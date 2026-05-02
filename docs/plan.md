# 开发日志

## Novel Migration Baseline

- chapter generation
- story sync
- long-term memory
- auto mode
- worldbook / relationships / foreshadowing

### Novel Migration Phase 0
- Migration execution plan created with resumable phase checkpoints.
- Baseline feature inventory recorded for future parity checks.
- Baseline verification completed (2026-05-03):
  - `pnpm --filter @orison/shared-contracts test` — PASS (36 tests)
  - `pnpm --filter @orison/agent test agentContracts.test.ts workflowSync.test.ts` — PASS (19 tests)
  - `pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx orchestrationPanel.test.tsx` — 1 pre-existing failure (reviewFlow, unrelated to migration)
- Green baseline established, ready for Phase 1.

### Novel Migration Phase 1
- Added novel contracts for chapter runs, story memory, and candidate patches.
- Created: `packages/shared-contracts/src/contracts/story-memory.ts` — StoryMemoryEntry + StoryMemoryIndex schemas.
- Created: `packages/shared-contracts/src/contracts/novel-orchestration.ts` — chapterCandidatePatch, novelChapterRunRequest/Result, novelStorySyncPayload, novelMemoryExtractionPayload schemas.
- Modified: `project.ts` — chapterStatusSchema extended with 'generating'; chapterSchema gained last_run_id, generated_at, bridge_notes.
- Modified: `tasks.ts` — outputType enum extended with 'chapter_candidate'.
- Modified: `index.ts` — exports for story-memory and novel-orchestration modules.
- Created: `tests/novelContracts.test.ts` — 16 tests covering all new schemas.
- Green commands:
  - `pnpm --filter @orison/shared-contracts test` (52 passed, +16 novel contracts)
  - `pnpm --filter @orison/shared-contracts typecheck` (PASS)
  - `pnpm --filter @orison/agent test agentContracts.test.ts workflowSync.test.ts` (19 passed)

### Novel Migration Phase 2
- Chapter markdown and metadata now persist locally via novelProjectRepository.
- Memory index has a local YAML repository via memoryRepository.
- Foreshadow registry participates in field sync (FIELD_TO_KEY added in both localProjectRepository.ts and fieldSyncBridge.ts).
- Chapter candidate patches accepted through applyFieldPatches → inline markdown write + metadata update.
- Created: `apps/desktop/local-bff/sync/novelProjectRepository.ts` — loadChapterMetadata, loadChapterMarkdown, acceptChapterCandidate.
- Created: `apps/desktop/local-bff/sync/memoryRepository.ts` — loadMemoryIndex, saveMemoryIndex, addMemoryEntry.
- Created: `apps/desktop/local-bff/test/novelProjectRepository.test.ts` — 6 tests.
- Created: `apps/desktop/local-bff/test/memoryRepository.test.ts` — 5 tests.
- Modified: `localProjectRepository.ts` — FIELD_TO_KEY adds foreshadow_registry; inline chapter_candidate patch handling.
- Modified: `fieldSyncBridge.ts` — FIELD_TO_KEY adds foreshadow_registry.
- Modified: `localProjectRepository.test.ts` — added chapter_candidate patch test.
- Modified: `fieldSyncBridge.test.ts` — added 2 foreshadow_registry tests.
- Green commands:
  - `pnpm --filter @orison/desktop-local-bff test` (31 passed, +11 new tests)
  - `pnpm --filter @orison/shared-contracts test` (52 passed, no regression)

---

## 重构：代码解耦与模块化

### Store 拆分
- `appStore.ts` 从单文件拆为 8 个 slice：authSlice、projectSlice、settingsSlice、panelsSlice、tasksSlice、editorSlice、creativeFieldsSlice、fileTabsSlice
- 新增 `types.ts` 统一类型定义，`storage.ts` 封装 localStorage 访问

### 组件抽取
- `NewProjectDialog` — TopBar 和 ProjectsPage 共享的新建项目对话框
- `WindowControls` — 窗口控制按钮（最小化/最大化/关闭）
- `ResizeHandle` — 面板拖拽调整宽度

### CSS 模块化
- `global.css`（742 行）拆为：welcome.css、topbar.css、workspace.css、sidebar.css、inspector.css
- global.css 仅保留 imports + reset

### 数据提取
- InspectorPanel 配置数据提取到 `shared/data/inspectorFields.ts`
- 魔法数字提取到 `shared/constants.ts`

---

## 安全修复

### JWT 签名
- 用 `jose` 库替换 base64 伪 JWT，HS256 签名 + 2 小时过期
- 生产环境强制 JWT_SECRET 至少 32 字符

### CORS
- 从 `origin: true` 改为白名单（localhost:5173、localhost:4000、app://.)

### 轮询泄漏
- tasksSlice 添加 AbortController，新请求自动取消旧轮询

---

## 性能优化

- SideNav / WorkspaceLayout 多个独立 selector 合并为 `useShallow` 单选择器
- SideNav toggle 函数用 `useCallback` 包裹
- ResizeHandle 用 `useRef` 保存最新回调，避免闭包捕获旧值

---

## Bug 修复

### 项目选择页无返回入口
- TopBar 新增 Home 按钮，点击 `closeProject()` 返回项目选择页

### 面板拉伸被锁回初始状态
- ResizeHandle 改用 ref 调用最新 onResize，不再闭包旧值
- WorkspaceLayout resize handler 改用 `useAppStore.getState()` 读取实时宽度

---

## 安全加固（2026-04-30）

### IPC 路径校验
- 新增 `shell/main/ipc/pathGuard.ts`，提供 `isSafePath`、`assertSafePath`、`assertWithinProject` 三个工具函数
- `projectIpc.ts` 所有 12 个文件操作 handler 加入路径校验，拒绝用户主目录以外的路径
- `windowIpc.ts` 的 `shell:show-item-in-folder` / `shell:open-path` 加入路径校验，删除自动创建文件/目录的逻辑

### API Key 加密
- `configIpc.ts` 使用 Electron `safeStorage` API 加密 API Key 后写入 `~/.orison/config.json`，读取时解密
- 不支持 `safeStorage` 的环境自动回退到明文（兼容 CI）

### CSP 动态注入
- 移除 `index.html` 中硬编码的 `<meta>` CSP 标签
- 主进程通过 `session.webRequest.onHeadersReceived` 动态注入 CSP
- 仅生产构建注入（dev 模式下 Vite dev server origin 与 `'self'` 不匹配，跳过注入）

### 默认模型名修正
- `configIpc.ts` 默认模型从 `gpt-5.4` 改为 `gpt-4o`

---

## UI 完善（2026-04-30）

### 第一批：Bug 修复 + 核心交互
- TiptapEditor toolbar `isActive` 检测改为显式 `activeName` 映射，修复 codeBlock / bulletList / orderedList 高亮失效
- FileEditor 添加 Ctrl+S / Cmd+S 快捷键调用 `saveFile`
- TopBar MenuDropdown 支持 Arrow/Enter/Escape 键盘导航 + ARIA 角色 + 菜单间 Left/Right 切换
- 新增 `useGlobalShortcuts` hook，统一注册 Ctrl+S/Z/Shift+Z/N/O
- 新增 `AboutDialog` 组件，Help → About 菜单项接入

### 第二批：页面布局打磨
- AuthPage：密码可见切换、autoComplete 属性、tab 切换清错误、提交失败焦点管理
- ProjectsPage：新增 header（品牌名 + 用户信息 + 登出）、空状态引导、卡片 hover translateY(-2px) 动画、section title、max-width 960px 居中
- WorkspaceLayout：底部面板改为 CSS transition 折叠/展开（不再条件移除 DOM）、720px 断点强制 grid columns 回退

### 第三批：侧边栏 & 项目树
- 新增 6 个 IPC 通道：`project:read-directory`、`delete-entry`、`rename-entry`、`create-entry`、`read-file`、`write-file`
- ProjectTree 改为通过 IPC 读取真实目录（懒加载 depth=1，展开时按需加载子级）
- 右键菜单的删除/重命名/新建操作调用真实 IPC
- 文件树展开/折叠改用 `grid-template-rows` CSS 过渡动画
- SideNav `aria-label` 从 "Project Tree" 修正为 "Main Navigation"
- `dirtyPaths` 和 `ctxItems` 改用 `useMemo` 缓存

### 其他
- 新增 `ErrorBoundary` 组件包裹 `<App />`，防止渲染异常白屏
- `authSlice` 的 `catch (e: any)` 改为 `catch (e: unknown)` + 类型安全处理
- ProjectTree 的 `FileEntry` 类型改为复用 `@orison/shared-contracts` 的 `FileTreeEntry`
- preload 安全白名单测试更新为 22 个方法

### Novel Migration Phase 3
- Native novel chapter pipeline 上线：6 节点混合 TS+Python 流水线（context-loader → chapter-bridge → draft-writer → multi-review → targeted-revision → chapter-title）。
- 关键修复：Windows Python 子进程 stdin 编码（`PYTHONIOENCODING=utf-8` + `Buffer.from(payload, 'utf8')` + `io.TextIOWrapper`），避免 cp936 破坏中文路径的反斜杠转义。
- 新增 `novel_draft_writer_agent.py`，绕开 creative pipeline 的 `planning.storyPlan` 硬依赖。
- Green commands:
  - `pnpm --filter @orison/agent test` (22 files / 92 tests passed)

### Novel Migration Phase 4
- 章节候选后处理：`story-sync-agent` (TS) 输出 `foreshadow_registry` merge patches；`memory-extractor-agent` (TS) 输出 `chapter_summary` / `character_mentions` / `foreshadow_seed` 三类 memory entries。
- 规则驱动版本，便于审阅与回归；契约定型后可平滑替换为 LLM 节点。
- locked / 已存在条目自动去重，永不主动覆盖。
- Green commands:
  - `pnpm --filter @orison/agent test` (23 files / 98 tests passed)

### Novel Migration Phase 5
- Desktop novel workbench 落地：`NovelWorkbench` + `ChapterListPanel` + `ChapterResultPanel` + `MemoryPanel`。
- 新增 store slice `novelChapterSlice`：章节选择、候选 accept/reject、memory entries。
- 接入 `EditorArea` 在 novel 模块下新增"章节工作台"子 tab。
- Green commands:
  - `pnpm --filter @orison/desktop-ui test novelWorkbench.test.tsx` (10/10 passed)

### Novel Migration Phase 6
- Auto Mode 多章节自动推进：`novelAutoModeRunner` (factory-based runner) + `autoModeService` (进程内会话注册表 + 后台异步推进循环)。
- 3 条 HTTP 路由：`POST /v1/orchestration/auto-mode`、`POST /v1/orchestration/auto-mode/actions`、`GET /v1/orchestration/auto-mode/:autoModeId`。
- `AutoModeConsole.tsx` UI（嵌入 NovelWorkbench 侧栏）+ 2s 轮询拉取最新状态。
- 暂停/恢复/取消 + failed 错误隔离。
- Green commands:
  - `pnpm --filter @orison/agent test` (24 files / 106 tests passed)
  - `pnpm --filter @orison/desktop-ui test autoModeConsole.test.tsx` (8/8 passed)

### Novel Migration Phase 7 — Parity Audit & Cutover
- Parity 矩阵已完成：`docs/superpowers/specs/2026-05-02-novel-migration-parity-audit.md`。
- 7 项 Definition of Done 全部满足。
- 最终测试基线（cutover 时刻）：
  - `@orison/shared-contracts`: 6 文件 / 52 测试 PASS
  - `@orison/desktop-local-bff`: 7 文件 / 31 测试 PASS
  - `@orison/agent`: 24 文件 / 106 测试 PASS
  - `@orison/desktop-ui`: 5/7 文件 / 32/34 测试 PASS（2 个失败为 Phase 5 之前历史遗留，已 git stash 验证）
  - **合计 42 个测试文件 / 221 个测试通过**

### Novel Migration Cutover Recommendation
- Ready for internal dogfood: **yes**
- Ready to retire standalone app: **yes（建议保留 30 天作为回滚兜底，期间未触发回滚则归档）**
- Remaining blockers: 无
- Remaining non-blocking enhancements:
  1. (P1) `story-sync-agent` 由规则驱动升级为 LLM 节点（contracts 已定型，无需改 schema）
  2. (P2) Auto Mode 会话持久化（序列化到 `runs/auto-mode/<id>.yaml`）
  3. (P3) Memory RAG / embedding 检索能力
  4. (P3) `apps/desktop/ui/tsconfig.json` zod / rootDir 配置缺陷修复（与本次迁移正交）
  5. (P3) 历史遗留 UI 测试 `workspaceLayout.test.tsx` / `reviewFlow.test.tsx`（与本次迁移正交）
- 退役清单（建议执行顺序）：
  1. 在 `H:/小说/backend` 与 `H:/小说/frontend` 仓库 README 顶部加 deprecation notice
  2. 等待 30 天 dogfood 期，期间收集 issue
  3. 30 天后将旧仓库改为 `archived` 状态，保留只读访问
  4. 更新内部 README，将旧仓库从默认入口移除
