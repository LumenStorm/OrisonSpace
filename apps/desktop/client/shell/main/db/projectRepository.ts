import { getDb } from './index';

export type ProjectRecord = {
  projectId: string;
  name: string;
  type: 'novel' | 'script';
  localFingerprint: string;
  path?: string;
  coverImage?: string;
  lastOpenedAt?: string;
  logline?: string;
  genre?: string;
  writingStyle?: string;
  createdAt: string;
  updatedAt: string;
};

function nextProjectId(): string {
  const db = getDb();
  const row = db.prepare('SELECT project_id FROM projects ORDER BY project_id DESC LIMIT 1').get() as { project_id: string } | undefined;
  const current = row ? Number(row.project_id) : 0;
  return String(current + 1).padStart(5, '0');
}

function rowToRecord(r: any): ProjectRecord {
  return {
    projectId: r.project_id,
    name: r.project_name,
    type: r.project_type,
    localFingerprint: r.local_fingerprint,
    path: r.project_path ?? r.local_fingerprint ?? undefined,
    coverImage: r.cover_image ?? undefined,
    lastOpenedAt: r.last_opened_at ?? undefined,
    logline: r.logline ?? undefined,
    genre: r.genre ?? undefined,
    writingStyle: r.writing_style ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  'project_id, project_name, project_type, local_fingerprint, project_path, cover_image, last_opened_at, logline, genre, writing_style, created_at, updated_at';

export function ensureProject(input: { name: string; type: 'novel' | 'script'; localFingerprint: string; path?: string; coverImage?: string; logline?: string; genre?: string; writingStyle?: string }): ProjectRecord {
  const db = getDb();

  const existing = db.prepare(
    `SELECT ${SELECT_COLS} FROM projects WHERE local_fingerprint = ?`
  ).get(input.localFingerprint) as any;

  if (existing) {
    // Keep path/cover fresh on re-registration (e.g. cover added later).
    const path = input.path ?? existing.project_path ?? input.localFingerprint;
    const coverImage = input.coverImage ?? existing.cover_image ?? null;
    db.prepare(
      "UPDATE projects SET project_path = ?, cover_image = ?, updated_at = datetime('now') WHERE local_fingerprint = ?"
    ).run(path, coverImage, input.localFingerprint);
    return rowToRecord({ ...existing, project_path: path, cover_image: coverImage });
  }

  const projectId = nextProjectId();
  const path = input.path ?? input.localFingerprint;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects (project_id, project_name, project_type, local_fingerprint, project_path, cover_image, last_opened_at, logline, genre, writing_style) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(projectId, input.name, input.type, input.localFingerprint, path, input.coverImage ?? null, now, input.logline ?? null, input.genre ?? null, input.writingStyle ?? null);

  return {
    projectId,
    name: input.name,
    type: input.type,
    localFingerprint: input.localFingerprint,
    path,
    coverImage: input.coverImage,
    lastOpenedAt: now,
    logline: input.logline,
    genre: input.genre,
    writingStyle: input.writingStyle,
    createdAt: now,
    updatedAt: now,
  };
}

/** Every registered project, most-recently-opened first. The durable source of
 *  truth for the "recent/registered projects" list (survives version changes). */
export function listProjects(): ProjectRecord[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT ${SELECT_COLS} FROM projects ORDER BY COALESCE(last_opened_at, updated_at) DESC`
  ).all() as any[];
  return rows.map(rowToRecord);
}

/** Bump last-opened time (and optionally cover image) for ordering. No-op if unknown. */
export function touchProject(input: { localFingerprint: string; coverImage?: string }): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (input.coverImage !== undefined) {
    db.prepare(
      'UPDATE projects SET last_opened_at = ?, cover_image = ? WHERE local_fingerprint = ?'
    ).run(now, input.coverImage, input.localFingerprint);
  } else {
    db.prepare(
      'UPDATE projects SET last_opened_at = ? WHERE local_fingerprint = ?'
    ).run(now, input.localFingerprint);
  }
}
