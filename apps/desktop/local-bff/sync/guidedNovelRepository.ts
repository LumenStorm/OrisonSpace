import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  guidedNovelProjectStateSchema,
  guidedPlanningBaselineSchema,
  guidedPlanningBaselineFieldsSchema,
} from '@orison/shared-contracts';
import type { GuidedNovelProjectState } from '@orison/shared-contracts';
import YAML from 'yaml';

const GUIDED_DIR = path.join('.orison', 'guided-novel');
const SESSION_FILE = 'session.yaml';
const BASELINE_FILE = 'planning-baseline.yaml';

export function saveGuidedNovelState(projectPath: string, state: GuidedNovelProjectState): void {
  const sessionPath = resolveGuidedFile(projectPath, SESSION_FILE);
  ensureDirectory(path.dirname(sessionPath));

  const parsed = guidedNovelProjectStateSchema.parse({
    ...state,
    planningBaseline: undefined,
  });

  writeFileSync(sessionPath, YAML.stringify(parsed), 'utf8');

  if (state.planningBaseline) {
    savePlanningBaseline(projectPath, state.planningBaseline.version, state.planningBaseline.fields);
  }
}

export function loadGuidedNovelState(projectPath: string): GuidedNovelProjectState | null {
  const sessionPath = resolveGuidedFile(projectPath, SESSION_FILE);
  const baselinePath = resolveGuidedFile(projectPath, BASELINE_FILE);

  if (!existsSync(sessionPath) && !existsSync(baselinePath)) {
    return null;
  }

  const sessionState = existsSync(sessionPath)
    ? guidedNovelProjectStateSchema.parse(YAML.parse(readFileSync(sessionPath, 'utf8')) ?? {})
    : {};
  const baselineState = existsSync(baselinePath)
    ? guidedPlanningBaselineSchema.parse(YAML.parse(readFileSync(baselinePath, 'utf8')) ?? {})
    : undefined;

  return guidedNovelProjectStateSchema.parse({
    ...sessionState,
    planningBaseline: baselineState,
  });
}

export function savePlanningBaseline(
  projectPath: string,
  version: number,
  baseline: Record<string, unknown>,
): void {
  const baselinePath = resolveGuidedFile(projectPath, BASELINE_FILE);
  ensureDirectory(path.dirname(baselinePath));

  const parsed = guidedPlanningBaselineSchema.parse({
    version,
    fields: guidedPlanningBaselineFieldsSchema.parse(baseline),
    updatedAt: new Date().toISOString(),
  });

  writeFileSync(baselinePath, YAML.stringify(parsed), 'utf8');
}

function resolveGuidedFile(projectPath: string, fileName: string) {
  const resolved = path.join(projectPath, GUIDED_DIR, fileName);
  assertProjectScopedPath(projectPath, resolved);
  return resolved;
}

function ensureDirectory(dirPath: string) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function assertProjectScopedPath(projectPath: string, targetPath: string) {
  const resolvedProject = normalizeForComparison(path.resolve(projectPath));
  const resolvedTarget = normalizeForComparison(path.resolve(targetPath));

  if (resolvedTarget !== resolvedProject && !resolvedTarget.startsWith(resolvedProject + path.sep)) {
    throw new Error(`Path escapes project directory: ${targetPath}`);
  }
}

function normalizeForComparison(value: string) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
