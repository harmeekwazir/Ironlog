import Dexie, { type Table } from 'dexie';
import type { Workout, Exercise, PersonalRecord, WorkoutTemplate } from '../types';

class IronLogDB extends Dexie {
  workouts!: Table<Workout>;
  exercises!: Table<Exercise>;
  personalRecords!: Table<PersonalRecord>;
  templates!: Table<WorkoutTemplate>;

  constructor() {
    super('IronLogDB');
    this.version(1).stores({
      workouts: 'id, startedAt, completedAt, isTemplate',
      exercises: 'id, name, category, isCustom',
      personalRecords: 'id, exerciseId, type, achievedAt',
      templates: 'id, name, createdAt',
    });
  }
}

export const db = new IronLogDB();

// Seed default exercises
export async function seedExercises() {
  const count = await db.exercises.count();
  if (count > 0) return;

  const now = Date.now();
  const defaults: Exercise[] = [
    // Chest
    { id: 'ex-001', name: 'Barbell Bench Press', muscleGroups: ['chest', 'shoulders', 'arms'], equipment: ['barbell'], category: 'chest', isCustom: false, createdAt: now },
    { id: 'ex-002', name: 'Incline Dumbbell Press', muscleGroups: ['chest', 'shoulders'], equipment: ['dumbbell'], category: 'chest', isCustom: false, createdAt: now },
    { id: 'ex-003', name: 'Dumbbell Flyes', muscleGroups: ['chest'], equipment: ['dumbbell'], category: 'chest', isCustom: false, createdAt: now },
    { id: 'ex-004', name: 'Cable Crossover', muscleGroups: ['chest'], equipment: ['cable'], category: 'chest', isCustom: false, createdAt: now },
    { id: 'ex-005', name: 'Push-ups', muscleGroups: ['chest', 'shoulders', 'arms'], equipment: ['bodyweight'], category: 'chest', isCustom: false, createdAt: now },
    { id: 'ex-006', name: 'Dips', muscleGroups: ['chest', 'arms'], equipment: ['bodyweight'], category: 'chest', isCustom: false, createdAt: now },
    // Back
    { id: 'ex-007', name: 'Deadlift', muscleGroups: ['back', 'legs'], equipment: ['barbell'], category: 'back', isCustom: false, createdAt: now },
    { id: 'ex-008', name: 'Pull-ups', muscleGroups: ['back', 'arms'], equipment: ['bodyweight'], category: 'back', isCustom: false, createdAt: now },
    { id: 'ex-009', name: 'Barbell Row', muscleGroups: ['back', 'arms'], equipment: ['barbell'], category: 'back', isCustom: false, createdAt: now },
    { id: 'ex-010', name: 'Lat Pulldown', muscleGroups: ['back', 'arms'], equipment: ['cable'], category: 'back', isCustom: false, createdAt: now },
    { id: 'ex-011', name: 'Seated Cable Row', muscleGroups: ['back'], equipment: ['cable'], category: 'back', isCustom: false, createdAt: now },
    { id: 'ex-012', name: 'T-Bar Row', muscleGroups: ['back'], equipment: ['barbell'], category: 'back', isCustom: false, createdAt: now },
    // Legs
    { id: 'ex-013', name: 'Barbell Squat', muscleGroups: ['legs'], equipment: ['barbell'], category: 'legs', isCustom: false, createdAt: now },
    { id: 'ex-014', name: 'Romanian Deadlift', muscleGroups: ['legs', 'back'], equipment: ['barbell'], category: 'legs', isCustom: false, createdAt: now },
    { id: 'ex-015', name: 'Leg Press', muscleGroups: ['legs'], equipment: ['machine'], category: 'legs', isCustom: false, createdAt: now },
    { id: 'ex-016', name: 'Leg Extension', muscleGroups: ['legs'], equipment: ['machine'], category: 'legs', isCustom: false, createdAt: now },
    { id: 'ex-017', name: 'Leg Curl', muscleGroups: ['legs'], equipment: ['machine'], category: 'legs', isCustom: false, createdAt: now },
    { id: 'ex-018', name: 'Calf Raise', muscleGroups: ['legs'], equipment: ['machine'], category: 'legs', isCustom: false, createdAt: now },
    { id: 'ex-019', name: 'Bulgarian Split Squat', muscleGroups: ['legs'], equipment: ['dumbbell'], category: 'legs', isCustom: false, createdAt: now },
    // Shoulders
    { id: 'ex-020', name: 'Overhead Press', muscleGroups: ['shoulders', 'arms'], equipment: ['barbell'], category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-021', name: 'Dumbbell Shoulder Press', muscleGroups: ['shoulders'], equipment: ['dumbbell'], category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-022', name: 'Lateral Raises', muscleGroups: ['shoulders'], equipment: ['dumbbell'], category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-023', name: 'Face Pulls', muscleGroups: ['shoulders', 'back'], equipment: ['cable'], category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-024', name: 'Rear Delt Flyes', muscleGroups: ['shoulders', 'back'], equipment: ['dumbbell'], category: 'shoulders', isCustom: false, createdAt: now },
    // Arms
    { id: 'ex-025', name: 'Barbell Curl', muscleGroups: ['arms'], equipment: ['barbell'], category: 'arms', isCustom: false, createdAt: now },
    { id: 'ex-026', name: 'Dumbbell Curl', muscleGroups: ['arms'], equipment: ['dumbbell'], category: 'arms', isCustom: false, createdAt: now },
    { id: 'ex-027', name: 'Hammer Curl', muscleGroups: ['arms'], equipment: ['dumbbell'], category: 'arms', isCustom: false, createdAt: now },
    { id: 'ex-028', name: 'Tricep Pushdown', muscleGroups: ['arms'], equipment: ['cable'], category: 'arms', isCustom: false, createdAt: now },
    { id: 'ex-029', name: 'Skull Crushers', muscleGroups: ['arms'], equipment: ['barbell'], category: 'arms', isCustom: false, createdAt: now },
    { id: 'ex-030', name: 'Close Grip Bench Press', muscleGroups: ['arms', 'chest'], equipment: ['barbell'], category: 'arms', isCustom: false, createdAt: now },
    // Core
    { id: 'ex-031', name: 'Plank', muscleGroups: ['core'], equipment: ['bodyweight'], category: 'core', isCustom: false, createdAt: now },
    { id: 'ex-032', name: 'Cable Crunch', muscleGroups: ['core'], equipment: ['cable'], category: 'core', isCustom: false, createdAt: now },
    { id: 'ex-033', name: 'Hanging Leg Raise', muscleGroups: ['core'], equipment: ['bodyweight'], category: 'core', isCustom: false, createdAt: now },
    { id: 'ex-034', name: 'Ab Wheel Rollout', muscleGroups: ['core'], equipment: ['other'], category: 'core', isCustom: false, createdAt: now },
  ];

  await db.exercises.bulkAdd(defaults);
}
