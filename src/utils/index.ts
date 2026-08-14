import type { Exercise, IndividualMuscle, MuscleGroup, MuscleSplit, OverloadSuggestion, PersonalRecord, ReadinessCheck, SuggestedExercise, WeeklyReport, WorkoutSet, WorkoutExercise, WorkoutSuggestion, Workout } from '../types';

export const INDIVIDUAL_MUSCLES: IndividualMuscle[] = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'lats',
  'upper_back', 'lower_back', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
];

export const MUSCLE_LABELS: Record<IndividualMuscle, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  lats: 'Lats',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
};

// Canonical push/pull/legs/core grouping — muscles conventionally trained in the same
// session. Shared by the recovery heatmap and the workout suggestion engine so "what
// belongs together" is defined in exactly one place.
export const MUSCLE_SPLITS: Record<MuscleSplit, IndividualMuscle[]> = {
  push: ['chest', 'front_delts', 'side_delts', 'triceps'],
  pull: ['lats', 'upper_back', 'rear_delts', 'biceps', 'forearms', 'lower_back'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  core: ['abs'],
};

export const SPLIT_LABELS: Record<MuscleSplit, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core' };

// Which Exercise.category values feed the exercise pool for each split. 'arms' is a
// catch-all category some exercises use for either biceps or triceps work, so it's a
// candidate for both push and pull rather than committed to one.
const SPLIT_CATEGORIES: Record<MuscleSplit, MuscleGroup[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'forearms'],
  legs: ['legs'],
  core: ['core'],
};

// Brzycki formula, intentionally shown only for sets at or above 10 reps.
export function estimate1RM(weight: number, reps: number): number | null {
  if (weight <= 0 || reps < 10 || reps >= 37) return null;
  return Math.round(weight * (36 / (37 - reps)));
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

export function calculateReadiness(inputs: Pick<ReadinessCheck, 'sleep' | 'soreness' | 'energy' | 'stress' | 'motivation'>) {
  const raw = (
    inputs.sleep * 0.25 +
    (6 - inputs.soreness) * 0.2 +
    inputs.energy * 0.25 +
    (6 - inputs.stress) * 0.15 +
    inputs.motivation * 0.15
  );
  const score = Math.round(Math.max(0, Math.min(100, raw * 20)));
  return {
    score,
    recoveryMultiplier: Number((0.7 + (score / 100) * 0.6).toFixed(2)),
  };
}

export function getReadinessLabel(score: number): string {
  if (score >= 85) return 'Primed';
  if (score >= 70) return 'Ready';
  if (score >= 50) return 'Manage load';
  return 'Recovery first';
}

export function calcSessionWorkload(sessionRpe: number, durationMs: number): number {
  return Math.round(sessionRpe * Math.max(1, durationMs / 60000));
}

export function getAcwr(workouts: Workout[], now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  const completed = workouts.filter(w => w.completedAt && w.workload);
  const acute = completed
    .filter(w => now - w.completedAt! <= 7 * day)
    .reduce((sum, w) => sum + (w.workload ?? 0), 0);
  const chronicTotal = completed
    .filter(w => now - w.completedAt! <= 28 * day)
    .reduce((sum, w) => sum + (w.workload ?? 0), 0);
  const chronicWeekly = chronicTotal / 4;
  const ratio = chronicWeekly > 0 ? acute / chronicWeekly : 0;
  const status = ratio === 0
    ? 'No baseline'
    : ratio < 0.8
      ? 'Underloaded'
      : ratio <= 1.3
        ? 'Sweet spot'
        : ratio <= 1.5
          ? 'Caution'
          : 'High spike';
  return { acute, chronicWeekly: Math.round(chronicWeekly), ratio, status };
}

const EXERCISE_MUSCLES: Record<string, Partial<Record<IndividualMuscle, number>>> = {
  // Chest — ex-001..ex-011
  'ex-001': { chest: 0.55, front_delts: 0.2, triceps: 0.25 },   // Barbell Bench Press
  'ex-002': { chest: 0.5, front_delts: 0.3, triceps: 0.2 },     // Incline Dumbbell Press
  'ex-003': { chest: 0.85, front_delts: 0.15 },                  // Dumbbell Flyes
  'ex-004': { chest: 0.9, front_delts: 0.1 },                    // Cable Crossover
  'ex-005': { chest: 0.5, front_delts: 0.2, triceps: 0.3 },     // Push-ups
  'ex-006': { chest: 0.35, front_delts: 0.15, triceps: 0.5 },   // Dips
  'ex-007': { chest: 0.5, front_delts: 0.3, triceps: 0.2 },     // Incline Barbell Bench Press
  'ex-008': { chest: 0.65, triceps: 0.25, front_delts: 0.1 },   // Decline Bench Press
  'ex-009': { chest: 0.75, front_delts: 0.15, triceps: 0.1 },   // Machine Chest Press
  'ex-010': { chest: 0.9, front_delts: 0.1 },                    // Pec Deck Fly
  'ex-011': { chest: 0.9, front_delts: 0.1 },                    // Single Arm Cable Fly
  // Back — ex-012..ex-022
  'ex-012': { glutes: 0.25, hamstrings: 0.2, lower_back: 0.2, upper_back: 0.15, forearms: 0.2 }, // Deadlift
  'ex-013': { lats: 0.55, biceps: 0.25, upper_back: 0.1, forearms: 0.1 },                        // Pull-ups
  'ex-014': { upper_back: 0.35, lats: 0.3, biceps: 0.2, rear_delts: 0.1, forearms: 0.05 },       // Barbell Row
  'ex-015': { lats: 0.55, biceps: 0.25, upper_back: 0.1, forearms: 0.1 },                        // Lat Pulldown
  'ex-016': { upper_back: 0.4, lats: 0.3, biceps: 0.2, rear_delts: 0.1 },                        // Seated Cable Row
  'ex-017': { upper_back: 0.4, lats: 0.3, biceps: 0.2, rear_delts: 0.1 },                        // T-Bar Row
  'ex-018': { upper_back: 0.45, lats: 0.3, rear_delts: 0.15, biceps: 0.1 },                      // Chest Supported Row
  'ex-019': { lats: 0.4, upper_back: 0.3, biceps: 0.2, rear_delts: 0.1 },                        // Single Arm Dumbbell Row
  'ex-020': { lats: 0.75, upper_back: 0.15, abs: 0.1 },                                           // Straight Arm Pulldown
  'ex-021': { upper_back: 0.4, lats: 0.3, biceps: 0.2, rear_delts: 0.1 },                        // Machine Row
  'ex-022': { upper_back: 0.4, lats: 0.35, rear_delts: 0.15, biceps: 0.1 },                      // Meadows Row
  // Legs — ex-023..ex-037
  'ex-023': { quads: 0.45, glutes: 0.3, hamstrings: 0.15, lower_back: 0.1 }, // Barbell Squat
  'ex-024': { hamstrings: 0.4, glutes: 0.3, lower_back: 0.2, forearms: 0.1 }, // Romanian Deadlift
  'ex-025': { quads: 0.55, glutes: 0.3, hamstrings: 0.15 },                   // Leg Press
  'ex-026': { quads: 1 },                                                       // Leg Extension
  'ex-027': { hamstrings: 1 },                                                  // Leg Curl
  'ex-028': { calves: 1 },                                                      // Calf Raise
  'ex-029': { quads: 0.45, glutes: 0.35, hamstrings: 0.2 },                   // Bulgarian Split Squat
  'ex-030': { quads: 0.55, glutes: 0.25, lower_back: 0.1, abs: 0.1 },         // Front Squat
  'ex-031': { quads: 0.6, glutes: 0.25, hamstrings: 0.15 },                   // Hack Squat
  'ex-032': { quads: 0.45, glutes: 0.35, hamstrings: 0.2 },                   // Walking Lunges
  'ex-033': { quads: 0.5, glutes: 0.3, hamstrings: 0.1, upper_back: 0.1 },   // Goblet Squat
  'ex-034': { glutes: 0.7, hamstrings: 0.2, abs: 0.1 },                       // Hip Thrust
  'ex-035': { glutes: 0.75, hamstrings: 0.2, abs: 0.05 },                     // Glute Bridge
  'ex-036': { calves: 1 },                                                      // Seated Calf Raise
  'ex-037': { calves: 1 },                                                      // Standing Calf Raise
  // Shoulders — ex-038..ex-047
  'ex-038': { front_delts: 0.45, side_delts: 0.2, triceps: 0.3, abs: 0.05 }, // Overhead Press
  'ex-039': { front_delts: 0.45, side_delts: 0.25, triceps: 0.3 },            // Dumbbell Shoulder Press
  'ex-040': { side_delts: 0.9, front_delts: 0.1 },                            // Lateral Raises
  'ex-041': { rear_delts: 0.45, upper_back: 0.35, biceps: 0.2 },              // Face Pulls
  'ex-042': { rear_delts: 0.65, upper_back: 0.35 },                           // Rear Delt Flyes
  'ex-043': { front_delts: 0.4, side_delts: 0.3, triceps: 0.3 },              // Arnold Press
  'ex-044': { side_delts: 0.9, front_delts: 0.1 },                            // Cable Lateral Raise
  'ex-045': { front_delts: 0.4, side_delts: 0.3, triceps: 0.3 },              // Machine Shoulder Press
  'ex-046': { front_delts: 0.9, side_delts: 0.1 },                            // Front Raise
  'ex-047': { side_delts: 0.35, upper_back: 0.3, front_delts: 0.2, biceps: 0.15 }, // Upright Row
  // Biceps — ex-048..ex-055
  'ex-048': { biceps: 0.75, forearms: 0.25 },  // Barbell Curl
  'ex-049': { biceps: 0.75, forearms: 0.25 },  // Dumbbell Curl
  'ex-050': { biceps: 0.5, forearms: 0.5 },    // Hammer Curl
  'ex-051': { biceps: 0.9, forearms: 0.1 },    // Preacher Curl
  'ex-052': { biceps: 0.8, forearms: 0.2 },    // Cable Curl
  'ex-053': { biceps: 0.75, forearms: 0.25 },  // EZ Bar Curl
  'ex-054': { biceps: 0.9, forearms: 0.1 },    // Spider Curl
  'ex-055': { biceps: 0.9, forearms: 0.1 },    // Concentration Curl
  // Triceps — ex-056..ex-063
  'ex-056': { triceps: 1 },                                      // Tricep Pushdown
  'ex-057': { triceps: 0.9, forearms: 0.1 },                    // Skull Crushers
  'ex-058': { triceps: 0.55, chest: 0.3, front_delts: 0.15 },  // Close Grip Bench Press
  'ex-059': { triceps: 1 },                                      // Overhead Cable Extension
  'ex-060': { triceps: 1 },                                      // Overhead Dumbbell Extension
  'ex-061': { triceps: 0.7, chest: 0.2, front_delts: 0.1 },    // Bench Dips
  'ex-062': { triceps: 1 },                                      // Cable Kickback
  'ex-063': { triceps: 1 },                                      // Single Arm Pushdown
  // Forearms — ex-064..ex-068
  'ex-064': { forearms: 1 },                                                            // Wrist Curl
  'ex-065': { forearms: 1 },                                                            // Reverse Wrist Curl
  'ex-066': { forearms: 0.6, upper_back: 0.15, glutes: 0.1, quads: 0.1, abs: 0.05 }, // Farmer Carry
  'ex-067': { forearms: 1 },                                                            // Plate Pinch Hold
  'ex-068': { biceps: 0.3, forearms: 0.7 },                                            // Reverse Curl
  // Core — ex-069..ex-079
  'ex-069': { abs: 0.75, glutes: 0.1, front_delts: 0.15 },    // Plank
  'ex-070': { abs: 1 },                                          // Cable Crunch
  'ex-071': { abs: 0.75, forearms: 0.15, lats: 0.1 },          // Hanging Leg Raise
  'ex-072': { abs: 0.7, lats: 0.15, front_delts: 0.15 },       // Ab Wheel Rollout
  'ex-073': { abs: 0.9, forearms: 0.1 },                        // Russian Twist
  'ex-074': { abs: 1 },                                          // Decline Sit-up
  'ex-075': { abs: 1 },                                          // Bicycle Crunch
  'ex-076': { abs: 0.6, front_delts: 0.2, quads: 0.2 },        // Mountain Climbers
  'ex-077': { abs: 1 },                                          // Dead Bug
  'ex-078': { abs: 0.7, glutes: 0.15, front_delts: 0.15 },     // Side Plank
  'ex-079': { abs: 0.9, quads: 0.1 },                           // V-Ups
  // Full Body — ex-080
  'ex-080': { glutes: 0.2, quads: 0.15, lower_back: 0.15, upper_back: 0.15, front_delts: 0.15, triceps: 0.1, forearms: 0.1 }, // Clean and Press
};

function fallbackMuscles(exercise?: Exercise): Partial<Record<IndividualMuscle, number>> {
  switch (exercise?.category) {
    case 'chest': return { chest: 0.7, front_delts: 0.15, triceps: 0.15 };
    case 'back': return { lats: 0.4, upper_back: 0.3, biceps: 0.2, forearms: 0.1 };
    case 'legs': return { quads: 0.35, hamstrings: 0.25, glutes: 0.25, calves: 0.15 };
    case 'shoulders': return { front_delts: 0.35, side_delts: 0.35, rear_delts: 0.3 };
    case 'biceps': return { biceps: 0.8, forearms: 0.2 };
    case 'triceps': return { triceps: 0.85, forearms: 0.15 };
    case 'forearms': return { forearms: 1 };
    case 'arms': return { biceps: 0.4, triceps: 0.4, forearms: 0.2 };
    case 'core': return { abs: 1 };
    case 'full_body':
    case 'full-body': return { quads: 0.2, glutes: 0.15, upper_back: 0.15, chest: 0.1, front_delts: 0.1, triceps: 0.1, abs: 0.1, lower_back: 0.05, hamstrings: 0.05 };
    default: return { abs: 1 };
  }
}

export function calcMuscleStress(workout: Workout, exercises: Record<string, Exercise>) {
  const totals: Partial<Record<IndividualMuscle, number>> = {};
  for (const item of workout.exercises) {
    const distribution = EXERCISE_MUSCLES[item.exerciseId] ?? fallbackMuscles(exercises[item.exerciseId]);
    for (const set of item.sets.filter(s => s.completed && s.type !== 'warmup')) {
      const rpe = Math.max(5, Math.min(10, set.rpe ?? 7));
      // Volume load: sqrt(weight × reps / 600) normalises to ~1.0 at 60 kg × 10 reps.
      // Bodyweight sets treated as 60 kg equivalent. Reps capped at 30 to dampen cardio noise.
      const load = set.weight > 0
        ? set.weight * Math.min(set.reps, 30)
        : Math.min(set.reps, 30) * 60;
      const volumeFactor = Math.sqrt(load / 600);
      // RPE non-linear: 7→1.0, 8→1.47, 9→1.88, 10→2.44 — heavier effort amplifies stress sharply
      const rpeFactor = Math.pow(rpe / 7, 2.5);
      const typeFactor = set.type === 'failure' || set.type === 'amrap' ? 1.3
        : set.type === 'dropset' ? 1.15
        : set.type === 'tempo' ? 1.1
        : 1.0;
      const setStress = volumeFactor * rpeFactor * typeFactor;
      for (const [muscle, fraction] of Object.entries(distribution) as [IndividualMuscle, number][]) {
        totals[muscle] = (totals[muscle] ?? 0) + setStress * fraction;
      }
    }
  }
  return totals;
}

// Fatigue half-life varies by muscle — small/peripheral muscles clear stress faster than
// large or posterior-chain muscles that see heavier absolute loads and more DOMS.
const MUSCLE_TAU_TIME: Record<IndividualMuscle, number> = {
  forearms: 18, calves: 20, abs: 20, side_delts: 22, rear_delts: 22, biceps: 24,
  triceps: 26, front_delts: 26, chest: 28, upper_back: 28, glutes: 30,
  lats: 32, quads: 34, hamstrings: 36, lower_back: 38,
};

// τ_stress = 7 (baseline): at stress=2.0 recovery≈75%, at stress=7 recovery≈37%, at stress=14 recovery≈14%
const TAU_STRESS_BASE = 7;

// "Fitness" = chronic training exposure per muscle, decayed over a ~4-week window — the slow
// side of a Banister fitness/fatigue split. A muscle trained consistently tolerates more
// stress before its recovery% drops (real adaptation), modeled here as a stretch on τ_stress
// (up to +50%), so the same raw stress reads as "more recovered" for a well-trained muscle.
const TAU_FITNESS = 24 * 28;
const FITNESS_REF = 8;
const ADAPTATION_MAX = 0.5;

export function getMuscleRecovery(workouts: Workout[], exercises?: Record<string, Exercise>, now = Date.now()) {
  const fatigue: Partial<Record<IndividualMuscle, number>> = {};
  const fitness: Partial<Record<IndividualMuscle, number>> = {};
  for (const workout of workouts) {
    if (!workout.completedAt) continue;
    const hours = Math.max(0, (now - workout.completedAt) / 3600000);
    // Prefer live recomputation when exercises are available so formula changes
    // apply retroactively; fall back to stored muscleStress for workouts with no exercises map
    const stressMap = exercises
      ? calcMuscleStress(workout, exercises)
      : workout.muscleStress;
    if (!stressMap) continue;
    for (const [muscle, stress] of Object.entries(stressMap) as [IndividualMuscle, number][]) {
      fatigue[muscle] = (fatigue[muscle] ?? 0) + stress * Math.exp(-hours / MUSCLE_TAU_TIME[muscle]);
      fitness[muscle] = (fitness[muscle] ?? 0) + stress * Math.exp(-hours / TAU_FITNESS);
    }
  }
  return INDIVIDUAL_MUSCLES.map(muscle => {
    const stress = fatigue[muscle] ?? 0;
    const fitnessLevel = fitness[muscle] ?? 0;
    const adaptation = ADAPTATION_MAX * (1 - Math.exp(-fitnessLevel / FITNESS_REF));
    const tauStress = TAU_STRESS_BASE * (1 + adaptation);
    const tauTime = MUSCLE_TAU_TIME[muscle];
    const recovery = Math.round(100 * Math.exp(-stress / tauStress));
    const stressAt75 = tauStress * -Math.log(0.75);
    const hoursUntilReady = stress > stressAt75
      ? Math.ceil(-tauTime * Math.log(stressAt75 / stress))
      : 0;
    return { muscle, stress, fitness: fitnessLevel, recovery, hoursUntilReady };
  });
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
  return crypto.randomUUID();
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
    biceps: '#f8961e',
    triceps: '#f3722c',
    forearms: '#f4a261',
    core: '#90be6d',
    cardio: '#9b5de5',
    full_body: '#f72585',
    'full-body': '#f72585',
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

// Per-exercise history of top-set weight/reps for each completed session — the basis for
// progression suggestions. Only counts sets with weight > 0, so bodyweight-only exercises
// never accumulate history here (see getExerciseLastTrained for a weight-agnostic version).
function buildExerciseHistory(workouts: Workout[]): Record<string, { date: number; topWeight: number; topReps: number }[]> {
  const sorted = [...workouts].sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const historyMap: Record<string, { date: number; topWeight: number; topReps: number }[]> = {};
  for (const workout of sorted) {
    if (!workout.completedAt) continue;
    for (const ex of workout.exercises) {
      const workingSets = ex.sets.filter(s => s.completed && s.type !== 'warmup' && s.weight > 0 && s.reps > 0);
      if (!workingSets.length) continue;
      const topSet = workingSets.reduce((best, s) => (s.weight > best.weight ? s : best), workingSets[0]);
      if (!historyMap[ex.exerciseId]) historyMap[ex.exerciseId] = [];
      historyMap[ex.exerciseId].push({ date: workout.completedAt, topWeight: topSet.weight, topReps: topSet.reps });
    }
  }
  return historyMap;
}

// Session count + last-trained timestamp per exercise, regardless of weight — used to judge
// familiarity/novelty for bodyweight exercises too (pull-ups, push-ups, ...).
function getExerciseLastTrained(workouts: Workout[]): Record<string, { count: number; lastTrainedAt: number }> {
  const map: Record<string, { count: number; lastTrainedAt: number }> = {};
  for (const workout of workouts) {
    if (!workout.completedAt) continue;
    for (const ex of workout.exercises) {
      if (!ex.sets.some(s => s.completed && s.type !== 'warmup')) continue;
      const entry = map[ex.exerciseId] ?? { count: 0, lastTrainedAt: 0 };
      entry.count += 1;
      entry.lastTrainedAt = Math.max(entry.lastTrainedAt, workout.completedAt);
      map[ex.exerciseId] = entry;
    }
  }
  return map;
}

export function getOverloadSuggestions(
  workouts: Workout[],
  exercises: Record<string, Exercise>,
  limit = 10,
): OverloadSuggestion[] {
  const historyMap = buildExerciseHistory(workouts);
  const results: OverloadSuggestion[] = [];

  for (const [exerciseId, history] of Object.entries(historyMap)) {
    const ex = exercises[exerciseId];
    if (!ex || history.length === 0) continue;

    const last = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;
    const prev2 = history.length >= 3 ? history[history.length - 3] : null;

    const isLower = ex.muscleGroups.some(g => g === 'legs');
    const increment = isLower ? 5 : 2.5;

    let trend: OverloadSuggestion['trend'];
    let suggestedWeight = last.topWeight;
    let suggestedReps = last.topReps;

    if (!prev) {
      trend = 'new';
      suggestedReps = last.topReps >= 12 ? Math.max(6, last.topReps - 3) : Math.min(last.topReps + 1, 15);
      if (last.topReps >= 12) suggestedWeight = last.topWeight + increment;
    } else if (last.topWeight > prev.topWeight) {
      trend = 'improving';
      suggestedReps = last.topReps >= 12 ? Math.max(6, last.topReps - 3) : Math.min(last.topReps + 1, 15);
      if (last.topReps >= 12) suggestedWeight = last.topWeight + increment;
    } else if (last.topWeight < prev.topWeight) {
      trend = 'deload';
    } else {
      const stalledThree = !!prev2 && last.topWeight === prev2.topWeight;
      if (last.topReps >= 10 || stalledThree) {
        trend = 'stalled';
        suggestedWeight = last.topWeight + increment;
        suggestedReps = Math.max(6, last.topReps - 2);
      } else {
        trend = 'improving';
        suggestedReps = Math.min(last.topReps + 1, 15);
      }
    }

    results.push({
      exerciseId,
      exerciseName: ex.name,
      lastWeight: last.topWeight,
      lastReps: last.topReps,
      suggestedWeight,
      suggestedReps,
      trend,
      sessionCount: history.length,
      lastTrainedAt: last.date,
    });
  }

  return results.sort((a, b) => b.lastTrainedAt - a.lastTrainedAt).slice(0, limit);
}

// Which split a given workout mostly trained, by summing its per-muscle stress into each
// split and taking the largest. Used to avoid suggesting the same split two days running.
function splitOfWorkout(workout: Workout, exercises: Record<string, Exercise>): MuscleSplit | null {
  const stressMap = calcMuscleStress(workout, exercises);
  const splitKeys = Object.keys(MUSCLE_SPLITS) as MuscleSplit[];
  let best: MuscleSplit | null = null;
  let bestStress = 0;
  for (const split of splitKeys) {
    const total = MUSCLE_SPLITS[split].reduce((sum, m) => sum + (stressMap[m] ?? 0), 0);
    if (total > bestStress) { bestStress = total; best = split; }
  }
  return best;
}

/**
 * Suggests today's workout split + exercise list. Rules, in order of precedence:
 *
 * 1. Recovery-gated split choice — rank push/pull/legs/core by average muscle recovery
 *    (getMuscleRecovery) and lead with whichever is most ready.
 * 2. Split rotation — if the top-recovered split is the one trained last session, rotate to
 *    the next-best split instead, unless that alternative is itself still fatigued (<45%),
 *    in which case repeating is the right call over forcing an undertrained split.
 * 3. Safety gate — ACWR "High spike" or a fatigued chosen split (<45%) trims the session
 *    (fewer exercises, fewer sets) rather than blocking training outright.
 * 4. Within the split, muscles are filled in order of least-recovered-first (their limited
 *    candidate pool matters most), one exercise per muscle, compound movements (more muscles
 *    meaningfully activated) preferred over isolation.
 * 5. Continuity — an exercise with logged history is preferred over one never tried, so the
 *    progressive-overload engine has real numbers to suggest. But an exercise whose
 *    progression has stalled, or that was used in the immediately previous session, is
 *    deprioritized in favor of a fresh candidate for the same muscle (novelty/variation).
 */
export function getWorkoutSuggestion(
  workouts: Workout[],
  exercises: Record<string, Exercise>,
  now = Date.now(),
): WorkoutSuggestion | null {
  const exerciseList = Object.values(exercises);
  if (!exerciseList.length) return null;

  const splitKeys = Object.keys(MUSCLE_SPLITS) as MuscleSplit[];
  const recoveryByMuscle = Object.fromEntries(
    getMuscleRecovery(workouts, exercises, now).map(r => [r.muscle, r.recovery]),
  ) as Record<IndividualMuscle, number>;
  const avgRecoveryBySplit = Object.fromEntries(
    splitKeys.map(split => {
      const muscles = MUSCLE_SPLITS[split];
      const avg = muscles.reduce((sum, m) => sum + (recoveryByMuscle[m] ?? 100), 0) / muscles.length;
      return [split, Math.round(avg)];
    }),
  ) as Record<MuscleSplit, number>;

  const completed = [...workouts].filter(w => w.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  const lastWorkout = completed[0];
  const lastSplit = lastWorkout ? splitOfWorkout(lastWorkout, exercises) : null;

  const ranked = [...splitKeys].sort((a, b) => avgRecoveryBySplit[b] - avgRecoveryBySplit[a]);
  let chosen = ranked[0];
  let rotatedFrom: MuscleSplit | null = null;
  if (chosen === lastSplit && ranked.length > 1 && avgRecoveryBySplit[ranked[1]] >= 45) {
    rotatedFrom = chosen;
    chosen = ranked[1];
  }

  const acwr = getAcwr(workouts, now);
  const loadAdvice: WorkoutSuggestion['loadAdvice'] =
    acwr.status === 'High spike' || avgRecoveryBySplit[chosen] < 45 ? 'reduce'
    : avgRecoveryBySplit[chosen] < 60 ? 'light'
    : 'normal';
  const maxExercises = loadAdvice === 'reduce' ? 3 : loadAdvice === 'light' ? 4 : 5;
  const setsPerExercise = loadAdvice === 'reduce' ? 2 : 3;

  const overloadMap = Object.fromEntries(getOverloadSuggestions(workouts, exercises, Infinity).map(s => [s.exerciseId, s]));
  const lastTrained = getExerciseLastTrained(workouts);
  const lastWorkoutExerciseIds = new Set(lastWorkout?.exercises.map(e => e.exerciseId) ?? []);
  const splitMuscles = MUSCLE_SPLITS[chosen];

  const candidates = exerciseList
    .filter(ex => SPLIT_CATEGORIES[chosen].includes(ex.category) || ex.category === 'arms')
    .map(ex => {
      const dist = EXERCISE_MUSCLES[ex.id] ?? fallbackMuscles(ex);
      const entries = Object.entries(dist) as [IndividualMuscle, number][];
      const inSplit = entries.filter(([m]) => splitMuscles.includes(m));
      if (!inSplit.length) return null;
      const primary = inSplit.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
      const compoundness = entries.filter(([, frac]) => frac >= 0.15).length;
      return { ex, primary, compoundness };
    })
    .filter((c): c is { ex: Exercise; primary: IndividualMuscle; compoundness: number } => c !== null);

  const rankCandidate = (c: { ex: Exercise; compoundness: number }) => {
    let score = c.compoundness * 0.5;
    if (lastTrained[c.ex.id]) score += 2;
    if (lastWorkoutExerciseIds.has(c.ex.id)) score -= 1.5;
    if (overloadMap[c.ex.id]?.trend === 'stalled') score -= 1;
    return score;
  };

  const picked: { ex: Exercise; primary: IndividualMuscle; compoundness: number }[] = [];
  const muscleOrder = [...splitMuscles].sort((a, b) => (recoveryByMuscle[a] ?? 100) - (recoveryByMuscle[b] ?? 100));
  for (const muscle of muscleOrder) {
    if (picked.length >= maxExercises) break;
    const pool = candidates.filter(c => c.primary === muscle && !picked.some(p => p.ex.id === c.ex.id));
    if (!pool.length) continue;
    pool.sort((a, b) => rankCandidate(b) - rankCandidate(a));
    picked.push(pool[0]);
  }
  if (picked.length < maxExercises) {
    const remaining = candidates
      .filter(c => !picked.some(p => p.ex.id === c.ex.id))
      .sort((a, b) => rankCandidate(b) - rankCandidate(a));
    for (const cand of remaining) {
      if (picked.length >= maxExercises) break;
      picked.push(cand);
    }
  }
  picked.sort((a, b) => b.compoundness - a.compoundness);

  const suggestedExercises: SuggestedExercise[] = picked.map(p => {
    const overload = overloadMap[p.ex.id];
    return {
      exerciseId: p.ex.id,
      exerciseName: p.ex.name,
      primaryMuscle: p.primary,
      sets: setsPerExercise,
      targetReps: overload ? String(overload.suggestedReps) : '8-12',
      suggestedWeight: overload?.suggestedWeight,
      isFamiliar: !!lastTrained[p.ex.id],
    };
  });

  const reason = chosen === lastSplit
    ? `Every other split is still recovering, so ${SPLIT_LABELS[chosen]} is your best option even after last session.`
    : rotatedFrom
      ? `${SPLIT_LABELS[rotatedFrom]} tested more recovered, but you just trained it — ${SPLIT_LABELS[chosen]} is next best (${avgRecoveryBySplit[chosen]}% avg).`
      : `${SPLIT_LABELS[chosen]} muscles are your most recovered right now (${avgRecoveryBySplit[chosen]}% avg).`;

  return {
    split: chosen,
    label: SPLIT_LABELS[chosen],
    reason,
    avgRecovery: avgRecoveryBySplit[chosen],
    loadAdvice,
    exercises: suggestedExercises,
  };
}

export function getWeeklyReport(
  workouts: Workout[],
  exercises: Record<string, Exercise>,
  personalRecords: PersonalRecord[],
  now = Date.now(),
): WeeklyReport {
  const weekStart = startOfWeek(new Date(now));
  const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;

  const thisWeek = workouts.filter(w => w.completedAt && w.completedAt >= weekStart);
  const lastWeek = workouts.filter(w => w.completedAt && w.completedAt >= prevWeekStart && w.completedAt < weekStart);

  const volume = thisWeek.reduce((sum, w) => sum + (w.totalVolume ?? calcWorkoutVolume(w)), 0);
  const prevVolume = lastWeek.reduce((sum, w) => sum + (w.totalVolume ?? calcWorkoutVolume(w)), 0);
  const prsThisWeek = personalRecords.filter(pr => pr.achievedAt >= weekStart).length;

  const volumeByExercise: Record<string, number> = {};
  const muscleGroupsHit = new Set<MuscleGroup>();
  for (const workout of thisWeek) {
    for (const ex of workout.exercises) {
      volumeByExercise[ex.exerciseId] = (volumeByExercise[ex.exerciseId] ?? 0) + calcExerciseVolume(ex);
      exercises[ex.exerciseId]?.muscleGroups.forEach(g => muscleGroupsHit.add(g));
    }
  }

  let topExercise: WeeklyReport['topExercise'] = null;
  for (const [exerciseId, vol] of Object.entries(volumeByExercise)) {
    if (vol > 0 && (!topExercise || vol > topExercise.volume)) {
      topExercise = { name: exercises[exerciseId]?.name ?? 'Unknown', volume: vol };
    }
  }

  return {
    weekStart,
    sessions: thisWeek.length,
    prevSessions: lastWeek.length,
    volume,
    prevVolume,
    prsThisWeek,
    topExercise,
    muscleGroupsHit: muscleGroupsHit.size,
  };
}
