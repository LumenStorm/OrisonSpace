import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { executePythonNode } from '../pythonNodeExecutor';

const AGENT_DIR = path.resolve(__dirname, '../../../python');

function resolvePromptFile(promptPath: string): { system: string; user: string } {
  const resolved = path.resolve(AGENT_DIR, '..', promptPath);
  if (!existsSync(resolved)) return { system: '', user: '' };
  const content = YAML.parse(readFileSync(resolved, 'utf8'));
  return { system: content.system || '', user: content.user || '' };
}

interface PlanningBundleInput {
  projectPath: string;
  autoModeId: string;
  plotSummary: string;
  modelRuntime?: { apiKey?: string; baseUrl?: string; modelId?: string };
}

interface PlanningBundle {
  artifacts: Record<string, unknown>;
}

interface PlanningBundleResult {
  chapterIds: string[];
  bundle: PlanningBundle;
  bundlePath: string;
}

async function callAgent(nodeId: string, input: Record<string, unknown>, modelRuntime?: PlanningBundleInput['modelRuntime']): Promise<{ stateKey: string; artifact: unknown }> {
  const nodeFile = path.join(AGENT_DIR, 'nodes', `${nodeId.replace(/-/g, '_')}_agent.py`);
  const prompt = resolvePromptFile(`prompts/${nodeId}.yaml`);

  const prevEnv = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_BASE_URL: process.env.OPENAI_BASE_URL };
  if (modelRuntime?.apiKey) process.env.OPENAI_API_KEY = modelRuntime.apiKey;
  if (modelRuntime?.baseUrl) process.env.OPENAI_BASE_URL = modelRuntime.baseUrl;

  try {
    const result = await executePythonNode({
      pythonCommand: 'python',
      runnerPath: path.join(AGENT_DIR, 'runner/main.py'),
      request: {
        runId: `run_plan_${Date.now().toString(36)}`,
        nodeId,
        nodeFile,
        projectPath: '',
        config: { model: modelRuntime?.modelId ?? 'gpt-4o-mini' },
        prompt,
        input,
      },
    });
    if (!result.ok) throw new Error(`Node ${nodeId} failed: ${result.error.message}`);
    return { stateKey: result.state_key ?? result.stateKey ?? '', artifact: result.artifact };
  } finally {
    if (prevEnv.OPENAI_API_KEY) process.env.OPENAI_API_KEY = prevEnv.OPENAI_API_KEY;
    else delete process.env.OPENAI_API_KEY;
    if (prevEnv.OPENAI_BASE_URL) process.env.OPENAI_BASE_URL = prevEnv.OPENAI_BASE_URL;
    else delete process.env.OPENAI_BASE_URL;
  }
}

export async function createFullNovelPlanningBundle(input: PlanningBundleInput): Promise<PlanningBundleResult> {
  const { projectPath, autoModeId, plotSummary, modelRuntime } = input;

  // Load or bootstrap project.yaml
  let project: any;
  const yamlPath = path.join(projectPath, 'project.yaml');
  const jsonPath = path.join(projectPath, 'project.json');

  if (existsSync(yamlPath)) {
    project = YAML.parse(readFileSync(yamlPath, 'utf8'));
  } else if (existsSync(jsonPath)) {
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    project = {
      meta: { id: json.projectId || json.id || 'auto', name: json.name, type: json.type || 'novel', version: 1 },
    };
  } else {
    throw new Error(`Project not found at ${projectPath}`);
  }

  const targetChapters = project.novel?.target_chapters ?? 6;
  let storyPlan: any = null;
  let episodeOutlines: any[] | null = null;
  let curves: any = null;

  if (modelRuntime?.apiKey) {
    // AI-driven planning
    const plannerResult = await callAgent('story-planner', {
      requirement: plotSummary,
      artifacts: {},
    }, modelRuntime);
    storyPlan = plannerResult.artifact;

    const episodePlannerResult = await callAgent('episode-planner', {
      requirement: plotSummary,
      artifacts: { 'planning.storyPlan': storyPlan },
    }, modelRuntime);
    episodeOutlines = episodePlannerResult.artifact as any[];

    const curvePlannerResult = await callAgent('curve-planner', {
      requirement: plotSummary,
      artifacts: { 'planning.storyPlan': storyPlan, 'episode_outlines': episodeOutlines },
    }, modelRuntime);
    curves = curvePlannerResult.artifact;
  }

  // Determine chapter IDs
  const chapterIds = Array.isArray(episodeOutlines)
    ? episodeOutlines.map((ep: any) => ep.id || `ch_${String((ep.index ?? 0) + 1).padStart(3, '0')}`)
    : Array.from({ length: targetChapters }, (_, i) => `ch_${String(i + 1).padStart(3, '0')}`);

  // Build bundle
  const stubEpisodes = chapterIds.map((id, i) => ({ id, title: `第${i + 1}章`, goal: `章节 ${i + 1} 叙事目标` }));
  const finalEpisodes = episodeOutlines ?? stubEpisodes;

  const bundle: PlanningBundle = {
    artifacts: {
      world_setting: storyPlan?.world_setting ?? { premise: plotSummary },
      outline: storyPlan?.outline ?? storyPlan,
      episode_outlines: finalEpisodes,
      growth_curve: curves?.growth_curve ?? [],
      pacing_curve: curves?.pacing_curve ?? {},
      emotion_curve: curves?.emotion_curve ?? {},
    },
  };

  // Update project structure
  if (!project.creative) project.creative = {};
  project.creative.outline = storyPlan?.outline ?? storyPlan;
  project.creative.episode_outlines = finalEpisodes;
  project.creative.asset_cards = finalEpisodes.map((ep: any) => ({ chapterId: ep.id, title: ep.title }));
  if (curves?.growth_curve) project.creative.growth_curve = curves.growth_curve;
  if (curves?.pacing_curve) project.creative.pacing_curve = curves.pacing_curve;
  if (curves?.emotion_curve) project.creative.emotion_curve = curves.emotion_curve;
  project.creative.creative_brief = { rawRequirement: plotSummary };

  if (!project.novel) project.novel = {};
  project.novel.chapters = chapterIds.map((id, i) => ({
    id,
    title: episodeOutlines?.[i]?.title ?? `第${i + 1}章`,
    sort_order: i,
    content_file: `chapters/${id}.md`,
    status: 'draft',
    summary: episodeOutlines?.[i]?.summary ?? '',
  }));

  // Write project.yaml
  writeFileSync(yamlPath, YAML.stringify(project), 'utf8');

  // Write bundle
  const bundleDir = path.join(projectPath, 'runs', 'planning');
  if (!existsSync(bundleDir)) mkdirSync(bundleDir, { recursive: true });
  const bundlePath = path.join(bundleDir, `${autoModeId}.yaml`);
  writeFileSync(bundlePath, YAML.stringify(bundle), 'utf8');

  return { chapterIds, bundle, bundlePath };
}
