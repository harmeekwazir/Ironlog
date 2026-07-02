import { create } from 'zustand';

export type Page = 'dashboard' | 'workout' | 'history' | 'exercises' | 'analytics' | 'settings' | 'profile' | 'suggested';

interface NavState {
  page: Page;
  setPage: (page: Page) => void;
  // Sub-navigation
  selectedWorkoutId: string | null;
  selectedExerciseId: string | null;
  setSelectedWorkout: (id: string | null) => void;
  setSelectedExercise: (id: string | null) => void;
}

export const useNav = create<NavState>((set) => ({
  page: 'dashboard',
  setPage: (page) => set({ page }),
  selectedWorkoutId: null,
  selectedExerciseId: null,
  setSelectedWorkout: (id) => set({ selectedWorkoutId: id }),
  setSelectedExercise: (id) => set({ selectedExerciseId: id }),
}));
