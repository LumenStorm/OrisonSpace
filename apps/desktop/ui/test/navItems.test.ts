import { describe, expect, it } from 'vitest';
import { novelNavItems } from '../src/features/side-nav/navItems';

describe('novelNavItems', () => {
  it('includes the guided novel workspace in the novel authoring rail', () => {
    expect(novelNavItems.some((item) => item.key === 'guided_novel')).toBe(true);
  });
});
