# Plan: 左侧 UI 重构 — Icon Rail + 搜索面板 + 编辑区 Tab 化 ✅ DONE

## 需求总结

1. **Icon Rail 调整**: Agent 图标从底部移到 video 图标下方（成为 top section 的一部分）
2. **新增搜索**: Icon Rail top section 加入搜索图标，点击后左侧面板从 ProjectTree 切换为 SearchPanel（VSCode 风格，互斥）
3. **编辑区 Tab 化**: 图片生成、分镜、视频 不再独占编辑区，而是作为 EditorArea 里的 tab 页，和打开的文件 tab 并存

## 当前结构

```
Icon Rail (top):  outline | novel/script | storyboard | image_gen | video
Icon Rail (bottom): agent | settings | account

左侧面板: ProjectTree (固定)
编辑区: image_gen/video/storyboard 时 → ModuleEditor 独占
         其他时 → FileTabBar + FileEditor
```

## 目标结构

```
Icon Rail (top):  outline | novel/script | storyboard | image_gen | video | agent | search
Icon Rail (bottom): settings | account

左侧面板: ProjectTree 或 SearchPanel (互斥，由 icon rail 的 search 图标切换)
编辑区: 统一 tab 系统 — 文件 tab + 模块 tab (image_gen / storyboard / video) 并存
```

## 改动清单

### 1. Store 变更

**修改 `apps/desktop/ui/src/shared/store/types.ts`**
- 新增 `SidebarPanel` 类型: `'explorer' | 'search'`

**修改 `apps/desktop/ui/src/shared/store/panelsSlice.ts`**
- 新增状态: `activeSidebarPanel: SidebarPanel` (默认 `'explorer'`)
- 新增 action: `setActiveSidebarPanel(panel: SidebarPanel)`
- 当 `activeSidebarPanel` 切换时自动打开左侧面板 (`projectTreeOpen = true`)

**修改 `apps/desktop/ui/src/shared/store/fileTabsSlice.ts`**
- 扩展 `FileTabKind`: `'text' | 'image' | 'module'`
- 新增 action: `openModuleTab(moduleId: string, label: string)` — 打开一个模块 tab
- 模块 tab 的 `path` 用特殊前缀: `__module__/image_gen`, `__module__/storyboard`, `__module__/video`
- 模块 tab 不需要 content/savedContent（永远 clean）

### 2. Icon Rail 变更

**修改 `apps/desktop/ui/src/features/side-nav/navItems.ts`**
- 从 navItems 中移除 `storyboard`, `image_gen`, `video`（它们不再是模块切换，而是打开 tab）
- 新增 `agent` 和 `search` 到 navItems 末尾

**修改 `apps/desktop/ui/src/features/side-nav/SideNav.tsx`**
- Agent 按钮从 bottom section 移到 top section（作为 navItems 的一部分）
- 新增 search 按钮逻辑: 点击时 `setActiveSidebarPanel('search')` + 确保左侧面板打开
- `storyboard`, `image_gen`, `video` 的点击行为改为: 调用 `openModuleTab(key, label)` 而不是 `setActiveModule`
- bottom section 只保留 settings 和 account

### 3. 左侧面板切换

**修改 `apps/desktop/ui/src/widgets/layout/WorkspaceLayout.tsx`**
- 根据 `activeSidebarPanel` 渲染 `<ProjectTree />` 或 `<SearchPanel />`

**新增 `apps/desktop/ui/src/features/search-panel/SearchPanel.tsx`**
- 搜索输入框 + 结果列表
- 搜索调用 Shell 的 search tool（通过 desktop API 或直接 HTTP）
- 点击结果 → openFile

### 4. EditorArea Tab 化

**修改 `apps/desktop/ui/src/features/editor/EditorArea.tsx`**
- 移除 `moduleAlwaysOwnsEditor` 逻辑
- 统一渲染: 始终显示 `FileTabBar` + 当前 tab 内容
- 当 `activeFilePath` 以 `__module__/` 开头时，渲染对应的模块编辑器组件
- 当 `activeFilePath` 是普通文件时，渲染 `FileEditor`
- 当没有打开的 tab 时，显示 `ModuleEditor`（outline/novel/script 的默认视图）

**修改 `apps/desktop/ui/src/features/editor/FileTabBar.tsx`**
- 模块 tab 显示对应图标（image/view_quilt/movie_filter）而不是文件类型图标
- 模块 tab 永远 clean（无 dirty indicator）

### 5. WorkspaceModule 类型清理

**修改 `types.ts`**
- `WorkspaceModule` 保留 `'outline' | 'novel' | 'script'`（这些仍然是模块切换）
- `storyboard`, `image_gen`, `video` 从 WorkspaceModule 中移除（它们变成 tab）

或者更保守的方案: 保留 WorkspaceModule 不变，但 `storyboard/image_gen/video` 的行为从"切换模块"变为"打开 tab"。

## 关键决策

| 决策 | 选择 |
|------|------|
| 模块 tab 的 path 标识 | `__module__/image_gen` 等特殊前缀，避免和真实文件冲突 |
| 搜索面板的搜索实现 | 调用 Shell HTTP `/tool/execute` (toolId: search) |
| outline/novel/script 的行为 | 不变 — 仍然是模块切换，控制 ModuleEditor 显示什么 |
| Agent 图标行为 | 和之前一样 toggleAgentPanel（右侧面板），只是位置移到 top section |
| 模块 tab 是否可关闭 | 是，和文件 tab 一样可以关闭 |

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
  apps/desktop/ui/src/features/editor/FileTabBar.tsx

新增:
  apps/desktop/ui/src/features/search-panel/SearchPanel.tsx
```
