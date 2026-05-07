# OneLine2Video / Orison Space

面向长篇故事、小说、剧本、分镜与视频策划的 AI 创作工作台。

> 当前定位：AI 驱动的影视 / 小说创作 IDE。用户从一句话、一个章节、一个分镜想法开始，逐步构建大纲、正文、创作字段、分镜与后续生成资产；AI 负责辅助生成、审阅建议与可控修改。

产品形态：以本地项目为核心，`server` 提供认证、项目登记、任务查询与 Agent 代理，桌面端主进程直接连接第三方模型。

- 本地项目文件仍然是创作内容的唯一事实来源
- `apps/server` 负责公开 API、JWT 鉴权、项目与任务元数据、Agent 代理
- `apps/agent` 负责编排流程、章节生成、规则回退、自动模式
- `apps/desktop/shell` 负责 IPC、安全边界、模型调用、story-sync 本地执行
- `apps/desktop/ui` 负责创作、审核、设置、项目管理与工作区交互

---

## 当前状态（2026-05-07）

### 核心能力

- 小说章节生成链路已接入桌面端工作区
  - 章节生成 / 续写 / 润色 / 复审
  - Story Sync 预计算补丁
  - 长期记忆抽取与面板展示
  - Auto Mode 多章节自动推进
- 创作字段编辑可在桌面端本地同步
  - 大纲、细纲、世界观、资产卡、关系图、伏笔注册表、成长 / 节奏 / 情绪曲线等
- 图片生成已改为桌面主进程直接连模型
  - 生成结果先落到项目 `temp/images/`
  - 确认保存后移动到 `assets/images/`
- 模型网关已从服务端迁移到桌面主进程
  - 文本 / 图片 / 视频生成都走 IPC
  - `apiKey` 不再经过 server，也不进入 agent

### 鉴权与会话

- 服务端提供：
  - `POST /v1/auth/register`
  - `POST /v1/auth/login`
  - `GET /v1/auth/me`
- 桌面端启动时会执行 session bootstrap：
  - 本地有 token 时，先调用 `/v1/auth/me`
  - token 过期则自动退出到登录页
  - 启动校验成功会同步最新用户信息到本地 store

### 模型配置

- 模型配置使用 v2 结构：
  - `~/.orison/model/index.yaml`
  - `~/.orison/model/profiles/*.yaml`
- 一个 profile 表示一组 `provider + baseUrl + apiKey`
- 一个 profile 下可挂多个 `models[]`
- 槽位选择为：
  - `novel -> { profileId, modelId }`
  - `image -> { profileId, modelId }`
  - `video -> { profileId, modelId }`

### 测试基线

最近已验证：

- `pnpm --filter @orison/desktop-ui test -- authSessionExpiry.test.tsx`
- `pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx`
- `pnpm --filter @orison/desktop-ui typecheck`
- `pnpm --filter @orison/server test -- auth.test.ts`

---

## 仓库结构

```text
OneLine2Video/
├─ apps/
│  ├─ agent/                 Agent 编排与章节流水线
│  ├─ desktop/
│  │  ├─ shell/              Electron 主进程、preload、IPC
│  │  ├─ ui/                 React 桌面界面
│  │  └─ local-bff/          本地项目读写与字段同步桥
│  └─ server/                Fastify 服务端
├─ packages/
│  ├─ shared-contracts/      共享契约、Zod schema、IPC 类型
│  ├─ model-protocols/       模型协议适配层
│  ├─ story-sync/            Story Sync 共享逻辑
│  ├─ shared-utils/
│  └─ ui-kit/
├─ docs/                     参考文档、架构规则、API / IPC 说明
├─ design.md
├─ plan.md
└─ README.md
```

---

## 环境要求

- Node.js 22+
- pnpm 10+
- PostgreSQL 14+
- Python 3.10+（Agent Python 节点需要）

---

## 安装

```powershell
pnpm install
```

如果需要 Electron 镜像：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm install
```

---

## 本地开发

```powershell
pnpm dev           # 启动桌面端（desktop-shell）
pnpm dev:server    # 启动服务端 http://localhost:4000
pnpm dev:agent     # 启动 Agent http://localhost:18422
```

构建：

```powershell
pnpm build
pnpm build:desktop
pnpm build:server
```

测试：

```powershell
pnpm test
pnpm typecheck
pnpm lint
```

---

## 服务端接口概览

### 公开接口

- `GET /health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`

### 受保护接口

- `GET /v1/auth/me`
- `POST /v1/projects`
- `POST /v1/tasks`
- `GET /v1/tasks/:taskId`
- `GET /v1/tasks/:taskId/detail`
- `GET /v1/projects/:projectId/tasks`
- `GET /v1/projects/:projectId/assets`
- `/v1/orchestration/*` -> 代理到 Agent

### 已移除

- `/v1/generation/:provider/text`
- `/v1/generation/:provider/image`

现在第三方模型请求都由桌面主进程完成。

---

## 桌面 IPC 概览

桌面端通过 `window.orisonDesktop` 暴露能力，主要包括：

- 项目目录与文件操作
- 用户偏好读写
- 模型配置读写
- provider 模型列表刷新
- 文本 / 图片 / 视频生成
- story-sync 本地执行
- 字段同步
- 自定义标题栏窗口控制

详细见 [docs/ipc/desktop-ipc.md](docs/ipc/desktop-ipc.md)。

---

## 数据边界

### 本地项目

本地项目目录保存创作正文与资产文件，例如：

- `project.yaml`
- `chapters/*.md`
- `memory/story-memory.yaml`
- `temp/images/*`
- `assets/images/*`

### PostgreSQL

服务端数据库负责：

- `users`
- `projects`
- `tasks`
- `task_asset_refs`
- `project_assets`

服务端不保存完整创作正文。

---

## 最近的重要架构变化

### 1. 模型网关迁移到桌面主进程

- `apps/server` 不再持有任何 provider generation route
- `apps/desktop/shell/main/ipc/modelGatewayIpc.ts` 成为统一模型出口
- `packages/model-protocols` 负责按 `apiFormat` 分发协议

### 2. Story Sync 从 Agent 中抬出

- 桌面主进程先执行 story-sync LLM 提取
- 渲染层把补丁放入 run body 的 `artifacts['chapter.llmPatches']`
- Agent 仅做二次校验与规则回退

### 3. 启动鉴权改为先校验后放行

- 启动时调用 `/v1/auth/me`
- 过期 token 不再先进入项目页
- 非过期错误进入登录页并保留错误提示

### 4. 模型设置页交互状态收口

- 空 profile -> 空状态
- 新建中 -> 编辑器
- 选择已有 profile -> 编辑器
- 有 profile 但未选择 -> 提示先选择

---

## 相关文档

- [服务端 API 参考](docs/api/server-api.md)
- [桌面 IPC 参考](docs/ipc/desktop-ipc.md)
- [模块边界规则](docs/architecture/module-boundaries.md)
- [数据字典](docs/data-dictionary.md)
- [UI 设计说明](docs/ui-design.md)
- [开发记录](docs/plan.md)

---

## License

Private
