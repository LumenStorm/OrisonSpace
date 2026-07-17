import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOpenProject } from '../src/shared/hooks/useOpenProject';
import { useAppStore } from '../src/shared/store/appStore';

describe('useOpenProject', () => {
  beforeEach(() => {
    useAppStore.setState({
      resolvedLocale: 'zh-CN',
      openProject: vi.fn().mockResolvedValue({ opened: true, failed: [] }),
    } as any);

    (window as any).orisonDesktop = {
      pickProjectDirectory: vi.fn().mockResolvedValue('C:\\Projects\\Restored'),
      loadProjectMeta: vi.fn().mockResolvedValue({
        projectId: '00007',
        name: '已恢复项目',
        type: 'novel',
      }),
      ensureProjectRegistration: vi.fn().mockResolvedValue({
        projectId: '00007',
        name: '已恢复项目',
        type: 'novel',
      }),
      ensureProjectDocument: vi.fn().mockResolvedValue(undefined),
      saveProjectMeta: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('打开带持久项目编号的目录时仍会重新校验注册，以恢复软归档项目', async () => {
    const { result } = renderHook(() => useOpenProject());

    await act(async () => {
      await result.current();
    });

    expect(window.orisonDesktop.ensureProjectRegistration).toHaveBeenCalledWith({
      projectId: '00007',
      name: '已恢复项目',
      type: 'novel',
      localFingerprint: 'C:\\Projects\\Restored',
      path: 'C:\\Projects\\Restored',
      coverImage: undefined,
    });
    expect(useAppStore.getState().openProject).toHaveBeenCalledWith(expect.objectContaining({
      projectId: '00007',
      path: 'C:\\Projects\\Restored',
    }));
  });
});
