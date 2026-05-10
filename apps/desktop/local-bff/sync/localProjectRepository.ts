import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import {
  patchOperationSchema,
  projectDocumentSchema,
  assetCardsSchema,
  assetRegistrySchema,
  supportedAssetArchiveTypes,
} from '@orison/shared-contracts';
import type { ProjectFieldPatch, CreativeFieldKey } from '@orison/shared-contracts';
import YAML from 'yaml';

type ProjectDocument = z.infer<typeof projectDocumentSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;
type AssetCard = z.infer<typeof assetCardsSchema>[number];
type AssetRegistry = z.infer<typeof assetRegistrySchema>;
type SupportedAssetArchiveType = (typeof supportedAssetArchiveTypes)[number];

const PROJECT_FILE = 'project.yaml';
const ARCHIVE_SCHEMA_VERSION = 1;
const ARCHIVE_DIRS: Record<SupportedAssetArchiveType, string> = {
  character: 'assets/characters',
  location: 'assets/locations',
  prop: 'assets/props',
};

export function createEmptyProjectDocument(
  name: string,
  type: 'novel' | 'script' = 'novel',
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
    },
    outline: {
      title: name,
      acts: [],
    },
    storyboard: {
      shots: [],
    },
  });
}

export function applyPatchOperations(project: ProjectDocument, operations: PatchOperation[]) {
  const next = structuredClone(project) as Record<string, any>;

  for (const operation of operations) {
    if (operation.op !== 'replace') continue;

    if (operation.path === 'outline.acts[0].summary' && next.outline.acts[0]) {
      next.outline.acts[0].summary = operation.value;
    }
  }

  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();
  return projectDocumentSchema.parse(next);
}

export function saveProject(projectPath: string, document: ProjectDocument): void {
  ensureDirectory(projectPath);

  const base = structuredClone(projectDocumentSchema.parse(document)) as Record<string, any>;
  const synchronized = synchronizeArchiveArtifacts(projectPath, base);
  const validated = projectDocumentSchema.parse(synchronized);
  writeFileSync(path.join(projectPath, PROJECT_FILE), YAML.stringify(validated), 'utf8');
}

export function loadProject(projectPath: string): ProjectDocument | null {
  const filePath = path.join(projectPath, PROJECT_FILE);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf8');
  const parsed = (YAML.parse(raw) ?? {}) as Record<string, any>;
  const hydrated = hydrateArchiveArtifacts(projectPath, parsed);

  return projectDocumentSchema.parse(hydrated);
}

export function applyFieldPatches(projectPath: string, fieldPatch: ProjectFieldPatch): ProjectDocument {
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
    foreshadow_registry: 'foreshadow_registry',
  };

  for (const patch of fieldPatch.patches) {
    if ((patch.field as string) === 'chapter_candidate') {
      const data = patch.data as any;
      if (data?.chapterId && data?.candidate) {
        const chapters = next.novel?.chapters;
        if (Array.isArray(chapters)) {
          const chapter = chapters.find((entry: any) => entry.id === data.chapterId);
          if (chapter) {
            const fullPath = path.join(projectPath, chapter.content_file);
            ensureDirectory(path.dirname(fullPath));
            writeFileSync(fullPath, data.candidate.content, 'utf8');

            if (data.candidate.title !== undefined) chapter.title = data.candidate.title;
            if (data.candidate.summary !== undefined) chapter.summary = data.candidate.summary;
            if (data.candidate.wordCount !== undefined) chapter.word_count = data.candidate.wordCount;
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
    if (next.field_metadata?.[patch.field]?.locked) continue;

    switch (patch.action) {
      case 'set':
        next[docKey] = patch.data;
        break;
      case 'merge':
        if (Array.isArray(next[docKey]) && Array.isArray(patch.data)) {
          next[docKey] = [...next[docKey], ...patch.data];
        } else if (isRecord(next[docKey]) && isRecord(patch.data)) {
          next[docKey] = { ...next[docKey], ...patch.data };
        } else {
          next[docKey] = patch.data;
        }
        break;
      case 'delete':
        delete next[docKey];
        break;
    }

    if (!next.field_metadata) next.field_metadata = {};
    next.field_metadata[patch.field] = {
      version: patch.fieldVersion,
      source: 'agent',
      locked: next.field_metadata[patch.field]?.locked ?? false,
      dependsOn: next.field_metadata[patch.field]?.dependsOn ?? [],
      stale: false,
    };
  }

  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();

  saveProject(projectPath, projectDocumentSchema.parse(next));
  return loadProject(projectPath)!;
}

export function deleteAssetArchive(projectPath: string, assetId: string): ProjectDocument {
  const project = loadProject(projectPath);
  if (!project) {
    throw new Error(`Project not found at ${projectPath}`);
  }

  const cards = normalizeAssetCards(project.asset_cards);
  const target = cards.find((card) => card.id === assetId);
  if (!target || !isSupportedArchiveType(target.type)) {
    throw new Error(`Supported asset archive not found: ${assetId}`);
  }

  removeArchiveYaml(projectPath, target);

  for (const imagePath of collectArchiveImagePaths(target)) {
    removeArchiveImage(projectPath, imagePath);
  }

  const nextProject = {
    ...project,
    asset_cards: cards.filter((card) => card.id !== assetId),
    meta: {
      ...project.meta,
      version: project.meta.version + 1,
      updated_at: new Date().toISOString(),
    },
  };

  saveProject(projectPath, projectDocumentSchema.parse(nextProject));
  return loadProject(projectPath)!;
}

function synchronizeArchiveArtifacts(projectPath: string, project: Record<string, any>) {
  const cards = project.asset_cards
    ? normalizeAssetCards(project.asset_cards)
    : deriveLegacyAssetCards(project);

  for (const card of cards) {
    if (!isSupportedArchiveType(card.type)) continue;
    const archive = card.archive ?? buildArchiveReference(card);
    const archivePath = resolveArchivePath(projectPath, card.type, archive.path);
    ensureDirectory(path.dirname(archivePath));
    writeFileSync(archivePath, YAML.stringify(cardToArchiveDocument({ ...card, archive })), 'utf8');
  }

  project.asset_cards = cards;
  project.asset_registry = buildAssetRegistry(cards);
  return project;
}

function hydrateArchiveArtifacts(projectPath: string, parsed: Record<string, any>) {
  const inlineCards = parsed.asset_cards ? normalizeAssetCards(parsed.asset_cards) : deriveLegacyAssetCards(parsed);
  const archiveCards = readArchiveCards(projectPath);

  if (archiveCards.length > 0) {
    const archiveIds = new Set(archiveCards.map((card) => card.id));
    const remainingCards = inlineCards.filter(
      (card) => !archiveIds.has(card.id) && !isSupportedArchiveType(card.type),
    );
    parsed.asset_cards = [...archiveCards, ...remainingCards];
  } else {
    parsed.asset_cards = inlineCards;
  }

  parsed.asset_registry = buildAssetRegistry(parsed.asset_cards);
  return parsed;
}

function readArchiveCards(projectPath: string): AssetCard[] {
  const cards: AssetCard[] = [];

  for (const type of supportedAssetArchiveTypes) {
    const dir = path.join(projectPath, ARCHIVE_DIRS[type]);
    if (!existsSync(dir)) continue;

    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (!statSync(fullPath).isFile() || !entry.endsWith('.yaml')) continue;

      const relativePath = toRelativeProjectPath(projectPath, fullPath);
      const raw = readFileSync(fullPath, 'utf8');
      const parsed = (YAML.parse(raw) ?? {}) as Record<string, any>;
      cards.push(archiveDocumentToCard(type, relativePath, parsed));
    }
  }

  return cards.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function deriveLegacyAssetCards(parsed: Record<string, any>): AssetCard[] {
  if (!parsed.assets?.characters) return [];

  return parsed.assets.characters.map((character: any, index: number) =>
    normalizeArchiveCard({
      id: character.id ?? `imported_char_${index}`,
      type: 'character',
      name: character.name,
      summary: [character.appearance, character.personality].filter(Boolean).join('，') || undefined,
      details: {
        profile: {},
        persona: {
          appearance: character.appearance,
          personality: character.personality,
        },
      },
      tags: [],
      relationships: [],
      sourceRefs: [],
      status: 'active',
      locked: false,
    }),
  );
}

function normalizeAssetCards(value: unknown): AssetCard[] {
  if (!Array.isArray(value)) return [];

  return assetCardsSchema.parse(value).map((card) => {
    if (!isSupportedArchiveType(card.type)) {
      return {
        ...card,
        locked: card.locked ?? false,
      };
    }
    return normalizeArchiveCard(card);
  });
}

function normalizeArchiveCard(card: AssetCard): AssetCard {
  const archive = card.archive ?? buildArchiveReference(card);
  const details = isRecord(card.details) ? structuredClone(card.details) : undefined;
  const story = isRecord(details?.story) ? details.story : {};
  const firstAppearance = card.firstAppearance ?? asOptionalString(story.first_appearance);
  const visuals = normalizeVisuals(card.visuals, card.summary, card.name);
  const sourceRefs = new Set(card.sourceRefs ?? []);
  sourceRefs.add(archive.path);
  if (visuals?.primaryImage) {
    sourceRefs.add(visuals.primaryImage);
  }

  return {
    ...card,
    archive,
    details,
    visuals,
    firstAppearance,
    sourceRefs: [...sourceRefs],
    locked: card.locked ?? false,
  };
}

function buildArchiveReference(card: AssetCard) {
  const slug = normalizeSlug(card.name || card.id);
  return {
    path: `${ARCHIVE_DIRS[card.type as SupportedAssetArchiveType]}/${slug}.yaml`,
    slug,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  };
}

function normalizeVisuals(
  visuals: AssetCard['visuals'],
  summary: string | undefined,
  name: string,
): AssetCard['visuals'] | undefined {
  if (!visuals) return undefined;

  const gallery = [...(visuals.gallery ?? [])];
  let primaryImage = visuals.primaryImage;

  if (!primaryImage) {
    primaryImage = gallery.find((entry) => entry.kind === 'primary')?.path;
  }

  if (primaryImage && !gallery.some((entry) => entry.path === primaryImage)) {
    gallery.unshift({
      id: `${normalizeSlug(name)}-primary`,
      path: primaryImage,
      kind: 'primary',
      prompt: summary,
    });
  }

  return {
    primaryImage,
    gallery,
  };
}

function collectArchiveImagePaths(card: AssetCard): string[] {
  const paths = new Set<string>();
  if (card.visuals?.primaryImage) paths.add(card.visuals.primaryImage);
  for (const image of card.visuals?.gallery ?? []) {
    if (typeof image.path === 'string' && image.path.length > 0) {
      paths.add(image.path);
    }
  }
  return [...paths];
}

function removeArchiveYaml(projectPath: string, card: AssetCard) {
  const archivePath = card.archive?.path;
  if (!archivePath) return;

  const fullPath = resolveArchivePath(projectPath, card.type as SupportedAssetArchiveType, archivePath);
  assertProjectScopedPath(projectPath, fullPath);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { force: true });
  }
}

function removeArchiveImage(projectPath: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized.startsWith('assets/images/')) return;

  const fullPath = path.join(projectPath, normalized);
  assertProjectScopedPath(projectPath, fullPath);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { force: true });
  }
}

function buildAssetRegistry(cards: AssetCard[]): AssetRegistry {
  const items = cards
    .filter((card) => isSupportedArchiveType(card.type) && card.archive)
    .map((card) => ({
      id: card.id,
      type: card.type as SupportedAssetArchiveType,
      name: card.name,
      summary: card.summary,
      status: card.status,
      tags: card.tags,
      archivePath: card.archive!.path,
      primaryImage: card.visuals?.primaryImage,
    }));

  return assetRegistrySchema.parse({
    items,
    updatedAt: new Date().toISOString(),
  });
}

function resolveArchivePath(projectPath: string, type: SupportedAssetArchiveType, archivePath: string) {
  const normalized = normalizeArchiveRelativePath(type, archivePath);
  const fullPath = path.join(projectPath, normalized);
  assertProjectScopedPath(projectPath, fullPath);
  return fullPath;
}

function normalizeArchiveRelativePath(type: SupportedAssetArchiveType, archivePath: string) {
  const normalized = archivePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const expectedPrefix = `${ARCHIVE_DIRS[type]}/`;

  if (
    path.isAbsolute(archivePath) ||
    /^[a-zA-Z]:[\\/]/.test(archivePath) ||
    normalized.startsWith('/') ||
    !normalized.startsWith(expectedPrefix) ||
    !normalized.endsWith('.yaml') ||
    parts.some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`Invalid archive path: ${archivePath}`);
  }

  return normalized;
}

function cardToArchiveDocument(card: AssetCard) {
  const details = isRecord(card.details) ? card.details : {};
  const storyDetails = isRecord(details.story) ? details.story : {};
  const story = {
    ...storyDetails,
    first_appearance: card.firstAppearance ?? asOptionalString(storyDetails.first_appearance),
  };

  return {
    id: card.id,
    type: card.type,
    name: card.name,
    slug: card.archive?.slug,
    status: card.status,
    summary: card.summary,
    tags: card.tags,
    profile: asObject(details.profile),
    persona: card.type === 'character' ? asObject(details.persona) : undefined,
    setting: card.type === 'location' ? asObject(details.setting) : undefined,
    story: Object.keys(story).length > 0 ? story : undefined,
    relations: card.relationships.map((relation) => ({
      target_id: relation.targetId,
      relation_type: relation.relationType,
      label: relation.label,
    })),
    visuals: card.visuals
      ? {
          primary_image: card.visuals.primaryImage,
          gallery: card.visuals.gallery.map((image) => ({
            id: image.id,
            path: image.path,
            kind: image.kind,
            prompt: image.prompt,
            model: image.model,
            created_at: image.createdAt,
            notes: image.notes,
          })),
        }
      : undefined,
    agent_notes: asObject(details.agent_notes ?? details.agentNotes),
  };
}

function archiveDocumentToCard(
  type: SupportedAssetArchiveType,
  archivePath: string,
  doc: Record<string, any>,
): AssetCard {
  const slug = asOptionalString(doc.slug) ?? path.basename(archivePath, '.yaml');
  const visualsDoc = isRecord(doc.visuals) ? doc.visuals : {};
  const gallery = Array.isArray(visualsDoc.gallery)
    ? visualsDoc.gallery.map((entry: any, index: number) => ({
        id: asOptionalString(entry?.id) ?? `${slug}-${index}`,
        path: String(entry?.path ?? ''),
        kind: entry?.kind ?? 'scene_reference',
        prompt: asOptionalString(entry?.prompt),
        model: asOptionalString(entry?.model),
        createdAt: asOptionalString(entry?.created_at),
        notes: asOptionalString(entry?.notes),
      }))
    : [];

  const details: Record<string, unknown> = {};
  if (isRecord(doc.profile) && Object.keys(doc.profile).length > 0) details.profile = doc.profile;
  if (isRecord(doc.persona) && Object.keys(doc.persona).length > 0) details.persona = doc.persona;
  if (isRecord(doc.setting) && Object.keys(doc.setting).length > 0) details.setting = doc.setting;
  if (isRecord(doc.story) && Object.keys(doc.story).length > 0) details.story = doc.story;
  if (isRecord(doc.agent_notes) && Object.keys(doc.agent_notes).length > 0) details.agent_notes = doc.agent_notes;

  const relations = Array.isArray(doc.relations)
    ? doc.relations.map((relation: any) => ({
        targetId: String(relation?.target_id ?? ''),
        relationType: String(relation?.relation_type ?? ''),
        label: asOptionalString(relation?.label),
      }))
    : [];

  return normalizeArchiveCard({
    id: String(doc.id ?? slug),
    type,
    name: String(doc.name ?? slug),
    summary: asOptionalString(doc.summary),
    details: Object.keys(details).length > 0 ? details : undefined,
    archive: {
      path: archivePath.replace(/\\/g, '/'),
      slug,
      schemaVersion: Number(doc.schemaVersion ?? ARCHIVE_SCHEMA_VERSION),
    },
    visuals: gallery.length > 0 || asOptionalString(visualsDoc.primary_image)
      ? {
          primaryImage: asOptionalString(visualsDoc.primary_image) ?? gallery.find((entry) => entry.kind === 'primary')?.path,
          gallery,
        }
      : undefined,
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
    relationships: relations,
    firstAppearance: asOptionalString(doc.story?.first_appearance),
    sourceRefs: [archivePath.replace(/\\/g, '/')],
    status: doc.status ?? 'draft',
    locked: false,
  });
}

function isSupportedArchiveType(value: string): value is SupportedAssetArchiveType {
  return (supportedAssetArchiveTypes as readonly string[]).includes(value);
}

function normalizeSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'asset';
}

function ensureDirectory(dirPath: string) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function toRelativeProjectPath(projectPath: string, fullPath: string) {
  return path.relative(projectPath, fullPath).replace(/\\/g, '/');
}

function assertProjectScopedPath(projectPath: string, targetPath: string) {
  const resolvedProject = path.resolve(projectPath);
  const resolvedTarget = path.resolve(targetPath);
  const normalizedProject = normalizeForComparison(resolvedProject);
  const normalizedTarget = normalizeForComparison(resolvedTarget);

  if (normalizedTarget !== normalizedProject && !normalizedTarget.startsWith(normalizedProject + path.sep)) {
    throw new Error(`Path escapes project directory: ${resolvedTarget}`);
  }
}

function normalizeForComparison(value: string) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: unknown) {
  return isRecord(value) && Object.keys(value).length > 0 ? value : undefined;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
