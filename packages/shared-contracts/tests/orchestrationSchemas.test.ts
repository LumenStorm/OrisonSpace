import { describe, expect, it } from 'vitest';
import {
  orchestrationActionSchema,
  orchestrationNodeConfigSchema,
  orchestrationRunSchema,
} from '../src/orchestration';

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
      model: 'gpt-5.4',
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
});
