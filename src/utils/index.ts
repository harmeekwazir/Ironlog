import type { WorkoutSet, WorkoutExercise, Workout } from '../types';

// Epley formula for estimated 1RM
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function calcSetVolume(set: WorkoutSet): number {
  return set.weight * set.reps;
}

export function calcExerciseVolume(exercise: WorkoutExercise): number {
  return exercise.sets
    .filter(s => s.completed && s.type !== 'warmup')
    .reduce((sum, s) => sum + calcSetVolume(s), 0);
}

export function calcWorkoutVolume(workout: Workout): number {
  return workout.exercises.reduce((sum, e) => sum + calcExerciseVolume(e), 0);
}

export function formatWeight(kg: number): string {
  if (kg === 0) return '–';
  return `${kg} kg`;
}

export function calcBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  return weightKg / ((heightCm / 100) ** 2);
}

export function getBMICategory(bmi: number): string {
  if (bmi === 0) return 'Unknown';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export function estimateMaintenanceCalories(weightKg: number, heightCm: number, age: number, activityLevel: string): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const activity = activityLevel === 'high' ? 1.55 : activityLevel === 'moderate' ? 1.35 : 1.2;
  return Math.round(bmr * activity);
}

export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatRestTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getSetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    warmup: 'Warm-up',
    working: 'Working',
    failure: 'Failure',
    dropset: 'Drop Set',
    superset: 'Superset',
    amrap: 'AMRAP',
    tempo: 'Tempo',
    assisted: 'Assisted',
    partial: 'Partial',
  };
  return labels[type] || type;
}

export function getSetTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    warmup: 'text-blue-400 bg-blue-400/10',
    working: 'text-volt-400 bg-volt-400/10',
    failure: 'text-ember-400 bg-ember-400/10',
    dropset: 'text-purple-400 bg-purple-400/10',
    superset: 'text-orange-400 bg-orange-400/10',
    amrap: 'text-red-400 bg-red-400/10',
    tempo: 'text-cyan-400 bg-cyan-400/10',
    assisted: 'text-green-400 bg-green-400/10',
    partial: 'text-yellow-400 bg-yellow-400/10',
  };
  return colors[type] || 'text-iron-300 bg-iron-700';
}

export function getMuscleGroupColor(group: string): string {
  const colors: Record<string, string> = {
    chest: '#ff6b6b',
    back: '#4ecdc4',
    legs: '#45b7d1',
    shoulders: '#f9c74f',
    arms: '#f8961e',
    core: '#90be6d',
    cardio: '#9b5de5',
    full_body: '#f72585',
  };
  return colors[group] || '#a8a8a8';
}

export function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}
