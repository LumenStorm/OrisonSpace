# Orison Space (OneLine2Video)

AI 驱动的影视创作 IDE —— 从一句话创意到完整视频。

核心理念：AI 主导生成，人类审阅、接受或拒绝。工作流程为：创意 → 大纲 → 剧本 → 分镜 → 视频。

## 架构总览

项目采用三层 Agent 编排架构，由 TypeScript 服务端调度 Python Agent 节点执行：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  规划层                                                                      │
│  需求接入 → 资产装载 → 故事规划 → 章节任务卡 → 正文初稿生成 → 连续性记忆更新    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  生产层                                                                      │
│  多维审核 → 是否通过? ──通过──→ 版本归档 → 交付输出 → 数据回流                  │
│                 │                                  ╎ (虚线回流)               │
│               未通过                         更新资产与规则 → 资产装载          │
│                 ↓                           影响后续生成与审核 → 多维审核        │
│            定向修订 → 多维审核 (循环)                                          │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  控制与交付层                                                                 │
│  人工接管（重大冲突时介入） → 多维审核                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
oneline2video/
├── apps/
│   ├── desktop/
│   │   ├── shell/              # Electron 主进程 + 预加载 + 渲染入口
│   │   ├── ui/                 # React UI（页面、功能模块、OrchestrationPanel）
│   │   └── local-bff/          # 本地 BFF 层（IPC 桥接、归档仓库、API 客户端）
│   └── server/                 # Fastify 服务端
│       └── src/modules/
│           ├── auth/           # 认证模块（注册、登录、JWT）
│           ├── task/           # 任务模块（提交、缓存、Mock 适配器）
│           └── orchestration/  # Agent 编排模块
│               ├── engine/     # 执行引擎
│               │   ├── runService.ts         # 主链路执行服务
│               │   ├── actionService.ts      # 人工操作服务（accept/edit/rerun/abort）
│               │   ├── archiveService.ts     # 版本归档
│               │   ├── deliveryService.ts    # 交付输出
│               │   ├── feedbackService.ts    # 数据回流
│               │   ├── pythonNodeExecutor.ts # Python 子进程执行器
│               │   ├── registry.ts           # 节点注册表
│               │   └── reviewRouter.ts       # 审核路由
│               ├── nodes/      # 8 个 Agent 节点（TS 端定义）
│               ├── config/     # YAML 配置加载 & Prompt 模板解析
│               ├── contracts/  # 类型定义
│               ├── store/      # 内存 Run 存储
│               └── routes.ts   # REST API 路由
├── python-agent/               # Python Agent 节点实现
│   ├── runner/main.py          # 统一入口（stdin JSON → stdout JSON）
│   ├── nodes/                  # 8 个 Agent 节点实现
│   │   ├── intake_agent.py
│   │   ├── asset_loader_agent.py
│   │   ├── story_planner_agent.py    # 接入 OpenAI Responses API
│   │   ├── chapter_task_agent.py
│   │   ├── draft_writer_agent.py
│   │   ├── continuity_memory_agent.py
│   │   ├── multi_review_agent.py
│   │   └── targeted_revision_agent.py
│   ├── python_agent/shared/    # 共享模块（model_client、errors、模板）
│   └── tests/                  # Python 测试
├── packages/
│   ├── shared-contracts/       # Zod schema 契约（orchestration、project、task、auth、IPC）
│   ├── shared-utils/           # 公共工具函数
│   ├── ui-kit/                 # 通用 UI 组件库
│   └── eslint-config/          # 共享 ESLint 配置
├── turbo.json                  # Turborepo 构建编排
└── pnpm-workspace.yaml         # pnpm 工作区配置
```

## Agent 编排流程

### 8 个 Agent 节点

| 节点 | 职责 | 产物 Key |
|------|------|----------|
| intake-agent | 需求接入，标准化用户输入 | `intake.requirement` |
| asset-loader-agent | 资产装载，加载项目上下文 | `assets.projectContext` |
| story-planner-agent | 故事规划，调用 OpenAI 生成结构化故事大纲 | `planning.storyPlan` |
| chapter-task-agent | 章节任务拆解 | `planning.chapterTasks` |
| draft-writer-agent | 正文初稿生成 | `draft.initial` |
| continuity-memory-agent | 连续性记忆更新 | `memory.continuity` |
| multi-review-agent | 多维审核（pass / revise / escalate） | `review.latest` |
| targeted-revision-agent | 定向修订（审核未通过时触发） | `draft.revision` |

### 审核路由

- `pass` → 版本归档 → 交付输出 → 数据回流 → 状态变为 `delivered`
- `revise` → 定向修订 → 重新审核（循环）
- `escalate` → 人工接管（`human_in_loop`）

### 人工操作（Actions API）

| Action | 说明 |
|--------|------|
| `accept_current` | 接受当前结果，触发归档→交付→回流 |
| `edit_and_resume` | 编辑产物后从下一节点继续执行 |
| `rerun_from_node` | 从指定节点重新执行后续链路 |
| `abort_run` | 终止流程 |

### Run 状态机

```
pending → running → approved → archived → delivered
                  ↘ revision_pending → (定向修订循环)
                  ↘ human_in_loop → (等待人工操作)
                  ↘ failed
```

## 环境要求

- Node.js >= 22
- pnpm >= 10
- Python >= 3.11
- PostgreSQL >= 14（认证模块需要）

## 安装

```bash
# 安装 Node 依赖
pnpm install

# 安装 Python 依赖
cd python-agent
pip install -r requirements.txt
```

### 环境变量

```bash
# OpenAI API（story-planner-agent 需要）
export OPENAI_API_KEY=your-api-key

# 测试时可用 Mock 模式跳过真实 API 调用
export OPENAI_RESPONSES_MOCK_JSON='{"title":"Mock","premise":"...","tone":"dark","acts":[],"characters":[]}'
```

### 数据库初始化

```sql
-- 连接 PostgreSQL 后执行
CREATE ROLE root WITH LOGIN PASSWORD 'root' SUPERUSER;
CREATE DATABASE orison_dev;

-- 连接 orison_dev 后执行
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

如果 Electron 下载缓慢，可设置国内镜像：

```bash
# Windows
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# macOS / Linux
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

## 启动

```bash
# 启动后端服务 + 桌面应用（推荐）
run.bat 选项 1

# 单独启动后端服务
pnpm dev:server

# 单独启动桌面应用（需先启动后端）
pnpm dev
```

### 测试账号

| 邮箱 | 密码 |
|------|------|
| test@orison.dev | test123 |

## API 端点

### 编排 API

```
POST   /v1/orchestration/runs      # 启动编排链路
GET    /v1/orchestration/runs/:id   # 查询 Run 状态
POST   /v1/orchestration/actions    # 执行人工操作
```

### 请求示例

```bash
# 启动编排
curl -X POST http://localhost:4000/v1/orchestration/runs \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"./my-project","requirement":"写一个悬疑故事大纲"}'

# 查询状态
curl http://localhost:4000/v1/orchestration/runs/run_xxx

# 接受结果
curl -X POST http://localhost:4000/v1/orchestration/actions \
  -H "Content-Type: application/json" \
  -d '{"runId":"run_xxx","action":"accept_current"}'
```

## 构建

```bash
# 全量构建
pnpm build

# 单独构建桌面应用
pnpm build:desktop

# 单独构建服务端
pnpm build:server
```

## 测试

```bash
# 运行全部测试
pnpm test

# 运行服务端 orchestration 测试（需设置 OPENAI mock 环境变量）
OPENAI_API_KEY=test-key \
OPENAI_RESPONSES_MOCK_JSON='{"title":"Mock","premise":"test","tone":"dark","acts":[{"id":"a1","title":"A1","goal":"g","conflict":"c","turn":"t"}],"characters":[{"id":"c1","name":"H","role":"p","goal":"g","risk":"r"}]}' \
npx vitest --run apps/server/test/orchestration.*.test.ts

# 运行 UI 测试
cd apps/desktop/ui && npx vitest --run

# 运行 Python 测试
cd python-agent && pytest

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面端 | Electron + React 19 + Zustand + TipTap |
| 服务端 | Fastify + Zod + Pino |
| Agent 节点 | Python 3.11 + OpenAI Responses API |
| 契约层 | Zod schema（TypeScript ↔ Python 共享） |
| 构建 | Turborepo + pnpm workspace + tsup |
| 测试 | Vitest + Testing Library + pytest |
| 数据库 | PostgreSQL（认证） |

## 开发规范

### 分支

- `main` — 稳定发布分支
- `dev` — 日常开发分支
- `test` — 测试分支
- 功能分支从 `dev` 切出，命名 `feat/xxx` 或 `fix/xxx`

### 同步代码

协同开发时，拉取最新代码请使用 `git remote update` + `git rebase`，避免产生多余的 merge commit：

```bash
git remote update
git rebase origin/dev
```

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(orchestration): add delivery and feedback pipeline
fix(executor): resolve workspace root path in worktree
docs: update README with full architecture
```

### 代码风格

- TypeScript strict 模式
- React 函数组件 + Hooks
- 状态管理使用 Zustand
- 样式使用 CSS 变量 + BEM-like 类名（无 CSS-in-JS）
- 字体：Inter（UI）/ Newsreader（内容展示）
- 图标：Material Symbols Outlined

### 数据流

- 本地优先：项目数据存储在客户端，服务端仅处理认证、任务和配额
- AI 任务通过 `taskRequest` 提交，返回 `patchOperations`
- 编排链路通过 `orchestrationRun` 管理，支持审核循环和人工接管
- 所有 AI 结果需经用户审阅后才合并到本地数据

### 目录约定

- `pages/` — 页面级组件
- `features/` — 功能模块组件
- `widgets/` — 布局组件
- `shared/` — 公共状态、样式、类型、数据

## 文档

- [UI 页面与元素设计](docs/ui-design.md)
- [桌面端 IPC 协议](docs/ipc/desktop-ipc.md)
- [服务端 API](docs/api/server-api.md)
- [OpenAI Story Planner 设计](docs/superpowers/specs/2026-04-23-openai-story-planner-design.md)
- [Agent 编排补全计划](docs/superpowers/plans/2026-04-24-agent-orchestration-completion.md)

## License

Private
