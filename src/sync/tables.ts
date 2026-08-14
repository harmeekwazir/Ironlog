import type { SyncTableName } from '../db';

export const SYNC_TABLES: SyncTableName[] = ['workouts', 'exercises', 'personalRecords', 'templates', 'readiness'];

export const SUPABASE_TABLE: Record<SyncTableName, string> = {
  workouts: 'workouts',
  exercises: 'exercises',
  personalRecords: 'personal_records',
  templates: 'workout_templates',
  readiness: 'readiness_checks',
};
