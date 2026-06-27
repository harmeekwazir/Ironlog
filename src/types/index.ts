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
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'full_body'
  | 'full-body';

export type IndividualMuscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

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
  readinessId?: string;
  readinessScore?: number;
  recoveryMultiplier?: number;
  sessionRpe?: number;
  workload?: number;
  muscleStress?: Partial<Record<IndividualMuscle, number>>;
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
  sourceWorkoutId?: string;
}

export interface ReadinessCheck {
  id: string;
  date: string;
  sleep: number;
  soreness: number;
  energy: number;
  stress: number;
  motivation: number;
  score: number;
  recoveryMultiplier: number;
  createdAt: number;
}

export type ActiveSet = WorkoutSet & {
  exerciseIndex: number;
  setIndex: number;
};

export interface OverloadSuggestion {
  exerciseId: string;
  exerciseName: string;
  lastWeight: number;
  lastReps: number;
  suggestedWeight: number;
  suggestedReps: number;
  trend: 'improving' | 'stalled' | 'new' | 'deload';
  sessionCount: number;
  lastTrainedAt: number;
}
