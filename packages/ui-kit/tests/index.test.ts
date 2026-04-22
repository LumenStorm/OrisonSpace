import { describe, expect, it } from 'vitest';

describe('ui-kit', () => {
  it('exports a module', async () => {
    const mod = await import('../src/index');
    expect(mod).toBeDefined();
  });
});
