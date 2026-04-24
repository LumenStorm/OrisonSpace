import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/engine/runService';

describe('openai api key missing failure path', () => {
  it('routes to human_in_loop when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;

    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('human_in_loop');
    // 第一个调用 LLM 的节点（intake-agent）会因缺少 API key 而失败
    expect(run.currentNodeId).toBe('intake-agent');
    expect(run.review?.summary ?? '').toContain('OPENAI_API_KEY');
  });
});
