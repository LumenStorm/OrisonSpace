import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('agent port configuration', () => {
  it('defaults to the project agent port that avoids 4001 conflicts', async () => {
    const originalPort = process.env.PORT;
    delete process.env.PORT;
    vi.resetModules();

    try {
      const { env } = await import('../src/env');
      expect(env.PORT).toBe(18422);
    } finally {
      if (originalPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }
    }
  });

  it('keeps the tracked dev env file on the same non-conflicting port', () => {
    const envFile = readFileSync(path.resolve(__dirname, '../.env.agent'), 'utf8');
    expect(envFile).toContain('PORT=18422');
    expect(envFile).not.toContain('PORT=4001');
  });

  it('loads the tracked agent env file in dev instead of the ignored local env file', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.dev).toContain('--env-file=.env.agent');
    expect(packageJson.scripts.dev).not.toContain('--env-file=.env ');
  });
});
