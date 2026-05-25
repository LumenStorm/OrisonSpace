import { getDb } from './index';

export type AssetRecord = {
  assetId: string;
  projectId: string;
  assetType: string;
  assetName: string;
  assetGroup: string;
  assetStatus: string;
  relativePath: string;
  sourceTaskId?: string;
  summary?: string;
  version: number;
  updatedAt: string;
};

export type UpsertAssetInput = {
  assetId: string;
  projectId: string;
  assetType: string;
  assetName: string;
  assetGroup?: string;
  assetStatus?: string;
  relativePath: string;
  sourceTaskId?: string;
  summary?: string;
};

export function listAssets(projectId: string): AssetRecord[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT asset_id, project_id, asset_type, asset_name, asset_group, asset_status,
            relative_path, source_task_id, summary, version, updated_at
     FROM project_assets WHERE project_id = ? ORDER BY asset_group, asset_name`
  ).all(projectId) as any[];
  return rows.map(toRecord);
}

export function upsertAsset(input: UpsertAssetInput): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO project_assets (asset_id, project_id, asset_type, asset_name, asset_group, asset_status, relative_path, source_task_id, summary, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(project_id, asset_id) DO UPDATE SET
      asset_type = excluded.asset_type,
      asset_name = excluded.asset_name,
      asset_group = excluded.asset_group,
      asset_status = excluded.asset_status,
      relative_path = excluded.relative_path,
      source_task_id = excluded.source_task_id,
      summary = excluded.summary,
      version = version + 1,
      updated_at = datetime('now')
  `).run(
    input.assetId,
    input.projectId,
    input.assetType,
    input.assetName,
    input.assetGroup ?? '',
    input.assetStatus ?? 'active',
    input.relativePath,
    input.sourceTaskId ?? null,
    input.summary ?? null,
  );
}

export function updateAsset(projectId: string, assetId: string, fields: Partial<Pick<AssetRecord, 'assetName' | 'assetGroup' | 'summary' | 'assetStatus'>>): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.assetName !== undefined) { sets.push('asset_name = ?'); values.push(fields.assetName); }
  if (fields.assetGroup !== undefined) { sets.push('asset_group = ?'); values.push(fields.assetGroup); }
  if (fields.summary !== undefined) { sets.push('summary = ?'); values.push(fields.summary); }
  if (fields.assetStatus !== undefined) { sets.push('asset_status = ?'); values.push(fields.assetStatus); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(projectId, assetId);
  db.prepare(`UPDATE project_assets SET ${sets.join(', ')} WHERE project_id = ? AND asset_id = ?`).run(...values);
}

export function deleteAsset(projectId: string, assetId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM project_assets WHERE project_id = ? AND asset_id = ?').run(projectId, assetId);
}

function toRecord(row: any): AssetRecord {
  return {
    assetId: row.asset_id,
    projectId: row.project_id,
    assetType: row.asset_type,
    assetName: row.asset_name,
    assetGroup: row.asset_group ?? '',
    assetStatus: row.asset_status,
    relativePath: row.relative_path ?? '',
    sourceTaskId: row.source_task_id ?? undefined,
    summary: row.summary ?? undefined,
    version: row.version,
    updatedAt: row.updated_at,
  };
}
