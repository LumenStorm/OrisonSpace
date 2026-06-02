import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { RunResult } from './runService';

let Database: any = null;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch {
  // Native module not available — fallback to in-memory only.
}

const memoryStore = new Map<string, RunResult>();

function runsDir(projectPath: string): string {
  const dir = path.join(projectPath, '.orison', 'runs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getDb(projectPath: string): any | null {
  if (!Database) return null;
  try {
    const dir = runsDir(projectPath);
    const dbPath = path.join(dir, 'runs.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        project_path TEXT NOT NULL,
        current_node_id TEXT,
        completed_nodes_json TEXT NOT NULL DEFAULT '[]',
        pending_nodes_json TEXT NOT NULL DEFAULT '[]',
        artifacts_json TEXT NOT NULL DEFAULT '{}',
        review_json TEXT,
        archive_json TEXT,
        delivery_json TEXT,
        feedback_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    return db;
  } catch {
    return null;
  }
}

function toRow(run: RunResult) {
  const now = Date.now();
  return {
    id: run.runId,
    status: run.status,
    project_path: (run as any).projectPath ?? '',
    current_node_id: run.currentNodeId ?? null,
    completed_nodes_json: JSON.stringify(run.completedNodes),
    pending_nodes_json: JSON.stringify((run as any).pendingNodes ?? []),
    artifacts_json: JSON.stringify(run.artifacts),
    review_json: run.review ? JSON.stringify(run.review) : null,
    archive_json: run.archive ? JSON.stringify(run.archive) : null,
    delivery_json: run.delivery ? JSON.stringify(run.delivery) : null,
    feedback_json: run.feedback ? JSON.stringify(run.feedback) : null,
    created_at: now,
    updated_at: now,
  };
}

function fromRow(row: any): RunResult {
  return {
    runId: row.id,
    status: row.status,
    currentNodeId: row.current_node_id ?? null,
    completedNodes: JSON.parse(row.completed_nodes_json),
    artifacts: JSON.parse(row.artifacts_json),
    review: row.review_json ? JSON.parse(row.review_json) : null,
    archive: row.archive_json ? JSON.parse(row.archive_json) : null,
    delivery: row.delivery_json ? JSON.parse(row.delivery_json) : null,
    feedback: row.feedback_json ? JSON.parse(row.feedback_json) : null,
  };
}

export function registerRun(run: RunResult, projectPath?: string): void {
  memoryStore.set(run.runId, run);
  if (!projectPath) return;
  const db = getDb(projectPath);
  if (!db) return;
  try {
    const row = toRow(run);
    db.prepare(`
      INSERT OR REPLACE INTO runs (
        id, status, project_path, current_node_id,
        completed_nodes_json, pending_nodes_json, artifacts_json,
        review_json, archive_json, delivery_json, feedback_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id, row.status, row.project_path, row.current_node_id,
      row.completed_nodes_json, row.pending_nodes_json, row.artifacts_json,
      row.review_json, row.archive_json, row.delivery_json, row.feedback_json,
      row.created_at, row.updated_at,
    );
  } finally {
    db.close();
  }
}

export function getRun(runId: string, projectPath?: string): RunResult | undefined {
  const cached = memoryStore.get(runId);
  if (cached) return cached;
  if (!projectPath) return undefined;
  const db = getDb(projectPath);
  if (!db) return undefined;
  try {
    const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
    if (!row) return undefined;
    const run = fromRow(row);
    memoryStore.set(runId, run);
    return run;
  } finally {
    db.close();
  }
}

export function listRuns(projectPath: string): RunResult[] {
  const db = getDb(projectPath);
  if (!db) return [...memoryStore.values()];
  try {
    const rows = db.prepare('SELECT * FROM runs ORDER BY updated_at DESC').all();
    return rows.map(fromRow);
  } finally {
    db.close();
  }
}
