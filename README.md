# OneLine2Video / Orison Space

面向长篇故事、小说、剧本、分镜与视频策划的 AI 创作工作台。

> 当前定位：AI 驱动的影视 / 小说创作 IDE。用户从一句话、一个章节、一个分镜想法开始，逐步构建大纲、正文、创作字段、分镜与后续生成资产；AI 负责辅助生成、审阅建议与可控修改。

产品形态：以本地项目为核心，`server` 提供认证与 Agent 编排代理，桌面端主进程直接连接第三方模型。

- 本地项目文件仍然是创作内容的唯一事实来源
- `apps/server` 负责公开 API、JWT 鉴权与 `/v1/orchestration/*` Agent 代理
- `apps/agent` 负责编排流程、章节生成、规则回退、自动模式
- `apps/desktop/shell` 负责 IPC、安全边界、模型调用、story-sync 本地执行
- `apps/desktop/ui` 负责创作、审核、设置、项目管理与工作区交互

---

## 当前状态（2026-05-08）

### 核心能力

- 小说章节生成链路已接入桌面端工作区
  - 章节生成 / 续写 / 润色 / 复审
  - Story Sync 预计算补丁
  - 长期记忆抽取与面板展示
  - Auto Mode 多章节自动推进
- 创作字段编辑可在桌面端本地同步
  - 大纲、细纲、世界观、资产卡、关系图、伏笔注册表、成长 / 节奏 / 情绪曲线等
- 图片生成已改为桌面主进程直接连模型
  - 生成结果先落到项目 `temp/images/generation/`
  - 生成页会读取 `temp/images/generation/` 中已有图片
  - 画廊支持分页、按需懒加载二进制、复制 prompt、删除、已入库角标
  - 支持本地图片编辑：画笔、画圈、遮罩、裁切；工具栏分组 + Reset + 遮罩叠层可视化 + Esc 关闭
  - 支持上传参考图进入编辑模式（走 `/images/edits`），自动强制 n=1
  - 预览弹窗支持左右键盘切换
  - 确认保存后移动到 `assets/images/`
- 模型网关已从服务端迁移到桌面主进程
  - 文本 / 图片 / 视频生成都走 IPC
  - `apiKey` 不再经过 server，也不进入 agent
  - 模型列表统一走 OpenAI 兼容层（`GET {baseUrl}/v1/models`），覆盖直连 OpenAI 和 NewAPI/OneAPI 中继
  - 协议层统一为单一 OpenAI 兼容适配器（`generateText` / `generateImage` / `generateVideo`），移除多 apiFormat 注册表
  - 模型能力识别改为 model-registry 模式匹配（glob pattern），不再依赖手动 apiFormat 标注

### 鉴权与会话

- 服务端提供：
  - `POST /v1/auth/register`
  - `POST /v1/auth/login`
  - `GET /v1/auth/me`
- 密码传输安全：
  - 客户端使用 Web Crypto API 对密码做 SHA-256(password + app_salt) 散列
  - 散列值通过 HTTPS 传输到服务端
  - 服务端对收到的散列值做 bcrypt 存储/校验
- 桌面端启动时会执行 session bootstrap：
  - 本地有 token 时，先调用 `/v1/auth/me`
  - token 过期则自动退出到登录页
  - 启动校验成功会同步最新用户信息到本地 store

### 模型配置

- 模型配置使用 key-based 结构：
  - `~/.orison/model/keys/*.yaml`
- 一个 key 表示一组 `name + baseUrl + apiKey`
- 一个 key 下挂多个 `models[]`（从远端 `/v1/models` 发现后自动分类）
- 每个 model 有 `id`、`capability`（text/image/video）、`alias`、`enabled`
- 生成请求使用 `ModelRef`：`{ keyId, modelId }`
- 模型能力和别名由 `model-registry`（glob pattern 匹配）自动推断

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
│  ├─ agent/                          Fastify Agent：编排、章节流水线、Auto Mode、规则回退
│  │  ├─ src/
│  │  │  ├─ app.ts                    Agent 入口
│  │  │  ├─ routes.ts                 orchestration 路由
│  │  │  ├─ engine/                   运行时引擎
│  │  │  │  ├─ novelPipeline.ts       章节生成主流水线
│  │  │  │  ├─ runService.ts          orchestration run 调度
│  │  │  │  ├─ reviewRouter.ts        复审路由
│  │  │  │  ├─ workflowSync.ts        与 desktop 的 sync 协议
│  │  │  │  ├─ autoMode/              Auto Mode 状态机 / runner / store
│  │  │  │  ├─ memory/                长期记忆抽取
│  │  │  │  ├─ foreshadowLedger.ts    伏笔登记
│  │  │  │  └─ promptContractValidator.ts
│  │  │  ├─ nodes/                    有向工作流的节点（draft-writer / story-planner / story-sync / multi-review 等）
│  │  │  ├─ store/                    Agent 侧状态持久化
│  │  │  ├─ contracts/                Agent 对外契约
│  │  │  └─ common/
│  │  ├─ prompts/                     节点 prompt 模板
│  │  └─ python/                      python node executor 辅助
│  ├─ desktop/
│  │  ├─ shell/                       Electron 主进程 + preload
│  │  │  ├─ main/
│  │  │  │  ├─ index.ts               主进程入口、窗口创建、CSP 注入
│  │  │  │  ├─ ipc/
│  │  │  │  │  ├─ projectIpc.ts       项目 / 文件通道
│  │  │  │  │  ├─ projectIpcHelpers.ts
│  │  │  │  │  ├─ windowIpc.ts        窗口与系统通道
│  │  │  │  │  ├─ configIpc.ts        模型配置、用户偏好
│  │  │  │  │  ├─ modelProviderIpc.ts provider 模型列表
│  │  │  │  │  ├─ modelGatewayIpc.ts  文本 / 图片 / 视频生成入口
│  │  │  │  │  ├─ storySyncIpc.ts     本地 story-sync 执行
│  │  │  │  │  ├─ fieldSyncIpc.ts     创作字段同步
│  │  │  │  │  └─ pathGuard.ts        路径白名单
│  │  │  │  └─ storySync/runStorySync.ts
│  │  │  ├─ preload/index.ts          `window.orisonDesktop` contextBridge
│  │  │  ├─ renderer/main.tsx         Vite renderer 入口
│  │  │  └─ resources/
│  │  ├─ ui/                          React 渲染层
│  │  │  └─ src/
│  │  │     ├─ app/App.tsx            页面切换 / bootstrap
│  │  │     ├─ pages/
│  │  │     │  ├─ auth/               登录 / 注册
│  │  │     │  ├─ projects/           项目页
│  │  │     │  └─ workspace/          工作区
│  │  │     ├─ widgets/
│  │  │     │  ├─ layout/             WorkspaceLayout 等跨 feature 外壳
│  │  │     │  └─ projects/           项目页复用块
│  │  │     ├─ features/              产品域 feature
│  │  │     │  ├─ auth/
│  │  │     │  ├─ editor/             TiptapEditor / OutlineEditor / ScriptEditor
│  │  │     │  │                      / VideoEditor / ImageGenEditor / ImageEditDialog
│  │  │     │  │                      / FileEditor / StoryboardCanvas
│  │  │     │  ├─ bottom-panel/       properties / tasks / output
│  │  │     │  ├─ inspector/
│  │  │     │  ├─ project-tree/
│  │  │     │  ├─ side-nav/
│  │  │     │  ├─ top-bar/
│  │  │     │  ├─ novel-workbench/
│  │  │     │  ├─ orchestration/
│  │  │     │  ├─ auto-mode/
│  │  │     │  ├─ creative/           创作字段编辑器
│  │  │     │  ├─ memory/             长期记忆面板
│  │  │     │  └─ tasks/
│  │  │     └─ shared/
│  │  │        ├─ api/                HTTP helper（唯一 fetch 层）
│  │  │        ├─ store/              Zustand slice 化 store
│  │  │        ├─ i18n/               en-US / zh-CN yaml
│  │  │        ├─ themes/             主题 token 生成
│  │  │        ├─ imageGen/           图片生成共享逻辑
│  │  │        ├─ components/         通用 UI 原语
│  │  │        ├─ hooks/
│  │  │        ├─ data/
│  │  │        ├─ utils/
│  │  │        └─ styles/             全局样式（文件夹分层，见下）
│  │  │           ├─ tokens.css
│  │  │           ├─ global.css       唯一入口，按顺序串联所有 @import
│  │  │           ├─ inspector.css
│  │  │           ├─ creative.css
│  │  │           ├─ base/
│  │  │           │  ├─ components.css
│  │  │           │  └─ welcome.css
│  │  │           ├─ layout/
│  │  │           │  ├─ workspace.css
│  │  │           │  ├─ topbar.css
│  │  │           │  ├─ sidebar.css
│  │  │           │  └─ pages.css
│  │  │           └─ editor/          原 editor.css 拆分而成
│  │  │              ├─ tiptap.css    Tiptap + Outline + Acts
│  │  │              ├─ script.css    Script / Novel 编辑器外壳
│  │  │              ├─ video.css
│  │  │              ├─ image-gen.css 图片生成 + 画廊 + 分页 + model chip
│  │  │              ├─ image-dialog.css 预览弹窗 + 编辑弹窗
│  │  │              ├─ novel.css     Novel Workbench + Memory Panel + 子 tab
│  │  │              └─ file.css      File Editor + Tab Bar + markdown/code/image
│  │  └─ local-bff/                   本地项目数据读写层
│  │     ├─ api/                      project.yaml / chapters / memory 读写
│  │     ├─ sync/                     字段同步桥
│  │     └─ orchestration/            本地编排辅助
│  └─ server/                         Fastify 服务端
│     └─ src/
│        ├─ app.ts
│        ├─ common/                   db / error / util
│        └─ modules/
│           ├─ auth/                  register / login / me
│           ├─ orchestration/         转发到 Agent
│           └─ asset/ review/ user/ audit/ quota/ 预留占位目录
├─ packages/
│  ├─ shared-contracts/               Zod schema、IPC 类型、跨进程契约
│  ├─ model-protocols/                统一 OpenAI 兼容适配层（text/image/video 生成 + listModels）
│  ├─ story-sync/                     story-sync 共享逻辑（prompt / parse / patch）
│  ├─ shared-utils/
│  ├─ ui-kit/
│  └─ eslint-config/
├─ docs/
│  ├─ api/server-api.md               服务端 API 参考
│  ├─ ipc/desktop-ipc.md              桌面 IPC 参考
│  ├─ architecture/module-boundaries.md 模块边界规则
│  ├─ data-dictionary.md
│  ├─ ui-design.md
│  └─ plan.md                         开发记录
├─ design.md                          架构设计说明
├─ plan.md                            当前进度与计划
├─ run.bat / run.sh                   开发脚本
├─ turbo.json / pnpm-workspace.yaml
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
- `temp/images/generation/*`
- `assets/images/*`

### PostgreSQL

服务端数据库当前负责：

- `users`

项目文件、创作字段与后台任务持久化由桌面端本地项目目录和本地 SQLite 承担。

服务端不保存完整创作正文。

---

## 最近的重要架构变化

### 1. 模型网关迁移到桌面主进程

- `apps/server` 不再持有任何 provider generation route
- `apps/desktop/shell/main/ipc/modelGatewayIpc.ts` 成为统一模型出口
- `packages/model-protocols` 负责统一 OpenAI 兼容协议调用

### 2. Story Sync 从 Agent 中抬出

- 桌面主进程先执行 story-sync LLM 提取
- 渲染层把补丁放入 run body 的 `artifacts['chapter.llmPatches']`
- Agent 仅做二次校验与规则回退

### 3. 启动鉴权改为先校验后放行

- 启动时调用 `/v1/auth/me`
- 过期 token 不再先进入项目页
- 非过期错误进入登录页并保留错误提示

### 4. 模型设置页交互状态收口

- 空 key -> 空状态
- 新建中 -> 编辑器
- 选择已有 key -> 编辑器
- 有 key 但未选择 -> 提示先选择

### 5. 桌面 UI 样式按文件夹分层

- `shared/styles/` 从扁平的单层文件改为 `base/ layout/ editor/` 三层
- 原 2092 行的 `editor.css` 拆成 7 个子文件：tiptap / script / video / image-gen / image-dialog / novel / file
- `global.css` 作为唯一入口串联所有 `@import`，严格保持原级联顺序，下游消费方 `import '@desktop-ui/shared/styles/global.css'` 无感

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
