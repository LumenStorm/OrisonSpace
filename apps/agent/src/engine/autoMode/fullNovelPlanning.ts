import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const FULL_NOVEL_PLANNING_KEYS = [
  'creative_brief',
  'world_setting',
  'asset_cards',
  'relationship_graph',
  'outline',
  'growth_curve',
  'pacing_curve',
  'emotion_curve',
  'episode_outlines',
  'foreshadow_registry',
] as const;

export type FullNovelPlanningBundle = {
  autoModeId: string;
  plotSummary: string;
  artifacts: Record<(typeof FULL_NOVEL_PLANNING_KEYS)[number], unknown>;
  chapterIds: string[];
};

export type CreateFullNovelPlanningBundleInput = {
  projectPath: string;
  autoModeId: string;
  plotSummary?: string;
  requestedChapterIds?: string[];
};

export type CreateFullNovelPlanningBundleResult = {
  bundle: FullNovelPlanningBundle;
  bundlePath: string;
  chapterIds: string[];
};

function readProject(projectPath: string): Record<string, any> {
  const projectFile = path.join(projectPath, 'project.yaml');
  if (existsSync(projectFile)) {
    return (YAML.parse(readFileSync(projectFile, 'utf8')) ?? {}) as Record<string, any>;
  }

  const desktopMetaFile = path.join(projectPath, 'project.json');
  if (existsSync(desktopMetaFile)) {
    const meta = JSON.parse(readFileSync(desktopMetaFile, 'utf8')) as Record<string, any>;
    const projectName = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : path.basename(projectPath);
    const projectId =
      typeof meta.projectId === 'string' && meta.projectId.trim() ? meta.projectId.trim() : projectName;
    return {
      meta: {
        id: projectId,
        name: projectName,
        type: typeof meta.type === 'string' ? meta.type : 'novel',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      outline: {
        title: projectName,
        acts: [],
      },
      storyboard: {
        shots: [],
      },
      novel: {},
    };
  }

  throw new Error(`Project not found at ${projectPath}: project.yaml/project.json missing`);
}

function writeProject(projectPath: string, project: Record<string, any>): void {
  writeFileSync(path.join(projectPath, 'project.yaml'), YAML.stringify(project), 'utf8');
}

function normalizeId(prefix: string, value: string, index: number): string {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `${prefix}_${ascii || String(index).padStart(3, '0')}`;
}

function derivePlotSummary(project: Record<string, any>, provided?: string): string {
  const direct = provided?.trim();
  if (direct) return direct;
  const candidates = [
    project?.creative?.creative_brief?.rawRequirement,
    project?.novel?.plot,
    project?.novel?.description,
    project?.meta?.description,
    project?.outline?.title,
    project?.meta?.name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return 'A full-length novel generated from the user-approved premise.';
}

function targetChapterCount(project: Record<string, any>): number {
  const existing = project?.novel?.chapters;
  if (Array.isArray(existing) && existing.length > 0) return existing.length;
  const configured = Number(project?.creative?.constraints?.chapterCount ?? project?.novel?.target_chapters);
  if (Number.isInteger(configured) && configured > 0) return Math.min(configured, 200);
  return 6;
}

function buildEpisodeOutlines(plotSummary: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const chapterNumber = index + 1;
    return {
      id: `ch_${String(chapterNumber).padStart(3, '0')}`,
      index,
      title: `Chapter ${chapterNumber}`,
      purpose: chapterNumber === 1 ? 'Open the premise and core conflict.' : 'Advance the approved outline.',
      summary: `${plotSummary} Step ${chapterNumber}: advance the central conflict with a concrete scene outcome.`,
      core_event: `Key event ${chapterNumber}`,
      character_progressions: [],
      emotional_beats: ['pressure rises', 'choice forces consequence'],
      pacing_beats: ['setup', 'turn', 'hook'],
      foreshadowing: [`foreshadow_${String(chapterNumber).padStart(3, '0')}`],
      payoffs: chapterNumber > 1 ? [`foreshadow_${String(chapterNumber - 1).padStart(3, '0')}`] : [],
      hook: 'End with a clear unresolved question.',
      dependsOn: chapterNumber > 1 ? [`ch_${String(chapterNumber - 1).padStart(3, '0')}`] : [],
      status: 'planned',
    };
  });
}

function buildBundle(autoModeId: string, plotSummary: string, chapterCount: number): FullNovelPlanningBundle {
  const episodes = buildEpisodeOutlines(plotSummary, chapterCount);
  const protagonistId = normalizeId('asset', 'protagonist', 1);
  const rivalId = normalizeId('asset', 'rival', 2);
  const settingId = normalizeId('asset', 'central setting', 3);

  return {
    autoModeId,
    plotSummary,
    chapterIds: episodes.map((episode) => episode.id),
    artifacts: {
      creative_brief: {
        rawRequirement: plotSummary,
        genre: 'novel',
        tone: 'serialized',
        userConstraints: ['Use this human-approved plot summary as the source of truth.'],
        taboos: [],
      },
      world_setting: {
        premise: plotSummary,
        era: 'unspecified',
        locations: [{ id: settingId, name: 'Central Setting', description: 'Primary stage for the main conflict.' }],
        rules: ['New facts discovered in chapters must be synced back before later chapters depend on them.'],
        power_structures: [],
        taboos: [],
        visual_language: [],
        tone_rules: ['Maintain continuity with approved assets and prior chapter memory.'],
        open_questions: ['Which new facts will the chapter loop discover and promote into memory?'],
      },
      asset_cards: [
        {
          id: protagonistId,
          type: 'character',
          name: 'Protagonist',
          summary: 'Main point-of-view character derived from the approved plot summary.',
          tags: ['core'],
          relationships: [{ targetId: rivalId, relationType: 'rivalry', label: 'central conflict' }],
          sourceRefs: [`auto-mode:${autoModeId}:plotSummary`],
          status: 'active',
        },
        {
          id: rivalId,
          type: 'character',
          name: 'Rival Force',
          summary: 'Primary opposing force that pressures the protagonist.',
          tags: ['core'],
          relationships: [{ targetId: protagonistId, relationType: 'rivalry', label: 'opposition' }],
          sourceRefs: [`auto-mode:${autoModeId}:plotSummary`],
          status: 'active',
        },
        {
          id: settingId,
          type: 'location',
          name: 'Central Setting',
          summary: 'Primary location or social arena of the story.',
          tags: ['setting'],
          relationships: [],
          sourceRefs: [`auto-mode:${autoModeId}:plotSummary`],
          status: 'active',
        },
      ],
      relationship_graph: {
        nodes: [
          { id: 'node_protagonist', assetCardId: protagonistId, label: 'Protagonist', type: 'character', locked: false },
          { id: 'node_rival', assetCardId: rivalId, label: 'Rival Force', type: 'character', locked: false },
        ],
        edges: [
          {
            id: 'edge_central_conflict',
            from: 'node_protagonist',
            to: 'node_rival',
            relationType: 'rivalry',
            label: 'central conflict',
            strength: 8,
            polarity: 'negative',
            visibility: 'public',
            sourceRefs: [`auto-mode:${autoModeId}:plotSummary`],
            locked: false,
          },
        ],
        version: 1,
        updatedBy: 'agent',
      },
      outline: {
        title: 'Full Novel Outline',
        logline: plotSummary,
        theme: 'choice and consequence',
        genre: 'novel',
        central_conflict: plotSummary,
        acts: [
          { id: 'act_1', title: 'Opening Pressure', goal: 'Establish protagonist, world, and conflict.' },
          { id: 'act_2', title: 'Escalation', goal: 'Complicate the conflict through consequences.' },
          { id: 'act_3', title: 'Resolution Direction', goal: 'Drive toward payoff and transformation.' },
        ],
        major_turning_points: ['inciting pressure', 'midpoint reversal', 'final commitment'],
        ending_direction: 'Resolve the central conflict while preserving room for discovered details.',
        constraints: ['Follow approved episode order unless the user revises the plan.'],
      },
      growth_curve: [
        {
          character_id: protagonistId,
          start_state: 'reactive',
          desire: 'solve the central conflict',
          need: 'accept the cost of action',
          turning_points: episodes.map((episode) => ({
            turning_point: `Growth beat for ${episode.title}`,
            linked_episode_ids: [episode.id],
          })),
          regressions: [],
          end_state: 'changed by accumulated consequences',
          linked_episode_ids: episodes.map((episode) => episode.id),
        },
      ],
      pacing_curve: {
        unit: 'chapter',
        points: episodes.map((episode, index) => ({
          refId: episode.id,
          intensity: Math.min(10, 4 + index),
          informationDensity: 6,
          actionLevel: index % 2 === 0 ? 6 : 4,
          recoveryLevel: index % 2 === 0 ? 3 : 5,
          note: `Pacing target for ${episode.title}`,
        })),
        target_shape: 'rising pressure with short recovery beats',
        risks: ['Repetition if chapter memory is not synced.'],
      },
      emotion_curve: {
        unit: 'chapter',
        points: episodes.map((episode, index) => ({
          refId: episode.id,
          primaryEmotion: index === 0 ? 'curiosity' : 'tension',
          valence: index < chapterCount - 1 ? -0.2 : 0.3,
          arousal: Math.min(1, 0.4 + index * 0.08),
          transition: 'each chapter should alter the emotional state',
        })),
        emotional_promises: ['escalating stakes', 'earned payoff'],
        catharsis_points: [episodes.at(-1)?.id ?? 'ch_001'],
      },
      episode_outlines: episodes,
      foreshadow_registry: {
        items: episodes.map((episode, index) => ({
          id: `foreshadow_${String(index + 1).padStart(3, '0')}`,
          title: `${episode.title} hook`,
          content: episode.hook,
          source_type: 'agent',
          plant_ref: episode.id,
          plant_index: index,
          target_resolve_ref: episodes[Math.min(index + 1, episodes.length - 1)]?.id,
          target_resolve_index: Math.min(index + 1, episodes.length - 1),
          status: 'pending',
          is_long_term: index < episodes.length - 1,
          importance: 0.5,
          strength: 5,
          subtlety: 5,
          urgency: 1,
          related_asset_ids: [protagonistId],
          related_foreshadow_ids: [],
          tags: ['auto-mode'],
          auto_remind: true,
          remind_before_units: 2,
          include_in_context: true,
          sourceRefs: [`auto-mode:${autoModeId}:episode:${episode.id}`],
        })),
        version: 1,
        updatedBy: 'agent',
      },
    },
  };
}

function ensureChapterSlots(project: Record<string, any>, episodes: Array<Record<string, any>>): string[] {
  project.novel = project.novel ?? {};
  const existing = Array.isArray(project.novel.chapters) ? project.novel.chapters : [];
  if (existing.length > 0) {
    project.novel.chapters = existing;
    return existing.map((chapter: Record<string, any>) => String(chapter.id));
  }

  project.novel.chapters = episodes.map((episode, index) => ({
    id: String(episode.id),
    title: String(episode.title ?? `Chapter ${index + 1}`),
    sort_order: index,
    content_file: `chapters/${episode.id}.md`,
    status: 'draft',
    summary: String(episode.summary ?? ''),
  }));
  return project.novel.chapters.map((chapter: Record<string, any>) => String(chapter.id));
}

export function createFullNovelPlanningBundle(
  input: CreateFullNovelPlanningBundleInput
): CreateFullNovelPlanningBundleResult {
  const project = readProject(input.projectPath);
  const plotSummary = derivePlotSummary(project, input.plotSummary);
  const chapterCount = input.requestedChapterIds?.length || targetChapterCount(project);
  const bundle = buildBundle(input.autoModeId, plotSummary, chapterCount);
  const episodes = bundle.artifacts.episode_outlines as Array<Record<string, any>>;
  const chapterIds = input.requestedChapterIds?.length
    ? [...input.requestedChapterIds]
    : ensureChapterSlots(project, episodes);

  project.creative = {
    ...(project.creative ?? {}),
    ...bundle.artifacts,
    auto_mode_planning: {
      autoModeId: input.autoModeId,
      generatedAt: new Date().toISOString(),
      approved: false,
    },
  };
  writeProject(input.projectPath, project);

  const autoModeDir = path.join(input.projectPath, 'runs', 'auto-mode');
  if (!existsSync(autoModeDir)) mkdirSync(autoModeDir, { recursive: true });
  const bundlePath = path.join(autoModeDir, `${input.autoModeId}-planning-bundle.yaml`);
  const persisted = { ...bundle, chapterIds };
  writeFileSync(bundlePath, YAML.stringify(persisted), 'utf8');

  return { bundle: persisted, bundlePath, chapterIds };
}

export function approveFullNovelPlanning(projectPath: string, autoModeId: string): void {
  const project = readProject(projectPath);
  project.creative = project.creative ?? {};
  project.creative.auto_mode_planning = {
    ...(project.creative.auto_mode_planning ?? {}),
    autoModeId,
    approved: true,
    approvedAt: new Date().toISOString(),
  };
  writeProject(projectPath, project);
}
