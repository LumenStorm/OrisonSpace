import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { executePythonNode } from './pythonNodeExecutor';
import { registerRun } from './runStore';
import { writeArtifactYaml, writeContextPacketYaml } from './artifactYaml';
import type { NovelModelRuntime } from '@orison/shared-contracts';
import { executeRecallStep } from '@orison/desktop-local-bff';
import { buildForeshadowContext } from './foreshadowLedger';
import { buildHierarchicalContext, shouldTriggerCompression, getBlockIndex } from './hierarchicalContext';

// ── Types ──

interface RunOptions {
  reviewMode?: 'pass' | 'revise' | 'escalate';
  forcePythonFailure?: boolean;
}

interface StartInput {
  projectPath: string;
  requirement: string;
  configRoot?: string;
}

interface NovelChapterInput {
  projectPath: string;
  chapterId: string;
  mode: 'generate' | 'continue' | 'polish' | 'review';
  instruction?: string;
  modelRuntime?: NovelModelRuntime;
}

export interface RunResult {
  runId: string;
  status: string;
  currentNodeId: string | null;
  completedNodes: string[];
  artifacts: Record<string, unknown>;
  archive: { versionId: string } | null;
  delivery: { deliveryId: string } | null;
  feedback: { feedbackId: string } | null;
  review: { verdict?: string; summary?: string; reasons?: string[] } | null;
}

// ── Helpers ──

const AGENT_DIR = path.resolve(__dirname, '../../python');

function resolvePromptFile(promptPath: string): { system: string; user: string } {
  const resolved = path.resolve(AGENT_DIR, '..', promptPath);
  if (!existsSync(resolved)) return { system: '', user: '' };
  const content = YAML.parse(readFileSync(resolved, 'utf8'));
  return { system: content.system || '', user: content.user || '' };
}

async function runPythonAgent(
  nodeId: string,
  input: Record<string, unknown>,
  opts: { modelRuntime?: NovelModelRuntime; configOverrides?: Record<string, unknown> } = {},
): Promise<{ stateKey: string; artifact: unknown }> {
  const nodeFile = path.join(AGENT_DIR, 'nodes', `${nodeId.replace(/-/g, '_')}.py`);
  const actualNodeFile = existsSync(nodeFile)
    ? nodeFile
    : path.join(AGENT_DIR, 'nodes', `${nodeId.replace(/-/g, '_')}_agent.py`);

  const promptFile = `prompts/${nodeId}.yaml`;
  const prompt = resolvePromptFile(promptFile);

  const env = opts.modelRuntime
    ? { OPENAI_API_KEY: opts.modelRuntime.apiKey, OPENAI_BASE_URL: opts.modelRuntime.baseUrl }
    : {};

  const prevEnv = { ...process.env };
  if (opts.modelRuntime) {
    process.env.OPENAI_API_KEY = opts.modelRuntime.apiKey;
    process.env.OPENAI_BASE_URL = opts.modelRuntime.baseUrl;
  }

  try {
    const result = await executePythonNode({
      pythonCommand: 'python',
      runnerPath: path.join(AGENT_DIR, 'runner/main.py'),
      request: {
        runId: `run_${Date.now().toString(36)}`,
        nodeId,
        nodeFile: actualNodeFile,
        projectPath: '',
        config: { model: opts.modelRuntime?.modelId ?? 'gpt-4o-mini', ...opts.configOverrides },
        prompt,
        input,
      },
    });

    if (!result.ok) {
      throw new Error(`Node ${nodeId} failed: ${result.error.message}`);
    }
    return { stateKey: result.state_key ?? result.stateKey ?? '', artifact: result.artifact };
  } finally {
    // Restore env
    if (opts.modelRuntime) {
      if (prevEnv.OPENAI_API_KEY) process.env.OPENAI_API_KEY = prevEnv.OPENAI_API_KEY;
      else delete process.env.OPENAI_API_KEY;
      if (prevEnv.OPENAI_BASE_URL) process.env.OPENAI_BASE_URL = prevEnv.OPENAI_BASE_URL;
      else delete process.env.OPENAI_BASE_URL;
    }
  }
}

// ── Creative pipeline node sequence ──

const CREATIVE_CHAIN = [
  'intake-agent',
  'asset-loader-agent',
  'story-planner-agent',
  'chapter-task-agent',
  'draft-writer-agent',
  'continuity-memory-agent',
  'multi-review-agent',
];

// ── Novel pipeline ──

function loadNovelProject(projectPath: string) {
  const yamlPath = path.join(projectPath, 'project.yaml');
  if (!existsSync(yamlPath)) throw new Error(`Project not found: ${projectPath}`);
  return YAML.parse(readFileSync(yamlPath, 'utf8'));
}

function buildChapterContext(project: any, chapterId: string, mode: string): Record<string, unknown> {
  const chapters = project.novel?.chapters ?? [];
  const chapter = chapters.find((ch: any) => ch.id === chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const novelTitle = project.outline?.title ?? project.meta?.name ?? '';
  const ctx: Record<string, unknown> = { chapterId, novelTitle, mode };

  // POV character
  if (chapter.pov_character) ctx.povCharacter = chapter.pov_character;

  // Global direction
  const logline = project.creative?.outline?.logline ?? '';
  if (logline) ctx.logline = logline;

  // Asset cards (character names + summaries)
  const assets = project.creative?.asset_cards ?? [];
  if (assets.length > 0) {
    ctx.characters = assets
      .filter((a: any) => a.type === 'character')
      .map((a: any) => ({ name: a.name, summary: a.summary, voiceSample: a.voiceSample ?? '' }));
  }

  // For continue mode, load existing draft
  if (mode === 'continue' && chapter.content_file) {
    const contentPath = path.join(project._projectPath!, chapter.content_file);
    if (existsSync(contentPath)) {
      ctx.draftText = readFileSync(contentPath, 'utf8');
    }
  }

  // Hierarchical context loading
  const hCtx = buildHierarchicalContext(project, chapterId);
  if (hCtx.l0PreviousChapterText) ctx.previousChapterText = hCtx.l0PreviousChapterText;
  if (hCtx.l1RecentSummaries) ctx.priorChapterSummaries = hCtx.l1RecentSummaries;
  if (hCtx.l2BlockSummaries) ctx.blockSummaries = hCtx.l2BlockSummaries;
  if (hCtx.l3GlobalNarrative) ctx.globalNarrative = hCtx.l3GlobalNarrative;
  if (hCtx.characterStates.length > 0) ctx.characterStates = hCtx.characterStates;

  return ctx;
}

// ── Factory ──

export function createRunService(options: RunOptions = {}) {
  const reviewMode = options.reviewMode ?? 'pass';

  return {
    async start(input: StartInput): Promise<RunResult> {
      const runId = `run_${Date.now().toString(36)}`;
      const artifacts: Record<string, unknown> = { requirement: input.requirement };
      const completedNodes: string[] = [];

      for (const nodeId of CREATIVE_CHAIN) {
        if (options.forcePythonFailure) {
          const run: RunResult = {
            runId, status: 'human_in_loop', currentNodeId: nodeId,
            completedNodes, artifacts, archive: null, delivery: null, feedback: null,
            review: { summary: 'python node failed (forced)', reasons: [] },
          };
          registerRun(run);
          return run;
        }

        let result: { stateKey: string; artifact: unknown };
        try {
          result = await runPythonAgent(nodeId, { requirement: input.requirement, artifacts });
        } catch (err: any) {
          const run: RunResult = {
            runId, status: 'human_in_loop', currentNodeId: nodeId,
            completedNodes, artifacts, archive: null, delivery: null, feedback: null,
            review: { summary: `python node failed: ${err.message}`, reasons: [] },
          };
          registerRun(run);
          return run;
        }
        artifacts[result.stateKey] = result.artifact;
        completedNodes.push(nodeId);

        // Check review
        if (nodeId === 'multi-review-agent') {
          const review = result.artifact as any;
          if (reviewMode === 'revise' || review?.verdict === 'revise') {
            const run: RunResult = {
              runId, status: 'revision_pending', currentNodeId: 'targeted-revision-agent',
              completedNodes, artifacts, archive: null, delivery: null, feedback: null,
              review: { verdict: 'revise', reasons: review?.reasons ?? [] },
            };
            registerRun(run);
            return run;
          }
          if (reviewMode === 'escalate' || review?.verdict === 'escalate') {
            const run: RunResult = {
              runId, status: 'human_in_loop', currentNodeId: 'multi-review-agent',
              completedNodes, artifacts,
              archive: null, delivery: null, feedback: null,
              review: { verdict: 'escalate', reasons: review?.reasons ?? [] },
            };
            registerRun(run);
            return run;
          }
        }
      }

      const versionId = `ver_${Date.now().toString(36)}`;
      const deliveryId = `dlv_${Date.now().toString(36)}`;
      const feedbackId = `fb_${Date.now().toString(36)}`;

      const run: RunResult = {
        runId, status: 'delivered', currentNodeId: null, completedNodes, artifacts,
        archive: { versionId },
        delivery: { deliveryId },
        feedback: { feedbackId },
        review: null,
      };
      registerRun(run);
      return run;
    },

    async startNovelChapter(input: NovelChapterInput): Promise<RunResult> {
      const { projectPath, chapterId, mode, modelRuntime } = input;
      const runId = `run_novel_${Date.now().toString(36)}`;

      const project = loadNovelProject(projectPath);
      project._projectPath = projectPath;

      // Phase 1: context loading
      const chapterContext = buildChapterContext(project, chapterId, mode);
      const artifacts: Record<string, unknown> = { 'context.chapterContext': chapterContext };
      const completedNodes: string[] = ['context-loader-agent'];

      // Phase 2: bridge
      const bridgeGuidance = { chapterId, instruction: input.instruction ?? '' };
      artifacts['context.bridgeGuidance'] = bridgeGuidance;
      completedNodes.push('chapter-bridge-agent');

      // Phase 2.5: memory recall
      const novelId = project.meta?.id ?? 'unknown';
      const chapters = project.novel?.chapters ?? [];
      const chapterIdx = chapters.findIndex((ch: any) => ch.id === chapterId);
      const currentChapter = chapterIdx >= 0 ? chapterIdx + 1 : 1;

      const recallResult = executeRecallStep({
        projectPath,
        novelId,
        currentChapter,
        recallTags: [{ category: 'event', value: chapterId }],
      });
      if (recallResult.recalledMemoriesText) {
        artifacts['context.recalledMemories'] = recallResult.recalledMemoriesText;
      }

      // Phase 2.6: foreshadow context
      const foreshadowRegistry = project.creative?.foreshadow_registry;
      if (foreshadowRegistry?.items?.length) {
        const fsContext = buildForeshadowContext(foreshadowRegistry, chapterIdx >= 0 ? chapterIdx : 0);
        if (fsContext.contextText) {
          artifacts['context.foreshadowGuidance'] = fsContext.contextText;
        }
      }

      // Phase 3: draft writer
      const draftResult = await runPythonAgent('novel-draft-writer', {
        artifacts: {
          'context.chapterContext': chapterContext,
          'context.bridgeGuidance': bridgeGuidance,
          'context.recalledMemories': artifacts['context.recalledMemories'] ?? '',
          'context.foreshadowGuidance': artifacts['context.foreshadowGuidance'] ?? '',
          'draft.initial': mode === 'continue' ? { text: chapterContext.draftText ?? '' } : {},
        },
      }, { modelRuntime });
      artifacts[draftResult.stateKey] = draftResult.artifact;
      completedNodes.push('draft-writer-agent');

      // Phase 4: review + revision loop (max 3 rounds)
      let currentDraft = draftResult.artifact;
      let reviewArtifact: any = null;
      const MAX_REVISION_ROUNDS = 3;
      const accumulatedReasons: string[] = [];

      for (let round = 0; round < MAX_REVISION_ROUNDS; round++) {
        const reviewResult = await runPythonAgent('multi-review', {
          artifacts: { 'draft.initial': currentDraft },
        }, { modelRuntime });
        reviewArtifact = reviewResult.artifact;
        completedNodes.push('multi-review-agent');

        if (reviewArtifact?.verdict !== 'revise') break;

        accumulatedReasons.push(...(reviewArtifact.reasons ?? []));

        const revisionResult = await runPythonAgent('targeted-revision', {
          artifacts: {
            'draft.initial': currentDraft,
            'review.latest': { ...reviewArtifact, reasons: accumulatedReasons },
          },
        }, { modelRuntime });
        currentDraft = revisionResult.artifact;
        completedNodes.push('targeted-revision-agent');
      }

      artifacts['review.result'] = reviewArtifact;

      // Phase 4.5: outline adherence check
      const episodeOutlines = project.creative?.episode_outlines ?? [];
      const currentEpisode = episodeOutlines.find((ep: any) => ep.id === chapterId);
      if (currentEpisode) {
        const adherenceResult = await runPythonAgent('outline-adherence', {
          artifacts: {
            'draft.initial': currentDraft,
            'context.episodeOutline': currentEpisode,
            'context.foreshadowGuidance': artifacts['context.foreshadowGuidance'] ?? '',
          },
        }, { modelRuntime });
        artifacts['adherence.result'] = adherenceResult.artifact;
        completedNodes.push('outline-adherence-agent');
      }

      // Build candidate
      const draft = currentDraft as any;
      const draftText = draft?.text ?? '';

      // Phase 5: generate chapter summary and persist
      let chapterSummary = '';
      if (draftText && modelRuntime) {
        const summaryResult = await runPythonAgent('chapter-summary', {
          artifacts: { 'draft.initial': currentDraft },
        }, { modelRuntime });
        const summaryArtifact = summaryResult.artifact as any;
        chapterSummary = summaryArtifact?.summary ?? '';
        artifacts['chapter.summary'] = summaryArtifact;
        completedNodes.push('chapter-summary-agent');

        // Persist summary to project.yaml
        if (chapterSummary) {
          const yamlPath = path.join(projectPath, 'project.yaml');
          if (existsSync(yamlPath)) {
            const proj = YAML.parse(readFileSync(yamlPath, 'utf8'));
            const ch = proj?.novel?.chapters?.find((c: any) => c.id === chapterId);
            if (ch) {
              ch.summary = chapterSummary;
              writeFileSync(yamlPath, YAML.stringify(proj), 'utf8');
            }
          }
        }

        // Persist character states
        if (summaryArtifact?.characterUpdates?.length) {
          const summariesDir = path.join(projectPath, 'runs/summaries');
          if (!existsSync(summariesDir)) mkdirSync(summariesDir, { recursive: true });
          const statesFile = path.join(summariesDir, 'character_states.json');
          let states: any[] = [];
          if (existsSync(statesFile)) {
            try { states = JSON.parse(readFileSync(statesFile, 'utf8')); } catch { /* */ }
          }
          for (const update of summaryArtifact.characterUpdates) {
            const existing = states.find((s: any) => s.name === update.name);
            if (existing) {
              existing.currentState = update.state;
              existing.lastSeenChapter = chapterId;
            } else {
              states.push({ name: update.name, currentState: update.state, lastSeenChapter: chapterId });
            }
          }
          writeFileSync(statesFile, JSON.stringify(states, null, 2), 'utf8');
        }

        // Phase 5.5: L2/L3 compression trigger
        const sortedChapters = [...(project.novel?.chapters ?? [])].sort(
          (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const currentIdx = sortedChapters.findIndex((c: any) => c.id === chapterId);
        if (shouldTriggerCompression(currentIdx + 1)) {
          const blockIdx = getBlockIndex(currentIdx + 1);
          const blockStart = blockIdx * 5;
          const blockChapters = sortedChapters.slice(blockStart, blockStart + 5);
          const blockSummaries = blockChapters
            .filter((c: any) => c.summary)
            .map((c: any) => ({ chapterId: c.id, title: c.title, summary: c.summary }));

          const summariesDir = path.join(projectPath, 'runs/summaries');
          if (!existsSync(summariesDir)) mkdirSync(summariesDir, { recursive: true });

          const statesFile = path.join(summariesDir, 'character_states.json');
          let prevStates: any[] = [];
          if (existsSync(statesFile)) {
            try { prevStates = JSON.parse(readFileSync(statesFile, 'utf8')); } catch { /* */ }
          }
          const globalFile = path.join(summariesDir, 'global_narrative.txt');
          const prevGlobal = existsSync(globalFile) ? readFileSync(globalFile, 'utf8') : '';

          const compressResult = await runPythonAgent('narrative-compressor', {
            artifacts: {
              chapterSummaries: blockSummaries,
              previousGlobalNarrative: prevGlobal,
              previousCharacterStates: prevStates,
            },
          }, { modelRuntime });
          const compressed = compressResult.artifact as any;
          completedNodes.push('narrative-compressor-agent');

          if (compressed?.blockSummary) {
            writeFileSync(path.join(summariesDir, `l2_block_${blockIdx}.txt`), compressed.blockSummary, 'utf8');
          }
          if (compressed?.globalNarrative) {
            writeFileSync(globalFile, compressed.globalNarrative, 'utf8');
          }
          if (compressed?.characterStates?.length) {
            writeFileSync(statesFile, JSON.stringify(compressed.characterStates, null, 2), 'utf8');
          }
        }
      }

      artifacts['chapter.candidate'] = {
        title: draft?.title ?? '',
        content: draftText,
        summary: chapterSummary,
        wordCount: draft?.wordCount ?? 0,
      };

      return {
        runId, status: 'delivered', currentNodeId: null, completedNodes, artifacts,
        archive: null, delivery: null, feedback: null, review: null,
      };
    },

    async startCreative(input: StartInput): Promise<RunResult> {
      const runId = `run_${Date.now().toString(36)}`;
      const artifacts: Record<string, unknown> = { requirement: input.requirement };
      const completedNodes: string[] = [];

      const CREATIVE_EXTENDED_CHAIN = [
        'intake-agent',
        'asset-loader-agent',
        'story-planner-agent',
        'curve-planner-agent',
        'episode-planner-agent',
        'chapter-task-agent',
        'draft-writer-agent',
        'continuity-memory-agent',
        'multi-review-agent',
      ];

      for (const nodeId of CREATIVE_EXTENDED_CHAIN) {
        const result = await runPythonAgent(nodeId, { requirement: input.requirement, artifacts });
        artifacts[result.stateKey] = result.artifact;
        completedNodes.push(nodeId);

        // Persist artifact YAML
        const configRoot = input.configRoot ?? input.projectPath;
        writeArtifactYaml(configRoot, runId, result.stateKey, result.artifact, { generated_by: nodeId });
        writeContextPacketYaml(configRoot, runId, nodeId, { node_id: nodeId, stateKey: result.stateKey });
      }

      // Extract foreshadow registry from episode outlines
      const episodes = artifacts['episode_outlines'] as any[];
      if (Array.isArray(episodes)) {
        const items = episodes
          .flatMap((ep: any) => (ep.foreshadowing ?? []).map((f: string) => ({ content: f, sourceEpisodeId: ep.id, status: 'pending' })));
        if (items.length > 0) {
          artifacts['foreshadow_registry'] = { items };
        }
      }

      const versionId = `ver_${Date.now().toString(36)}`;
      const deliveryId = `dlv_${Date.now().toString(36)}`;
      const feedbackId = `fb_${Date.now().toString(36)}`;

      return {
        runId, status: 'delivered', currentNodeId: null, completedNodes, artifacts,
        archive: { versionId },
        delivery: { deliveryId },
        feedback: { feedbackId },
        review: null,
      };
    },
  };
}
