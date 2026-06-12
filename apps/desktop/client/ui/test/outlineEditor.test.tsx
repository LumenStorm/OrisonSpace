import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useAppStore } from '../src/shared/store/appStore';
import { OutlineEditor } from '../src/features/editor/OutlineEditor';

vi.mock('../src/features/editor/TiptapEditor', () => ({
  TiptapEditor: ({ content = '', onChange }: { content?: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="Mock Tiptap"
      value={content}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

declare global {
  interface Window {
    orisonDesktop: any;
  }
}

describe('OutlineEditor regressions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({
      currentProject: { name: 'Demo', path: '/demo', type: 'novel' },
      projectDocumentHydrated: false,
      creativeFields: {},
      fieldMetadata: {},
      resolvedLocale: 'en-US',
    });
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = {
      syncField: vi.fn(async () => undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('首次渲染且 store 尚未 hydrate 时，不应立即把空 outline 落盘', async () => {
    const { container, unmount } = render(<OutlineEditor />);

    // 未 hydrate 时只渲染骨架屏，不挂载表单
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(600);

    expect(window.orisonDesktop.syncField).not.toHaveBeenCalled();

    unmount();
    await vi.runOnlyPendingTimersAsync();
  });
});
