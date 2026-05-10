import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceLayout } from '../src/widgets/layout/WorkspaceLayout';
import { useAppStore } from '../src/shared/store/appStore';

vi.mock('../src/shared/i18n/useI18n', () => ({
  availableLocales: ['en-US', 'zh-CN'],
  detectSystemLocale: () => 'en-US',
  useI18n: () => ({
    t: (key: string) => key,
    tArray: () => [],
    ready: true,
  }),
}));

describe('WorkspaceLayout', () => {
  it('renders object navigation, context rail, and system rail for novel projects', () => {
    useAppStore.setState({
      currentProject: {
        name: 'Memory City',
        path: 'C:/Projects/MemoryCity',
        type: 'novel',
      },
    } as any);

    render(<WorkspaceLayout />);

    expect(screen.getByLabelText('Novel Object Navigation')).toBeTruthy();
    expect(screen.getByLabelText('Context Rail')).toBeTruthy();
    expect(screen.getByLabelText('System Rail')).toBeTruthy();
  });
});
