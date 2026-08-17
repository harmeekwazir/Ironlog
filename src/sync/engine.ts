import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { db, type SyncQueueEntry, type SyncTableName } from '../db';
import { useAuth } from '../store/auth';
import { useSyncStatus } from '../store/sync';
import { withSyncSuppressed } from './outbox';
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

// Drains the outbox for one table: every queued create/update collapses to a single
// upsert of the record's *current* Dexie state (the queue only tracks which ids
// changed, not payloads, so it's always the freshest state that gets pushed).
// Deletes are pushed as a tombstone update, not a real delete — see migration notes.
async function pushTable(userId: string, table: SyncTableName) {
  const client = requireSupabase();
  const entries = await db.syncQueue.where('table').equals(table).toArray();
  if (entries.length === 0) return;

  const latestByRecord = new Map<string, SyncQueueEntry>();
  for (const entry of entries) latestByRecord.set(entry.recordId, entry);

  const supaTable = SUPABASE_TABLE[table];
  const upsertEntries = [...latestByRecord.values()].filter((e) => e.op === 'upsert');
  const deleteEntries = [...latestByRecord.values()].filter((e) => e.op === 'delete');

  for (let i = 0; i < upsertEntries.length; i += PUSH_BATCH_SIZE) {
    const batch = upsertEntries.slice(i, i + PUSH_BATCH_SIZE);
    const records = await Promise.all(batch.map((e) => db.table(table).get(e.recordId)));
    const rows = records
      .filter((r): r is Record<string, unknown> => r != null)
      .map((r) => toRow({ ...r, userId }));
    if (rows.length === 0) continue;
    // Deliberately not reading back the server-assigned updated_at here: the pull
    // cursor is driven entirely by what the server returns during pullTable, never by
    // this device's local copy, so there's nothing that actually depends on the local
    // record matching the server's timestamp. Writing it back would mean touching a
    // Dexie table the outbox hooks are watching, right after processing that table's
    // own outbox — a needless feedback loop for no functional benefit.
    const { error } = await client.from(supaTable).upsert(rows);
    if (error) throw error;
  }

  for (const entry of deleteEntries) {
    // update(), not delete()/upsert(): a plain delete would leave other devices'
    // pull cursor unable to see the change, and a full-row upsert would fail NOT NULL
    // constraints for a record that was created and deleted before it ever synced.
    const { error } = await client
      .from(supaTable)
      .update({ deleted_at: entry.updatedAt, updated_at: entry.updatedAt })
      .eq('id', entry.recordId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  await db.syncQueue.bulkDelete(entries.map((e) => e.localId!));
}

// Pulls the user's *entire* current set of rows for this table and applies it locally —
// deliberately not an incremental "only what's newer than my last cursor" fetch. An
// earlier cursor-based version tracked a per-table watermark in db.syncMeta, but that
// watermark turned out to be a recurring source of silent, hard-to-diagnose staleness
// (get it stuck ahead of real data once — clock skew, a broken test run, anything — and
// every future pull silently fetches nothing, forever, with no error). Profile/settings
// sync never had this problem because they always fetch their one current row fresh.
// Applying that same always-fetch-everything approach here trades some bandwidth
// (irrelevant at personal-workout-history scale) for that same reliability: every pull
// is a full, self-correcting resync, not a delta that can drift out of sync with reality.
// Rows with a deleted_at tombstone are applied as a local hard-delete instead of an upsert.
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

// One-time upload of everything already on this device, run the first time a user
// signs in — the outbox is empty for pre-existing records since hooks only fire on
// writes going forward, so this bypasses the queue and reads local tables directly.
async function pushAll(userId: string) {
  const client = requireSupabase();

  async function pushAllForTable(table: SyncTableName) {
    const supaTable = SUPABASE_TABLE[table];
    let records = (await db.table(table).toArray()) as Record<string, unknown>[];
    if (table === 'exercises') records = records.filter((r) => r.isCustom);
    if (records.length === 0) return;

    for (let i = 0; i < records.length; i += PUSH_BATCH_SIZE) {
      const batch = records.slice(i, i + PUSH_BATCH_SIZE).map((r) => toRow({ ...r, userId }));
      const { error } = await client.from(supaTable).upsert(batch);
      if (error) throw error;
    }
  }

  await Promise.all([
    ...SYNC_TABLES.map(pushAllForTable),
    pushProfile(userId),
    pushSettings(userId),
  ]);
}

function initialSyncKey(userId: string) {
  return `ironlog:initial-sync:${userId}`;
}

async function ensureInitialSync(userId: string) {
  const key = initialSyncKey(userId);
  if (localStorage.getItem(key)) return;
  await pushAll(userId);
  localStorage.setItem(key, '1');
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
      ...SYNC_TABLES.map((table) => pushTable(userId, table)),
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

async function handleSignedIn(userId: string) {
  try {
    await ensureInitialSync(userId);
  } catch (err) {
    // Don't let a failed one-time backfill permanently block ongoing sync — fall
    // through to triggerSync()/startInterval() so the outbox can still drain and
    // future edits keep syncing even if the historical upload needs a retry later.
    console.error('[sync] initial sync failed', err);
    useSyncStatus.setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
  triggerSync();
  startInterval();
  subscribeRealtime(userId);
}

/** Manually kick off a sync — used by the "Sync now" button in Settings. */
export function syncNow() {
  triggerSync();
}

// Re-runs the one-time historical push directly (in case it never completed) and
// triggers a fresh sync. Table pulls are already a full resync every time (see
// pullTable), so this mainly matters for recovering a device whose initial upload
// failed partway. Note: clearing the initial-sync flag alone wouldn't be enough —
// that flag is only ever consulted from handleSignedIn, on an actual sign-in
// transition, so a plain triggerSync() afterwards wouldn't have re-run the push.
export async function forceFullResync() {
  const { status, user } = useAuth.getState();
  if (status !== 'signed-in' || !user) return;
  try {
    await pushAll(user.id);
    localStorage.setItem(initialSyncKey(user.id), '1');
  } catch (err) {
    console.error('[sync] forceFullResync push failed', err);
    useSyncStatus.setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
  triggerSync();
}

/** Wires the sync engine to auth state and network/visibility triggers. Call once at app startup. */
export function startSyncEngine() {
  if (!supabase) return;

  let previousUserId: string | null = useAuth.getState().user?.id ?? null;
  useAuth.subscribe((state) => {
    const userId = state.user?.id ?? null;
    if (state.status === 'signed-in' && userId && userId !== previousUserId) {
      void handleSignedIn(userId);
    }
    if (state.status === 'signed-out' && previousUserId !== null) {
      stopInterval();
      unsubscribeRealtime();
      useSyncStatus.setState({ status: 'idle', lastSyncedAt: null, error: null });
    }
    previousUserId = userId;
  });

  const initial = useAuth.getState();
  if (initial.status === 'signed-in' && initial.user) void handleSignedIn(initial.user.id);

  window.addEventListener('online', () => triggerSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerSync();
  });
}
