import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityLevel = 'low' | 'moderate' | 'high';
export type TrainingGoal = 'Build strength' | 'Build muscle' | 'Maintain' | 'Lose fat';

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
  updateProfile: (changes: Partial<Omit<ProfileState, 'updateProfile' | 'resetProfile' | 'updatedAt'>>) => void;
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
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      ...defaultProfile,
      updateProfile: (changes) => set((state) => ({ ...state, ...changes, updatedAt: Date.now() })),
      resetProfile: () => set({ ...defaultProfile, updatedAt: Date.now() }),
    }),
    {
      name: 'ironlog-profile',
    }
  )
);
