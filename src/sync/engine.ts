import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { db, type SyncTableName } from '../db';
import { useAuth } from '../store/auth';
import { useSyncStatus } from '../store/sync';
import { useProfile } from '../store/profile';
import { useSettings } from '../store/settings';
import { withSyncSuppressed, onLocalChange } from './outbox';
import { SYNC_TABLES, SUPABASE_TABLE } from './tables';
import { toRow, fromRow } from './transform';
import { pushProfile, pullProfile } from './profile';
import { pushSettings, pullSettings } from './settings';

const PUSH_BATCH_SIZE = 50;
const PULL_PAGE_SIZE = 500;
// Realtime (see subscribeRealtime below) is what makes sync near-instant; this interval
// is just a fallback safety net in case a realtime event is missed or the socket drops.
const SYNC_INTERVAL_MS = 3 * 60_000;
const REALTIME_DEBOUNCE_MS = 500;

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// Which tables have a real local change since they were last successfully pushed.
// Seeded to "everything" on each sign-in (see handleSignedIn) so the first sync of a
// session still uploads any pre-existing local-only data, then drained incrementally
// as pushTableFull succeeds and refilled as outbox.ts reports genuine local edits.
//
// This gate is load-bearing, not an optimization: pushing an unchanged table would
// still re-upsert every row, and the server trigger stamps a fresh updated_at on every
// write regardless of whether the values actually differ — which would generate a
// realtime event, which would trigger another sync, forever. Skipping the push when
// there's nothing new is what keeps "sync on every change" from becoming "sync
// constantly regardless of changes."
let dirtyTables = new Set<SyncTableName>();

// Pushes this table's *entire* current local state — not a diff against some "what
// changed since last push" queue. An earlier version tracked pending upserts in an
// outbox and only pushed those, but that diffing state was a repeated source of drift
// (an edit that, for whatever reason, never made it into the queue correctly would just
// silently never sync — the exact failure mode "Force full re-sync" was built to route
// around by bypassing the queue entirely and pushing everything). Doing that on every
// regular sync removes the class of bug rather than papering over the next instance of
// it; the dirtyTables gate above is what keeps "every push is a full push" from also
// meaning "every sync cycle writes, whether or not anything changed."
//
// Deletions are the one thing a full-table scan can't detect on its own — a deleted
// record is, by definition, absent from "push everything currently here" — so pending
// tombstones are read from the small delete-only queue outbox.ts maintains, independent
// of the dirty flag (that queue is naturally empty when there's nothing to delete).
async function pushTableFull(userId: string, table: SyncTableName) {
  const client = requireSupabase();
  const supaTable = SUPABASE_TABLE[table];

  if (dirtyTables.has(table)) {
    let records = (await db.table(table).toArray()) as Record<string, unknown>[];
    if (table === 'exercises') records = records.filter((r) => r.isCustom);

    for (let i = 0; i < records.length; i += PUSH_BATCH_SIZE) {
      const batch = records.slice(i, i + PUSH_BATCH_SIZE).map((r) => toRow({ ...r, userId }));
      if (batch.length === 0) continue;
      const { error } = await client.from(supaTable).upsert(batch);
      if (error) throw error;
    }
    // Only cleared after every batch above succeeded — if any upsert throws, this line
    // is never reached, so the table stays dirty and the next sync retries the push.
    dirtyTables.delete(table);
  }

  const deleteEntries = await db.syncQueue.where('table').equals(table).toArray();
  for (const entry of deleteEntries) {
    // update(), not delete(): a plain delete would leave other devices' pull unable to
    // see the change (they only ever see what's currently there, tombstone or not).
    const { error } = await client
      .from(supaTable)
      .update({ deleted_at: entry.updatedAt, updated_at: entry.updatedAt })
      .eq('id', entry.recordId)
      .eq('user_id', userId);
    if (error) throw error;
  }
  if (deleteEntries.length) await db.syncQueue.bulkDelete(deleteEntries.map((e) => e.localId!));
}

// Pulls the user's entire current set of rows for this table and applies it locally —
// same "always full, never an incremental diff" reasoning as the push side above; see
// that comment. Rows with a deleted_at tombstone are applied as a local hard-delete.
async function pullTable(userId: string, table: SyncTableName) {
  const client = requireSupabase();
  const supaTable = SUPABASE_TABLE[table];

  const allRows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PULL_PAGE_SIZE) {
    const { data, error } = await client
      .from(supaTable)
      .select('*')
      .eq('user_id', userId)
      .range(from, from + PULL_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as Record<string, unknown>[]));
    if (data.length < PULL_PAGE_SIZE) break;
  }

  const toUpsert: Record<string, unknown>[] = [];
  const toDelete: string[] = [];
  for (const row of allRows) {
    const record = fromRow<Record<string, unknown> & { id: string; deletedAt?: number }>(row);
    if (record.deletedAt) toDelete.push(record.id);
    else toUpsert.push(record);
  }

  await withSyncSuppressed(async () => {
    if (toUpsert.length) await db.table(table).bulkPut(toUpsert);
    if (toDelete.length) await db.table(table).bulkDelete(toDelete);
  });
}

let syncing = false;

async function runSync(userId: string) {
  if (syncing) return;
  syncing = true;
  useSyncStatus.setState({ status: 'syncing', error: null });
  try {
    // Push must fully finish before pull starts (so a pull can't clobber a local edit
    // that hasn't reached the server yet), but within each phase every table is an
    // independent request — no reason to wait for workouts before starting exercises.
    await Promise.all([
      ...SYNC_TABLES.map((table) => pushTableFull(userId, table)),
      pushProfile(userId),
      pushSettings(userId),
    ]);
    await Promise.all([
      ...SYNC_TABLES.map((table) => pullTable(userId, table)),
      pullProfile(userId),
      pullSettings(userId),
    ]);
    useSyncStatus.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null });
  } catch (err) {
    console.error('[sync] runSync failed', err);
    useSyncStatus.setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    syncing = false;
  }
}

let intervalId: number | undefined;

function stopInterval() {
  if (intervalId !== undefined) {
    window.clearInterval(intervalId);
    intervalId = undefined;
  }
}

function startInterval() {
  stopInterval();
  intervalId = window.setInterval(() => triggerSync(), SYNC_INTERVAL_MS);
}

function triggerSync() {
  const { status, user } = useAuth.getState();
  if (status !== 'signed-in' || !user) return;
  if (!navigator.onLine) {
    useSyncStatus.setState({ status: 'offline' });
    return;
  }
  void runSync(user.id);
}

let localChangeDebounceId: number | undefined;

// Fires whenever *this* device makes a local edit — a Dexie write, or a
// profile/settings store change (those don't go through Dexie at all, being separate
// Zustand+localStorage stores). The edit itself is what should start the flush timer,
// not just external signals like another device's realtime notification or the
// fallback interval — without this, a change made here could sit local-only for up to
// SYNC_INTERVAL_MS before anything pushed it.
function scheduleSyncSoon() {
  window.clearTimeout(localChangeDebounceId);
  localChangeDebounceId = window.setTimeout(() => triggerSync(), REALTIME_DEBOUNCE_MS);
}

let realtimeChannel: RealtimeChannel | null = null;
let realtimeDebounceId: number | undefined;

// Subscribes to Postgres Changes (Supabase's realtime feed off the WAL) for every
// synced table, scoped to this user's own rows. Any insert/update/delete — from any
// device — wakes up a sync almost immediately instead of waiting for the next poll.
// Debounced because finishing a workout can touch several rows (the workout itself
// plus any new PRs) in quick succession, which would otherwise fire several syncs back
// to back for what's really one logical change.
function subscribeRealtime(userId: string) {
  if (!supabase) return;
  unsubscribeRealtime();

  const onChange = (payload: { table: string; eventType: string }) => {
    console.log('[realtime] change received:', payload.table, payload.eventType);
    window.clearTimeout(realtimeDebounceId);
    realtimeDebounceId = window.setTimeout(() => triggerSync(), REALTIME_DEBOUNCE_MS);
  };

  let channel = supabase.channel(`sync:${userId}`);
  for (const table of Object.values(SUPABASE_TABLE)) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      onChange,
    );
  }
  channel = channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
    onChange,
  );
  channel = channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${userId}` },
    onChange,
  );
  channel.subscribe((status, err) => {
    console.log('[realtime] subscription status:', status, err ?? '');
  });
  realtimeChannel = channel;
}

function unsubscribeRealtime() {
  window.clearTimeout(realtimeDebounceId);
  if (realtimeChannel) {
    void realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
}

function handleSignedIn(userId: string) {
  // No separate "one-time historical upload" step needed anymore: marking every table
  // dirty here means the first sync of this session pushes everything, same as any
  // other push — there's nothing a special first-run path would do differently, and
  // this also correctly re-seeds if a different user signs in during the same session.
  dirtyTables = new Set(SYNC_TABLES);
  triggerSync();
  startInterval();
  subscribeRealtime(userId);
}

/** Manually kick off a sync — used by the "Sync now" button in Settings. */
export function syncNow() {
  triggerSync();
}

/**
 * Like a normal sync, but forces every table to actually push its full state even if
 * nothing local has changed since the last successful push — useful if a device's data
 * is suspected to have drifted for some reason and you want to force-reconcile rather
 * than wait for the next genuine edit.
 */
export function forceFullResync() {
  dirtyTables = new Set(SYNC_TABLES);
  triggerSync();
}

/** Wires the sync engine to auth state and network/visibility triggers. Call once at app startup. */
export function startSyncEngine() {
  if (!supabase) return;

  let previousUserId: string | null = useAuth.getState().user?.id ?? null;
  useAuth.subscribe((state) => {
    const userId = state.user?.id ?? null;
    if (state.status === 'signed-in' && userId && userId !== previousUserId) {
      handleSignedIn(userId);
    }
    if (state.status === 'signed-out' && previousUserId !== null) {
      stopInterval();
      unsubscribeRealtime();
      useSyncStatus.setState({ status: 'idle', lastSyncedAt: null, error: null });
    }
    previousUserId = userId;
  });

  const initial = useAuth.getState();
  if (initial.status === 'signed-in' && initial.user) handleSignedIn(initial.user.id);

  window.addEventListener('online', () => triggerSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerSync();
  });

  onLocalChange((table) => {
    dirtyTables.add(table);
    scheduleSyncSoon();
  });
  useProfile.subscribe((state, prevState) => {
    if (state.updatedAt !== prevState.updatedAt) scheduleSyncSoon();
  });
  useSettings.subscribe((state, prevState) => {
    if (state.updatedAt !== prevState.updatedAt) scheduleSyncSoon();
  });
}
