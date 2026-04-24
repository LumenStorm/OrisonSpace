import { describe, expect, it } from 'vitest';
import { orchestrationNodeConfigSchema } from '@orison/shared-contracts';

describe('python node config schema', () => {
  it('accepts a python runtime node declaration', () => {
    const parsed = orchestrationNodeConfigSchema.parse({
      agentId: 'story-planner-agent',
      runtime: 'python',
      entry: './python/nodes/story_planner_agent.py',
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
  });
});
