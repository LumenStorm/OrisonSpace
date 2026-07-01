import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

  it('连续手动输入：本地值不被回灌覆盖，且只 debounce 落盘一次', async () => {
    useAppStore.setState({
      projectDocumentHydrated: true,
      // updateField writes a new object into store.creativeFields.outline;
      // the editor must NOT re-hydrate from its own write and clobber typing.
      updateField: (field: string, data: unknown) => {
        useAppStore.setState((s) => ({ creativeFields: { ...s.creativeFields, [field]: data } }) as any);
        if (field === 'outline') {
          void window.orisonDesktop.syncField('/demo', field, data);
        }
      },
    } as any);

    const { container, unmount } = render(<OutlineEditor />);
    const input = container.querySelector('.outline-tag-input') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Type three characters with re-renders between (store updates round-trip).
    fireEvent.change(input, { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(100);
    fireEvent.change(input, { target: { value: 'ab' } });
    await vi.advanceTimersByTimeAsync(100);
    fireEvent.change(input, { target: { value: 'abc' } });

    // Mid-burst the input keeps the latest value (not reverted to a stale one).
    expect((container.querySelector('.outline-tag-input') as HTMLInputElement).value).toBe('abc');

    // Debounce not yet elapsed → no write.
    expect(window.orisonDesktop.syncField).not.toHaveBeenCalled();

    // After the debounce window, exactly one write with the final value.
    await vi.advanceTimersByTimeAsync(600);
    expect(window.orisonDesktop.syncField).toHaveBeenCalledTimes(1);
    const [, field, data] = (window.orisonDesktop.syncField as any).mock.calls[0];
    expect(field).toBe('outline');
    expect((data as { story_type?: string }).story_type).toBe('abc');
    // Input still shows what was typed — no clobber from the self-write echo.
    expect((container.querySelector('.outline-tag-input') as HTMLInputElement).value).toBe('abc');

    unmount();
    await vi.runOnlyPendingTimersAsync();
  });
});
