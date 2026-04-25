import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { patchOperationSchema, projectDocumentSchema } from '@orison/shared-contracts';
import type { ProjectFieldPatch, CreativeFieldKey } from '@orison/shared-contracts';
import YAML from 'yaml';

type ProjectDocument = z.infer<typeof projectDocumentSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;

// ── 旧接口（保持兼容） ──

export function createEmptyProjectDocument(name: string, type: 'novel' | 'script' = 'novel'): ProjectDocument {
  const now = new Date().toISOString();
  return projectDocumentSchema.parse({
    meta: {
      id: crypto.randomUUID(),
      name,
      type,
      version: 1,
      created_at: now,
      updated_at: now
    },
    outline: {
      title: name,
      acts: []
    },
    storyboard: {
      shots: []
    }
  });
}

export function applyPatchOperations(project: ProjectDocument, operations: PatchOperation[]) {
  const next = structuredClone(project) as Record<string, any>;

  for (const operation of operations) {
    if (operation.op !== 'replace') {
      continue;
    }

    if (operation.path === 'outline.acts[0].summary' && next.outline.acts[0]) {
      next.outline.acts[0].summary = operation.value;
    }
  }

  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();
  return projectDocumentSchema.parse(next);
}

// ── Phase 2: 磁盘读写 ──

const PROJECT_FILE = 'project.yaml';

/**
 * 将 ProjectDocument 保存到 `<projectPath>/project.yaml`
 */
export function saveProject(projectPath: string, document: ProjectDocument): void {
  if (!existsSync(projectPath)) {
    mkdirSync(projectPath, { recursive: true });
  }
  const filePath = path.join(projectPath, PROJECT_FILE);
  const validated = projectDocumentSchema.parse(document);
  writeFileSync(filePath, YAML.stringify(validated), 'utf8');
}

/**
 * 从 `<projectPath>/project.yaml` 读取 ProjectDocument。
 * 如果文件不存在返回 null。
 */
export function loadProject(projectPath: string): ProjectDocument | null {
  const filePath = path.join(projectPath, PROJECT_FILE);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf8');
  const parsed = YAML.parse(raw);

  // 旧字段派生兼容：assets.characters → asset_cards
  if (parsed.assets?.characters && !parsed.asset_cards) {
    parsed.asset_cards = parsed.assets.characters.map((c: any, i: number) => ({
      id: c.id ?? `imported_char_${i}`,
      type: 'character',
      name: c.name,
      summary: [c.appearance, c.personality].filter(Boolean).join('；') || undefined,
      tags: [],
      relationships: [],
      sourceRefs: [],
      status: 'active',
      locked: false
    }));
  }

  return projectDocumentSchema.parse(parsed);
}

/**
 * 将 CreativeFieldKey 级别的 patch 应用到项目文档。
 * 加载 → 应用 → 保存 → 返回更新后的文档。
 */
export function applyFieldPatches(
  projectPath: string,
  fieldPatch: ProjectFieldPatch
): ProjectDocument {
  const project = loadProject(projectPath);
  if (!project) {
    throw new Error(`Project not found at ${projectPath}`);
  }

  const next = structuredClone(project) as Record<string, any>;

  const FIELD_TO_KEY: Record<CreativeFieldKey, string> = {
    creative_brief: 'creative_brief',
    world_setting: 'world_setting',
    outline: 'outline_v2',
    episode_outlines: 'episode_outlines',
    growth_curve: 'growth_curve',
    pacing_curve: 'pacing_curve',
    emotion_curve: 'emotion_curve',
    asset_cards: 'asset_cards',
    relationship_graph: 'relationship_graph'
  };

  for (const patch of fieldPatch.patches) {
    const docKey = FIELD_TO_KEY[patch.field];
    if (!docKey) continue;

    // 跳过 locked 字段
    if (next.field_metadata?.[patch.field]?.locked) continue;

    switch (patch.action) {
      case 'set':
        next[docKey] = patch.data;
        break;
      case 'merge':
        if (Array.isArray(next[docKey]) && Array.isArray(patch.data)) {
          next[docKey] = [...next[docKey], ...patch.data];
        } else if (typeof next[docKey] === 'object' && typeof patch.data === 'object') {
          next[docKey] = { ...next[docKey], ...(patch.data as object) };
        } else {
          next[docKey] = patch.data;
        }
        break;
      case 'delete':
        delete next[docKey];
        break;
    }

    // 更新 field_metadata
    if (!next.field_metadata) next.field_metadata = {};
    next.field_metadata[patch.field] = {
      version: patch.fieldVersion,
      source: 'agent',
      locked: next.field_metadata[patch.field]?.locked ?? false,
      dependsOn: next.field_metadata[patch.field]?.dependsOn ?? [],
      stale: false
    };
  }

  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();

  const validated = projectDocumentSchema.parse(next);
  saveProject(projectPath, validated);
  return validated;
}
