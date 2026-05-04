# OneLine2Video / Orison Space

一个面向长篇故事、剧本、分镜与视频策划的 AI 创作工作台。

> **当前定位**：AI 驱动的影视/小说创作 IDE — 从一句话开始，构建大纲、小说、分镜直到视频；用户主导创作，AI 辅助生成与可控修改。

产品形态：**本地项目为主、Server 与 Agent 提供任务与生成能力**。

- 本地项目文件是创作内容的**唯一真理来源**
- Fastify 服务端负责认证、项目登记、任务入库与轻量资产索引
- Agent 服务负责章节流水线编排与生成
- Electron 桌面端负责创作、审阅、接收/拒绝 AI 结果

---

## 当前状态（2026-05-03）

### 创作主链路

- **小说项目**完整流水线（Phase 1-7 迁移完成，从老 standalone `H:/小说/{backend, frontend}` 整体迁入本仓库）
  - 章节生成（generate / continue / polish / review 四种模式）
  - 故事同步（自动从章节正文提取伏笔/世设更新建议为 reviewable patches）
  - 长期记忆（章节摘要 / 角色提及 / 悬念种子三类条目持久化）
  - 自动模式（多章节顺序自动推进，支持暂停/恢复/取消）
- **剧本/创作字段**编辑：creative brief、世界观、资产卡、关系图、outline v2、集纲、成长/节奏/情感曲线、伏笔注册表
- **任务/审核**：任务流水、章节候选 accept/reject、字段级 patch review

### 桌面端

- Electron + React 19 + TypeScript + Zustand
- **章节工作台**（Phase 5）：章节列表 + 候选审阅 + 自动模式控制台
- **记忆面板**：按章节分组、伏笔徽章
- **自动模式控制台**：启动/暂停/恢复/取消 + 2s 轮询进度
- **创作字段编辑器**：所有 creative fields 的可视化编辑
- **图片生成工作台**：调用服务端图片生成接口，生成结果先保存到项目 `temp/images/`，可预览、转存到 `assets/images/` 并加入资产卡
- **项目文件树**：通过 IPC 读取真实目录、懒加载、右键菜单
- **IPC 安全加固**：`pathGuard.ts` 路径越界校验、API Key 用 `safeStorage` 加密、CSP 主进程动态注入

### Agent 服务

- 6 节点混合 TS + Python 章节流水线：
  - `context-loader-agent` (TS) — 加载 project.yaml + 章节 markdown + 前序摘要
  - `chapter-bridge-agent` (TS) — 衔接指南
  - `draft-writer-agent` (Python) — LLM 草稿生成
  - `multi-review-agent` (Python) — 多维评审
  - `targeted-revision-agent` (Python) — 定向修订
  - `chapter-title-agent` (TS) — 标题归一化
- **Story Sync** + **Memory Extractor**（TS, 规则驱动）
- **Auto Mode**：进程内会话注册表 + 后台异步推进循环
- Windows 下 Python 子进程 stdin/stdout 强制 UTF-8（避免 cp936 破坏中文与路径转义）

### 服务端

- Fastify
- 认证（注册/登录/JWT）
- 项目登记（`POST /v1/projects`）
- 任务接口（提交、查询、按项目列表）
- 生成接口（`POST /v1/generation/:provider/text` / `image`，图片响应统一补齐 base64 与 data URL）
- 轻量资产索引（`(project_id, asset_id)` 复合主键）
- PostgreSQL 持久化 — 启动时自动建表

### 测试基线（2026-05-03）

| 包 | 文件 | 测试 | 状态 |
|---|---|---|---|
| `@orison/shared-contracts` | 6 | 52 | ✅ |
| `@orison/desktop-local-bff` | 7 | 31 | ✅ |
| `@orison/agent` | 24 | 106 | ✅ |
| `@orison/desktop-ui` | 8 | 36 | ✅ |

**当前 focused verification 已覆盖：desktop-ui 8 文件 / 36 测试，desktop-shell 5 文件 / 7 测试，server 7 文件 / 19 测试，均通过。**

---

## 仓库结构

```text
OneLine2Video/
├─ apps/
│  ├─ agent/                          Agent 编排服务
│  │  ├─ src/engine/
│  │  │  ├─ novelPipeline.ts          小说章节 6 节点流水线
│  │  │  ├─ runService.ts             run service（startNovelChapter / startCreative / start）
│  │  │  ├─ pythonNodeExecutor.ts     Python 子进程桥（含 UTF-8 stdin 修复）
│  │  │  └─ autoMode/
│  │  │     ├─ novelAutoModeRunner.ts 多章节会话工厂
│  │  │     └─ autoModeService.ts     进程内会话注册表 + 后台推进循环
│  │  ├─ src/nodes/                   TS 节点
│  │  │  ├─ context-loader-agent/
│  │  │  ├─ chapter-bridge-agent/
│  │  │  ├─ chapter-title-agent/
│  │  │  ├─ story-sync-agent/         规则驱动的故事同步
│  │  │  └─ memory-extractor-agent/   规则驱动的长期记忆提取
│  │  ├─ python/
│  │  │  ├─ runner/main.py            Python 节点入口（UTF-8 stdin/stdout）
│  │  │  ├─ nodes/                    Python LLM 节点
│  │  │  │  ├─ draft_writer_agent.py
│  │  │  │  ├─ novel_draft_writer_agent.py
│  │  │  │  ├─ multi_review_agent.py
│  │  │  │  └─ targeted_revision_agent.py
│  │  │  └─ python_agent/shared/      模型客户端 / 错误 / 模板
│  │  └─ test/                        24 个测试文件
│  ├─ desktop/
│  │  ├─ shell/
│  │  │  ├─ main/                     Electron 主进程 + IPC handlers + pathGuard
│  │  │  ├─ preload/                  contextBridge 预加载
│  │  │  └─ test/                     IPC 安全测试
│  │  ├─ ui/
│  │  │  └─ src/features/
│  │  │     ├─ novel-workbench/       章节工作台 (Phase 5)
│  │  │     ├─ memory/                记忆面板 (Phase 5)
│  │  │     ├─ auto-mode/             自动模式控制台 (Phase 6)
│  │  │     ├─ creative/              创作字段编辑器
│  │  │     ├─ orchestration/         编排面板
│  │  │     ├─ tasks/                 任务面板
│  │  │     └─ editor/                文件 / 大纲 / 剧本 / 分镜 / 图片生成 / 视频编辑
│  │  └─ local-bff/
│  │     └─ sync/
│  │        ├─ novelProjectRepository.ts  小说章节本地仓库
│  │        ├─ memoryRepository.ts        story-memory.yaml 仓库
│  │        ├─ localProjectRepository.ts  通用项目仓库 + chapter_candidate inline patch
│  │        └─ fieldSyncBridge.ts         字段同步桥
│  └─ server/                         Fastify 服务端
├─ packages/
│  ├─ shared-contracts/               共享 Zod 契约
│  │  └─ src/contracts/
│  │     ├─ novel-orchestration.ts    章节 run / story sync / memory / auto mode 契约
│  │     ├─ story-memory.ts           记忆条目契约
│  │     ├─ project.ts                project / chapter / chapter_status
│  │     ├─ project-patch.ts          field patch 契约
│  │     ├─ creative-fields.ts        所有 creative fields schema
│  │     └─ ...
│  ├─ shared-utils/                   共享工具
│  └─ ui-kit/                         共享 UI 包
├─ docs/
│  ├─ plan.md                         开发日志（含小说迁移 Phase 0-7 全部检查点）
│  ├─ api/                            服务端 API 文档
│  ├─ ipc/                            桌面 IPC 文档
│  └─ superpowers/
│     ├─ plans/2026-05-02-novel-system-migration.md   小说迁移完整计划与检查点
│     └─ specs/2026-05-02-novel-migration-parity-audit.md  Parity 审计与 cutover 决策
├─ run.bat                            Windows 一键启动
└─ pnpm-workspace.yaml
```

---

## 环境要求

- Node.js 22+
- pnpm 10+
- PostgreSQL 14+
- Python 3.10+（Agent Python 节点）
- Windows / macOS / Linux 均可（开发测试以 Windows + PowerShell 为主）

---

## 安装

```powershell
pnpm install
```

Electron 镜像（可选）：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm install
```

Python 依赖（仅 agent 服务需要）：

```powershell
cd apps/agent
pip install -r requirements.txt   # 如有需要
```

---

## 环境变量

服务端读取 `apps/server/.env`，Agent 读取 `apps/agent/.env.agent`。

```powershell
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/agent/.env.agent.example apps/agent/.env.agent
```

服务端默认：

```text
PORT=4000
DATABASE_URL=postgresql://postgres:root@localhost:5432/orison_dev
AGENT_URL=http://localhost:18422
JWT_SECRET=orison-dev-secret-key-NOT-FOR-PRODUCTION
DEMO_ACCESS_TOKEN=demo-access-token
```

Agent 默认：

```text
PORT=18422
LOG_LEVEL=info
OPENAI_API_KEY=<your-key>
OPENAI_BASE_URL=<optional-proxy>
```

---

## 本地开发

```powershell
# Windows 一键启动（同时拉起 server + agent + desktop）
run.bat

# 或者分别启动：
pnpm dev           # 桌面端
pnpm dev:server    # 服务端 http://localhost:4000
pnpm dev:agent     # Agent http://localhost:18422
```

构建：

```powershell
pnpm build
pnpm build:desktop
pnpm build:server
```

---

## 测试

```powershell
pnpm test            # turbo 全量
pnpm typecheck
pnpm lint
```

定向：

```powershell
pnpm --filter @orison/shared-contracts test
pnpm --filter @orison/desktop-local-bff test
pnpm --filter @orison/agent test
pnpm --filter @orison/desktop-ui test
```

迁移期间已实测全绿（基线 2026-05-03）：

```powershell
pnpm --filter @orison/agent test    # 24 文件 / 106 测试 PASS
pnpm --filter @orison/desktop-local-bff test    # 7 文件 / 31 测试 PASS
pnpm --filter @orison/shared-contracts test    # 6 文件 / 52 测试 PASS
```

---

## 接口概览

### 服务端

- `GET /health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/projects`
- `POST /v1/tasks`
- `GET /v1/tasks/:taskId`
- `GET /v1/projects/:projectId/tasks`
- `GET /v1/projects/:projectId/assets`
- `POST /v1/generation/:provider/text`
- `POST /v1/generation/:provider/image`
- `/v1/orchestration/*` → 代理至 Agent

### Agent 编排

- `POST /v1/orchestration/runs` — 启动 run（自动按 body 形态识别）
  - 含 `chapterId + mode` → **小说章节流水线**
  - 含 `runIntent` / `targetFields` / `constraints` → **creative pipeline**
  - 否则 → 旧版主链路
- `GET /v1/orchestration/runs/:runId` — 查询 run 快照
- `POST /v1/orchestration/actions` — `accept_current` / `edit_and_resume` / `rerun_from_node` / `abort_run`
- `POST /v1/orchestration/auto-mode` — 启动多章节自动模式
- `POST /v1/orchestration/auto-mode/actions` — `pause` / `resume` / `cancel`
- `GET /v1/orchestration/auto-mode/:autoModeId` — 查询自动模式状态

详见 [`docs/api/server-api.md`](docs/api/server-api.md)。

---

## 数据边界

- **本地 YAML + Markdown** 保存完整创作内容
  - `project.yaml` — 项目元信息、章节列表、世界观、关系图、伏笔注册表、曲线
  - `chapters/<chapter_id>.md` — 章节正文
  - `memory/story-memory.yaml` — 长期记忆索引
  - `temp/images/` — 图片生成临时结果
  - `assets/images/` — 已确认保存的生成图片资产
- **PostgreSQL** 保存项目元数据、任务流水、任务资产引用、轻量资产索引

也就是说：

- `outline` / `novel` / `script` / `storyboard` / `creative fields` / 生成图片文件等长内容继续本地保存
- `projects` / `tasks` / `task_asset_refs` / `project_assets` 负责任务追踪与检索

---

## 关键约定

- `projectId`：五位顺序号，例如 `00001`
- `taskId`：服务端生成，格式为 `YYYYMMDDHHmmssSSS_<random5>`
- `runId` / `autoModeId`：客户端可见，用于轮询与状态展示
- 章节 `status`：`draft` / `generating` / `revised` / `final`
- `project_assets` 按 `(project_id, asset_id)` 复合主键，避免不同项目里同名资产互相覆盖
- `chapter_candidate` patch 走 `applyFieldPatches` 通道：写入 markdown 文件 + 更新 yaml 元信息原子化

---

## 小说创作工作流（端到端）

1. 在桌面端新建/打开 novel 项目
2. 在"创作"面板编辑 brief、世界观、资产卡、关系图、伏笔等
3. 切换到"章节工作台"子标签页
4. 在章节列表中选择目标章节
5. 点击 `生成本章` / `续写` / `润色` / `复审`
6. 等待 6 节点流水线完成（`OrchestrationPanel` 显示节点级进度）
7. 在 `ChapterResultPanel` 审阅候选 → `接受候选` 写入磁盘 / `丢弃候选`
8. 接受后，`story-sync-agent` 输出的 patches 在 creative tab 的 `PatchReviewPanel` 中可逐项接受
9. `MemoryPanel` 自动展示新一章的记忆条目（按章节分组、伏笔徽章）
10. 多章节连推：使用侧栏的 `AutoModeConsole` → `启动自动模式`，可随时暂停/恢复/取消

---

## 已知现状与 Backlog

### 已知历史遗留（不阻塞 cutover）

1. `apps/desktop/ui` 的 `tsc --noEmit` 仍有 zod 模块解析 + rootDir 配置问题（与小说迁移正交，所有 creative 页面同样报错）
2. `test/workspaceLayout.test.tsx` / `test/reviewFlow.test.tsx` 失败（迁移之前已存在，git stash 可验证）
3. `GET /v1/projects/:projectId/tasks` 与 `GET /v1/projects/:projectId/assets` 暂未分页
4. `GET /v1/tasks/:taskId` 当前只返回任务结果，不返回任务元数据
5. `field:sync` IPC 通道已在 preload 与主进程 handler 中闭环；当前无已知 IPC surface mismatch

### 后续 Enhancement（按优先级）

- **P1** — `story-sync-agent` 由规则驱动升级为 LLM 节点（契约已定型，无需改 schema）
- **P2** — Auto Mode 会话持久化（序列化 `NovelAutoModeState` 到 `runs/auto-mode/<id>.yaml`）
- **P3** — Memory RAG / embedding 检索能力
- **P3** — `apps/desktop/ui/tsconfig.json` 历史遗留 zod / rootDir 整改

---

## 相关文档

- [服务端接口文档](docs/api/server-api.md)
- [桌面 IPC 文档](docs/ipc/desktop-ipc.md)
- [数据字典](docs/data-dictionary.md)
- [UI 设计](docs/ui-design.md)
- [开发日志](docs/plan.md)
- [小说迁移完整计划](docs/superpowers/plans/2026-05-02-novel-system-migration.md)
- [小说迁移 Parity 审计](docs/superpowers/specs/2026-05-02-novel-migration-parity-audit.md)
- [任务存储设计说明](docs/superpowers/specs/2026-04-27-task-storage-and-api-design.md)

---

## License

Private

---

## Architecture Notes (2026-05-04)

- Desktop UI split rules now live in [docs/architecture/module-boundaries.md](docs/architecture/module-boundaries.md).
- Pages should stay route-level; feature files own domain UI; child views, hooks, local types, and pure helpers are split when they carry independent responsibility.
- New desktop projects default to `~/Documents/OrisonSpace`; user-selected project directories are registered as allowed roots for the current Electron session and guarded by shell IPC path validation.
- Model config is stored as `~/.orison/model/index.yaml` plus one YAML file per model under `~/.orison/model/profiles/`; legacy `~/.orison/model/config.yaml` is migrated on read.
- The settings page manages a reusable model library and assigns selected profiles to `novel`, `image`, and `video`.
- The bottom Properties panel reads the selected image model from the same model library; placeholder image model choices have been removed.
- The bottom Output panel is a real console fed by model refresh/save and image generation/save events.
- Server generation APIs are provider-routed: `/v1/generation/:provider/text` and `/v1/generation/:provider/image`.
- Model-list refresh is handled by the desktop shell against the configured provider base URL, avoiding renderer CORS limits without adding a server endpoint.
- Current provider adapters are split by provider and capability for OpenAI-compatible, GCP, and Anthropic formats.
- Image generation responses accept `b64Json`, `b64_json`, `base64`, or data URL payloads and normalize to `b64Json`, `mimeType`, and `dataUrl`.
- The renderer previews generated images with data URLs, while the desktop shell converts base64 payloads into project-scoped files through `project:save-base64-image`.
- Latest focused verification: `@orison/shared-contracts typecheck`, `@orison/server test/build`, `@orison/desktop-shell typecheck/test`, and `@orison/desktop-ui typecheck/test` pass.
