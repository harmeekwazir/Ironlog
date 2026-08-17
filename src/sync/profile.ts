import { supabase } from '../lib/supabase';
import { useProfile, PROFILE_FIELDS, type ProfileState } from '../store/profile';
import { toRow, fromRow } from './transform';
import { mergeFields } from './fieldMerge';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// Profile lives in a Zustand+localStorage store, not Dexie, so it doesn't go through the
// outbox/hook pipeline the other tables use — it's a single row per user, so a plain
// push-current-state / pull-and-merge is simpler than routing it through Dexie.
//
// Tracks the updatedAt value we know the server already has, from either side of sync
// (a push we just did, or a pull that just applied). Without this, pushProfile would
// unconditionally re-upload on every sync cycle — including cycles triggered by
// realtime notifying this same device about its own previous write — and since the
// server trigger stamps a fresh updated_at on every write even for identical data,
// that alone creates a new realtime event, which triggers another sync, forever.
let lastSyncedUpdatedAt = 0;

export async function pushProfile(userId: string) {
  const client = requireSupabase();
  const state = useProfile.getState();
  if (!state.updatedAt || state.updatedAt <= lastSyncedUpdatedAt) return;
  const { updateProfile: _u, resetProfile: _r, ...fields } = state;
  const row = toRow({ ...fields, id: userId });
  // .select() to read back the server-assigned updated_at (a trigger overwrites
  // whatever we send) so this device's own copy doesn't keep using its own clock.
  const { data, error } = await client.from('profiles').upsert(row).select().maybeSingle();
  if (error) throw error;
  if (data) {
    const remote = fromRow<{ updatedAt: number }>(data);
    lastSyncedUpdatedAt = remote.updatedAt;
    useProfile.setState({ updatedAt: remote.updatedAt });
  }
}

export async function pullProfile(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return;

  const remote = fromRow<ProfileState>(data);
  const local = useProfile.getState();
  // Field-level merge, not whole-row: an edit to weight on this device and a different
  // edit to, say, notes on another device should both survive — see fieldMerge.ts.
  const { patch, changed } = mergeFields(local, remote, PROFILE_FIELDS);
  if (changed) useProfile.setState(patch);
  lastSyncedUpdatedAt = Math.max(lastSyncedUpdatedAt, remote.updatedAt);
}
