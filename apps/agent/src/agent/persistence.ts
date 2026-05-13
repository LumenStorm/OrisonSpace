/**
 * Session persistence — stores sessions in {projectPath}/.orison/sessions/
 *
 * - SQLite `index.db` for fast listing/searching
 * - JSONL files for full message history
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, appendFileSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { SessionState, SessionMessage } from '../types';

function sessionsDir(projectPath: string): string {
  const dir = path.join(projectPath, '.orison', 'sessions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getDb(projectPath: string): Database.Database {
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
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  return db;
}

export function persistSession(session: SessionState, title?: string): void {
  const db = getDb(session.projectPath);
  try {
    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, title, agent_name, project_path, status, message_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      title ?? deriveTitle(session),
      session.agentName,
      session.projectPath,
      session.status,
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
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export function listSessions(projectPath: string): SessionMeta[] {
  const dir = path.join(projectPath, '.orison', 'sessions');
  if (!existsSync(path.join(dir, 'index.db'))) return [];
  const db = getDb(projectPath);
  try {
    return db.prepare(`
      SELECT id, title, agent_name as agentName, project_path as projectPath,
             status, message_count as messageCount, created_at as createdAt, updated_at as updatedAt
      FROM sessions
      ORDER BY updated_at DESC
    `).all() as SessionMeta[];
  } finally {
    db.close();
  }
}

export function deletePersistedSession(projectPath: string, sessionId: string): void {
  const db = getDb(projectPath);
  try {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  } finally {
    db.close();
  }
  const filePath = path.join(sessionsDir(projectPath), `${sessionId}.jsonl`);
  if (existsSync(filePath)) unlinkSync(filePath);
}

function deriveTitle(session: SessionState): string {
  const firstUser = session.messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  return firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '');
}
