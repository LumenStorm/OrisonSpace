import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { NovelAutoModeState, NovelAutoModeStartRequest, NovelModelRuntime } from '@orison/shared-contracts';
import { saveAutoModeState } from './autoModeStore';
import { createFullNovelPlanningBundle } from './fullNovelPlanning';
import { createRunService } from '../runService';

type RunnerState = NovelAutoModeState;

export function createNovelAutoModeRunner() {
  let state: RunnerState | null = null;
  let modelRuntime: NovelModelRuntime | undefined;

  function assertStarted(): RunnerState {
    if (!state) throw new Error('Runner not started');
    return state;
  }

  function loadProject(projectPath: string) {
    const yamlPath = path.join(projectPath, 'project.yaml');
    if (existsSync(yamlPath)) {
      return YAML.parse(readFileSync(yamlPath, 'utf8'));
    }
    const jsonPath = path.join(projectPath, 'project.json');
    if (existsSync(jsonPath)) {
      return JSON.parse(readFileSync(jsonPath, 'utf8'));
    }
    throw new Error(`Project not found at ${projectPath}`);
  }

  return {
    async start(request: NovelAutoModeStartRequest & { modelRuntime?: NovelModelRuntime }): Promise<RunnerState> {
      const { projectPath, mode, chapterIds, plotSummary } = request;
      modelRuntime = request.modelRuntime;

      // Validate project exists
      const project = loadProject(projectPath);

      let pendingIds: string[];

      if (chapterIds) {
        pendingIds = chapterIds;
      } else {
        // Check if we need to bootstrap (project.json only, no project.yaml with chapters)
        const yamlPath = path.join(projectPath, 'project.yaml');
        const hasYaml = existsSync(yamlPath);
        const yamlProject = hasYaml ? YAML.parse(readFileSync(yamlPath, 'utf8')) : null;
        const chapters = yamlProject?.novel?.chapters;

        if (!chapters || chapters.length === 0) {
          // Bootstrap from plotSummary
          const bundle = createFullNovelPlanningBundle({
            projectPath,
            autoModeId: `auto_${Date.now().toString(36)}`,
            plotSummary: plotSummary || '',
          });
          pendingIds = bundle.chapterIds;
        } else {
          // Select non-final chapters
          pendingIds = chapters
            .filter((ch: any) => ch.status !== 'final')
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((ch: any) => ch.id);
        }
      }

      const autoModeId = `auto_${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      state = {
        autoModeId,
        projectPath,
        status: 'awaiting_approval',
        pendingChapterIds: pendingIds,
        completedChapterIds: [],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: pendingIds.length,
        startedAt: now,
        updatedAt: now,
        lastError: null,
        mode,
        planning: {
          status: 'generated' as const,
          artifactKeys: [],
          generatedAt: now,
        },
      };

      saveAutoModeState(state);
      return state;
    },

    async approvePlan(): Promise<RunnerState> {
      const s = assertStarted();
      s.status = 'running';
      s.planning = { ...s.planning!, status: 'approved' as const, approvedAt: new Date().toISOString() };
      s.updatedAt = new Date().toISOString();
      saveAutoModeState(s);
      return s;
    },

    async runOnce(): Promise<RunnerState> {
      const s = assertStarted();

      if (s.status === 'paused' || s.status === 'cancelled' || s.status === 'completed') {
        return s;
      }

      if (s.pendingChapterIds.length === 0) {
        s.status = 'completed';
        s.finishedAt = new Date().toISOString();
        s.updatedAt = new Date().toISOString();
        saveAutoModeState(s);
        return s;
      }

      const chapterId = s.pendingChapterIds[0];
      s.currentChapterId = chapterId;

      const service = createRunService();
      const run = await service.startNovelChapter({
        projectPath: s.projectPath,
        chapterId,
        mode: s.mode || 'generate',
        modelRuntime,
      });

      s.currentRunId = run.runId;
      s.pendingChapterIds = s.pendingChapterIds.slice(1);
      s.completedChapterIds = [...s.completedChapterIds, chapterId];
      s.currentChapterId = null;

      if (s.pendingChapterIds.length === 0) {
        s.status = 'completed';
        s.finishedAt = new Date().toISOString();
      }

      s.updatedAt = new Date().toISOString();
      saveAutoModeState(s);
      return s;
    },

    getState(): RunnerState {
      return assertStarted();
    },

    pause(): void {
      const s = assertStarted();
      s.status = 'paused';
      s.updatedAt = new Date().toISOString();
      saveAutoModeState(s);
    },

    resume(): void {
      const s = assertStarted();
      s.status = 'running';
      s.updatedAt = new Date().toISOString();
      saveAutoModeState(s);
    },

    cancel(): void {
      const s = assertStarted();
      s.status = 'cancelled';
      s.updatedAt = new Date().toISOString();
      saveAutoModeState(s);
    },
  };
}
