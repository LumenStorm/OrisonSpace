import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { NovelAutoModeState } from '@orison/shared-contracts';

export const AUTO_MODE_DIR = 'runs/auto-mode';
export const AUTO_MODE_SCHEMA_VERSION = 1;

export function saveAutoModeState(state: NovelAutoModeState): void {
  const dir = path.join(state.projectPath, AUTO_MODE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const content = YAML.stringify({ ...state, schemaVersion: AUTO_MODE_SCHEMA_VERSION });
  writeFileSync(path.join(dir, `${state.autoModeId}.yaml`), content, 'utf8');
}

export function loadAutoModeState(projectPath: string, autoModeId: string): NovelAutoModeState | null {
  const filePath = path.join(projectPath, AUTO_MODE_DIR, `${autoModeId}.yaml`);
  if (!existsSync(filePath)) return null;
  return YAML.parse(readFileSync(filePath, 'utf8')) as NovelAutoModeState;
}

export function listProjectAutoModeStates(projectPath: string): NovelAutoModeState[] {
  const dir = path.join(projectPath, AUTO_MODE_DIR);
  if (!existsSync(dir)) return [];
  const results: NovelAutoModeState[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.yaml')) continue;
    try {
      const parsed = YAML.parse(readFileSync(path.join(dir, file), 'utf8'));
      if (parsed?.autoModeId) results.push(parsed as NovelAutoModeState);
    } catch { /* skip broken files */ }
  }
  return results;
}
