import { describe, expect, it } from 'vitest';
import {
  orchestrationActionSchema,
  orchestrationNodeConfigSchema,
  orchestrationRunSchema,
} from '../src/orchestration';
import {
  novelAutoModeActionSchema,
  novelAutoModeStartRequestSchema,
  novelAutoModeStateSchema,
  novelChapterRunRequestSchema,
} from '../src/contracts/novel-orchestration';

describe('orchestration schemas', () => {
  it('accepts a valid run snapshot', () => {
    const parsed = orchestrationRunSchema.parse({
      runId: 'run_1',
      status: 'running',
      currentNodeId: 'story-planner-agent',
      projectPath: 'I:/workspace/demo',
      completedNodes: ['intake-agent'],
      pendingNodes: ['asset-loader-agent', 'story-planner-agent'],
      artifacts: {
        intake: { requirement: 'Write a suspenseful story.' }
      },
      review: null,
      archive: null
    });

    expect(parsed.currentNodeId).toBe('story-planner-agent');
  });

  it('accepts a valid node config with YAML prompt file', () => {
    const parsed = orchestrationNodeConfigSchema.parse({
      agentId: 'story-planner-agent',
      runtime: 'python',
      entry: './python-agent/nodes/story_planner_agent.py',
      model: 'gpt-5.4',
      execution: {
        timeoutMs: 30000,
        maxRetries: 2
      },
      prompt: {
        file: './prompts/story-planner.yaml',
        systemKey: 'system',
        userKey: 'user'
      },
      inputs: {
        fromState: ['intake.requirement'],
        mappings: { requirement: 'intake.requirement' }
      },
      outputs: {
        artifactType: 'story_plan',
        stateKey: 'planning.storyPlan'
      },
      review: {
        passRules: ['has_structure'],
        escalateOn: ['missing_conflict']
      }
    });

    expect(parsed.runtime).toBe('python');
    expect(parsed.entry).toContain('story_planner_agent.py');
    expect(parsed.prompt.file).toContain('story-planner.yaml');
  });

  it('accepts a valid human action command', () => {
    const parsed = orchestrationActionSchema.parse({
      runId: 'run_1',
      action: 'rerun_from_node',
      nodeId: 'draft-writer-agent'
    });

    expect(parsed.action).toBe('rerun_from_node');
  });

  it('accepts full-novel auto mode planning approval state', () => {
    const parsed = novelAutoModeStateSchema.parse({
      autoModeId: 'auto_1',
      projectPath: 'I:/workspace/demo',
      status: 'awaiting_approval',
      pendingChapterIds: [],
      completedChapterIds: [],
      currentChapterId: null,
      currentRunId: null,
      totalChapters: 0,
      lastError: null,
      plotSummary: 'A detective follows a city-wide mystery.',
      planning: {
        status: 'generated',
        bundlePath: 'runs/auto-mode/auto_1-planning-bundle.yaml',
        artifactKeys: ['creative_brief', 'world_setting', 'episode_outlines'],
        generatedAt: '2026-05-11T00:00:00.000Z',
      },
    });

    expect(parsed.status).toBe('awaiting_approval');
    expect(parsed.planning?.artifactKeys).toContain('episode_outlines');
  });

  it('accepts selected novel writing model runtime config', () => {
    const chapter = novelChapterRunRequestSchema.parse({
      projectPath: 'I:/workspace/novel_001',
      chapterId: 'ch_001',
      mode: 'generate',
      modelRuntime: {
        keyId: 'key_001',
        modelId: 'gpt-5.4',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      },
    });
    expect(chapter.modelRuntime?.modelId).toBe('gpt-5.4');

    const auto = novelAutoModeStartRequestSchema.parse({
      projectPath: 'I:/workspace/novel_001',
      modelRuntime: {
        keyId: 'key_001',
        modelId: 'gpt-5.4',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      },
    });
    expect(auto.modelRuntime?.keyId).toBe('key_001');
  });

  it('accepts plot summary on start and approve_plan action', () => {
    const start = novelAutoModeStartRequestSchema.parse({
      projectPath: 'I:/workspace/demo',
      plotSummary: 'Human-approved premise.',
    });
    const action = novelAutoModeActionSchema.parse({
      autoModeId: 'auto_1',
      action: 'approve_plan',
    });

    expect(start.plotSummary).toBe('Human-approved premise.');
    expect(action.action).toBe('approve_plan');
  });
});
