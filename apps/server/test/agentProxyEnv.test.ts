import { describe, expect, it, vi } from 'vitest';

describe('server agent proxy environment', () => {
  it('defaults AGENT_URL to the non-conflicting agent port', async () => {
    const originalAgentUrl = process.env.AGENT_URL;
    delete process.env.AGENT_URL;
    vi.resetModules();

    try {
      const { env } = await import('../src/common/env');
      expect(env.AGENT_URL).toBe('http://localhost:18422');
    } finally {
      if (originalAgentUrl === undefined) {
        delete process.env.AGENT_URL;
      } else {
        process.env.AGENT_URL = originalAgentUrl;
      }
    }
  });
});
