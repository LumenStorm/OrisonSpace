/**
 * Session persistence — stores sessions in {projectPath}/.orison/sessions/
 *
 * - SQLite `index.db` for fast listing/searching (graceful fallback if native module unavailable)
 * - JSONL files for full message history
 * - JSON metadata files for session tree and recovery metadata
 */
import { existsSync, mkdirSync, appendFileSync, readFileSync, unlinkSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { SessionState, SessionMessage } from '../types';
import type { ContinuationSnapshot } from '../context/continuation';
import type { SerializedSkillRunState } from '../runtime/skillRunState';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';

let Database: any = null;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch {
  // Native module not available — SQLite index disabled, JSONL-only mode.
}

function sessionsDir(projectPath: string): string {
  const dir = path.join(projectPath, '.orison', 'sessions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getDb(projectPath: string): any | null {
  if (!Database) return null;
  try {
    const dir = sessionsDir(projectPath);
    const dbPath = path.join(dir, 'index.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        agent_name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        parent_id TEXT,
        session_role TEXT,
        branch_from_message_id TEXT,
        children_json TEXT NOT NULL DEFAULT '[]',
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    ensureSessionTableSchema(db);
    return db;
  } catch {
    Database = null; // Disable for future calls
    return null;
  }
}

export function persistSession(session: SessionState, title?: string): void {
  persistSessionMeta(session);
  const db = getDb(session.projectPath);
  if (!db) return;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, title, agent_name, project_path, status, parent_id, session_role,
        branch_from_message_id, children_json, message_count, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      title ?? deriveTitle(session),
      session.agentName,
      session.projectPath,
      session.status,
      session.parentId ?? null,
      session.sessionRole ?? null,
      session.branchFromMessageId ?? null,
      JSON.stringify(session.children ?? []),
      session.messages.length,
      session.createdAt,
      session.updatedAt,
    );
  } finally {
    db.close();
  }
}

export function appendMessageToFile(projectPath: string, sessionId: string, message: SessionMessage): void {
  const dir = sessionsDir(projectPath);
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  appendFileSync(filePath, JSON.stringify(message) + '\n', 'utf-8');
}

export function overwriteMessagesFile(projectPath: string, sessionId: string, messages: SessionMessage[]): void {
  const dir = sessionsDir(projectPath);
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  const body = messages.map((message) => JSON.stringify(message)).join('\n');
  atomicWriteFileSync(filePath, body ? `${body}\n` : '', 'utf-8');
}

export function loadMessagesFromFile(projectPath: string, sessionId: string): SessionMessage[] {
  const dir = sessionsDir(projectPath);
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line) as SessionMessage);
}

export interface SessionMeta {
  id: string;
  title: string;
  agentName: string;
  projectPath: string;
  status: string;
  parentId?: string;
  sessionRole?: 'primary' | 'child' | 'fork';
  branchFromMessageId?: string;
  children?: string[];
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export function listSessions(projectPath: string): SessionMeta[] {
  const dir = path.join(projectPath, '.orison', 'sessions');
  const db = getDb(projectPath);
  if (db) {
    if (!existsSync(path.join(dir, 'index.db'))) return [];
    try {
      const rows = db.prepare(`
        SELECT id, title, agent_name as agentName, project_path as projectPath,
               status, parent_id as parentId, session_role as sessionRole,
               branch_from_message_id as branchFromMessageId, children_json as childrenJson,
               message_count as messageCount, created_at as createdAt, updated_at as updatedAt
        FROM sessions
        ORDER BY updated_at DESC
      `).all() as Array<SessionMeta & { childrenJson?: string }>;
      return rows.map((row) => ({
        ...row,
        children: parseChildrenJson(row.childrenJson),
      }));
    } finally {
      db.close();
    }
  }
  // Fallback: list from JSONL files
  if (!existsSync(dir)) return [];
  const sessionIds = new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl') || f.endsWith('.meta.json'))
      .map((f) => f.replace(/(\.meta\.json|\.jsonl)$/, '')),
  );
  return [...sessionIds]
    .map((f) => {
      const id = f;
      const meta = loadSessionMeta(projectPath, id);
      return {
        id,
        title: id,
        agentName: meta?.agentName ?? 'writer',
        projectPath,
        status: meta?.status ?? 'idle',
        parentId: meta?.parentId,
        sessionRole: meta?.sessionRole,
        branchFromMessageId: meta?.branchFromMessageId,
        children: meta?.children ?? [],
        messageCount: 0,
        createdAt: meta?.createdAt ?? 0,
        updatedAt: meta?.updatedAt ?? 0,
      };
    });
}

export function deletePersistedSession(projectPath: string, sessionId: string): void {
  const db = getDb(projectPath);
  if (db) {
    try {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    } finally {
      db.close();
    }
  }
  const filePath = path.join(sessionsDir(projectPath), `${sessionId}.jsonl`);
  if (existsSync(filePath)) unlinkSync(filePath);
  const metaPath = path.join(sessionsDir(projectPath), `${sessionId}.meta.json`);
  if (existsSync(metaPath)) unlinkSync(metaPath);
}

export interface SessionMetaState {
  id: string;
  agentName: string;
  projectPath: string;
  status: SessionState['status'];
  modelRef?: { keyId: string; modelId: string };
  parentId?: string;
  children: string[];
  branchFromMessageId?: string;
  sessionRole?: 'primary' | 'child' | 'fork';
  createdAt: number;
  updatedAt: number;
  error?: string;
  skillRunState?: SerializedSkillRunState;
}

export interface PersistedContinuationRecord {
  continuationId: string;
  sessionId: string;
  createdAt: number;
  snapshot: ContinuationSnapshot;
}

export function persistSessionMeta(session: SessionState): void {
  const metaPath = path.join(sessionsDir(session.projectPath), `${session.id}.meta.json`);
  const meta: SessionMetaState = {
    id: session.id,
    agentName: session.agentName,
    projectPath: session.projectPath,
    status: session.status,
    modelRef: session.modelRef,
    parentId: session.parentId,
    children: session.children ?? [],
    branchFromMessageId: session.branchFromMessageId,
    sessionRole: session.sessionRole,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    error: session.error,
    skillRunState: session.skillRunState,
  };
  atomicWriteFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

export function loadSessionMeta(projectPath: string, sessionId: string): SessionMetaState | undefined {
  const metaPath = path.join(sessionsDir(projectPath), `${sessionId}.meta.json`);
  if (!existsSync(metaPath)) return undefined;
  return JSON.parse(readFileSync(metaPath, 'utf-8')) as SessionMetaState;
}

export function persistContinuation(projectPath: string, record: PersistedContinuationRecord): void {
  const filePath = path.join(sessionsDir(projectPath), `${record.sessionId}.continuations.json`);
  const existing = loadContinuations(projectPath, record.sessionId);
  const next = [record, ...existing.filter((item) => item.continuationId !== record.continuationId)].slice(0, 20);
  atomicWriteFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
}

export function loadContinuations(projectPath: string, sessionId: string): PersistedContinuationRecord[] {
  const filePath = path.join(sessionsDir(projectPath), `${sessionId}.continuations.json`);
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    return Array.isArray(parsed) ? parsed as PersistedContinuationRecord[] : [];
  } catch {
    return [];
  }
}

export function loadContinuationById(projectPath: string, sessionId: string, continuationId: string): PersistedContinuationRecord | undefined {
  return loadContinuations(projectPath, sessionId).find((item) => item.continuationId === continuationId);
}

function deriveTitle(session: SessionState): string {
  const firstUser = session.messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  return firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '');
}

function parseChildrenJson(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function ensureSessionTableSchema(db: any): void {
  const columns = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));

  const migrations = [
    {
      column: 'parent_id',
      sql: 'ALTER TABLE sessions ADD COLUMN parent_id TEXT',
    },
    {
      column: 'session_role',
      sql: 'ALTER TABLE sessions ADD COLUMN session_role TEXT',
    },
    {
      column: 'branch_from_message_id',
      sql: 'ALTER TABLE sessions ADD COLUMN branch_from_message_id TEXT',
    },
    {
      column: 'children_json',
      sql: `ALTER TABLE sessions ADD COLUMN children_json TEXT NOT NULL DEFAULT '[]'`,
    },
  ];

  for (const migration of migrations) {
    if (!existing.has(migration.column)) {
      db.exec(migration.sql);
    }
  }
}
