import { describe, expect, it } from 'vitest';
import { executePythonNode } from '../src/modules/orchestration/engine/pythonNodeExecutor';

describe('python node executor', () => {
  it('executes the runner and parses a controlled failure payload when the node file is missing', async () => {
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

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected missing node file to produce a failure payload');
    }
    expect(result.error.type).toBe('NodeExecutionError');
    expect(result.error.retryable).toBe(false);
    expect(result.error.message).toContain('story_planner_agent.py');
  });
});
