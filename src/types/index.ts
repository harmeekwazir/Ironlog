export type SetType =
  | 'warmup'
  | 'working'
  | 'failure'
  | 'dropset'
  | 'superset'
  | 'amrap'
  | 'tempo'
  | 'assisted'
  | 'partial';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'bands'
  | 'other';

export interface WorkoutSet {
  id: string;
  type: SetType;
  weight: number; // kg
  reps: number;
  rpe?: number; // 1–10
  notes?: string;
  restSeconds?: number;
  completed: boolean;
  completedAt?: number;
  // Tempo: eccentric-pause-concentric
  tempo?: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  restSeconds?: number;
  order: number;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  completedAt?: number;
  exercises: WorkoutExercise[];
  notes?: string;
  totalVolume?: number;
  isTemplate?: boolean;
  templateId?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
  category: MuscleGroup;
  notes?: string;
  isCustom?: boolean;
  createdAt: number;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  type: 'weight' | 'reps' | 'volume' | 'estimated1rm';
  value: number;
  reps?: number;
  weight?: number;
  workoutId: string;
  achievedAt: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: {
    exerciseId: string;
    sets: number;
    targetReps: string;
    restSeconds: number;
    type: SetType;
  }[];
  createdAt: number;
  lastUsed?: number;
}

export type ActiveSet = WorkoutSet & {
  exerciseIndex: number;
  setIndex: number;
};
