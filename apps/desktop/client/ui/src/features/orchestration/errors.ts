/**
 * Resolve a slice-emitted error string into a user-facing message.
 *
 * Slices store errors as either:
 *   - a translation key with a status suffix (e.g. `orchestration.startFailed|500`), or
 *   - a raw message (network failures, JSON parse errors).
 *
 * The pipe character separates the i18n key from variable values so the slice
 * stays UI-agnostic while the panel still renders translated text.
 */
export function resolveErrorKey(error: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (error.includes('|')) {
    const [key, status] = error.split('|', 2);
    return t(key, { status });
  }
  return error;
}
