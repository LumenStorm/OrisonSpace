import { renameSync } from 'node:fs';
import YAML from 'yaml';

/**
 * Resilience for already-corrupt YAML files on disk.
 *
 * Background: a single unparseable `project.yaml` (legacy corruption from the
 * pre-atomic-write era — a short write left a stale tail behind a valid prefix)
 * used to wedge EVERY save path, because every writer starts with a load and
 * `YAML.parse` threw with no guard. These helpers let loaders catch that, set
 * the bad file aside (never silently destroyed), and self-heal.
 */

/**
 * Move a corrupt file out of the way so callers can rebuild a fresh one without
 * clobbering it. The bad bytes are preserved as `<file>.corrupt-<timestamp>`
 * for manual inspection / recovery. Best-effort: a failed rename never throws
 * (the caller still proceeds to bootstrap), so recovery is never blocked.
 *
 * Returns the backup path on success, or null if the file couldn't be moved.
 */
export function backupCorruptFile(filePath: string): string | null {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.corrupt-${stamp}`;
  try {
    renameSync(filePath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * Salvage the largest leading slice of a corrupt YAML string that still parses
 * to a non-null object. The legacy corruption signature is a valid document
 * followed by stale trailing garbage, so the valid prefix usually carries the
 * real data (name, ids, version, …) — far better than discarding everything and
 * falling back to a directory-name bootstrap.
 *
 * Scans line boundaries from the end inward (cheap for the small config files
 * this runs on). Returns the parsed object, or null if nothing parses.
 */
export function salvageYamlPrefix(raw: string): Record<string, unknown> | null {
  const lines = raw.split('\n');
  for (let end = lines.length; end > 0; end--) {
    const candidate = lines.slice(0, end).join('\n');
    try {
      const parsed = YAML.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Prefix still breaks the parser — shrink and retry.
    }
  }
  return null;
}
