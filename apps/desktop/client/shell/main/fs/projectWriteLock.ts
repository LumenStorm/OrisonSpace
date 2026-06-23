/**
 * Per-project write serialization.
 *
 * Several IPC handlers and the field-sync bridge all do a read-modify-write on
 * the same `project.yaml` (load → mutate → save, bumping `meta.version`). Those
 * handlers contain `await` points, so two concurrent ones can both read the same
 * version, each mutate their own clone, and the later save clobbers the earlier
 * one (lost update + non-monotonic version).
 *
 * `withProjectLock` chains operations for a given project path so they run one
 * at a time, in submission order, across every caller that uses it.
 */
const chains = new Map<string, Promise<unknown>>();

export function withProjectLock<T>(projectDir: string, op: () => Promise<T> | T): Promise<T> {
  const key = projectDir;
  const prev = chains.get(key) ?? Promise.resolve();
  // Run `op` only after the previous op settles (success OR failure), so one
  // failed write never wedges the queue for that project.
  const result = prev.then(() => op(), () => op());
  // The stored tail tracks settlement (never rejects) and prunes itself when it
  // is still the tail, so the map doesn't grow unboundedly.
  const tail: Promise<unknown> = result.then(
    () => { if (chains.get(key) === tail) chains.delete(key); },
    () => { if (chains.get(key) === tail) chains.delete(key); },
  );
  chains.set(key, tail);
  return result;
}
