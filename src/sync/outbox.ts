import { db, type SyncQueueEntry, type SyncTableName } from '../db';

// A counter, not a boolean: if a suppressed call were ever nested inside another
// (directly, or indirectly via an awaited call that itself suppresses), a boolean would
// let the inner call's `finally` re-enable notifications while the outer call is still
// mid-flight.
let suppressDepth = 0;

// Wraps writes that merge remote (pulled) data into Dexie, so those writes don't get
// treated as new local edits (re-notified, re-queued as a delete-tombstone, etc.).
export async function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressDepth++;
  try {
    return await fn();
  } finally {
    suppressDepth--;
  }
}

// Notified with the table name whenever a genuine local change happens, so the sync
// engine can (a) kick off a push almost immediately instead of only reacting to remote
// realtime events, network/visibility changes, or the fallback timer, and (b) know
// *which* table actually has something new, so a push only touches tables with real
// changes — pushing an unchanged table would still bump every row's updated_at (the
// server trigger doesn't check whether the values actually differ), which would
// generate a realtime event, which would trigger another sync, forever.
type LocalChangeListener = (table: SyncTableName) => void;
const localChangeListeners = new Set<LocalChangeListener>();

export function onLocalChange(listener: LocalChangeListener): () => void {
  localChangeListeners.add(listener);
  return () => localChangeListeners.delete(listener);
}

function notifyLocalChange(table: SyncTableName) {
  for (const listener of localChangeListeners) listener(table);
}

// Only deletions get queued here. A create/update doesn't need to be — the sync engine
// pushes a table's *entire* current local state whenever it's marked dirty (see
// pushTableFull in engine.ts), so any new or changed record is picked up automatically,
// without needing a persisted record of exactly what changed. A deleted record can't be
// picked up that way (it's simply absent from a "push everything currently here" scan),
// so its tombstone push has to be tracked explicitly until it succeeds.
function enqueueDelete(entry: Omit<SyncQueueEntry, 'localId'>) {
  if (suppressDepth > 0) return;
  void db.syncQueue.add(entry as SyncQueueEntry).then(() => notifyLocalChange(entry.table));
}

// Registers per-table Dexie hooks. Work happens in `onsuccess` (fired after the write's
// own transaction commits) rather than inline, because the ambient transaction for a
// plain `table.put()` call is scoped only to that table — writing to `syncQueue` inline
// would throw.
function watch(table: SyncTableName, guard?: (obj: { isCustom?: boolean }) => boolean) {
  const dexieTable = db.table(table);

  dexieTable.hook('creating', function (_primKey, obj) {
    if (guard && !guard(obj)) return;
    this.onsuccess = () => { if (suppressDepth === 0) notifyLocalChange(table); };
  });

  dexieTable.hook('updating', function (_mods, _primKey, obj) {
    if (guard && !guard(obj)) return;
    this.onsuccess = () => { if (suppressDepth === 0) notifyLocalChange(table); };
  });

  dexieTable.hook('deleting', function (primKey, obj) {
    if (guard && !guard(obj)) return;
    this.onsuccess = () => enqueueDelete({ table, recordId: String(primKey), op: 'delete', updatedAt: Date.now() });
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
