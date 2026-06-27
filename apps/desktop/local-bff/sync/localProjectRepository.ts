import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { patchOperationSchema, projectDocumentSchema } from '@orison/shared-contracts';
import type { ProjectFieldPatch, CreativeFieldKey } from '@orison/shared-contracts';
import YAML from 'yaml';
import { atomicWriteFileSync } from './atomicWrite';
import { backupCorruptFile, salvageYamlPrefix } from './corruptRecovery';

type ProjectDocument = z.infer<typeof projectDocumentSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;

// ── 旧接口（保持兼容） ──

export function createEmptyProjectDocument(
  name: string,
  type: 'novel' | 'script' = 'novel',
  extraMeta: Record<string, string> = {}
): ProjectDocument {
  const now = new Date().toISOString();
  return projectDocumentSchema.parse({
    meta: {
      id: crypto.randomUUID(),
      name,
      type,
      version: 1,
      created_at: now,
      updated_at: now,
      ...extraMeta
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

  let parsed: any;
  try {
    parsed = YAML.parse(raw);
  } catch {
    // Corrupt YAML — legacy non-atomic-write damage leaves a valid prefix with a
    // stale tail. Throwing here would wedge EVERY save path (all start with a
    // load), so instead salvage the prefix, set the bad file aside, and either
    // recover the real data or let the caller's bootstrap rebuild a clean file.
    parsed = recoverCorruptProject(filePath, raw);
    if (!parsed) return null;
  }

  // Empty or corrupt YAML parses to null/non-object. Return null (rather than
  // throwing on the property access below) so callers' bootstrap/self-heal
  // fallback can kick in instead of silently losing the edit.
  if (!parsed || typeof parsed !== 'object') return null;

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

  try {
    return projectDocumentSchema.parse(parsed);
  } catch {
    // Structurally invalid (e.g. a salvaged prefix we couldn't repair, or YAML
    // that parsed but doesn't match the schema). Set the bad file aside and let
    // the caller bootstrap rather than wedge every save path.
    backupCorruptFile(filePath);
    return null;
  }
}

/**
 * Recover a project document from corrupt YAML bytes: salvage the largest valid
 * prefix, move the bad file aside (preserved as a `.corrupt-*` backup), and
 * backfill any required meta fields the corruption truncated so the salvaged
 * data survives schema validation instead of being discarded.
 *
 * Returns the (repaired) salvaged object, or null when nothing parses — in
 * which case the caller's bootstrap rebuilds from project.json / directory name.
 */
function recoverCorruptProject(filePath: string, raw: string): Record<string, any> | null {
  const salvaged = salvageYamlPrefix(raw);
  backupCorruptFile(filePath);
  if (!salvaged) return null;
  repairMetaDefaults(salvaged);
  return salvaged;
}

/**
 * Backfill the required meta/storyboard fields a corrupt-tail split may have
 * dropped from an otherwise-valid prefix. Only fills what's missing — real
 * salvaged values (name, ids, version) are never overwritten.
 */
function repairMetaDefaults(doc: Record<string, any>): void {
  const now = new Date().toISOString();
  if (!doc.meta || typeof doc.meta !== 'object') doc.meta = {};
  const m = doc.meta;
  if (typeof m.id !== 'string' || !m.id) m.id = crypto.randomUUID();
  if (typeof m.name !== 'string' || !m.name) m.name = 'Untitled';
  if (m.type !== 'script' && m.type !== 'novel') m.type = 'novel';
  if (typeof m.version !== 'number') m.version = 0;
  if (typeof m.created_at !== 'string') m.created_at = now;
  if (typeof m.updated_at !== 'string') m.updated_at = now;
  if (!doc.storyboard || typeof doc.storyboard !== 'object') doc.storyboard = { shots: [] };
  if (!Array.isArray(doc.storyboard.shots)) doc.storyboard.shots = [];
}

const LEGACY_META_FILE = 'project.json';

/** 旧 project.json 里可收敛到 project.yaml meta 的字段（与 projectMetaSchema 对齐）。 */
const META_STRING_FIELDS = ['logline', 'synopsis', 'genre', 'theme', 'writing_style', 'tone'] as const;

/** 从旧 project.json 读出可收敛进 yaml meta 的字段（含 coverImage→cover_image、projectId→project_id）。 */
function readLegacyMeta(projectPath: string): { name?: string; type?: 'novel' | 'script'; extra: Record<string, string> } {
  const result: { name?: string; type?: 'novel' | 'script'; extra: Record<string, string> } = { extra: {} };
  try {
    const metaPath = path.join(projectPath, LEGACY_META_FILE);
    if (!existsSync(metaPath)) return result;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
    if (typeof meta.name === 'string' && meta.name.trim()) result.name = meta.name;
    if (meta.type === 'script' || meta.type === 'novel') result.type = meta.type;
    for (const key of META_STRING_FIELDS) {
      const v = meta[key];
      if (typeof v === 'string' && v.trim()) result.extra[key] = v;
    }
    if (typeof meta.coverImage === 'string' && meta.coverImage.trim()) result.extra.cover_image = meta.coverImage;
    if (typeof meta.projectId === 'string' && meta.projectId.trim()) result.extra.project_id = meta.projectId;
  } catch {
    // 读不出/损坏的 project.json 当作不存在处理，用目录名兜底。
  }
  return result;
}

/**
 * 内存构造一个 project.yaml 文档：优先读旧 project.json 的全部 meta 字段，缺失则目录名兜底。
 * 不落盘、不删 json——是否落盘/迁移由调用方决定（迁移走 {@link migrateLegacyProjectJson}）。
 */
export function bootstrapProjectFromMeta(projectPath: string): ProjectDocument {
  const legacy = readLegacyMeta(projectPath);
  const name = legacy.name ?? path.basename(projectPath);
  const type = legacy.type ?? 'novel';
  return createEmptyProjectDocument(name, type, legacy.extra);
}

/**
 * 把旧 project.json 一次性迁移进 project.yaml，然后删除 json。
 *
 * - 已有合法 project.yaml：仅在 yaml 缺少 json 携带的 meta 字段时回填补齐，随后删 json。
 * - 无 project.yaml：从 json（或目录名兜底）重建一个完整文档写盘，随后删 json。
 * - 无 project.json：直接返回现有 yaml（可能为 null），不做任何写删。
 *
 * 删除前确保 yaml 已成功 atomicWrite 落盘；写失败则不删，避免数据丢失。
 * 返回迁移后的文档（无 json 且无 yaml 时返回 null）。
 */
export function migrateLegacyProjectJson(projectPath: string): ProjectDocument | null {
  const legacyPath = path.join(projectPath, LEGACY_META_FILE);
  if (!existsSync(legacyPath)) return loadProject(projectPath);

  const legacy = readLegacyMeta(projectPath);
  const existing = loadProject(projectPath);

  const doc = (existing
    ? structuredClone(existing)
    : createEmptyProjectDocument(legacy.name ?? path.basename(projectPath), legacy.type ?? 'novel')) as Record<string, any>;

  // 只补缺：yaml 已有的字段不被 json 覆盖（yaml 是新真相源）。
  if (!doc.meta.name && legacy.name) doc.meta.name = legacy.name;
  if (legacy.type && existing == null) doc.meta.type = legacy.type;
  for (const [key, value] of Object.entries(legacy.extra)) {
    if (doc.meta[key] === undefined) doc.meta[key] = value;
  }

  const validated = projectDocumentSchema.parse(doc);
  saveProject(projectPath, validated); // atomicWrite：成功后才删 json
  try {
    unlinkSync(legacyPath);
  } catch {
    // 删不掉（占用/权限）不阻断：yaml 已是真相源，残留 json 下次再试。
  }
  return validated;
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

    // 跳过过期补丁：补丁基于的 fieldVersion 早于当前已记录版本，说明
    // 该字段在补丁生成后被更新过，应用它会覆盖更新的内容。对齐 story-sync
    // 的 enforcePatchSafety 语义。
    const currentVersion = next.field_metadata?.[patch.field as CreativeFieldKey]?.version;
    if (typeof currentVersion === 'number' && typeof patch.fieldVersion === 'number' && patch.fieldVersion < currentVersion) {
      continue;
    }

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
