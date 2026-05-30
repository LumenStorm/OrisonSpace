# 开发日志

## 一、小说迁移主线回顾

### Phase 0

- 建立迁移执行计划
- 梳理 feature inventory
- 建立基线测试

### Phase 1

- 增加小说相关共享契约
- 引入章节运行、story-sync、memory 提取相关 schema

### Phase 2

- 本地章节仓库与 memory 仓库落地
- `project.yaml` / `chapters/*.md` / `story-memory.yaml` 可以本地持久化

### Phase 3

- 原生章节流水线接入 Agent
- TS + Python 混合节点链路跑通

### Phase 4

- story-sync 与 memory extractor 接入
- 候选补丁、记忆条目开始闭环

### Phase 5

- Novel Workbench 落地到桌面端
- 章节列表、候选审核、memory panel 等主界面能力上线

### Phase 6

- Auto Mode 多章节自动推进落地
- 支持启动、暂停、恢复、取消

### Phase 7

- 完成 parity audit
- 完成 cutover 准备

## 二、后续架构收敛记录

### 1. 桌面模型库

- 模型配置从 profile 结构简化为 key-based 结构：
  - `~/.orison/model/keys/*.yaml`
- 一个 key = 一组凭据（name + baseUrl + apiKey）
- 模型从远端 `/v1/models` 发现后自动分类
- 能力和别名由 `model-registry` glob pattern 推断
- 生成请求使用 `ModelRef`：`{ keyId, modelId }`

### 2. 图片生成链路

- 结果先落到项目 `temp/images/generation/`
- 生成页读取 `temp/images/generation/` 中已有图片
- 支持本地图片编辑：可选颜色画笔、画圈、遮罩、裁切
- 用户确认后移动到 `assets/images/`
- 生成图片可转成 asset card 写入创作字段

### 3. IPC 安全与路径校验

- `pathGuard.ts` 统一约束路径边界
- 允许用户显式选择的项目目录进入当前会话允许列表
- 项目相对路径写入仍阻止越界

## 三、2026-05-07 前后的关键变化

### 1. 服务端 generation route 移除

旧的：

- `POST /v1/generation/:provider/text`
- `POST /v1/generation/:provider/image`

当前已经移除。

替代方式：

- renderer -> desktop IPC
- desktop main -> `@orison/model-protocols`
- desktop main 直接请求 provider

### 2. Story Sync 抬到桌面主进程

- 桌面端先执行 story-sync LLM 提取
- 编排 run body 携带 `chapter.llmPatches`
- agent 二次校验补丁，失败则走规则回退

### 3. 启动鉴权调整

当前行为：

- 启动时先执行 session bootstrap
- 使用 `GET /v1/auth/me`
- 过期 token 自动退出
- 最新 user 会回写本地 store

### 4. 模型设置页交互整理

当前 UI 已整理出明确状态：

- 无 key：空状态
- 新建中：编辑器
- 编辑已有项：编辑器
- 有 key 但未选择：占位提示

## 四、当前已验证

最近明确跑过：

- `pnpm --filter @orison/desktop-ui test -- authSessionExpiry.test.tsx`
- `pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx`
- `pnpm --filter @orison/desktop-ui typecheck`
- `pnpm --filter @orison/server test -- auth.test.ts`

## 五、当前仍建议持续维护的事项

### 1. 文档同步

每次涉及以下变化时都要同步：

- server API
- desktop IPC
- 启动鉴权流程
- 模型配置 schema
- 设置页交互

### 2. 历史文档清理

仓库中仍有一部分更早的历史文档、spec、中文日志存在乱码或旧描述，需要继续分批修整。

### 3. UI 命名与文案

模型设置页底层已改为 key 概念，UI 文案可以继续优化，减少"模型"和"配置"混用带来的歧义。

### 4. 协议层简化（2026-05-08）

- 移除多 apiFormat 注册表和所有独立协议 adapter（claudeMessages、geminiGenerateContent、geminiImages、geminiImageEdit、openaiChat、openaiResponses、openaiImages、soraVideos）
- 统一为单一 OpenAI 兼容适配器（`generate.ts`）
- `listModels` 不再接收 `provider` 参数
- 模型能力识别改为 `model-registry` glob pattern 匹配
- 生成请求 schema 简化：移除 `apiFormat`、`provider`、`providerOptions` 等字段
- `baseUrl` 兼容带或不带 `/v1` 后缀（`normalizeBaseUrl` 自动补齐）

### 5. 后台任务持久化（2026-05-09）

- 新增 `backgroundTasksSlice`：管理前端后台任务生命周期
- 新增 `task:list / task:upsert / task:update-status / task:delete` IPC 通道
- 任务状态通过 SQLite `tasks` 表持久化，应用重启后可恢复
- `cancelled` 状态映射为 DB 中的 `failed`（符合 CHECK 约束）

### 6. 编辑器体验增强（2026-05-10）

- FileTabBar：右键上下文菜单、未保存关闭确认、`recentlyClosed` 栈、`Ctrl+W/Tab/Shift+T` 快捷键
- FindReplaceBar：`Ctrl+F/H` 查找替换，adapter 模式适配 Markdown/Code 编辑器
- CommandPalette：`Ctrl+Shift+P` 命令面板 / `Ctrl+P` 文件搜索，fuzzy match
- Git Timeline：左侧面板铁路图，基于 isomorphic-git 展示多分支提交拓扑、变更文件与分支操作
- 主进程日志系统：pino 文件流 + `logIpc` 暴露给渲染层
- 版本号与更新检查：`AboutDialog` + `UpdateAvailableDialog`

### 7. 认证与快捷键修复（2026-05-10）

- 登录注册 email 归一化：客户端 `trim().toLowerCase()`，服务端 zod `.transform()`
- 密码预哈希统一：客户端 `SHA256(password + "orison:auth:v1")` 后发送，后端直接 `bcrypt.compare`
- 快捷键补全：`Ctrl+B`（项目树）、`Ctrl+J`（底部面板）注册到 `useGlobalShortcuts`
- Electron `before-input-event`：阻止 Chromium 拦截 `Ctrl+Tab/N/W/T`
- 帮助 → 快捷键：新增 `ShortcutsDialog` 弹窗，按分类展示所有快捷键

### 8. Overview 页面与 Outline 独立化（2026-05-14）

- `WorkspaceModule` 新增 `'overview'`，默认 activeModule 改为 `'overview'`
- `WorkspaceLayout` 引入 standalone 分支：`overview` / `outline` 渲染独立全宽页面，不走 EditorArea + BottomPanel
- 新增 `features/overview/OverviewPage.tsx`：仪表盘风格，展示项目名称、类型、章节数/字数/草稿数/定稿数
- `OutlineEditor` 改为 Notion block 风格：无边框输入、底部细线 focus 变色、居中 720px 最大宽度
- 创作字段展示组件（`OutlineV2View` / `WorldSettingView` / `CreativeBriefView`）补齐缺失样式（`.creative-list`、`.asset-card-tag`）
- SideNav navItems 在 outline 前新增 overview 入口（`dashboard` 图标）

---

## 六、时间线面板化 + 创作分支 + 样式统一 + 基本功能补全（2026-05-26）

### 需求总结

1. **时间线 navbar 调整**：从独立主编辑区页面改为左侧面板（与 ProjectTree / SearchPanel 同级切换）
2. **时间线功能完善**：git 封装为创作时间节点，纵向铁路图展示多分支 DAG 拓扑，支持手动创建节点（commit + tag）、从任意节点创建分支探索不同剧情走向
3. **样式统一**：总览、大纲、小说页面遵循 design.md 的 "Literary Sanctuary" 设计语言
4. **基本功能补全**：Ctrl+S 保存 + toast 提示、大纲拖拽排序 + 层级折叠、时间线节点标签/描述、分支切换后自动刷新工作区

---

### Phase 1：时间线从页面改为侧边栏面板

#### 涉及文件

- `apps/desktop/client/ui/src/shared/store/types.ts` — `SidebarPanel` 类型新增 `'timeline'`，`ActivePage` 移除 `'timeline'`
- `apps/desktop/client/ui/src/features/side-nav/navItems.ts` — 移除 `timelineItem`
- `apps/desktop/client/ui/src/features/side-nav/SideNav.tsx` — 在搜索图标下方添加 timeline 图标（history），点击切换 `activeSidebarPanel` 为 `'timeline'`
- `apps/desktop/client/ui/src/widgets/layout/WorkspaceLayout.tsx` — 侧边栏区域支持渲染 `TimelinePanel`；移除主区域的 timeline 分支
- `apps/desktop/client/ui/src/features/timeline/TimelinePanel.tsx` — 重构为竖向面板布局（适配侧边栏宽度）
- `apps/desktop/client/ui/src/shared/styles/editor/timeline.css` — 适配侧边栏窄宽度

#### 实施细节

1. `SidebarPanel` 从 `'explorer' | 'search'` 改为 `'explorer' | 'search' | 'timeline'`
2. SideNav 在搜索按钮下方增加 timeline 按钮（material icon: `history`）
3. WorkspaceLayout 侧边栏 panel 区域：`activeSidebarPanel === 'timeline' ? <TimelinePanel /> : activeSidebarPanel === 'search' ? <SearchPanel /> : <ProjectTree />`
4. 从 `ActivePage` 类型和 WorkspaceLayout 主区域路由中移除 `'timeline'`
5. TimelinePanel 改为纵向铁路图布局（左侧 SVG 绘制 DAG 拓扑连线 + 节点圆点，右侧 commit 信息），适配侧边栏宽度

---

### Phase 2：时间线创作分支功能

#### 新增 IPC 通道

在 `packages/shared-contracts/src/ipc.ts` 和 preload bridge 新增：

```ts
gitCreateNode(dir: string, message: string, tag?: string): Promise<{ oid: string }>;
gitListBranches(dir: string): Promise<string[]>;
gitCurrentBranch(dir: string): Promise<string>;
gitCreateBranch(dir: string, name: string, fromOid?: string): Promise<void>;
gitCheckoutBranch(dir: string, name: string): Promise<void>;
```

#### Shell 端 handler

在 `apps/desktop/client/shell/main/ipc/gitIpc.ts` 中统一实现：

- `gitCreateNode`：执行 `git.add` + `git.commit` + 可选 `git.tag`，完成后 `notifyUI({ type: 'git:changed' })`
- `gitListBranches`：`git.listBranches({ fs, dir })`
- `gitCurrentBranch`：`git.currentBranch({ fs, dir })`
- `gitCreateBranch`：`git.branch({ fs, dir, ref, object? })`
- `gitCheckoutBranch`：`git.checkout({ fs, dir, ref })` + `notifyUI({ type: 'git:changed' })`
- `gitLog`：遍历所有分支收集 commits，返回含 `parents[]` 的 `GitCommitEntry[]`，按时间倒序

#### TimelinePanel UI

- 纵向铁路图（railroad graph）：左侧 SVG 绘制竖线 + 圆点节点 + 分叉/合并曲线，右侧显示 commit 信息
- 多分支拓扑可视化：基于 `parents[]` 计算列分配，分支占不同列，合并时绘制贝塞尔曲线
- 顶部显示当前分支名 + 分支下拉切换器
- "创建节点" 按钮：弹出输入框填 message + 可选 tag
- 每个 commit 节点增加 "从此处创建分支" 操作按钮
- commit 如果有 tag 则展示标签角标

#### 分支切换后自动刷新工作区

- `git:changed` 通知已在 `notifyUI` 中实现，前端监听后刷新文件树和 project 数据
- 确认 `gitCheckoutBranch` 后发送 `git:changed`，前端收到后调用 `reloadProjectTree()` + 重新 hydrate creative fields

---

### Phase 3：样式统一（design.md Literary Sanctuary 设计语言）

#### 设计原则映射

- **No-Line Rule**：移除 1px solid border，改用 tonal shift（背景色差异）区分区域
- **Writing Canvas**：总览/大纲/小说编辑区使用白色 `surface_container_lowest` 居中内容列，max-width 720px，padding 80px top/bottom
- **Typography**：内容区使用衬线字体 (Newsreader)，UI 部分使用 Manrope
- **Elevation**：用 ambient shadow 替代硬边框，浮动面板用 backdrop-blur
- **Input Style**：无边框输入框，背景填充 + focus 时变白 + ghost border

#### 涉及文件

- `apps/desktop/client/ui/src/shared/styles/tokens.css` — 新增 design.md 色彩 token
- `apps/desktop/client/ui/src/shared/styles/layout/workspace.css` — 主内容区居中画布样式
- `apps/desktop/client/ui/src/shared/styles/editor/tiptap.css` — 编辑器内容字体改为 Newsreader
- `apps/desktop/client/ui/src/features/overview/OverviewPage.tsx` — 结构改为 canvas layout
- `apps/desktop/client/ui/src/features/editor/OutlineEditor.tsx` — 同步画布布局
- `apps/desktop/client/ui/src/features/novel-workbench/` — 同步样式

#### 具体变更

1. 总览页：表单区居中画布，统计卡片从 grid 卡片改为内联指标行
2. 大纲页：编辑区居中画布，字段组使用 tonal layering 分组
3. 小说页：章节列表 + 编辑器居中，action bar 简化为内联工具条

---

### Phase 4：基本功能补全

#### 4.1 Ctrl+S 保存 + Toast 提示

- 新增全局 Toast 组件 `apps/desktop/client/ui/src/shared/components/Toast.tsx`
- 新增 `toastSlice` 到 store
- 在 `App.tsx` 挂载全局 `keydown` listener for Ctrl+S
- 触发时调用当前页面的保存逻辑（overview/outline 的 `persist()` 立即 flush）+ 显示 toast

#### 4.2 大纲拖拽排序 + 层级折叠

当前大纲用独立字段表单。将 `major_turning_points` 和 `constraints` 列表改为可拖拽列表：

- 使用原生 HTML5 drag-and-drop（无需新依赖）
- 每个列表项支持拖拽手柄排序
- 各 section (characters/conflict/turning points/constraints) 支持折叠/展开

#### 4.3 时间线节点标签/描述

- 创建节点时可填 tag 和描述（Phase 2 已覆盖）
- 显示时如果有 tag 则展示彩色标签

#### 4.4 分支切换后刷新（Phase 2 已覆盖）

---

### 实施顺序

1. **Phase 1** — 时间线面板化（结构变更最基础）
2. **Phase 2** — 时间线创作分支功能（新增 IPC + UI）
3. **Phase 3** — 样式统一（在结构稳定后做）
4. **Phase 4** — 基本功能补全（Toast / 拖拽 / 快捷键）

预计涉及 ~15-20 个文件修改/新增。
