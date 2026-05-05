import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { novelAutoModeStateSchema } from '@orison/shared-contracts';
import type { NovelAutoModeState } from '@orison/shared-contracts';

export const AUTO_MODE_DIR = path.join('runs', 'auto-mode');
export const AUTO_MODE_SCHEMA_VERSION = 1;

function getAutoModeDir(projectPath: string): string {
  return path.join(projectPath, AUTO_MODE_DIR);
}

function getStateFilePath(projectPath: string, autoModeId: string): string {
  return path.join(getAutoModeDir(projectPath), `${autoModeId}.yaml`);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function withSchemaVersion(state: NovelAutoModeState): NovelAutoModeState {
  return state.schemaVersion === undefined
    ? { ...state, schemaVersion: AUTO_MODE_SCHEMA_VERSION }
    : state;
}

export function saveAutoModeState(state: NovelAutoModeState): void {
  const dir = getAutoModeDir(state.projectPath);
  ensureDir(dir);
  const validated = novelAutoModeStateSchema.parse(withSchemaVersion(state));
  writeFileSync(getStateFilePath(state.projectPath, state.autoModeId), YAML.stringify(validated), 'utf8');
}

export function loadAutoModeState(projectPath: string, autoModeId: string): NovelAutoModeState | null {
  const filePath = getStateFilePath(projectPath, autoModeId);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8');
  const parsed = YAML.parse(raw);
  return novelAutoModeStateSchema.parse(parsed);
}

export function listProjectAutoModeStates(projectPath: string): NovelAutoModeState[] {
  const dir = getAutoModeDir(projectPath);
  if (!existsSync(dir)) return [];
  const states: NovelAutoModeState[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.yaml')) continue;
    try {
      const raw = readFileSync(path.join(dir, entry), 'utf8');
      const parsed = YAML.parse(raw);
      states.push(novelAutoModeStateSchema.parse(parsed));
    } catch {
      // ignore broken files; surface via lastError on next op
    }
  }
  return states;
}
