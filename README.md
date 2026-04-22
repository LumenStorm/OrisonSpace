# Orison Space (OneLine2Video)

AI 驱动的影视创作 IDE —— 从一句话创意到完整视频。

核心理念：AI 主导生成，人类审阅、接受或拒绝。工作流程为：创意 → 大纲 → 剧本 → 分镜 → 视频。

## 项目结构

```
oneline2video/
├── apps/
│   ├── desktop/
│   │   ├── shell/          # Electron 主进程 + 预加载 + 渲染入口
│   │   ├── ui/             # React UI 组件（页面、功能模块、样式）
│   │   └── local-bff/      # 本地 BFF 层（IPC 桥接、本地数据持久化）
│   └── server/             # 远程服务端（Fastify，负责认证、任务提交、配额）
├── packages/
│   ├── shared-contracts/   # Zod schema 契约（项目、任务、认证、IPC）
│   ├── shared-utils/       # 公共工具函数
│   ├── ui-kit/             # 通用 UI 组件库
│   └── eslint-config/      # 共享 ESLint 配置
├── turbo.json              # Turborepo 构建编排
└── pnpm-workspace.yaml     # pnpm 工作区配置
```

## 环境要求

- Node.js >= 22
- pnpm >= 10

## 安装

```bash
pnpm install
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
# 启动桌面应用（Electron + 热更新）
pnpm dev

# 单独启动后端服务
pnpm dev:server
```

也可以使用 `run.bat`（Windows）或 `run.sh`（macOS/Linux）菜单启动。

## 构建

```bash
# 全量构建
pnpm build

# 单独构建桌面应用
pnpm build:desktop

# 单独构建服务端
pnpm build:server
```

## 测试 & 检查

```bash
# 运行全部测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

## 开发规范

### 分支

- `main` — 稳定发布分支
- `dev` — 日常开发分支
- 功能分支从 `dev` 切出，命名 `feat/xxx` 或 `fix/xxx`

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(ui): add welcome page
fix(shell): resolve CSP font loading
docs: update UI design spec
refactor(store): extract project state
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

## License

Private
