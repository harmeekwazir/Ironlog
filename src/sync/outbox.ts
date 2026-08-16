import { db, type SyncQueueEntry, type SyncTableName } from '../db';

// A counter, not a boolean: if a suppressed call were ever nested inside another
// (directly, or indirectly via an awaited call that itself suppresses), a boolean would
// let the inner call's `finally` re-enable the outbox while the outer call is still
// mid-flight, letting its remaining writes leak into the outbox.
let suppressDepth = 0;

// Wraps writes that merge remote (pulled) data into Dexie, so those writes don't get
// queued straight back into the outbox they were just read from.
export async function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressDepth++;
  try {
    return await fn();
  } finally {
    suppressDepth--;
  }
}

function enqueue(entry: Omit<SyncQueueEntry, 'localId'>) {
  if (suppressDepth > 0) return;
  void db.syncQueue.add(entry as SyncQueueEntry);
}

// Registers per-table Dexie hooks that mirror every local create/update/delete into the
// syncQueue outbox, regardless of which page or store performed the write. Work happens
// in `onsuccess` (fired after the write's own transaction commits) rather than inline,
// because the ambient transaction for a plain `table.put()` call is scoped only to that
// table — writing to `syncQueue` inline would throw.
function watch(table: SyncTableName, guard?: (obj: { isCustom?: boolean }) => boolean) {
  const dexieTable = db.table(table);

  dexieTable.hook('creating', function (_primKey, obj) {
    if (guard && !guard(obj)) return;
    const { id, updatedAt } = obj as { id: string; updatedAt: number };
    this.onsuccess = () => enqueue({ table, recordId: id, op: 'upsert', updatedAt });
  });

  dexieTable.hook('updating', function (_mods, primKey, obj) {
    if (guard && !guard(obj)) return;
    this.onsuccess = (updatedObj) => {
      const { updatedAt } = updatedObj as { updatedAt: number };
      enqueue({ table, recordId: String(primKey), op: 'upsert', updatedAt });
    };
  });

  dexieTable.hook('deleting', function (primKey, obj) {
    if (guard && !guard(obj)) return;
    this.onsuccess = () => enqueue({ table, recordId: String(primKey), op: 'delete', updatedAt: Date.now() });
  });
}

export function registerSyncHooks() {
  watch('workouts');
  // Built-ins (isCustom: false) are seeded identically client-side by seedExercises()
  // on every device — only custom exercises need to leave this device.
  watch('exercises', (obj) => Boolean(obj.isCustom));
  watch('personalRecords');
  watch('templates');
  watch('readiness');
}
