import { supabase } from '../lib/supabase';
import { useSettings, SETTINGS_FIELDS } from '../store/settings';
import { toRow, fromRow } from './transform';
import { mergeFields, type FieldSyncable } from './fieldMerge';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

interface SyncedSettings extends FieldSyncable {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

// Same shape as src/sync/profile.ts — see that file for why lastSyncedUpdatedAt exists
// (prevents an unconditional re-push-on-every-cycle feedback loop) and why the merge is
// field-level rather than whole-row.
let lastSyncedUpdatedAt = 0;

export async function pushSettings(userId: string) {
  const client = requireSupabase();
  const { soundEnabled, hapticsEnabled, updatedAt, fieldUpdatedAt } = useSettings.getState();
  if (!updatedAt || updatedAt <= lastSyncedUpdatedAt) return;
  const row = toRow({ userId, soundEnabled, hapticsEnabled, updatedAt, fieldUpdatedAt });
  const { data, error } = await client.from('settings').upsert(row).select().maybeSingle();
  if (error) throw error;
  if (data) {
    const remote = fromRow<{ updatedAt: number }>(data);
    lastSyncedUpdatedAt = remote.updatedAt;
    useSettings.setState({ updatedAt: remote.updatedAt });
  }
}

export async function pullSettings(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client.from('settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return;

  const remote = fromRow<SyncedSettings>(data);
  const local = useSettings.getState();
  const { patch, changed } = mergeFields(local, remote, SETTINGS_FIELDS);
  if (changed) useSettings.setState(patch);
  lastSyncedUpdatedAt = Math.max(lastSyncedUpdatedAt, remote.updatedAt);
}
