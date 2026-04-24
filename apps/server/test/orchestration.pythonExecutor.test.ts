import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executePythonNode } from '../src/modules/orchestration/engine/pythonNodeExecutor';

const MOCK_STORY_PLAN = JSON.stringify({
  title: 'Mock Story',
  premise: 'A test premise',
  tone: 'dark',
  acts: [{ id: 'act_1', title: 'Act 1', goal: 'Open', conflict: 'None', turn: 'None' }],
  characters: [{ id: 'char_1', name: 'Hero', role: 'protagonist', goal: 'survive', risk: 'death' }]
});

describe('python node executor', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_STORY_PLAN;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('executes the runner and parses a success payload', async () => {
    const result = await executePythonNode({
      pythonCommand: 'python',
      runnerPath: 'python-agent/runner/main.py',
      request: {
        runId: 'run_1',
        nodeId: 'story-planner-agent',
        nodeFile: 'python-agent/nodes/story_planner_agent.py',
        configFile: 'I:/workspace/demo/project-config/agents/story-planner-agent.yaml',
        projectPath: 'I:/workspace/demo',
        config: {
          agentId: 'story-planner-agent',
          runtime: 'python',
          entry: './python-agent/nodes/story_planner_agent.py',
          model: 'gpt-5.4',
          execution: { timeoutMs: 30000, maxRetries: 2 },
          prompt: { file: './project-config/prompts/story-planner.yaml', systemKey: 'system', userKey: 'user' },
          inputs: { fromState: ['intake.requirement'], mappings: { requirement: 'intake.requirement' } },
          outputs: { artifactType: 'story_plan', stateKey: 'planning.storyPlan' },
          review: { passRules: ['has_structure'], escalateOn: ['missing_conflict'] }
        },
        prompt: { system: 'system', user: 'user' },
        input: { requirement: 'Write a dark opening.', artifacts: {} }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`expected a success payload, got ${result.error.message}`);
    }
    expect(result.state_key ?? result.stateKey).toBe('planning.storyPlan');
    expect(result.artifact).toMatchObject({
      title: 'Mock Story'
    });
  });
});
