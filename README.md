# OneLine2Video / Orison Space

一个面向长篇故事、剧本、分镜和视频策划的 AI 创作工作台。

当前产品方向是「本地项目为主、服务端和 Agent 提供任务与生成能力」：

- 本地项目文件仍然是创作内容的权威来源
- 服务端负责认证、项目登记、任务入库、任务查询和轻量资产索引
- Agent 服务负责编排与生成
- 桌面端负责创作、审阅、接收或拒绝 AI 结果

## 当前状态

当前仓库已经落地这些核心能力：

- Electron + React + TypeScript 的桌面端工作台
- 小说 / 剧本项目的本地打开与新建
- 创作字段编辑：brief、世界观、资产卡、关系图、outline v2、集纲、曲线等
- Fastify 服务端认证接口
- 项目注册接口：`POST /v1/projects`
- 任务接口：
  - `POST /v1/tasks`
  - `GET /v1/tasks/:taskId`
  - `GET /v1/projects/:projectId/tasks`
  - `GET /v1/projects/:projectId/assets`
- PostgreSQL 持久化：
  - `projects`
  - `tasks`
  - `task_asset_refs`
  - `project_assets`
- 桌面端项目注册联动：
  - 新建项目时会尝试向服务端登记 `projectId`
  - 打开旧项目时如果缺少 `projectId`，会尝试补登记
  - 提交任务时不再依赖客户端自造 `taskId`

## 仓库结构

```text
OneLine2Video/
  apps/
    agent/                Agent 编排服务
    desktop/
      shell/
        main/             Electron 主进程（IPC handlers、窗口管理）
        preload/          contextBridge 预加载脚本
        renderer/         React 入口
        test/             安全测试
        resources/        应用资源
      ui/                 React 桌面 UI
      local-bff/          桌面端本地桥接（预留，尚无实际源码）
    server/               Fastify 服务端
  packages/
    shared-contracts/     共享 Zod 契约与 IPC 类型定义
    shared-utils/         共享工具
    ui-kit/               共享 UI 包
  docs/
    api/                  服务端接口文档
    ipc/                  桌面 IPC 文档
    superpowers/          设计说明与实现计划
  run.bat                 Windows 本地开发启动器
```

## 环境要求

- Node.js 22+
- pnpm 10+
- PostgreSQL 14+
- Python 3.10+（用于部分 Agent Python 节点）

## 安装依赖

```powershell
pnpm install
```

如果 Electron 下载慢，可以先设置镜像再安装：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm install
```

## 环境变量

服务端读取 `apps/server/.env`，Agent 服务读取 `apps/agent/.env.agent`。

首次运行前可以先复制示例文件：

```powershell
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/agent/.env.agent.example apps/agent/.env.agent
```

服务端默认配置示例：

```text
PORT=4000
DATABASE_URL=postgresql://postgres:root@localhost:5432/orison_dev
AGENT_URL=http://localhost:18422
JWT_SECRET=orison-dev-secret-key-NOT-FOR-PRODUCTION
DEMO_ACCESS_TOKEN=demo-access-token
```

Agent 默认配置示例：

```text
PORT=18422
LOG_LEVEL=info
```

服务端启动时会检查目标数据库是否存在，并自动初始化当前需要的表结构。

## 本地开发

Windows 下一键启动：

```powershell
run.bat
```

也可以分别启动：

```powershell
# 桌面端
pnpm dev

# 服务端，默认 http://localhost:4000
pnpm dev:server

# Agent 服务，默认 http://localhost:18422
pnpm dev:agent
```

构建命令：

```powershell
pnpm build
pnpm build:desktop
pnpm build:server
```

## 测试

全量命令：

```powershell
pnpm test
pnpm lint
pnpm typecheck
```

常用定向测试：

```powershell
pnpm --filter @orison/shared-contracts test
pnpm --filter @orison/server test
pnpm --filter @orison/desktop-ui test
pnpm --filter @orison/agent test
```

这次任务已经实测通过的命令：

```powershell
pnpm --filter @orison/shared-contracts test
pnpm --filter @orison/server test projects.test.ts tasks.test.ts taskLists.test.ts
pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx
```

## 当前接口概览

服务端当前暴露的核心接口：

- `GET /health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/projects`
- `POST /v1/tasks`
- `GET /v1/tasks/:taskId`
- `GET /v1/projects/:projectId/tasks`
- `GET /v1/projects/:projectId/assets`
- `/v1/orchestration/*` 代理到 Agent 服务

更详细的字段说明见：

- [服务端接口文档](docs/api/server-api.md)

## 数据方向

当前的数据边界是：

- 本地文件保存完整创作内容
- PostgreSQL 保存项目元数据、任务流水、任务资产引用、轻量资产索引

也就是说：

- `outline`、`novel`、`script`、`storyboard`、`creative fields` 等长内容继续本地保存
- `projects` / `tasks` / `task_asset_refs` / `project_assets` 负责支持任务追踪和检索

## 关键约定

- `projectId`：五位顺序号，例如 `00001`
- `taskId`：服务端生成，格式为 `YYYYMMDDHHmmssSSS_<random5>`
- `project_assets` 现在按 `(project_id, asset_id)` 复合主键约束，避免不同项目里同名资产互相覆盖

## 已知现状

当前实现已经完成任务存储和项目索引主链路，但还有几处后续工作空间：

1. `GET /v1/projects/:projectId/tasks` 和 `GET /v1/projects/:projectId/assets` 还没有分页
2. `GET /v1/tasks/:taskId` 当前只返回任务结果，不返回任务元数据
3. 资产索引目前还是轻量占位值，后面可以逐步补充真实 `assetType` / `assetName`
4. `apps/desktop/ui` 的 `typecheck` 还存在一批历史类型问题，尚未在这轮里清理完

## 相关文档

- [服务端接口文档](docs/api/server-api.md)
- [桌面 IPC 文档](docs/ipc/desktop-ipc.md)
- [数据字典](docs/data-dictionary.md)
- [UI 设计](docs/ui-design.md)
- [开发日志](docs/plan.md)
- [任务存储设计说明](docs/superpowers/specs/2026-04-27-task-storage-and-api-design.md)
- [任务存储开发日志](<docs/任务存储与项目索引开发日志.md>)

## License

Private
