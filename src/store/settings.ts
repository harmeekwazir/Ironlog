import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const SETTINGS_FIELDS = ['soundEnabled', 'hapticsEnabled'] as const;
type SettingsField = (typeof SETTINGS_FIELDS)[number];

interface SettingsState {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  updatedAt: number;
  // Per-field edit timestamps for delta merging — see src/sync/fieldMerge.ts.
  fieldUpdatedAt: Partial<Record<SettingsField, number>>;
}

const defaults = { soundEnabled: true, hapticsEnabled: true, updatedAt: 0, fieldUpdatedAt: {} as Partial<Record<SettingsField, number>> };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setSoundEnabled: (enabled) => set((state) => ({
        soundEnabled: enabled,
        updatedAt: Date.now(),
        fieldUpdatedAt: { ...state.fieldUpdatedAt, soundEnabled: Date.now() },
      })),
      setHapticsEnabled: (enabled) => set((state) => ({
        hapticsEnabled: enabled,
        updatedAt: Date.now(),
        fieldUpdatedAt: { ...state.fieldUpdatedAt, hapticsEnabled: Date.now() },
      })),
    }),
    {
      name: 'ironlog-settings',
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<SettingsState> & Record<string, unknown>;
        const updatedAt = (state.updatedAt as number) || Date.now();
        const fieldUpdatedAt = (state.fieldUpdatedAt as Record<SettingsField, number> | undefined)
          ?? Object.fromEntries(SETTINGS_FIELDS.map(f => [f, updatedAt])) as Record<SettingsField, number>;
        return { ...defaults, ...state, updatedAt, fieldUpdatedAt } as SettingsState;
      },
    }
  )
);
