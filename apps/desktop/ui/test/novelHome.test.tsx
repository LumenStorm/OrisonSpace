import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NovelHome } from '../src/features/novel-home/NovelHome';

describe('NovelHome', () => {
  it('shows the guided and manual writing entry points in Chinese', () => {
    render(<NovelHome />);
    expect(screen.getByText('开始引导创作')).toBeTruthy();
    expect(screen.getByText('继续手动写作')).toBeTruthy();
  });
});
