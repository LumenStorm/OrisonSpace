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
  deletedAt?: string;
  identityBackfillPending: boolean;
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
    deletedAt: r.deleted_at ?? undefined,
    identityBackfillPending: r.identity_backfill_pending === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  'project_id, project_name, project_type, local_fingerprint, project_path, cover_image, last_opened_at, logline, genre, writing_style, deleted_at, identity_backfill_pending, created_at, updated_at';

type EnsureProjectInput = {
  projectId?: string;
  name: string;
  type: 'novel' | 'script';
  localFingerprint: string;
  path?: string;
  coverImage?: string;
  logline?: string;
  genre?: string;
  writingStyle?: string;
};

export function ensureProject(input: EnsureProjectInput): ProjectRecord {
  const db = getDb();

  let existing = db.prepare(
    `SELECT ${SELECT_COLS} FROM projects WHERE local_fingerprint = ?`
  ).get(input.localFingerprint) as any;

  if (existing) {
    if (input.projectId !== existing.project_id) {
      // 同一路径已被另一个项目占用时，为旧记录换成墓碑指纹，避免新项目继承旧身份。
      db.prepare(
        "UPDATE projects SET local_fingerprint = ?, deleted_at = COALESCE(deleted_at, datetime('now')), updated_at = datetime('now') WHERE project_id = ?"
      ).run(`__archived__:${existing.project_id}:${Date.now()}`, existing.project_id);
      existing = undefined;
    }
  }

  if (!existing && input.projectId) {
    const restored = db.prepare(
      `SELECT ${SELECT_COLS} FROM projects WHERE project_id = ? AND deleted_at IS NOT NULL`
    ).get(input.projectId) as any;
    if (restored) existing = restored;
  }

  if (existing) {
    // 刷新可变元数据；若用户从回收站恢复项目，则同时恢复注册状态。
    const path = input.path ?? existing.project_path ?? input.localFingerprint;
    const coverImage = input.coverImage ?? existing.cover_image ?? null;
    db.prepare(
      "UPDATE projects SET project_name = ?, project_type = ?, local_fingerprint = ?, project_path = ?, cover_image = ?, deleted_at = NULL, updated_at = datetime('now') WHERE project_id = ?"
    ).run(input.name, input.type, input.localFingerprint, path, coverImage, existing.project_id);
    return getProject(input.localFingerprint)!;
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
    identityBackfillPending: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Every registered project, most-recently-opened first. The durable source of
 *  truth for the "recent/registered projects" list (survives version changes). */
export function listProjects(): ProjectRecord[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT ${SELECT_COLS} FROM projects WHERE deleted_at IS NULL ORDER BY COALESCE(last_opened_at, updated_at) DESC`
  ).all() as any[];
  return rows.map(rowToRecord);
}

/** 按基于路径的本地指纹查询单个项目。 */
export function getProject(localFingerprint: string): ProjectRecord | undefined {
  const db = getDb();
  const row = db.prepare(
    `SELECT ${SELECT_COLS} FROM projects WHERE local_fingerprint = ?`
  ).get(localFingerprint) as any;
  return row ? rowToRecord(row) : undefined;
}

/** 按持久项目编号查询项目，包括软归档记录。 */
export function getProjectById(projectId: string): ProjectRecord | undefined {
  const db = getDb();
  const row = db.prepare(
    `SELECT ${SELECT_COLS} FROM projects WHERE project_id = ?`
  ).get(projectId) as any;
  return row ? rowToRecord(row) : undefined;
}

/** 只更新项目显示名称，不改变路径身份。 */
export function renameProject(localFingerprint: string, name: string): ProjectRecord | undefined {
  const db = getDb();
  db.prepare(
    "UPDATE projects SET project_name = ?, updated_at = datetime('now') WHERE local_fingerprint = ?"
  ).run(name, localFingerprint);
  return getProject(localFingerprint);
}

/** 软归档已删除项目，保留身份和运行历史，便于从回收站恢复。 */
export function archiveProject(localFingerprint: string): boolean {
  const db = getDb();
  const result = db.prepare(
    "UPDATE projects SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE local_fingerprint = ? AND deleted_at IS NULL"
  ).run(localFingerprint);
  return result.changes > 0;
}

/** project.yaml 已成功补写持久项目编号后，关闭该记录的一次性兼容窗口。 */
export function completeProjectIdentityBackfill(localFingerprint: string, projectId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'UPDATE projects SET identity_backfill_pending = 0, updated_at = datetime(\'now\') WHERE local_fingerprint = ? AND project_id = ? AND identity_backfill_pending = 1'
  ).run(localFingerprint, projectId);
  return result.changes > 0;
}

/** 永久清理从未暴露给用户的注册记录，仅用于回滚失败的复制。 */
export function purgeProject(localFingerprint: string): boolean {
  const db = getDb();
  const project = getProject(localFingerprint);
  if (!project) return false;

  const remove = db.transaction((projectId: string) => {
    // tasks 的 project_id 当前没有声明 ON DELETE CASCADE。
    db.prepare('DELETE FROM task_asset_refs WHERE task_id IN (SELECT task_id FROM tasks WHERE project_id = ?)').run(projectId);
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM project_assets WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE project_id = ?').run(projectId);
  });
  remove(project.projectId);
  return true;
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
