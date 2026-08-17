import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityLevel = 'low' | 'moderate' | 'high';
export type TrainingGoal = 'Build strength' | 'Build muscle' | 'Maintain' | 'Lose fat';

export const PROFILE_FIELDS = ['weightKg', 'heightCm', 'age', 'goal', 'activityLevel', 'notes'] as const;
type ProfileField = (typeof PROFILE_FIELDS)[number];

export interface ProfileState {
  weightKg: number;
  heightCm: number;
  age: number;
  goal: TrainingGoal;
  activityLevel: ActivityLevel;
  notes: string;
  // 0 means "never edited locally" — lets a pulled remote profile always win over an
  // untouched default instead of being compared against a real last-write-wins timestamp.
  updatedAt: number;
  // Per-field edit timestamps, so sync can merge column-by-column instead of one whole
  // row clobbering another — see src/sync/fieldMerge.ts.
  fieldUpdatedAt: Partial<Record<ProfileField, number>>;
  updateProfile: (changes: Partial<Pick<ProfileState, ProfileField>>) => void;
  resetProfile: () => void;
}

const defaultProfile = {
  weightKg: 75,
  heightCm: 175,
  age: 28,
  goal: 'Build muscle' as TrainingGoal,
  activityLevel: 'moderate' as ActivityLevel,
  notes: '',
  updatedAt: 0,
  fieldUpdatedAt: {} as Partial<Record<ProfileField, number>>,
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      ...defaultProfile,
      updateProfile: (changes) => set((state) => {
        const now = Date.now();
        const fieldUpdatedAt = { ...state.fieldUpdatedAt };
        for (const key of Object.keys(changes) as ProfileField[]) fieldUpdatedAt[key] = now;
        return { ...state, ...changes, updatedAt: now, fieldUpdatedAt };
      }),
      resetProfile: () => {
        const now = Date.now();
        const fieldUpdatedAt = Object.fromEntries(PROFILE_FIELDS.map(f => [f, now])) as Record<ProfileField, number>;
        set({ ...defaultProfile, updatedAt: now, fieldUpdatedAt });
      },
    }),
    {
      name: 'ironlog-profile',
      // Backfills updatedAt/fieldUpdatedAt for profiles saved before those fields
      // existed, so real pre-existing values read as "customized" (and get pushed /
      // merged correctly) instead of looking untouched forever just because they
      // predate these fields. Runs regardless of which prior shape is on disk.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<ProfileState> & Record<string, unknown>;
        const updatedAt = (state.updatedAt as number) || Date.now();
        const fieldUpdatedAt = (state.fieldUpdatedAt as Record<ProfileField, number> | undefined)
          ?? Object.fromEntries(PROFILE_FIELDS.map(f => [f, updatedAt])) as Record<ProfileField, number>;
        return { ...defaultProfile, ...state, updatedAt, fieldUpdatedAt } as ProfileState;
      },
    }
  )
);
