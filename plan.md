# 编辑器交互重构计划

## 目标

将编辑器从"模块视图 vs 文件Tab"的双模式，统一为**侧边栏切页面 + 文件Tab叠加**的单一交互模型。同时重构底部面板和时间线。

---

## 一、统一页面模型

### 现状问题
- `WorkspaceModule`（outline/novel/script）和 `WorkspacePanel`（overview/storyboard/...）是两套独立机制
- outline 是"standalone"模式，novel/script 是"editor"模式，其他是"workspace panel"模式 — 三种渲染路径
- 底部面板只在 editor 模式显示，workspace panel 模式下看不到

### 改动
1. **合并为统一的 `ActivePage` 类型**：
   ```ts
   type ActivePage = 'overview' | 'outline' | 'novel' | 'script' | 'storyboard' | 'image_gen' | 'video' | 'assets' | 'timeline';
   ```
   移除 `WorkspaceModule` 和 `WorkspacePanel` 的区分，统一为 `activePage`。

2. **WorkspaceLayout 简化为两层**：
   - 如果有打开的文件 Tab → 显示 FileTabBar + FileEditor（文件编辑模式）
   - 否则 → 显示当前 activePage 对应的页面组件

3. **侧边栏按钮行为统一**：点击任何页面按钮 → `setActivePage(page)`，同时不关闭已打开的文件 Tab（只是切换"背景页面"）。点击文件 Tab 时显示文件编辑器，关闭所有 Tab 后自动回到当前 activePage。

4. **底部面板始终可用**：不再限制只在 editor 模式显示。所有页面下方都可展开底部面板。

---

## 二、侧边栏布局调整

### 最终按钮顺序（从上到下）
```
[资源管理器]  [搜索]
─── 分隔线 ───
[总览]
[大纲]
[资产库]
[小说/剧本]  (根据项目类型)
─── 分隔线 ───
[分镜]
[生图]
[视频]
─── 分隔线 ───
[Agent]
[时间线]

底部固定：
[设置]
[账户]
```

---

## 三、底部面板重构

### 改动
- 移除 `timeline` tab（已移到侧边栏作为独立页面）
- 移除 `properties` tab（Inspector 改为右侧面板或集成到各页面内）
- 保留：`output`（日志）、`tasks`（任务进度）
- `BottomPanelTab` 类型改为 `'output' | 'tasks'`

---

## 四、时间线作为独立页面

- 将 `TimelinePanel` 从底部面板提升为一个完整页面
- 在 `ActivePage` 中加入 `'timeline'`
- 侧边栏新增时间线按钮（icon: `history`）

---

## 五、项目目录结构（数据层，本次不实现 UI）

确认目标结构：
```
my-project/
├── project.yaml          # 项目元数据
├── outline/
│   ├── outline.yaml      # 章节结构+摘要
│   └── characters.yaml   # 角色设定
├── chapters/             # 小说模式
│   ├── ch01.md
│   └── ch02.md
├── scripts/              # 剧本模式
│   ├── ep01.md
│   └── ep02.md
├── storyboard/
│   ├── storyboard.yaml   # 分镜数据
│   └── frames/           # 分镜图片
├── assets/
│   ├── images/           # AI生成图
│   ├── audio/
│   └── references/       # 参考素材
└── output/
    └── videos/
```

本次重构只做 UI 层面的页面模型统一，数据层后续单独迭代。

---

## 六、大纲结构化 UI（本次不实现）

大纲页面后续改为表单视图：解析 `outline.yaml` 后用结构化 UI 展示（拖拽排序章节、编辑摘要等）。本次保持现有 OutlineEditor 不变。

---

## 具体文件改动清单

| 文件 | 改动 |
|------|------|
| `shared/store/types.ts` | 新增 `ActivePage` 类型，废弃 `WorkspaceModule`/`WorkspacePanel`；`BottomPanelTab` 改为 `'output' \| 'tasks'` |
| `shared/store/panelsSlice.ts` | `activeWorkspacePanel` → `activePage`，移除 `clearWorkspacePanel`；底部面板默认 tab 改为 `'output'` |
| `shared/store/editorSlice.ts` | 移除 `activeModule`/`setActiveModule`，改用 `activePage` |
| `shared/store/appStore.ts` | 更新导出 |
| `features/side-nav/navItems.ts` | 统一为 `pageItems` 数组 |
| `features/side-nav/SideNav.tsx` | 用统一的 pageItems 渲染，加入 timeline 按钮 |
| `widgets/layout/WorkspaceLayout.tsx` | 简化为：有文件Tab → 文件编辑器；无Tab → activePage 页面。底部面板始终可用 |
| `features/bottom-panel/BottomPanel.tsx` | 移除 timeline 和 properties tab |
| `features/editor/EditorArea.tsx` | 简化，移除 ModuleEditor 逻辑 |
| `features/editor/FileTabBar.tsx` | 点击 tab 不再 clearWorkspacePanel |
| `shared/store/fileTabsSlice.ts` | 移除 clearWorkspacePanel 调用 |
| `shared/data/inspectorFields.ts` | 类型适配 ActivePage |
| `shared/data/workspaceData.ts` | 类型适配 |
| `features/inspector/InspectorPanel.tsx` | 适配 activePage |
| `shared/i18n/zh-CN.yaml` | 新增 `nav.timeline` |
| `shared/i18n/en-US.yaml` | 新增 `nav.timeline` |

---

## 不在本次范围

- 大纲结构化表单 UI（后续迭代）
- 项目目录结构的实际文件读写逻辑（后续迭代）
- Inspector 右侧面板化（保持在各页面内部处理）
- 视频时间线轨道编辑器（timeline 页面先用现有的 git log 视图）
