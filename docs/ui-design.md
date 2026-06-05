# Orison Space UI 页面与元素设计文档

## 1. 页面总览

当前桌面端有两个顶层页面：

| 页面 | 触发条件 | 说明 |
|---|---|---|
| 项目页 `ProjectsPage` | 没有打开项目 | 展示最近项目、新建项目、打开项目 |
| 工作区 `WorkspacePage` | 已打开项目 | 进入创作主界面 |

## 2. 项目页

### 页面职责

- 管理最近项目
- 新建项目
- 打开本地项目目录
- 显示当前用户信息

### 关键元素

| 元素 | 说明 |
|---|---|
| Header 品牌名 | `Orison Space` |
| 新建项目卡片 | 打开 `NewProjectDialog` |
| 打开项目卡片 | 调用系统目录选择器 |
| 最近项目卡片 | 打开已有项目 |
| 刷新按钮 | 检测最近项目目录是否存在，并同步 `project.yaml` 中的名称、类型、封面和 projectId |
| 空状态 | 没有最近项目时显示引导区 |

项目页进入时会自动刷新一次最近项目列表。若项目目录已不存在，直接从最近项目列表移除；若本地 `project.yaml` 已修改，则同步更新卡片信息。

## 4. 工作区总布局

工作区由以下区域构成：

- TopBar
- 左侧 Icon Rail
- 左侧 Project Tree / Search / Timeline（互斥）
- 中间 EditorArea
- 底部 BottomPanel
- 右侧 Agent Panel（可选，通过 Icon Rail 按钮 toggle）
- 底部 StatusBar

Agent Panel 独立于 Bottom Panel，全高显示（从顶部到窗口底部），不受 Bottom Panel 高度影响。

### TopBar

职责：

- 自定义标题栏
- 主导航菜单
- 窗口控制

菜单组：

- 文件
- 编辑
- 视图
- 帮助

### 左侧导航

Icon Rail 分为 top section 和 bottom section：

#### Top section（从上到下，按功能分组，组间有分隔线）

| 图标 | 功能 | 行为 |
|------|------|------|
| `folder_open` | 资源管理器 | 切换左侧面板为 ProjectTree |
| `search` | 搜索 | 切换左侧面板为 SearchPanel |
| `history` | 时间线 | 切换左侧面板为 TimelinePanel（铁路图展示 git 提交 DAG） |
| ─── 分隔线 ─── | | |
| `dashboard` | 总览 | `setActivePage('overview')` |
| `auto_stories` | 大纲 | `setActivePage('outline')` |
| `perm_media` | 资产库 | `setActivePage('assets')` |
| ─── 分隔线 ─── | | |
| `image` | 图片生成 | `setActivePage('image_gen')` |
| `movie_filter` | 视频 | `setActivePage('video')` |
| ─── 分隔线 ─── | | |
| `assistant` | Agent | toggle 右侧 Agent Panel |

#### Bottom section

| 图标 | 功能 |
|------|------|
| `settings` | 打开设置对话框 |

左侧面板（ProjectTree / SearchPanel / TimelinePanel）由 `activeSidebarPanel` 状态控制互斥切换。

### 页面模型

工作区使用统一的 `ActivePage` 类型控制中间内容区：

```ts
type ActivePage = 'overview' | 'outline' | 'novel' | 'script' | 'storyboard' | 'image_gen' | 'video' | 'assets';
type SidebarPanel = 'explorer' | 'search' | 'timeline';
```

渲染逻辑（`WorkspaceLayout`）：
1. 如果有打开的文件 Tab → 显示 FileTabBar + FileEditor（文件编辑模式），支持 SplitFileEditor 分屏
2. 否则 → 按 `activePage` 渲染对应页面组件

默认进入工作区时 `activePage` 为 `overview`。

各页面对应组件：

| activePage | 组件 | 说明 |
|------|------|------|
| `overview` | `OverviewPage` | 项目总览仪表盘 |
| `outline` | `OutlineEditor` | Notion block 风格大纲编辑器 |
| `novel` / `script` | `ScriptEditorPage` | 小说/剧本编辑器 + creative fields |
| `storyboard` | `StoryboardCanvas` | 分镜面板 |
| `image_gen` | `ImageGenEditor` | 图片生成面板 |
| `video` | `VideoEditor` | 视频编辑面板 |
| `assets` | `AssetsPanel` | 资产库面板 |

左侧面板组件：

| activeSidebarPanel | 组件 | 说明 |
|------|------|------|
| `explorer` | `ProjectTree` | 项目文件树 |
| `search` | `SearchPanel` | 全局搜索 |
| `timeline` | `TimelinePanel` | 时间线面板（纵向铁路图，展示多分支 DAG 拓扑） |

### FileTabBar（文件标签栏）

FileTabBar 只管理文件 tab（纯文件编辑），不再有模块 tab。打开文件 tab 时文件编辑器覆盖当前 activePage 视图，关闭所有 tab 后自动回到当前 activePage。

标签栏支持：

| 功能 | 触发方式 | 说明 |
|---|---|---|
| 关闭标签 | 中键点击 / 标签 × 按钮 / `Ctrl+W` | 未保存时弹出确认对话框（保存/不保存/取消） |
| 切换标签 | `Ctrl+Tab` / `Ctrl+Shift+Tab` | 循环切换已打开文件 |
| 重新打开 | `Ctrl+Shift+T` | 从 `recentlyClosed` 栈恢复最近关闭的文件 |
| 右键菜单 | 标签右键 | 关闭 / 关闭其他 / 关闭右侧 / 重新打开已关闭 / 拆分到右侧 / 复制路径 / 在资源管理器中显示 |

### 查找与替换 (FindReplaceBar)

编辑器内嵌的查找替换栏：

| 快捷键 | 功能 |
|---|---|
| `Ctrl+F` | 打开查找栏 |
| `Ctrl+H` | 打开替换栏 |
| `Enter` / `Shift+Enter` | 下一个 / 上一个匹配 |
| `Escape` | 关闭 |

支持大小写切换、逐个替换、全部替换。通过 `FindReplaceAdapter` 接口适配 Markdown (Tiptap) 和 Code (textarea) 两种编辑器。

### 命令面板 (CommandPalette)

| 快捷键 | 模式 | 说明 |
|---|---|---|
| `Ctrl+Shift+P` | 命令模式 | 搜索并执行已注册命令 |
| `Ctrl+P` | 文件模式 | 快速搜索并打开项目文件 |

- 组件：`features/command-palette/CommandPalette.tsx`
- 命令注册：`features/command-palette/commandRegistry.ts`
- 状态：`commandPaletteSlice`（`open` / `mode` / `query`）
- 支持 fuzzy match 过滤

## 5. 模型设置页

### 当前数据概念

这页底层是 key 概念：

- 一个 key = 一组 `name + baseUrl + apiKey`
- 一个 key 下包含多个发现的模型 `models[]`

### 当前交互状态

现在模型设置页已经明确分为四种 UI 状态：

| 状态 | 说明 |
|---|---|
| `idle` + 无 key | 显示”还没有模型”的空状态 |
| `creating` | 显示新建编辑器 |
| `editing` | 显示已选中 key 的编辑器 |
| `idle` + 有 key | 显示”请选择一个配置”的占位态 |

### 页面结构

- 左侧：Key 列表
- 右侧：Key 编辑器或空状态

### 编辑器字段

#### 身份区

- `keyName`

#### 凭据区

- `apiKey`
- `baseUrl`
- 刷新远端模型列表按钮

#### 模型区

- 每个 model entry 包含：
  - `id`
  - `capability`（text/image，自动推断）
  - `alias`（自动推断）
  - `enabled`

### 重要交互

- 空状态点击”添加模型”会直接进入编辑器
- 已有 key 但未选中时，不再默认渲染隐式新建编辑器
- 刷新模型列表后，由 model-registry 自动推断能力和别名

## 6. 图片生成模块

### 关键点

- 图片生成不再通过服务端 generation route
- 当前走 desktop main IPC：
  - `model:generate-image`
- 结果先保存到项目 `temp/images/generation/`
- 页面加载时读取 `temp/images/generation/` 的文件名索引，当前页图片按需分页懒加载二进制
- 支持本地编辑：可选颜色画笔、画圈、遮罩、裁切
- 编辑结果直接保存到 `temp/images/generation/`
- 用户确认后移动到 `assets/images/`

### 主区 UI

- 顶部 key chip：只显示 `modelAlias`，无参数入口；所有参数（尺寸 / 数量 / 质量 / 输出格式等）集中在 BottomPanel 的 properties tab，主区不再出现任何参数线索
- Prompt 输入：大尺寸文本区 + 右下角 Generate 主按钮；生成中图标旋转；错误以可关闭的 banner 呈现
- 画廊：1:1 正方形卡片网格，`object-fit: contain` 保证非方图不被裁切，棋盘纹底色；卡片支持分页，默认每页 12 张
- 卡片交互：
  - 顶部浮条（hover/focus）：预览、编辑、加入素材库、删除
  - 底部浮条（hover/focus）：单行 prompt + `…` 省略，右侧复制 SVG 图标
  - 状态标识：`generated` / `edited` 角标；已入库卡片右上角换成 check 徽标
  - 已入库图片的"删除"按钮禁用（需先从素材库移除），未入库可直接删除 temp 目录文件
- 预览弹窗：居中大图、左右键盘切换（也有左右箭头按钮）、Esc 关闭、底部操作栏（编辑 / 加入素材库）+ prompt 单行显示 + 复制图标

### 编辑弹窗

- 工具栏分三组，竖分隔可视化：Tool（Brush / Circle / Mask / Crop）· Style（color + size 或 crop 专用按钮）· History（Reset to original / Undo / Redo）
- 右端固定 Cancel / Save 主操作
- Mask 工具下遮罩以半透明 `mix-blend-mode: screen` 叠加显示，其他工具下隐藏但保留数据
- Esc 关闭弹窗
- 小屏下工具组自动换行

## 7. Story Sync 相关 UI 行为

- 桌面端发起章节编排前，可先本地执行 `storySync:run`
- 返回的 patch 会嵌入 orchestration run body
- agent 若发现 patch 无效，会回退到规则路径

## 8. 底部面板

BottomPanel 当前包含：

- output
- tasks

其中：

- output：真实输出控制台
- tasks：任务流与状态

底部面板在所有页面下方都可展开，不再限制只在特定模式显示。`timeline` 已移为左侧面板（`SidebarPanel`，由侧边栏 TimelineBtn 切换），`properties` 已移除（Inspector 集成到各页面内部）。

## 9. 当前 UI 设计与代码的一致性说明

以下是已经同步到代码的现状：

- 模型设置页交互状态已收口，不再混乱地依赖隐式条件
- 模型生成走 desktop main，不走 server generation route
- story-sync 已变为桌面本地执行 + agent 二次校验
- 侧边栏统一为 `ActivePage` 模型，所有页面按钮调用 `setActivePage`
- timeline 作为左侧面板（`SidebarPanel`），通过 `setActiveSidebarPanel('timeline')` 切换
- 底部面板只保留 output / tasks 两个 tab
- 资产库（assets）已作为独立页面加入侧边栏
- 文件编辑支持 SplitFileEditor 分屏
- 底部 StatusBar 常驻显示

## 10. 样式组织约定

- 渲染层全局样式位于 `apps/desktop/client/ui/src/shared/styles/`
- 采用文件夹分层：
  - 根：`tokens.css`、`global.css`（唯一入口）、`inspector.css`、`creative.css`
  - `base/`：`components.css`、`welcome.css`
  - `layout/`：`workspace.css`、`topbar.css`、`sidebar.css`、`statusbar.css`、`notifications.css`、`pages.css`
  - `editor/`：`tiptap.css`、`script.css`、`video.css`、`image-gen.css`、`image-dialog.css`、`novel.css`、`file.css`、`timeline.css`
- `global.css` 通过 `@import` 串联所有文件，顺序与原单文件时期一致，级联敏感规则（例如 `.image-gen-inspector-*` 排在 `.image-gen-*` 之后、`components.css` 作为末尾层）必须保留
- 渲染层只 import 一次 `global.css`，不单独引入子文件

## 11. 后续更新要求

若以下任一行为变化，需要同步更新本文档：

- 登录 / 启动鉴权流程
- 页面切换条件
- 模型设置页交互状态
- 图片生成入口和保存路径
- story-sync 在 UI 中的触发方式
- 底部面板标签或侧边栏页面增减
- 编辑器快捷键或命令面板命令变更
- FileTabBar 右键菜单项变更
