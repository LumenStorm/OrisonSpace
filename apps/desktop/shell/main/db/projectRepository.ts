import { getDb } from './index';

export type ProjectRecord = {
  projectId: string;
  name: string;
  type: 'novel' | 'script';
  localFingerprint: string;
  createdAt: string;
  updatedAt: string;
};

function nextProjectId(): string {
  const db = getDb();
  const row = db.prepare('SELECT project_id FROM projects ORDER BY project_id DESC LIMIT 1').get() as { project_id: string } | undefined;
  const current = row ? Number(row.project_id) : 0;
  return String(current + 1).padStart(5, '0');
}

export function ensureProject(input: { name: string; type: 'novel' | 'script'; localFingerprint: string }): ProjectRecord {
  const db = getDb();

  const existing = db.prepare(
    'SELECT project_id, project_name, project_type, local_fingerprint, created_at, updated_at FROM projects WHERE local_fingerprint = ?'
  ).get(input.localFingerprint) as any;

  if (existing) {
    return {
      projectId: existing.project_id,
      name: existing.project_name,
      type: existing.project_type,
      localFingerprint: existing.local_fingerprint,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const projectId = nextProjectId();
  db.prepare(
    'INSERT INTO projects (project_id, project_name, project_type, local_fingerprint) VALUES (?, ?, ?, ?)'
  ).run(projectId, input.name, input.type, input.localFingerprint);

  return {
    projectId,
    name: input.name,
    type: input.type,
    localFingerprint: input.localFingerprint,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
