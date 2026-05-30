import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { executePythonNode } from './pythonNodeExecutor';
import { registerRun } from './runStore';
import { writeArtifactYaml, writeContextPacketYaml } from './artifactYaml';
import type { NovelModelRuntime } from '@orison/shared-contracts';
import { executeRecallStep } from '@orison/desktop-local-bff';

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

  // For continue mode, load existing draft
  if (mode === 'continue' && chapter.content_file) {
    const contentPath = path.join(project._projectPath!, chapter.content_file);
    if (existsSync(contentPath)) {
      ctx.draftText = readFileSync(contentPath, 'utf8');
    }
  }

  // Load previous chapters for context
  const sortedChapters = [...chapters].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const chapterIdx = sortedChapters.findIndex((ch: any) => ch.id === chapterId);
  if (chapterIdx > 0) {
    const prev = sortedChapters[chapterIdx - 1];
    if (prev.content_file) {
      const prevPath = path.join(project._projectPath!, prev.content_file);
      if (existsSync(prevPath)) {
        ctx.previousChapterText = readFileSync(prevPath, 'utf8');
      }
    }
  }

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

      // Phase 3: draft writer
      const draftResult = await runPythonAgent('novel-draft-writer', {
        artifacts: {
          'context.chapterContext': chapterContext,
          'context.bridgeGuidance': bridgeGuidance,
          'context.recalledMemories': artifacts['context.recalledMemories'] ?? '',
          'draft.initial': mode === 'continue' ? { text: chapterContext.draftText ?? '' } : {},
        },
      }, { modelRuntime });
      artifacts[draftResult.stateKey] = draftResult.artifact;
      completedNodes.push('draft-writer-agent');

      // Phase 4: review
      const reviewResult = await runPythonAgent('multi-review', {
        artifacts: { 'draft.initial': draftResult.artifact },
      }, { modelRuntime });
      artifacts['review.result'] = reviewResult.artifact;
      completedNodes.push('multi-review-agent');

      // Build candidate
      const draft = draftResult.artifact as any;
      artifacts['chapter.candidate'] = {
        title: draft?.title ?? '',
        content: draft?.text ?? '',
        summary: '',
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
