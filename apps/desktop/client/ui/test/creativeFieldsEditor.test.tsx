import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreativeFieldsEditor } from '../src/features/creative/CreativeFieldsEditor';
import { useAppStore } from '../src/shared/store/appStore';

describe('CreativeFieldsEditor', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.setState({
      activeCreativeTab: 'world_setting',
      setActiveCreativeTab: vi.fn((tab) => useAppStore.setState({ activeCreativeTab: tab })),
      creativeFields: {},
      fieldMetadata: {},
      toggleFieldLock: vi.fn(),
      resolvedLocale: 'zh-CN',
      updateField: vi.fn(),
      pendingPatch: null,
      patchSelections: {},
      togglePatchSelection: vi.fn(),
      applySelectedPatches: vi.fn(),
      setPendingPatch: vi.fn(),
    });
  });

  it('渲染 tab 栏并默认选中世设', () => {
    render(<CreativeFieldsEditor />);
    const tabs = screen.getByRole('navigation', { name: 'Creative Field Tabs' });
    expect(tabs).toBeTruthy();
    const activeTab = tabs.querySelector('.creative-tabActive');
    expect(activeTab?.textContent).toContain('世设');
  });

  it('点击 tab 切换到资产卡', async () => {
    render(<CreativeFieldsEditor />);
    const assetTab = screen.getByText('资产卡');
    await userEvent.click(assetTab);
    expect(useAppStore.getState().activeCreativeTab).toBe('asset_cards');
  });

  it('FieldHeader 显示版本号和 stale 标记', () => {
    useAppStore.setState({
      fieldMetadata: {
        world_setting: {
          version: 3,
          source: 'agent',
          locked: false,
          dependsOn: [],
          stale: true
        }
      }
    });

    render(<CreativeFieldsEditor />);
    expect(screen.getByText('v3')).toBeTruthy();
    // stale badge 存在（不依赖具体翻译文本）
    const staleBadge = document.querySelector('.field-stale-badge');
    expect(staleBadge).toBeTruthy();
  });

  it('锁定按钮调用 toggleFieldLock', async () => {
    render(<CreativeFieldsEditor />);
    const lockBtn = document.querySelector('.field-lock-btn') as HTMLButtonElement;
    expect(lockBtn).toBeTruthy();
    await userEvent.click(lockBtn);
    expect(useAppStore.getState().toggleFieldLock).toHaveBeenCalledWith('world_setting');
  });

  it('有数据时世设视图显示 premise', () => {
    useAppStore.setState({
      creativeFields: {
        world_setting: {
          premise: '永夜都市',
          era: '近未来',
          locations: [],
          rules: [],
          power_structures: [],
          taboos: [],
          visual_language: [],
          tone_rules: [],
          open_questions: []
        }
      }
    });

    render(<CreativeFieldsEditor />);
    expect(screen.getByText('永夜都市')).toBeTruthy();
  });

  it('无数据时显示空状态', () => {
    render(<CreativeFieldsEditor />);
    const emptyEl = document.querySelector('.creative-empty');
    expect(emptyEl).toBeTruthy();
  });
});
