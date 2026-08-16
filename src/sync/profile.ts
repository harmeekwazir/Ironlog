import { supabase } from '../lib/supabase';
import { useProfile, type ActivityLevel, type TrainingGoal } from '../store/profile';
import { toRow, fromRow } from './transform';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// Profile lives in a Zustand+localStorage store, not Dexie, so it doesn't go through the
// outbox/hook pipeline the other tables use — it's a single row per user, so a plain
// push-current-state / pull-and-compare-timestamps is simpler than routing it through Dexie.
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
  const { updateProfile: _u, resetProfile: _r, ...fields } = useProfile.getState();
  if (!fields.updatedAt) return; // never edited locally — nothing to push
  if (fields.updatedAt <= lastSyncedUpdatedAt) return; // already in sync, nothing new
  const row = toRow({ ...fields, id: userId });
  // .select() to read back the server-assigned updated_at (a trigger overwrites
  // whatever we send) so this device's own copy doesn't keep using its own clock.
  const { data, error } = await client.from('profiles').upsert(row).select().maybeSingle();
  if (error) throw error;
  if (data) {
    const remote = fromRow<RemoteProfile>(data);
    lastSyncedUpdatedAt = remote.updatedAt;
    useProfile.setState({ updatedAt: remote.updatedAt });
  }
}

interface RemoteProfile {
  weightKg?: number;
  heightCm?: number;
  age?: number;
  goal?: TrainingGoal;
  activityLevel?: ActivityLevel;
  notes?: string;
  updatedAt: number;
}

export async function pullProfile(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return;

  const remote = fromRow<RemoteProfile>(data);
  const local = useProfile.getState();
  if (remote.updatedAt > local.updatedAt) {
    useProfile.setState({
      weightKg: remote.weightKg ?? local.weightKg,
      heightCm: remote.heightCm ?? local.heightCm,
      age: remote.age ?? local.age,
      goal: remote.goal ?? local.goal,
      activityLevel: remote.activityLevel ?? local.activityLevel,
      notes: remote.notes ?? local.notes,
      updatedAt: remote.updatedAt,
    });
  }
  lastSyncedUpdatedAt = Math.max(lastSyncedUpdatedAt, remote.updatedAt);
}
