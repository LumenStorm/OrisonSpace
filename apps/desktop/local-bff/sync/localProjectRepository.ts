import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { patchOperationSchema, projectDocumentSchema } from '@orison/shared-contracts';
import type { ProjectFieldPatch, CreativeFieldKey } from '@orison/shared-contracts';
import YAML from 'yaml';
import { atomicWriteFileSync } from './atomicWrite';

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
  atomicWriteFileSync(filePath, YAML.stringify(validated), 'utf8');
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

  // Migration: legacy outline -> outline_v2
  if (!parsed.outline_v2 && parsed.outline) {
    const legacyOutline = parsed.outline;
    const acts = Array.isArray(legacyOutline.acts) ? legacyOutline.acts : [];
    const actSummaries = acts
      .map((act: any) => [act.title, act.summary].filter(Boolean).join('：'))
      .filter(Boolean);
    const turningPoints = acts
      .map((act: any) => act.turning_point ?? act.title)
      .filter(Boolean);

    // Move identity fields to meta
    if (!parsed.meta.logline && legacyOutline.logline) parsed.meta.logline = legacyOutline.logline;
    if (!parsed.meta.synopsis && (legacyOutline.synopsis || actSummaries.length > 0)) {
      parsed.meta.synopsis = legacyOutline.synopsis ?? actSummaries.join('\n');
    }
    if (!parsed.meta.theme && legacyOutline.theme) parsed.meta.theme = legacyOutline.theme;
    if (!parsed.meta.genre && legacyOutline.genre) parsed.meta.genre = legacyOutline.genre;

    parsed.outline_v2 = {
      central_conflict: legacyOutline.central_conflict,
      major_turning_points: turningPoints,
      ending_direction: legacyOutline.ending_direction,
      constraints: [],
    };
  }

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

  // Migration: move identity fields from outline_v2 to meta
  if (parsed.outline_v2) {
    if (!parsed.meta.logline && parsed.outline_v2.logline) parsed.meta.logline = parsed.outline_v2.logline;
    if (!parsed.meta.synopsis && parsed.outline_v2.synopsis) parsed.meta.synopsis = parsed.outline_v2.synopsis;
    if (!parsed.meta.theme && parsed.outline_v2.theme) parsed.meta.theme = parsed.outline_v2.theme;
    if (!parsed.meta.genre && parsed.outline_v2.genre) parsed.meta.genre = parsed.outline_v2.genre;
    delete parsed.outline_v2.title;
    delete parsed.outline_v2.logline;
    delete parsed.outline_v2.synopsis;
    delete parsed.outline_v2.theme;
    delete parsed.outline_v2.genre;
  }

  // Migration: remove acts from outline_v2
  if (parsed.outline_v2?.acts) {
    delete parsed.outline_v2.acts;
  }

  return projectDocumentSchema.parse(parsed);
}

/** project.json 里可同步到 project.yaml meta 的字段（与 projectMetaSchema 对齐）。 */
const META_STRING_FIELDS = ['logline', 'synopsis', 'genre', 'theme', 'writing_style', 'tone'] as const;

/**
 * 加载 project.yaml；不存在时从同目录 project.json 兜底重建一个合法空文档。
 *
 * 背景：新建项目只写 project.json（name/type/logline/... 等 meta），从不创建
 * project.yaml；而创作字段（大纲、世设等）只存在于 project.yaml。于是首次访问
 * project.yaml 会落空。这里在缺失时读 project.json 的**全部** meta 字段重建，
 * 避免「两个文件元信息漂移」（例如概览页填了 logline，自愈出的 yaml 却为空）。
 *
 * 注意：本函数只在内存中构造文档，不落盘——是否写盘由调用方决定。
 */
export function bootstrapProjectFromMeta(projectPath: string): ProjectDocument {
  let name = path.basename(projectPath);
  let type: 'novel' | 'script' = 'novel';
  let extraMeta: Record<string, string> = {};
  try {
    const metaPath = path.join(projectPath, 'project.json');
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
      if (typeof meta.name === 'string' && meta.name.trim()) name = meta.name;
      if (meta.type === 'script') type = 'script';
      for (const key of META_STRING_FIELDS) {
        const v = meta[key];
        if (typeof v === 'string' && v.trim()) extraMeta[key] = v;
      }
    }
  } catch {
    // 读不出 project.json 就用目录名兜底，仍能建出合法文档。
  }
  const doc = createEmptyProjectDocument(name, type) as Record<string, any>;
  Object.assign(doc.meta, extraMeta);
  return projectDocumentSchema.parse(doc);
}
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
    // 'overview' patches target project meta (json + yaml), persisted by the
    // UI via syncProjectMeta — not a creative field in the project document.
    if ((patch.field as string) === 'overview') continue;

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
            atomicWriteFileSync(path.join(projectPath, section.content_file), data.candidate.content, 'utf8');

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

    const docKey = FIELD_TO_KEY[patch.field as CreativeFieldKey];
    if (!docKey) continue;

    // 跳过 locked 字段
    if (next.field_metadata?.[patch.field as CreativeFieldKey]?.locked) continue;

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
    next.field_metadata[patch.field as CreativeFieldKey] = {
      version: patch.fieldVersion,
      source: 'agent',
      locked: next.field_metadata[patch.field as CreativeFieldKey]?.locked ?? false,
      dependsOn: next.field_metadata[patch.field as CreativeFieldKey]?.dependsOn ?? [],
      stale: false
    };
  }

  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();

  const validated = projectDocumentSchema.parse(next);
  saveProject(projectPath, validated);
  return validated;
}
