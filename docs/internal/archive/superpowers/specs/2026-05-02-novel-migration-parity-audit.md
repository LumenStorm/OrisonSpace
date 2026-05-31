# Novel System Migration — Parity Audit

**审计日期**：2026-05-03
**审计范围**：从 `H:/小说/{backend, frontend}` (FastAPI + React 单体应用) 迁移到 `H:/小说/OrisonSpace` (pnpm monorepo / TypeScript / Electron) 的功能对等性评估。
**编写人**：迁移执行 agent
**目标读者**：项目维护者，决定旧 standalone app 是否可以归档/退役。

---

## 1. 审计方法

1. 通过列举旧 backend 的 API endpoints (`backend/app/api/v1/endpoints/*.py`) + 旧 frontend 的页面 (`frontend/src/pages/*.tsx`) 形成功能清单。
2. 对照新 monorepo 的 contracts / local-bff / agent / desktop-ui 四层，逐项评估。
3. 状态分类：
   - **DONE** — 新系统具备等价或更强能力，老用户工作流可在新系统完成。
   - **PARTIAL** — 已具备核心功能，但某些边缘场景缺失或退化（已可见可控）。
   - **MISSING** — 新系统暂无对应能力。
   - **N/A** — 旧能力在新架构下已不再需要（被替代或合并）。

---

## 2. Parity 矩阵

### 2.1 章节创作 (Chapter Authoring)

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| 创建/编辑章节元数据 (`endpoints/chapters.py`) | `apps/desktop/local-bff/sync/novelProjectRepository.ts` + `project.yaml.novel.chapters[]` | **DONE** | 直接读写本地 yaml，避免数据库 |
| 章节正文存储（DB） | `chapters/<chapter_id>.md` 平面文件 | **DONE** | 受益：Git 友好、便于备份 |
| 章节列表/选中 (`ChaptersPage.tsx`) | `ChapterListPanel.tsx` (Phase 5) | **DONE** | active 高亮 + 状态徽章 |
| 章节编辑器 (`ChapterEditorPage.tsx`) | `ChapterResultPanel.tsx` candidate 视图 | **PARTIAL** | 只读展示候选；用户接受后写入 markdown 文件，使用现有 ScriptEditor / FileEditor 编辑 |

### 2.2 章节生成 (Chapter Generation)

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| 章节生成接口 (`endpoints/generation.py`) | `POST /v1/orchestration/runs` (chapterId+mode) → `runNovelPipeline` | **DONE** | 6 节点混合流水线 |
| context 加载（章节 + 上下文） | `context-loader-agent` (TS) | **DONE** | 读 project.yaml + 章节 md + 前序摘要 |
| 章节衔接 bridge | `chapter-bridge-agent` (TS) | **DONE** | 规则驱动 |
| 草稿生成 LLM | `draft-writer-agent` → `novel_draft_writer_agent.py` | **DONE** | 接入 OpenAI Responses API + mock 通道 |
| 多维评审 | `multi-review-agent` (Python) | **DONE** | 复用 creative pipeline 现有逻辑 |
| 定向修订 | `targeted-revision-agent` (Python) | **DONE** | 复用现有 |
| 章节标题归一化 | `chapter-title-agent` (TS) | **DONE** | 含 `第X章` 前缀去重 |
| 生成模式 (generate/continue/polish/review) | `mode` 字段，4 种均接 |  **DONE** | 进入 `runNovelPipeline` 后路径相同，差异由 prompt + context 体现 |
| 生成状态展示 (`GenerationPage.tsx`) | `OrchestrationPanel` + `ChapterResultPanel.status` | **DONE** | 节点级别进度可视化 |
| `ChapterWorkbenchPage.tsx` 一体化工作台 | `NovelWorkbench.tsx` (Phase 5) | **DONE** | 章节列表 + 候选审阅 + 自动模式 一处搞定 |

### 2.3 故事同步 (Story Sync)

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| 自动从章节抽取世设/角色/伏笔更新 | `story-sync-agent` (TS, 规则驱动) | **PARTIAL** | 启发式仅覆盖 5 类悬念关键词；旧 app 用 LLM-based。Phase 6/7 后可平滑替换为 LLM 节点 |
| 已存在条目去重 | 已实现（`story-sync-agent` 中 `dup` 检测） | **DONE** | |
| locked 字段保护 | 默认全部走 `merge` action，永不 `set` 已存在条目 | **DONE** | |
| Reviewable patch（人工接受/拒绝） | 输出符合 `fieldPatchEntrySchema` 的 patches，由 `applyFieldPatches` 消费 | **DONE** | UI 侧通过现有 `PatchReviewPanel` 审阅（creative tab）|

### 2.4 长期记忆 (Story Memory)

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| 章节摘要记忆 (`endpoints/memories.py`) | `memory-extractor-agent` 输出 `chapter_summary` 类型 | **DONE** | 至少 1 条/章 |
| 角色提及记忆 | `character_mentions` 类型（中文人物正则） | **PARTIAL** | 仅识别"X 探长 / X 警官 / X 警探"等模式，未做命名实体识别 |
| 悬念种子记忆 | `foreshadow_seed` 类型（伏笔关键词） | **DONE** | 5 类关键词，与 story-sync 同源 |
| 持久化 | `memory/story-memory.yaml` 通过 `memoryRepository.ts` | **DONE** | YAML 索引文件 |
| 检索 / RAG | — | **MISSING** | 旧 app 也未深度实现，目前仅是顺序读取，未来可叠加 embedding |
| `MemoriesPage.tsx` 浏览界面 | `MemoryPanel.tsx` (Phase 5) | **DONE** | 按章节分组 + 伏笔徽章 |

### 2.5 自动模式 (Auto Mode)

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| 多章节顺序推进 (`endpoints/auto_mode.py`) | `novelAutoModeRunner` + `autoModeService` | **DONE** | 进程内会话注册表 |
| 暂停 / 恢复 / 取消 | `pause()` / `resume()` / `cancel()` + 路由 | **DONE** | |
| 自动选择下一章 | 解析 `project.yaml` 跳过 `status=final` | **DONE** | |
| 进度展示 (`AutoModePage.tsx`) | `AutoModeConsole.tsx` (Phase 6) + 2s 轮询 | **DONE** | 嵌入 NovelWorkbench 侧栏 |
| 失败处理 | status='failed' + lastError 记录 | **DONE** | |
| 会话持久化（重启恢复） | — | **MISSING** | 当前内存态；重启 agent 即丢失。生产可加 SQLite/JSON 文件存储 |

### 2.6 世设 / 角色 / 关系 / 伏笔编辑

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| Worldbook 编辑 (`WorldbookPage.tsx` + `endpoints/worldbook.py`) | `WorldSettingView.tsx` + `creativeFieldsSlice` (worldSetting) | **DONE** | 本来就有，Phase 1-4 未改动 |
| Characters 编辑 (`CharactersPage.tsx` + `endpoints/characters.py`) | `AssetCardsList.tsx` (asset_cards 中 type=character) | **DONE** | |
| 关系图谱 (`RelationshipGraphPage.tsx`) | `RelationshipGraphEditor.tsx` | **DONE** | |
| 伏笔板 (`ForeshadowingBoardPage.tsx`) | `ForeshadowRegistryView.tsx` | **DONE** | |
| 写作风格 (`WritingStylesPage.tsx`) | — | **N/A** | 新架构由 prompt yaml 文件管理 |
| Prompt 模板 (`PromptTemplatesPage.tsx`) | `apps/agent/python/nodes/*` + `prompts/*.yaml` | **N/A** | 在代码侧管理，更利于版本与 review |

### 2.7 其它

| 旧能力 | 新对应物 | 状态 | 备注 |
|---|---|---|---|
| 任务监控 (`TaskMonitorPage.tsx`) | `TaskFeedPanel` + `OrchestrationPanel` | **DONE** | |
| 设置页 (`SettingsPage.tsx`) | `SettingsDialog.tsx` | **DONE** | |
| 大纲编辑 (`OutlinePage.tsx`) | `OutlineEditor.tsx` + `OutlineV2View.tsx` | **DONE** | |
| 向导 (`WizardPage.tsx`) | `NewProjectDialog.tsx` | **PARTIAL** | 新建项目流程已有；旧 wizard 的多步骤结构可后续按需补 |
| Dashboard (`Dashboard.tsx`) | `ProjectsPage.tsx` | **PARTIAL** | 项目列表/打开；统计/活动信息流可作为 nice-to-have |

---

## 3. 关键差距与风险

### 3.1 Story Sync 启发式 vs LLM
- **现状**：当前 `story-sync-agent` 是基于关键词 (`钥匙/信件/照片/匣子/印记`) 的规则版。
- **影响**：在小说题材偏离侦探/悬疑时，提取召回率下降。
- **缓解**：契约（`novelStorySyncPayloadSchema`、`fieldPatchEntrySchema`）已定型，后续可在不改 contracts 的前提下用 Python LLM 节点替换 `createStorySyncNode()`。

### 3.2 Memory 检索能力
- **现状**：仅顺序读取 `memory/story-memory.yaml`，无 embedding/相似度搜索。
- **影响**：长篇小说（>50 章）的上下文召回受限。
- **缓解**：旧 app 也未真正落地 RAG，新架构下可加一个独立 `memoryRetrievalService` 而不动核心生成路径。

### 3.3 Auto Mode 持久化
- **现状**：进程内 Map，agent 重启即丢失会话。
- **影响**：服务重启后无法 resume 已暂停的多章节会话；最多丢失"未完成的 in-progress 会话"。
- **缓解**：可序列化 `NovelAutoModeState` 到 `runs/auto-mode/<id>.yaml`；改造工作量小。

### 3.4 Desktop UI tsc 报错（历史遗留）
- **现状**：`@orison/desktop-ui` 包预先就有 zod 模块解析 + rootDir 配置缺陷，所有现有 creative 文件（`CreativeBriefView`、`AssetCardsList`、`CurvesView` 等）+ Phase 5 新增的 `novelChapterSlice.ts` 都报同种错误。
- **影响**：tsc 类型检查不可作为 CI 信号；运行时与单元测试均正常。
- **缓解**：后续单独整改 `apps/desktop/ui/tsconfig.json`（不在迁移范围内）。

### 3.5 Desktop UI 已有 2 个历史遗留失败测试
- `test/workspaceLayout.test.tsx` —— `Orison Space` 文案断言。
- `test/reviewFlow.test.tsx` —— mock task adapter 流程。
- 通过 `git stash` 验证：移除 Phase 5/6 改动后，这两个测试仍然失败。**不在本次迁移范围**。

---

## 4. Definition of Done 校验

参考计划文件中的 DoD 清单：

| # | 标准 | 验证 |
|---|---|---|
| 1 | novel chapter data 存在于 `OrisonSpace` 本地项目文件 | ✅ `project.yaml.novel.chapters` + `chapters/*.md` |
| 2 | 章节可在桌面 workbench 生成与接受 | ✅ `NovelWorkbench` + `acceptChapterCandidate` IPC |
| 3 | story sync 输出可审阅的 native field patches | ✅ `story-sync-agent` 输出符合 `fieldPatchEntrySchema` |
| 4 | story-memory 本地持久化 + 反哺生成 | ✅ `memory/story-memory.yaml` + context loader 已读取 |
| 5 | auto mode 可推进多章节，支持 pause/resume | ✅ `novelAutoModeRunner` + `AutoModeConsole` |
| 6 | parity audit 关键功能 DONE / 主动接受 PARTIAL | ✅ 见上文矩阵 |
| 7 | 旧 standalone 不再是日常创作所必需 | ✅ 章节生成 / story sync / memory / auto mode 全在新栈 |

**结论：DoD 7/7 满足。**

---

## 5. Cutover Recommendation

### 内部 dogfood 就绪？
**Yes** — 章节生成、审阅、接受、自动推进的完整路径在新栈跑通；本地文件即真理来源；无需启动旧 backend/frontend。

### 旧 standalone app 退役就绪？
**Yes（建议）** — 所有 DONE 项 + 主动接受的 PARTIAL 项已覆盖典型创作工作流。建议保留旧 app 仓库 30 天作为回滚兜底，30 天内未触发回滚则归档。

### 仍需推进的非阻塞事项

1. **故事同步 LLM 化**（P1）— 把 `story-sync-agent` 替换为 Python LLM 节点。
2. **Auto Mode 会话持久化**（P2）— 序列化 `NovelAutoModeState` 到本地。
3. **Memory RAG 升级**（P3）— 加 embedding + 相似度检索。
4. **Desktop UI tsconfig 修复**（P3）— 解决 `zod` 模块解析与 `rootDir` 配置（与本次迁移正交）。
5. **历史遗留 UI 测试修复**（P3）— `workspaceLayout.test.tsx`、`reviewFlow.test.tsx`（与本次迁移正交）。

### 退役清单（建议执行顺序）

1. 在 `H:/小说/backend` 与 `H:/小说/frontend` 仓库 README 顶部加 deprecation notice，指向 `OrisonSpace`。
2. 等待 30 天 dogfood 期，期间收集 issue。
3. 30 天后将旧仓库改为 `archived` 状态，保留只读访问。
4. 更新内部 README，将旧仓库从默认入口移除。

---

## 6. 测试基线（Cutover 时刻快照）

```
@orison/shared-contracts:    6 文件 / 52 测试 PASS
@orison/desktop-local-bff:   7 文件 / 31 测试 PASS
@orison/agent:               24 文件 / 106 测试 PASS
@orison/desktop-ui:          5/7 文件 / 32/34 测试 PASS（2 个失败为 Phase 5 之前历史遗留，已 git stash 验证）
─────────────────────────────────────────────────
合计：42 个测试文件 / 221 个测试通过
```

---

## 7. 文件交付清单

迁移期内本仓库新增/修改的关键路径：

**Contracts**：
- `packages/shared-contracts/src/contracts/story-memory.ts`（新）
- `packages/shared-contracts/src/contracts/novel-orchestration.ts`（新）
- `packages/shared-contracts/src/contracts/project.ts`（扩展）
- `packages/shared-contracts/src/contracts/tasks.ts`（扩展）

**Local-BFF**：
- `apps/desktop/local-bff/sync/novelProjectRepository.ts`（新）
- `apps/desktop/local-bff/sync/memoryRepository.ts`（新）
- `apps/desktop/local-bff/sync/localProjectRepository.ts`（chapter_candidate inline + foreshadow 字段）
- `apps/desktop/local-bff/sync/fieldSyncBridge.ts`（foreshadow 字段）

**Agent**：
- `apps/agent/src/engine/novelPipeline.ts`（新）
- `apps/agent/src/engine/registry.ts`（`createNovelNodeRegistry`）
- `apps/agent/src/engine/runService.ts`（`startNovelChapter`）
- `apps/agent/src/engine/autoMode/novelAutoModeRunner.ts`（新）
- `apps/agent/src/engine/autoMode/autoModeService.ts`（新）
- `apps/agent/src/engine/pythonNodeExecutor.ts`（UTF-8 stdin/stdout 修复）
- `apps/agent/src/nodes/context-loader-agent/index.ts`（新）
- `apps/agent/src/nodes/chapter-bridge-agent/index.ts`（新）
- `apps/agent/src/nodes/chapter-title-agent/index.ts`（新）
- `apps/agent/src/nodes/story-sync-agent/index.ts`（新）
- `apps/agent/src/nodes/memory-extractor-agent/index.ts`（新）
- `apps/agent/python/nodes/novel_draft_writer_agent.py`（新）
- `apps/agent/python/runner/main.py`（UTF-8 stdin 修复）
- `apps/agent/src/routes.ts`（novel + auto-mode 路由）

**Desktop UI**：
- `apps/desktop/ui/src/shared/store/novelChapterSlice.ts`（新）
- `apps/desktop/ui/src/shared/store/appStore.ts`（slice 接入）
- `apps/desktop/ui/src/features/novel-workbench/NovelWorkbench.tsx`（新）
- `apps/desktop/ui/src/features/novel-workbench/ChapterListPanel.tsx`（新）
- `apps/desktop/ui/src/features/novel-workbench/ChapterResultPanel.tsx`（新）
- `apps/desktop/ui/src/features/memory/MemoryPanel.tsx`（新）
- `apps/desktop/ui/src/features/auto-mode/AutoModeConsole.tsx`（新）
- `apps/desktop/ui/src/features/editor/EditorArea.tsx`（章节工作台子 tab）

**Tests（新增）**：
- `packages/shared-contracts/tests/novelContracts.test.ts`
- `apps/desktop/local-bff/test/novelProjectRepository.test.ts`
- `apps/desktop/local-bff/test/memoryRepository.test.ts`
- `apps/agent/test/orchestration.novelWorkflow.test.ts`
- `apps/agent/test/storyMemory.test.ts`
- `apps/agent/test/autoModeRunner.test.ts`
- `apps/desktop/ui/test/novelWorkbench.test.tsx`
- `apps/desktop/ui/test/autoModeConsole.test.tsx`

---

*审计结束。建议归档此文件并在 `docs/plan.md` 追加 Cutover Recommendation 摘要。*
