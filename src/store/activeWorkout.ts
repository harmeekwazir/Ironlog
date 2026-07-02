import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Exercise, ReadinessCheck, Workout, WorkoutExercise, WorkoutSet, WorkoutTemplate } from '../types';
import { generateId, calcWorkoutVolume, calcMuscleStress, calcSessionWorkload, estimate1RM } from '../utils';
import { playSetComplete } from '../utils/sound';
import { hapticSetComplete } from '../utils/haptics';
import { db } from '../db';

interface ActiveWorkoutState {
  workout: Workout | null;
  restTimer: {
    active: boolean;
    startedAt: number;
    duration: number; // seconds
    exerciseId?: string;
  } | null;

  // Actions
  startWorkout: (name?: string, readiness?: ReadinessCheck, template?: WorkoutTemplate) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (exerciseIndex: number) => void;
  reorderExercises: (from: number, to: number) => void;
  addSet: (exerciseIndex: number, type?: WorkoutSet['type']) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  setExerciseNotes: (exerciseIndex: number, notes: string) => void;
  startRestTimer: (seconds: number, exerciseId?: string) => void;
  stopRestTimer: () => void;
  finishWorkout: (sessionRpe: number, exercises: Record<string, Exercise>) => Promise<{ workout: Workout; prCount: number } | null>;
  discardWorkout: () => void;
  updateWorkoutName: (name: string) => void;
}

export const useActiveWorkout = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      workout: null,
      restTimer: null,

      startWorkout: (name = 'Quick Workout', readiness, template) => {
        const workout: Workout = {
          id: generateId(),
          name: template?.name ?? name,
          startedAt: Date.now(),
          readinessId: readiness?.id,
          readinessScore: readiness?.score,
          recoveryMultiplier: readiness?.recoveryMultiplier,
          templateId: template?.id,
          exercises: template?.exercises.map((item, order) => ({
            id: generateId(),
            exerciseId: item.exerciseId,
            order,
            restSeconds: item.restSeconds,
            sets: Array.from({ length: item.sets }, () => ({
              id: generateId(),
              type: item.type,
              weight: 0,
              reps: Number.parseInt(item.targetReps) || 0,
              completed: false,
            })),
          })) ?? [],
        };
        set({ workout });
        if (template) void db.templates.update(template.id, { lastUsed: Date.now() });
      },

      addExercise: (exerciseId) => {
        const { workout } = get();
        if (!workout) return;
        const exercise: WorkoutExercise = {
          id: generateId(),
          exerciseId,
          sets: [
            {
              id: generateId(),
              type: 'working',
              weight: 0,
              reps: 0,
              completed: false,
            },
          ],
          order: workout.exercises.length,
        };
        set({
          workout: {
            ...workout,
            exercises: [...workout.exercises, exercise],
          },
        });
      },

      removeExercise: (exerciseIndex) => {
        const { workout } = get();
        if (!workout) return;
        const exercises = workout.exercises.filter((_, i) => i !== exerciseIndex);
        set({ workout: { ...workout, exercises } });
      },

      reorderExercises: (from, to) => {
        const { workout } = get();
        if (!workout) return;
        const exercises = [...workout.exercises];
        const [moved] = exercises.splice(from, 1);
        exercises.splice(to, 0, moved);
        set({ workout: { ...workout, exercises } });
      },

      addSet: (exerciseIndex, type = 'working') => {
        const { workout } = get();
        if (!workout) return;
        const exercises = [...workout.exercises];
        const exercise = { ...exercises[exerciseIndex] };
        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSet: WorkoutSet = {
          id: generateId(),
          type,
          weight: lastSet?.weight ?? 0,
          reps: lastSet?.reps ?? 0,
          completed: false,
        };
        exercise.sets = [...exercise.sets, newSet];
        exercises[exerciseIndex] = exercise;
        set({ workout: { ...workout, exercises } });
      },

      removeSet: (exerciseIndex, setIndex) => {
        const { workout } = get();
        if (!workout) return;
        const exercises = [...workout.exercises];
        const exercise = { ...exercises[exerciseIndex] };
        exercise.sets = exercise.sets.filter((_, i) => i !== setIndex);
        exercises[exerciseIndex] = exercise;
        set({ workout: { ...workout, exercises } });
      },

      updateSet: (exerciseIndex, setIndex, updates) => {
        const { workout } = get();
        if (!workout) return;
        const exercises = [...workout.exercises];
        const exercise = { ...exercises[exerciseIndex] };
        const sets = [...exercise.sets];
        sets[setIndex] = { ...sets[setIndex], ...updates };
        exercise.sets = sets;
        exercises[exerciseIndex] = exercise;
        set({ workout: { ...workout, exercises } });
      },

      completeSet: (exerciseIndex, setIndex) => {
        const { workout, updateSet, startRestTimer } = get();
        if (!workout) return;
        const exercise = workout.exercises[exerciseIndex];
        const s = exercise.sets[setIndex];
        updateSet(exerciseIndex, setIndex, {
          completed: !s.completed,
          completedAt: !s.completed ? Date.now() : undefined,
        });
        if (!s.completed) {
          const restSeconds = exercise.restSeconds ?? 120;
          startRestTimer(restSeconds, exercise.exerciseId);
          playSetComplete();
          hapticSetComplete();
        }
      },

      setExerciseNotes: (exerciseIndex, notes) => {
        const { workout } = get();
        if (!workout) return;
        const exercises = [...workout.exercises];
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], notes };
        set({ workout: { ...workout, exercises } });
      },

      startRestTimer: (duration, exerciseId) => {
        set({ restTimer: { active: true, startedAt: Date.now(), duration, exerciseId } });
      },

      stopRestTimer: () => {
        set({ restTimer: null });
      },

      finishWorkout: async (sessionRpe, exercises) => {
        const { workout } = get();
        if (!workout) return null;
        const completedWorkout: Workout = {
          ...workout,
          completedAt: Date.now(),
          totalVolume: calcWorkoutVolume(workout),
          sessionRpe,
          workload: calcSessionWorkload(sessionRpe, Date.now() - workout.startedAt),
          muscleStress: calcMuscleStress(workout, exercises),
        };
        await db.workouts.put(completedWorkout);

        // Check and save PRs
        const prExerciseIds = new Set<string>();
        for (const exercise of completedWorkout.exercises) {
          const workingSets = exercise.sets.filter(s => s.completed && s.type !== 'warmup');
          if (workingSets.length === 0) continue;

          const bestSet = workingSets.reduce((best, s) =>
            s.weight > best.weight ? s : best, workingSets[0]);

          // Check weight PR
          const prevWeightPR = await db.personalRecords
            .where({ exerciseId: exercise.exerciseId, type: 'weight' })
            .sortBy('value');
          const prevBest = prevWeightPR[prevWeightPR.length - 1];
          if (!prevBest || bestSet.weight > prevBest.value) {
            await db.personalRecords.put({
              id: generateId(),
              exerciseId: exercise.exerciseId,
              type: 'weight',
              value: bestSet.weight,
              reps: bestSet.reps,
              weight: bestSet.weight,
              workoutId: completedWorkout.id,
              achievedAt: completedWorkout.completedAt!,
            });
            prExerciseIds.add(exercise.exerciseId);
          }

          // Check estimated 1RM PR
          const best1rm = workingSets.reduce((best, s) => Math.max(best, estimate1RM(s.weight, s.reps) ?? 0), 0);
          const prev1rmPRs = await db.personalRecords
            .where({ exerciseId: exercise.exerciseId, type: 'estimated1rm' })
            .sortBy('value');
          const prev1rm = prev1rmPRs[prev1rmPRs.length - 1];
          if (best1rm > 0 && (!prev1rm || best1rm > prev1rm.value)) {
            await db.personalRecords.put({
              id: generateId(),
              exerciseId: exercise.exerciseId,
              type: 'estimated1rm',
              value: Math.round(best1rm),
              workoutId: completedWorkout.id,
              achievedAt: completedWorkout.completedAt!,
            });
            prExerciseIds.add(exercise.exerciseId);
          }
        }

        set({ workout: null, restTimer: null });
        return { workout: completedWorkout, prCount: prExerciseIds.size };
      },

      discardWorkout: () => {
        set({ workout: null, restTimer: null });
      },

      updateWorkoutName: (name) => {
        const { workout } = get();
        if (!workout) return;
        set({ workout: { ...workout, name } });
      },
    }),
    {
      name: 'ironlog-active-workout',
    }
  )
);
