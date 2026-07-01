/**
 * Project-switch reset registry.
 *
 * The app uses a single global Zustand store composed of many slices. When the
 * active project changes, every slice that holds project-scoped state must drop
 * it — otherwise the previous project's open files, chapters, agent conversation
 * and pending diffs bleed into the new project (and acting on a stale diff can
 * write to the wrong project's files).
 *
 * Rather than maintaining one hand-written field list in `projectSubscription`
 * (which inevitably drifts as slices gain new state), each slice registers its
 * own reset at creation time via `registerProjectReset`. `runProjectResets` then
 * invokes them all on switch. Ownership stays with the slice that defines the
 * state, so adding new project-scoped state can't silently miss the reset.
 */
type ResetFn = () => void;

const resetFns: ResetFn[] = [];

/** Register a slice's project-switch reset. Called once per slice at store init. */
export function registerProjectReset(fn: ResetFn): void {
  resetFns.push(fn);
}

/** Run every registered slice reset. Invoked by `projectSubscription` on switch. */
export function runProjectResets(): void {
  for (const fn of resetFns) {
    try {
      fn();
    } catch {
      // A single slice's reset must not abort the others.
    }
  }
}

/** Test helper: drop all registrations so a fresh store can re-register cleanly. */
function __clearProjectResets(): void {
  resetFns.length = 0;
}
