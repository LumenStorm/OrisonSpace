/**
 * Resolve a slice-emitted error string into a user-facing message.
 *
 * Slices store errors as either:
 *   - a translation key with a status suffix (e.g. `novelChapter.startFailed|500`), or
 *   - a raw message (network failures, JSON parse errors).
 *
 * The pipe character separates the i18n key from variable values so the slice
 * stays UI-agnostic while the panel still renders translated text.
 *
 * (Moved here from the removed orchestration feature folder — see
 * docs/internal/auto-mode-rebuild-plan.md. This is a generic helper, not
 * orchestration-specific, and is still used by the chapter result panel.)
 */
export function resolveErrorKey(error: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (error.includes('|')) {
    const [key, status] = error.split('|', 2);
    return t(key, { status });
  }
  return error;
}
