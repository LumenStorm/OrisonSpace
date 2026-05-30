import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

interface PlanningBundleInput {
  projectPath: string;
  autoModeId: string;
  plotSummary: string;
}

interface PlanningBundle {
  artifacts: {
    world_setting: { premise: string };
    episode_outlines: Array<{ id: string; title: string; goal: string }>;
  };
}

interface PlanningBundleResult {
  chapterIds: string[];
  bundle: PlanningBundle;
  bundlePath: string;
}

export function createFullNovelPlanningBundle(input: PlanningBundleInput): PlanningBundleResult {
  const { projectPath, autoModeId, plotSummary } = input;

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

  // Determine chapter count
  const targetChapters = project.novel?.target_chapters ?? 6;

  // Generate chapter IDs
  const chapterIds = Array.from({ length: targetChapters }, (_, i) =>
    `ch_${String(i + 1).padStart(3, '0')}`
  );

  // Generate episode outlines
  const episodeOutlines = chapterIds.map((id, i) => ({
    id,
    title: `第${i + 1}章`,
    goal: `章节 ${i + 1} 叙事目标`,
  }));

  // Build bundle
  const bundle: PlanningBundle = {
    artifacts: {
      world_setting: { premise: plotSummary },
      episode_outlines: episodeOutlines,
    },
  };

  // Ensure project structure
  if (!project.creative) project.creative = {};
  project.creative.creative_brief = { rawRequirement: plotSummary };
  project.creative.asset_cards = episodeOutlines.map((ep) => ({ chapterId: ep.id, title: ep.title }));

  if (!project.novel) project.novel = {};
  project.novel.chapters = chapterIds.map((id, i) => ({
    id,
    title: `第${i + 1}章`,
    sort_order: i,
    content_file: `chapters/${id}.md`,
    status: 'draft',
    summary: '',
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
