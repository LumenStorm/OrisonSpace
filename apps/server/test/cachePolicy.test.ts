import { describe, expect, it } from 'vitest';
import { TASK_CACHE_TTL_MS } from '../src/modules/task/cachePolicy';

describe('cache policy', () => {
  it('uses a finite short term cache ttl', () => {
    expect(TASK_CACHE_TTL_MS).toBeGreaterThan(0);
    expect(TASK_CACHE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
