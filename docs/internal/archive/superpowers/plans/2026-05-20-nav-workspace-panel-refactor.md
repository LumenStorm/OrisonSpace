# Plan: 左侧导航重构 — Workspace 面板化

> **⚠️ SUPERSEDED** — 本方案已被更激进的 `ActivePage` 统一模型取代。最终实现见 `plan.md`（编辑器交互重构计划）。本文档仅作历史参考。

## 需求总结

将 Icon Rail 按功能类型分组，图片生成/视频/分镜/总览/资产库改为 workspace 中间区域的互斥切换面板（不再是 editor tab 或 standalone page），大纲保留 standalone 行为。novel/script 编辑器模式不做任何修改。

## 目标结构

```
Icon Rail (top section, 按类型分组，组间有分隔线):

  ─── 左侧面板切换 ───
  explorer    → 左侧面板切 ProjectTree
  search      → 左侧面板切 SearchPanel

  ─── 分隔线 ───

  ─── 编辑器/页面（不修改现有行为）───
  outline     → standalone 全宽页面（不变）
  novel/script → 编辑器模式（不变）

  ─── 分隔线 ───

  ─── Workspace 面板 ───
  overview    → workspace 面板：项目总览
  storyboard  → workspace 面板：分镜
  image_gen   → workspace 面板：图片生成
  video       → workspace 面板：视频
  assets      → workspace 面板：资产库（新增）

  ─── 分隔线 ───

  agent       → toggle 右侧 Agent Panel

Icon Rail (bottom section):
  settings
  account
```

## 中间区域行为

workspace 主内容区有三种互斥模式：

| 模式 | 触发 | 渲染内容 |
|------|------|----------|
| standalone | 点击 outline | OutlineEditor 全宽（不变） |
| editor | 点击 novel/script 或点击 FileTabBar tab | 不变（FileTabBar + EditorArea + BottomPanel） |
| workspace-panel | 点击 overview/storyboard/image_gen/video/assets | FileTabBar（保留可见）+ workspace 面板内容（替换编辑器内容区） |

**workspace-panel 模式关键行为**：
- FileTabBar 始终可见，用户可随时点击 tab 切回编辑器模式
- 点击 workspace 面板图标时，中间内容区切换为对应面板
- 面板之间互斥（同时只显示一个）
- 点击 FileTabBar 中的 tab 时，自动退出 workspace-panel 模式回到 editor 模式
- BottomPanel 在 workspace-panel 模式下**不显示**（与 standalone 行为一致）

**不修改的部分**：
- novel/script 编辑器模式的所有行为保持原样
- outline standalone 页面保持原样
- 左侧面板（ProjectTree/SearchPanel）保持原样
- Agent Panel 保持原样

## 改动清单

### 1. 类型定义变更

**修改 `apps/desktop/ui/src/shared/store/types.ts`**

```ts
// 新增 WorkspacePanel 类型
type WorkspacePanel = 'overview' | 'storyboard' | 'image_gen' | 'video' | 'assets';

// WorkspaceModule 简化：移除 overview/storyboard/video/image_gen
type WorkspaceModule = 'outline' | 'novel' | 'script';
```

### 2. Store 变更

**修改 `panelsSlice.ts`**

- 新增状态：`activeWorkspacePanel: WorkspacePanel | null`（null = 不在面板模式）
- 新增 action：`setActiveWorkspacePanel(panel: WorkspacePanel)` — 进入面板模式
- 新增 action：`clearWorkspacePanel()` — 退出面板模式
- `setActiveModule` 被调用时自动 `clearWorkspacePanel()`

**修改 `fileTabsSlice.ts`**

- 移除 `openModuleTab` action（storyboard/image_gen/video 不再作为 tab）
- 当 `setActiveFile` 被调用时（用户点击 tab），调用 `clearWorkspacePanel()`

### 3. SideNav 变更

**修改 `navItems.ts`**

```ts
// 编辑器/页面切换项
export const editorNavItems = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  // novel 或 script 由项目类型决定
];

// Workspace 面板项（新类型）
export type WorkspacePanelItem = { id: WorkspacePanel; icon: string; i18nKey: string };
export const workspacePanelItems: WorkspacePanelItem[] = [
  { id: 'overview', icon: 'dashboard', i18nKey: 'nav.overview' },
  { id: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { id: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { id: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
  { id: 'assets', icon: 'perm_media', i18nKey: 'nav.assets' },
];
```

**修改 `SideNav.tsx`**

- workspace 面板图标点击调用 `setActiveWorkspacePanel(id)`
- 分组之间渲染 `<div className="side-nav-separator" />`
- 高亮：workspace 面板图标在 `activeWorkspacePanel === id` 时高亮
- 移除 `moduleTabItems` 的 `openModuleTab` 逻辑

### 4. WorkspaceLayout 变更

**修改 `WorkspaceLayout.tsx`**

当前逻辑：
```
if standalone(activeModule) → OverviewPage | OutlineEditor
else → EditorArea + BottomPanel
```

新逻辑：
```
if activeModule === 'outline' → OutlineEditor (standalone)
else if activeWorkspacePanel !== null → FileTabBar + WorkspacePanelContent (无 BottomPanel)
else → EditorArea + BottomPanel (编辑器模式)
```

workspace-panel 模式渲染：
```tsx
<div className="workspace-main">
  <FileTabBar />
  <div className="workspace-panel-content">
    {activeWorkspacePanel === 'overview' && <OverviewPanel />}
    {activeWorkspacePanel === 'storyboard' && <StoryboardCanvas />}
    {activeWorkspacePanel === 'image_gen' && <ImageGenEditor />}
    {activeWorkspacePanel === 'video' && <VideoEditor />}
    {activeWorkspacePanel === 'assets' && <AssetsPanel />}
  </div>
</div>
```

### 5. 新增资产库面板

**新增 `apps/desktop/ui/src/features/assets/AssetsPanel.tsx`**

- 展示 `assets/images/` 目录下的已确认资产
- 网格布局，卡片式展示（复用图片生成模块的卡片样式）
- 支持预览、删除
- 遵循 Literary Sanctuary 设计：tonal layering、no-border、warm neutrals

### 6. OverviewPage 调整

**修改 `apps/desktop/ui/src/features/overview/OverviewPage.tsx`**

- 重命名为 `OverviewPanel`（或保留文件名但调整内部布局）
- 从 standalone 全宽假设改为适应 workspace-panel-content 容器
- 内容不变（项目名、类型、章节数/字数等）

### 7. EditorArea 清理

**修改 `EditorArea.tsx`**

- 移除 `__module__/` 前缀 tab 的特殊渲染逻辑（不再渲染 ImageGenEditor/StoryboardCanvas/VideoEditor）
- 保留文件 tab 渲染逻辑不变

### 8. 样式变更

**修改 `apps/desktop/ui/src/shared/styles/layout/sidebar.css`**

- 新增 `.side-nav-separator`：
  - 水平细线，`outline_variant` (#adb3b2) 15% opacity
  - margin: 8px auto，宽度 60%

**修改 `apps/desktop/ui/src/shared/styles/layout/workspace.css`**

- 新增 `.workspace-panel-content`：flex: 1，overflow: auto，背景 `surface` (#f9f9f8)

### 9. i18n 补充

新增 key：`nav.assets` → "Assets" / "资产库"

## 文件变更汇总

```
修改:
  apps/desktop/ui/src/shared/store/types.ts
  apps/desktop/ui/src/shared/store/panelsSlice.ts
  apps/desktop/ui/src/shared/store/fileTabsSlice.ts
  apps/desktop/ui/src/features/side-nav/navItems.ts
  apps/desktop/ui/src/features/side-nav/SideNav.tsx
  apps/desktop/ui/src/widgets/layout/WorkspaceLayout.tsx
  apps/desktop/ui/src/features/editor/EditorArea.tsx
  apps/desktop/ui/src/features/overview/OverviewPage.tsx
  apps/desktop/ui/src/shared/styles/layout/sidebar.css
  apps/desktop/ui/src/shared/styles/layout/workspace.css
  i18n yaml 文件 (en-US, zh-CN)

新增:
  apps/desktop/ui/src/features/assets/AssetsPanel.tsx
```

## 设计风格约束（遵循 design.md "Literary Sanctuary"）

- 分隔线使用 Ghost Border：`outline_variant` (#adb3b2) at 15% opacity，不用 1px solid
- 面板背景使用 `surface` (#f9f9f8)
- 面板内容区使用 `surface_container_lowest` (#ffffff)
- 高亮图标使用 `primary` (#4552c3)
- 无 1px solid border 做布局分隔，通过 tonal shift 区分区域
- 面板切换即时，无过渡动画（工具感）
- 资产库卡片使用 ambient shadow: `0 12px 40px rgba(45, 52, 51, 0.06)`

## 执行顺序

1. types.ts（类型基础）
2. panelsSlice.ts + fileTabsSlice.ts（状态逻辑）
3. navItems.ts + SideNav.tsx（导航 UI）
4. WorkspaceLayout.tsx（布局切换）
5. EditorArea.tsx（清理模块 tab 逻辑）
6. OverviewPage.tsx（适配面板容器）
7. AssetsPanel.tsx（新增）
8. 样式文件
9. i18n
10. 测试验证

## 风险点

- `WorkspaceModule` 移除 overview/storyboard/video/image_gen 后需要全局搜索并清理所有引用
- 已打开的 `__module__/*` tab 需要在升级时自动关闭或忽略
- BottomPanel 中 properties tab 当前根据 activeModule 显示不同参数 — workspace-panel 模式下不显示 BottomPanel，所以无影响
