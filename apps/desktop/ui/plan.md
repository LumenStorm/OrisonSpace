# Tab 层级统一方案

## 目标
将大纲、章节编辑、创作设定都统一到文件 Tab 栏中，与从文件树打开的文件处于同一层级。侧边栏按钮变为"快捷打开对应 tab"的入口。

## 核心思路
扩展 `FileTab.kind` 增加虚拟 tab 类型：`'outline'` / `'chapter'` / `'creative'`。使用约定的虚拟路径（如 `__outline__`、`__chapter__/ch-xxx`、`__creative__`）。`FileEditor` 根据 kind 分发到对应编辑器组件。

## 改动清单

### 1. `fileTabsSlice.ts` — 扩展 FileTab 类型
- `FileTabKind` 增加 `'outline' | 'chapter' | 'creative'`
- 虚拟 tab 不走 `savedContent` 脏检查（它们的数据由各自 slice 管理）
- `requestCloseFile` 对虚拟 tab 直接关闭（无需保存确认）

### 2. `FileEditor.tsx` — 根据 kind 分发
- `kind === 'outline'` → 渲染 `<OutlineEditor />`
- `kind === 'chapter'` → 渲染 `<ScriptEditor />`（同时 `setActiveChapter` 为对应 id）
- `kind === 'creative'` → 渲染 `<CreativeFieldsEditor />`
- 其余保持原逻辑

### 3. `FileTabBar.tsx` — 虚拟 tab 图标和名称
- outline → icon `auto_stories`
- chapter → icon `description`，名称取章节 title
- creative → icon `palette`

### 4. `SideNav.tsx` — 按钮改为 openFile 调用
- 点击「大纲」→ `openFile('__outline__', '大纲', '', { kind: 'outline' })`
- 点击「小说/剧本」→ 打开当前活跃章节 tab（若无章节则打开 creative tab）
- 移除 `activePage` 中的 `'outline' | 'novel' | 'script'`（这些不再是 page，而是 tab）

### 5. `types.ts` — 精简 ActivePage
- `ActivePage` 变为 `'overview' | 'storyboard' | 'image_gen' | 'video' | 'assets' | 'timeline'`
- 大纲/小说/剧本不再是 page，而是 tab

### 6. `WorkspaceLayout.tsx` — 简化
- 移除 `case 'outline'` / `case 'novel'` / `case 'script'`
- Tab 栏始终显示（即使只有虚拟 tab）
- 当无 tab 打开时显示当前 activePage（overview/storyboard/image_gen/video/assets/timeline）

### 7. 章节列表交互
- 项目树或章节列表中点击某章节 → `openFile('__chapter__/{id}', chapterTitle, '', { kind: 'chapter' })`
- 切换 tab 到某章节时自动 `setActiveChapter(id)`

### 8. 清理
- 删除 `ScriptEditorPage.tsx`、`NovelScriptWithCreative.tsx`（不再需要 sub-tab 切换）
- `ModuleEditor.tsx` 已废弃，可删除

## 不变的部分
- 分镜/生图/视频/资产库/时间线仍为独立 page view
- Overview 仍为默认 page
- 底部面板（output/tasks）不变
- Agent 面板不变
