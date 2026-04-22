import { describe, expect, it } from 'vitest';

describe('shared-utils', () => {
  it('exports a module', async () => {
    const mod = await import('../src/index');
    expect(mod).toBeDefined();
  });
});
