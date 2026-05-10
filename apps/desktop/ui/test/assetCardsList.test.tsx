import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCardsList } from '../src/features/creative/AssetCardsList';
import { useAppStore } from '../src/shared/store/appStore';

describe('AssetCardsList', () => {
  beforeEach(() => {
    (window as any).orisonDesktop = {
      deleteAssetArchive: vi.fn().mockResolvedValue(undefined),
    };

    useAppStore.setState({
      resolvedLocale: 'zh-CN',
      currentProject: {
        projectId: '00001',
        name: 'Archive Project',
        path: 'C:\\Projects\\ArchiveProject',
        type: 'novel',
      },
      activeModule: 'outline',
      setActiveModule: vi.fn((module) => useAppStore.setState({ activeModule: module })),
      creativeFields: {
        asset_cards: [
          {
            id: 'char_lin_qi',
            type: 'character',
            name: '林七',
            summary: '冷静克制的调查员',
            tags: ['主角'],
            relationships: [],
            sourceRefs: ['assets/characters/lin-qi.yaml'],
            status: 'active',
            archive: {
              path: 'assets/characters/lin-qi.yaml',
              slug: 'lin-qi',
              schemaVersion: 1,
            },
            visuals: {
              primaryImage: 'assets/images/lin-qi-main.png',
              gallery: [
                {
                  id: 'img_main',
                  path: 'assets/images/lin-qi-main.png',
                  kind: 'primary',
                },
              ],
            },
            details: {
              profile: {
                role: '主角',
              },
              persona: {
                personality: '冷静',
              },
            },
          },
        ],
      },
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders localized Chinese labels for archive actions and fields', () => {
    render(<AssetCardsList />);

    expect(screen.getAllByText('林七').length).toBeGreaterThan(0);
    expect(screen.getByText('assets/characters/lin-qi.yaml')).toBeTruthy();
    expect(screen.getByRole('button', { name: '新建角色' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '生成图片' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存档案' })).toBeTruthy();
    expect(screen.getAllByText('角色 / 启用').length).toBeGreaterThan(0);
    expect(screen.getByText('主图')).toBeTruthy();
    expect(screen.getByText('名称')).toBeTruthy();
  });

  it('switches to image generation for the selected archive', async () => {
    render(<AssetCardsList />);

    await userEvent.click(screen.getByRole('button', { name: '生成图片' }));

    expect(useAppStore.getState().activeModule).toBe('image_gen');
    expect((useAppStore.getState() as any).assetArchiveTarget?.assetId).toBe('char_lin_qi');
  });

  it('deletes a supported archive after confirmation', async () => {
    render(<AssetCardsList />);

    await userEvent.click(screen.getByRole('button', { name: '删除档案' }));
    expect(screen.getByText('删除后将同时移除档案文件和关联图片，且不可恢复。')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(window.orisonDesktop.deleteAssetArchive).toHaveBeenCalledWith(
        'C:\\Projects\\ArchiveProject',
        'char_lin_qi',
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('林七')).toBeNull();
    });
  });

  it('does not show archive delete controls for legacy cards', () => {
    useAppStore.setState({
      creativeFields: {
        asset_cards: [
          {
            id: 'legacy_org',
            type: 'organization',
            name: '旧组织',
            summary: '兼容卡片',
            tags: [],
            relationships: [],
            sourceRefs: [],
            status: 'draft',
          },
        ],
      },
    } as any);

    render(<AssetCardsList />);

    expect(screen.queryByRole('button', { name: '删除档案' })).toBeNull();
  });
});
