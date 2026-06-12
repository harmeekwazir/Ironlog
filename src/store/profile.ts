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
  updateProfile: (changes: Partial<Omit<ProfileState, 'updateProfile'>>) => void;
  resetProfile: () => void;
}

const defaultProfile = {
  weightKg: 75,
  heightCm: 175,
  age: 28,
  goal: 'Build muscle' as TrainingGoal,
  activityLevel: 'moderate' as ActivityLevel,
  notes: '',
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      ...defaultProfile,
      updateProfile: (changes) => set((state) => ({ ...state, ...changes })),
      resetProfile: () => set({ ...defaultProfile }),
    }),
    {
      name: 'ironlog-profile',
    }
  )
);
