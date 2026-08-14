import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

export const useSyncStatus = create<SyncState>(() => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,
}));
