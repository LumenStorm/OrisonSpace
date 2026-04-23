import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrchestrationClient } from '../orchestration/api/client';

describe('orchestration client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        runId: 'run_1',
        status: 'approved',
        currentNodeId: null,
        projectPath: 'I:/workspace/demo',
        completedNodes: ['intake-agent'],
        pendingNodes: [],
        artifacts: {},
        review: null,
        archive: null
      })
    }));
  });

  it('starts a run through the orchestration endpoint', async () => {
    const client = createOrchestrationClient();
    const run = await client.startRun({
      projectPath: 'I:/workspace/demo',
      requirement: 'Generate a dark draft.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.runId).toBe('run_1');
    expect(run.status).toBe('approved');
  });
});
