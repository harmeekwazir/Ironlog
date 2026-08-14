import Dexie, { type Table } from 'dexie';
import type { Workout, Exercise, PersonalRecord, WorkoutTemplate, ReadinessCheck } from '../types';

// A syncable table name — kept in sync with the Dexie tables mirrored to Supabase.
export type SyncTableName = 'workouts' | 'exercises' | 'personalRecords' | 'templates' | 'readiness';

export interface SyncQueueEntry {
  localId?: number;
  table: SyncTableName;
  recordId: string;
  op: 'upsert' | 'delete';
  updatedAt: number;
}

export interface SyncMetaEntry {
  table: SyncTableName;
  lastPulledAt: number;
}

class IronLogDB extends Dexie {
  workouts!: Table<Workout>;
  exercises!: Table<Exercise>;
  personalRecords!: Table<PersonalRecord>;
  templates!: Table<WorkoutTemplate>;
  readiness!: Table<ReadinessCheck>;
  syncQueue!: Table<SyncQueueEntry>;
  syncMeta!: Table<SyncMetaEntry>;

  constructor() {
    super('IronLogDB');
    this.version(1).stores({
      workouts: 'id, startedAt, completedAt, isTemplate',
      exercises: 'id, name, category, isCustom',
      personalRecords: 'id, exerciseId, type, achievedAt',
      templates: 'id, name, createdAt',
    });
    this.version(2).stores({
      workouts: 'id, startedAt, completedAt, isTemplate',
      exercises: 'id, name, category, isCustom',
      personalRecords: 'id, exerciseId, type, achievedAt',
      templates: 'id, name, createdAt, lastUsed',
      readiness: 'id, date, createdAt',
    });
    // Adds `updatedAt` indexes (needed to watermark cloud sync) plus the outbox
    // (syncQueue) and per-table pull cursor (syncMeta) tables used by the sync engine.
    this.version(3).stores({
      workouts: 'id, startedAt, completedAt, isTemplate, updatedAt',
      exercises: 'id, name, category, isCustom, updatedAt',
      personalRecords: 'id, exerciseId, type, achievedAt, updatedAt',
      templates: 'id, name, createdAt, lastUsed, updatedAt',
      readiness: 'id, date, createdAt, updatedAt',
      syncQueue: '++localId, table, recordId, updatedAt',
      syncMeta: 'table',
    }).upgrade(async (tx) => {
      const now = Date.now();
      await tx.table('workouts').toCollection().modify((w) => { w.updatedAt ??= w.completedAt ?? w.startedAt ?? now; });
      await tx.table('exercises').toCollection().modify((e) => { e.updatedAt ??= e.createdAt ?? now; });
      await tx.table('personalRecords').toCollection().modify((p) => { p.updatedAt ??= p.achievedAt ?? now; });
      await tx.table('templates').toCollection().modify((t) => { t.updatedAt ??= t.lastUsed ?? t.createdAt ?? now; });
      await tx.table('readiness').toCollection().modify((r) => { r.updatedAt ??= r.createdAt ?? now; });
    });
  }
}

export const db = new IronLogDB();

// Maps every old exercise ID to the new sequential ID.
// IDs that stay the same are omitted (no-op entries waste nothing but are included for clarity).
const EXERCISE_ID_MAP: Record<string, string> = {
  // Chest — ex-001..ex-011
  'ex-001': 'ex-001', 'ex-002': 'ex-002', 'ex-003': 'ex-003',
  'ex-004': 'ex-004', 'ex-005': 'ex-005', 'ex-006': 'ex-006',
  'ex-035': 'ex-007', 'ex-036': 'ex-008', 'ex-037': 'ex-009',
  'ex-038': 'ex-010', 'ex-039': 'ex-011',
  // Back — ex-012..ex-022
  'ex-007': 'ex-012', 'ex-008': 'ex-013', 'ex-009': 'ex-014',
  'ex-010': 'ex-015', 'ex-011': 'ex-016', 'ex-012': 'ex-017',
  'ex-040': 'ex-018', 'ex-041': 'ex-019', 'ex-042': 'ex-020',
  'ex-043': 'ex-021', 'ex-044': 'ex-022',
  // Legs — ex-023..ex-037
  'ex-013': 'ex-023', 'ex-014': 'ex-024', 'ex-015': 'ex-025',
  'ex-016': 'ex-026', 'ex-017': 'ex-027', 'ex-018': 'ex-028',
  'ex-019': 'ex-029', 'ex-045': 'ex-030', 'ex-046': 'ex-031',
  'ex-047': 'ex-032', 'ex-048': 'ex-033', 'ex-049': 'ex-034',
  'ex-050': 'ex-035', 'ex-051': 'ex-036', 'ex-052': 'ex-037',
  // Shoulders — ex-038..ex-047
  'ex-020': 'ex-038', 'ex-021': 'ex-039', 'ex-022': 'ex-040',
  'ex-023': 'ex-041', 'ex-024': 'ex-042', 'ex-053': 'ex-043',
  'ex-054': 'ex-044', 'ex-055': 'ex-045', 'ex-056': 'ex-046',
  'ex-057': 'ex-047',
  // Biceps — ex-048..ex-055
  'ex-025': 'ex-048', 'ex-026': 'ex-049', 'ex-027': 'ex-050',
  'ex-058': 'ex-051', 'ex-059': 'ex-052', 'ex-060': 'ex-053',
  'ex-061': 'ex-054', 'ex-062': 'ex-055',
  // Triceps — ex-056..ex-063
  'ex-028': 'ex-056', 'ex-029': 'ex-057', 'ex-030': 'ex-058',
  'ex-063': 'ex-059', 'ex-064': 'ex-060', 'ex-065': 'ex-061',
  'ex-066': 'ex-062', 'ex-067': 'ex-063',
  // Forearms — ex-064..ex-068
  'ex-068': 'ex-064', 'ex-069': 'ex-065', 'ex-070': 'ex-066',
  'ex-071': 'ex-067', 'ex-072': 'ex-068',
  // Core — ex-069..ex-079
  'ex-031': 'ex-069', 'ex-032': 'ex-070', 'ex-033': 'ex-071',
  'ex-034': 'ex-072',
  // ex-073..ex-079 and ex-080 are unchanged
};

function remapId(id: string): string {
  return EXERCISE_ID_MAP[id] ?? id;
}

export async function seedExercises() {
  // Detect whether we're already on the new sequential scheme.
  // Under the new scheme ex-007 is "Incline Barbell Bench Press";
  // under the old scheme it was "Deadlift". Any other value means fresh DB.
  const ex007 = await db.exercises.get('ex-007');
  if (ex007?.name === 'Incline Barbell Bench Press') return;

  // Migrate workout exercise references
  const workouts = await db.workouts.toArray();
  for (const w of workouts) {
    if (!w.exercises?.length) continue;
    const remapped = w.exercises.map(ex => ({ ...ex, exerciseId: remapId(ex.exerciseId) }));
    await db.workouts.put({ ...w, exercises: remapped });
  }

  // Migrate personal record exercise references
  const prs = await db.personalRecords.toArray();
  for (const pr of prs) {
    const newId = remapId(pr.exerciseId);
    if (newId !== pr.exerciseId) await db.personalRecords.put({ ...pr, exerciseId: newId });
  }

  // Migrate template exercise references
  const templates = await db.templates.toArray();
  for (const t of templates) {
    const remapped = t.exercises.map(ex => ({ ...ex, exerciseId: remapId(ex.exerciseId) }));
    await db.templates.put({ ...t, exercises: remapped });
  }

  // Replace all default exercises with the new sequential IDs
  await db.exercises.filter(e => !e.isCustom).delete();

  const now = Date.now();
  const defaults: Omit<Exercise, 'updatedAt'>[] = [
    // ── Chest (ex-001 → ex-011) ────────────────────────────────────────────
    { id: 'ex-001', name: 'Barbell Bench Press',       muscleGroups: ['chest', 'shoulders', 'arms'], equipment: ['barbell'],    category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-002', name: 'Incline Dumbbell Press',    muscleGroups: ['chest', 'shoulders'],          equipment: ['dumbbell'],   category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-003', name: 'Dumbbell Flyes',            muscleGroups: ['chest'],                       equipment: ['dumbbell'],   category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-004', name: 'Cable Crossover',           muscleGroups: ['chest'],                       equipment: ['cable'],      category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-005', name: 'Push-ups',                  muscleGroups: ['chest', 'shoulders', 'arms'],  equipment: ['bodyweight'], category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-006', name: 'Dips',                      muscleGroups: ['chest', 'arms'],               equipment: ['bodyweight'], category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-007', name: 'Incline Barbell Bench Press', muscleGroups: ['chest', 'shoulders'],        equipment: ['barbell'],    category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-008', name: 'Decline Bench Press',       muscleGroups: ['chest', 'triceps'],            equipment: ['barbell'],    category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-009', name: 'Machine Chest Press',       muscleGroups: ['chest'],                       equipment: ['machine'],    category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-010', name: 'Pec Deck Fly',              muscleGroups: ['chest'],                       equipment: ['machine'],    category: 'chest',    isCustom: false, createdAt: now },
    { id: 'ex-011', name: 'Single Arm Cable Fly',      muscleGroups: ['chest'],                       equipment: ['cable'],      category: 'chest',    isCustom: false, createdAt: now },

    // ── Back (ex-012 → ex-022) ─────────────────────────────────────────────
    { id: 'ex-012', name: 'Deadlift',                  muscleGroups: ['back', 'legs'],                equipment: ['barbell'],    category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-013', name: 'Pull-ups',                  muscleGroups: ['back', 'arms'],                equipment: ['bodyweight'], category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-014', name: 'Barbell Row',               muscleGroups: ['back', 'arms'],                equipment: ['barbell'],    category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-015', name: 'Lat Pulldown',              muscleGroups: ['back', 'arms'],                equipment: ['cable'],      category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-016', name: 'Seated Cable Row',          muscleGroups: ['back'],                        equipment: ['cable'],      category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-017', name: 'T-Bar Row',                 muscleGroups: ['back'],                        equipment: ['barbell'],    category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-018', name: 'Chest Supported Row',       muscleGroups: ['back'],                        equipment: ['machine'],    category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-019', name: 'Single Arm Dumbbell Row',   muscleGroups: ['back', 'biceps'],              equipment: ['dumbbell'],   category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-020', name: 'Straight Arm Pulldown',     muscleGroups: ['back'],                        equipment: ['cable'],      category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-021', name: 'Machine Row',               muscleGroups: ['back'],                        equipment: ['machine'],    category: 'back',     isCustom: false, createdAt: now },
    { id: 'ex-022', name: 'Meadows Row',               muscleGroups: ['back'],                        equipment: ['barbell'],    category: 'back',     isCustom: false, createdAt: now },

    // ── Legs (ex-023 → ex-037) ─────────────────────────────────────────────
    { id: 'ex-023', name: 'Barbell Squat',             muscleGroups: ['legs'],                        equipment: ['barbell'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-024', name: 'Romanian Deadlift',         muscleGroups: ['legs', 'back'],                equipment: ['barbell'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-025', name: 'Leg Press',                 muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-026', name: 'Leg Extension',             muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-027', name: 'Leg Curl',                  muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-028', name: 'Calf Raise',                muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-029', name: 'Bulgarian Split Squat',     muscleGroups: ['legs'],                        equipment: ['dumbbell'],   category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-030', name: 'Front Squat',               muscleGroups: ['legs'],                        equipment: ['barbell'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-031', name: 'Hack Squat',                muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-032', name: 'Walking Lunges',            muscleGroups: ['legs'],                        equipment: ['dumbbell'],   category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-033', name: 'Goblet Squat',              muscleGroups: ['legs'],                        equipment: ['dumbbell'],   category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-034', name: 'Hip Thrust',                muscleGroups: ['legs'],                        equipment: ['barbell'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-035', name: 'Glute Bridge',              muscleGroups: ['legs'],                        equipment: ['bodyweight'], category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-036', name: 'Seated Calf Raise',         muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },
    { id: 'ex-037', name: 'Standing Calf Raise',       muscleGroups: ['legs'],                        equipment: ['machine'],    category: 'legs',     isCustom: false, createdAt: now },

    // ── Shoulders (ex-038 → ex-047) ────────────────────────────────────────
    { id: 'ex-038', name: 'Overhead Press',            muscleGroups: ['shoulders', 'arms'],           equipment: ['barbell'],    category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-039', name: 'Dumbbell Shoulder Press',   muscleGroups: ['shoulders'],                   equipment: ['dumbbell'],   category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-040', name: 'Lateral Raises',            muscleGroups: ['shoulders'],                   equipment: ['dumbbell'],   category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-041', name: 'Face Pulls',                muscleGroups: ['shoulders', 'back'],           equipment: ['cable'],      category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-042', name: 'Rear Delt Flyes',           muscleGroups: ['shoulders', 'back'],           equipment: ['dumbbell'],   category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-043', name: 'Arnold Press',              muscleGroups: ['shoulders'],                   equipment: ['dumbbell'],   category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-044', name: 'Cable Lateral Raise',       muscleGroups: ['shoulders'],                   equipment: ['cable'],      category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-045', name: 'Machine Shoulder Press',    muscleGroups: ['shoulders'],                   equipment: ['machine'],    category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-046', name: 'Front Raise',               muscleGroups: ['shoulders'],                   equipment: ['dumbbell'],   category: 'shoulders', isCustom: false, createdAt: now },
    { id: 'ex-047', name: 'Upright Row',               muscleGroups: ['shoulders', 'triceps'],        equipment: ['barbell'],    category: 'shoulders', isCustom: false, createdAt: now },

    // ── Biceps (ex-048 → ex-055) ───────────────────────────────────────────
    { id: 'ex-048', name: 'Barbell Curl',              muscleGroups: ['biceps'],                      equipment: ['barbell'],    category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-049', name: 'Dumbbell Curl',             muscleGroups: ['biceps'],                      equipment: ['dumbbell'],   category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-050', name: 'Hammer Curl',               muscleGroups: ['biceps', 'forearms'],          equipment: ['dumbbell'],   category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-051', name: 'Preacher Curl',             muscleGroups: ['biceps'],                      equipment: ['machine'],    category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-052', name: 'Cable Curl',                muscleGroups: ['biceps'],                      equipment: ['cable'],      category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-053', name: 'EZ Bar Curl',               muscleGroups: ['biceps'],                      equipment: ['barbell'],    category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-054', name: 'Spider Curl',               muscleGroups: ['biceps'],                      equipment: ['dumbbell'],   category: 'biceps',   isCustom: false, createdAt: now },
    { id: 'ex-055', name: 'Concentration Curl',        muscleGroups: ['biceps'],                      equipment: ['dumbbell'],   category: 'biceps',   isCustom: false, createdAt: now },

    // ── Triceps (ex-056 → ex-063) ──────────────────────────────────────────
    { id: 'ex-056', name: 'Tricep Pushdown',           muscleGroups: ['triceps'],                     equipment: ['cable'],      category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-057', name: 'Skull Crushers',            muscleGroups: ['triceps'],                     equipment: ['barbell'],    category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-058', name: 'Close Grip Bench Press',    muscleGroups: ['triceps', 'chest'],            equipment: ['barbell'],    category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-059', name: 'Overhead Cable Extension',  muscleGroups: ['triceps'],                     equipment: ['cable'],      category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-060', name: 'Overhead Dumbbell Extension', muscleGroups: ['triceps'],                   equipment: ['dumbbell'],   category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-061', name: 'Bench Dips',                muscleGroups: ['triceps'],                     equipment: ['bodyweight'], category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-062', name: 'Cable Kickback',            muscleGroups: ['triceps'],                     equipment: ['cable'],      category: 'triceps',  isCustom: false, createdAt: now },
    { id: 'ex-063', name: 'Single Arm Pushdown',       muscleGroups: ['triceps'],                     equipment: ['cable'],      category: 'triceps',  isCustom: false, createdAt: now },

    // ── Forearms (ex-064 → ex-068) ─────────────────────────────────────────
    { id: 'ex-064', name: 'Wrist Curl',                muscleGroups: ['forearms'],                    equipment: ['barbell'],    category: 'forearms', isCustom: false, createdAt: now },
    { id: 'ex-065', name: 'Reverse Wrist Curl',        muscleGroups: ['forearms'],                    equipment: ['barbell'],    category: 'forearms', isCustom: false, createdAt: now },
    { id: 'ex-066', name: 'Farmer Carry',              muscleGroups: ['forearms'],                    equipment: ['dumbbell'],   category: 'forearms', isCustom: false, createdAt: now },
    { id: 'ex-067', name: 'Plate Pinch Hold',          muscleGroups: ['forearms'],                    equipment: ['other'],      category: 'forearms', isCustom: false, createdAt: now },
    { id: 'ex-068', name: 'Reverse Curl',              muscleGroups: ['biceps', 'forearms'],          equipment: ['barbell'],    category: 'forearms', isCustom: false, createdAt: now },

    // ── Core (ex-069 → ex-079) ─────────────────────────────────────────────
    { id: 'ex-069', name: 'Plank',                     muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-070', name: 'Cable Crunch',              muscleGroups: ['core'],                        equipment: ['cable'],      category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-071', name: 'Hanging Leg Raise',         muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-072', name: 'Ab Wheel Rollout',          muscleGroups: ['core'],                        equipment: ['other'],      category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-073', name: 'Russian Twist',             muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-074', name: 'Decline Sit-up',            muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-075', name: 'Bicycle Crunch',            muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-076', name: 'Mountain Climbers',         muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-077', name: 'Dead Bug',                  muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-078', name: 'Side Plank',                muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },
    { id: 'ex-079', name: 'V-Ups',                     muscleGroups: ['core'],                        equipment: ['bodyweight'], category: 'core',     isCustom: false, createdAt: now },

    // ── Full Body (ex-080) ─────────────────────────────────────────────────
    { id: 'ex-080', name: 'Clean and Press',           muscleGroups: ['legs', 'shoulders', 'back'],   equipment: ['barbell'],    category: 'full-body', isCustom: false, createdAt: now },
  ];

  await db.exercises.bulkPut(defaults.map(e => ({ ...e, updatedAt: now })));
}
