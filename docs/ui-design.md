# Orison Space UI 页面与元素设计文档

## 1. 页面总览

当前桌面端有三个顶层页面：

| 页面 | 触发条件 | 说明 |
|---|---|---|
| 登录 / 注册页 `AuthPage` | `authStatus !== 'authenticated'` | 启动无会话、会话过期、bootstrap 失败时进入 |
| 项目页 `ProjectsPage` | 已登录但没有打开项目 | 展示最近项目、新建项目、打开项目 |
| 工作区 `WorkspacePage` | 已登录且已打开项目 | 进入创作主界面 |

重要更新：

- 启动时不再只看本地 token 是否存在
- 会先做 session bootstrap
- token 过期时不会先落到项目页

## 2. 登录 / 注册页

### 布局

- 中央卡片式布局
- 顶部保留品牌名与副标题
- 顶层仍显示极简模式 TopBar

### 交互元素

| 元素 | 说明 |
|---|---|
| 登录 / 注册切换 Tab | 切换模式时清理当前错误 |
| 邮箱输入框 | `autocomplete="email"` |
| 密码输入框 | 支持显示 / 隐藏切换 |
| 显示名输入框 | 仅注册模式展示 |
| 错误提示 | `role="alert"` |
| 提交按钮 | 登录时为 `Sign In`，注册时为 `Create Account` |

### 会话启动行为

- 若本地存在 token，`authSlice.bootstrapAuth()` 会先调用 `/v1/auth/me`
- 成功后进入项目页或工作区
- 401 则清空本地会话
- 非 401 失败也停留在登录页，并显示错误信息

## 3. 项目页

### 页面职责

- 管理最近项目
- 新建项目
- 打开本地项目目录
- 显示当前用户信息

### 关键元素

| 元素 | 说明 |
|---|---|
| Header 品牌名 | `Orison Space` |
| 用户信息区 | 显示 `displayName` 与 `email` |
| Logout 按钮 | 主动退出当前会话 |
| 新建项目卡片 | 打开 `NewProjectDialog` |
| 打开项目卡片 | 调用系统目录选择器 |
| 最近项目卡片 | 打开已有项目 |
| 刷新按钮 | 检测最近项目目录是否存在，并同步 `project.json` 中的名称、类型、封面和 projectId |
| 空状态 | 没有最近项目时显示引导区 |

项目页进入时会自动刷新一次最近项目列表。若项目目录已不存在，直接从最近项目列表移除；若本地 `project.json` 已修改，则同步更新卡片信息。

## 4. 工作区总布局

工作区由以下区域构成：

- TopBar
- 左侧 Icon Rail
- 左侧 Project Tree
- 中间 EditorArea
- 底部 BottomPanel
- 右侧 Agent Panel（可选，通过 Icon Rail 按钮 toggle）

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

#### Top section（从上到下）

| 图标 | 功能 | 行为 |
|------|------|------|
| `folder_open` | 资源管理器 | 切换左侧面板为 ProjectTree |
| `search` | 搜索 | 切换左侧面板为 SearchPanel |
| `auto_stories` | 大纲 | 切换 activeModule 为 outline |
| `menu_book` / `description` | 小说/剧本 | 切换 activeModule 为 novel/script |
| `view_quilt` | 分镜 | 在编辑区打开模块 tab |
| `image` | 图片生成 | 在编辑区打开模块 tab |
| `movie_filter` | 视频 | 在编辑区打开模块 tab |
| `smart_toy` | Agent | toggle 右侧 Agent Panel |

#### Bottom section

| 图标 | 功能 |
|------|------|
| `settings` | 打开设置对话框 |
| `account_circle` | 打开账户对话框 |

左侧面板（ProjectTree / SearchPanel）由 `activeSidebarPanel` 状态控制互斥切换。

### EditorArea 标签栏 (FileTabBar)

编辑区采用统一 tab 系统，文件 tab 和模块 tab（分镜/图片生成/视频）并存：

- 模块 tab 的 path 使用 `__module__/{id}` 前缀标识
- 模块 tab 永远 clean（无 dirty indicator）
- 模块 tab 显示对应图标（view_quilt/image/movie_filter）
- 点击 Icon Rail 的分镜/图片生成/视频图标会打开对应模块 tab

标签栏支持：

| 功能 | 触发方式 | 说明 |
|---|---|---|
| 关闭标签 | 中键点击 / 标签 × 按钮 / `Ctrl+W` | 未保存时弹出确认对话框（保存/不保存/取消） |
| 切换标签 | `Ctrl+Tab` / `Ctrl+Shift+Tab` | 循环切换已打开文件 |
| 重新打开 | `Ctrl+Shift+T` | 从 `recentlyClosed` 栈恢复最近关闭的文件 |
| 右键菜单 | 标签右键 | 关闭 / 关闭其他 / 关闭右侧 / 重新打开已关闭 / 复制路径 / 在资源管理器中显示 |

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
  - `capability`（text/image/video，自动推断）
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

- properties
- tasks
- output
- timeline

其中：

- properties：根据当前模块显示参数或设置字段
- tasks：任务流与状态
- output：真实输出控制台，不再是纯占位
- timeline：Git 提交历史时间线，展示提交列表与选中提交的变更文件

## 9. 当前 UI 设计与代码的一致性说明

以下是已经同步到代码的现状：

- 启动时鉴权先校验会话，再决定进入哪个页面
- 模型设置页交互状态已收口，不再混乱地依赖隐式条件
- 模型生成走 desktop main，不走 server generation route
- story-sync 已变为桌面本地执行 + agent 二次校验

## 10. 样式组织约定

- 渲染层全局样式位于 `apps/desktop/ui/src/shared/styles/`
- 采用文件夹分层：
  - 根：`tokens.css`、`global.css`（唯一入口）、`inspector.css`、`creative.css`
  - `base/`：`components.css`、`welcome.css`
  - `layout/`：`workspace.css`、`topbar.css`、`sidebar.css`、`pages.css`
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
- 底部面板标签增减
- 编辑器快捷键或命令面板命令变更
- FileTabBar 右键菜单项变更
