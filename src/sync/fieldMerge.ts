// Delta/field-level merge for single-row-per-user synced state (profile, settings).
//
// A whole-row last-write-wins would mean two unrelated edits made on different devices
// before either has seen the other's change — e.g. device A changes weight, device B
// toggles sound — result in one device's edit being silently discarded when the "older"
// whole row loses to the "newer" one. Comparing per-field timestamps instead lets both
// edits survive: each field independently keeps whichever side edited it more recently.
export interface FieldSyncable {
  updatedAt: number;
  fieldUpdatedAt: Record<string, number>;
}

export function mergeFields<T extends FieldSyncable>(
  local: T,
  remote: T,
  fields: readonly (keyof T & string)[],
): { patch: Partial<T>; changed: boolean } {
  const patch: Record<string, unknown> = {};
  const mergedFieldTs: Record<string, number> = { ...local.fieldUpdatedAt };
  let changed = false;

  for (const key of fields) {
    const remoteTs = remote.fieldUpdatedAt?.[key] ?? 0;
    const localTs = local.fieldUpdatedAt?.[key] ?? 0;
    if (remoteTs > localTs) {
      patch[key] = remote[key];
      mergedFieldTs[key] = remoteTs;
      changed = true;
    }
  }

  if (changed) {
    patch.fieldUpdatedAt = mergedFieldTs;
    patch.updatedAt = Math.max(local.updatedAt, remote.updatedAt);
  }

  return { patch: patch as Partial<T>, changed };
}
