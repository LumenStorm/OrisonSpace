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
    // Legacy patch paths are no longer supported (outline.acts removed)
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

  // Migration: remove deprecated outline/detailed_outline fields
  delete parsed.outline;
  delete parsed.detailed_outline;

  // Migration: old chapters without sections → wrap content_file into a single section
  if (parsed.novel?.chapters && Array.isArray(parsed.novel.chapters)) {
    for (const ch of parsed.novel.chapters) {
      if (!ch.sections && ch.content_file) {
        ch.sections = [{
          id: `${ch.id}_s1`,
          sort_order: 0,
          content_file: ch.content_file,
          word_count: ch.word_count,
        }];
        delete ch.content_file;
        delete ch.bridge_notes;
      }
      delete ch.act_id;
    }
  }

  // Migration: remove act_id from script scenes
  if (parsed.script?.scenes && Array.isArray(parsed.script.scenes)) {
    for (const sc of parsed.script.scenes) {
      delete sc.act_id;
    }
  }

  // Migration: assets.characters → asset_cards
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

  // Migration: move logline from outline_v2 to meta if missing
  if (!parsed.meta.logline && parsed.outline_v2?.logline) {
    parsed.meta.logline = parsed.outline_v2.logline;
  }

  // Migration: remove acts from outline_v2
  if (parsed.outline_v2?.acts) {
    delete parsed.outline_v2.acts;
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
    relationship_graph: 'relationship_graph',
    foreshadow_registry: 'foreshadow_registry'
  };

  for (const patch of fieldPatch.patches) {
    // 特殊处理：chapter_candidate 补丁需要写入 markdown + 更新章节元数据
    if ((patch.field as string) === 'chapter_candidate') {
      const data = patch.data as any;
      if (data?.chapterId && data?.candidate) {
        const chapters = next.novel?.chapters;
        if (chapters && Array.isArray(chapters)) {
          const chapter = chapters.find((ch: any) => ch.id === data.chapterId);
          if (chapter && chapter.sections?.length > 0) {
            const section = chapter.sections[0];
            // 写入 markdown 文件
            const mdDir = path.dirname(path.join(projectPath, section.content_file));
            if (!existsSync(mdDir)) {
              mkdirSync(mdDir, { recursive: true });
            }
            writeFileSync(path.join(projectPath, section.content_file), data.candidate.content, 'utf8');

            // 更新章节元数据
            const c = data.candidate;
            if (c.title !== undefined) chapter.title = c.title;
            if (c.summary !== undefined) chapter.summary = c.summary;
            if (c.wordCount !== undefined) {
              chapter.word_count = c.wordCount;
              section.word_count = c.wordCount;
            }
            chapter.status = 'draft';
            chapter.last_run_id = data.runId ?? fieldPatch.runId;
            chapter.generated_at = new Date().toISOString();
          }
        }
      }
      continue;
    }

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
