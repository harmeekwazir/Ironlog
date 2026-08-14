// Shallow camelCase <-> snake_case conversion between Dexie records and Supabase rows.
// Deliberately shallow: nested values (e.g. a workout's `exercises` array or
// `muscleStress` map) are stored as opaque JSONB and keep their original camelCase
// shape — only the top-level SQL column names need converting.

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function toRow(record: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    row[camelToSnake(key)] = value;
  }
  return row;
}

export function fromRow<T>(row: Record<string, unknown>): T {
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null) continue;
    record[snakeToCamel(key)] = value;
  }
  return record as T;
}
