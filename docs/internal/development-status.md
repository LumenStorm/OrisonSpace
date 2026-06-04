# Orison Space

面向长篇故事、小说、剧本、分镜与视频策划的 AI 创作工作台。

> 当前定位：AI 驱动的影视 / 小说创作 IDE。用户从一句话、一个章节、一个分镜想法开始，逐步构建大纲、正文、创作字段、分镜与后续生成资产；AI 负责辅助生成、审阅建议与可控修改。

产品形态：以本地项目为核心，桌面端主进程直接连接第三方模型，Agent 作为库内嵌于 Shell 进程。

- 本地项目文件仍然是创作内容的唯一事实来源
- `apps/desktop/agent` 是编排库（非独立进程），负责 workflow runtime、skill 执行、continuation
- `apps/desktop/client/shell` 负责 IPC、安全边界、模型调用、story-sync 本地执行、agent 生命周期
- `apps/desktop/client/ui` 负责创作、审核、设置、项目管理与工作区交互

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
- 模型网关在桌面主进程
  - 文本 / 图片 / 视频生成都走 IPC
  - `apiKey` 不进入 agent
  - 模型列表统一走 OpenAI 兼容层（`GET {baseUrl}/v1/models`），覆盖直连 OpenAI 和 NewAPI/OneAPI 中继
  - 协议层统一为单一 OpenAI 兼容适配器（`generateText` / `generateImage` / `generateVideo`），移除多 apiFormat 注册表
  - 模型能力识别改为 model-registry 模式匹配（glob pattern），不再依赖手动 apiFormat 标注

### 鉴权与会话

- 已移除服务端鉴权，桌面端为纯本地应用，无需登录
- 启动后直接进入项目页

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

- `pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx`
- `pnpm --filter @orison/desktop-ui typecheck`
- `pnpm --filter @orison/desktop-shell test -- securitySurface.test.ts`

---

## 最近更新（2026-05-23）

Agent runtime 打通"自动召唤 skill / 子代理"的完整嵌套链路:

- LLM 可在对话中直接命中 skill,系统提示按 `priority: required / optional` 自动列出可调用清单
- skill 内部 prompt 改为完整 runLoop,可继续触发其它 skill / 工具 / 子代理
- 新 `spawn_agent` 工具,子代理在独立子会话中聚焦完成任务,只回传最终答复
- `.orison/agents/<role>.md` 定义子代理人设(frontmatter + 正文)
- IPC stream 事件新增 `child` 类型,UI 用 `[subagent:role:dN]` 角标渲染嵌套消息
- abort 信号 / 嵌套深度上限 (`MAX_SPAWN_DEPTH = 5`) 沿调用链下传,防止失控

详见下面的 [「嵌套执行链（2026-05-23）」](#嵌套执行链2026-05-23) 节与 [docs/agent.md](docs/agent.md)。---

## 仓库结构

```text
OrisonSpace/
├─ apps/
│  ├─ desktop/
│  │  ├─ agent/                        @orison/desktop-agent 库：workflow runtime、skill 执行、continuation
│  │  │  └─ src/
│  │  │     ├─ index.ts                公共 API 入口
│  │  │     ├─ runtime/                workflow runtime 核心
│  │  │     ├─ skill/                  skill 发现与执行
│  │  │     ├─ session/                会话管理与持久化
│  │  │     ├─ agent/                  子代理定义加载
│  │  │     └─ remote.ts              LLM provider（依赖注入）
│  │  ├─ client/
│  │  │  ├─ shell/                     Electron 主进程 + preload
│  │  │  │  ├─ main/
│  │  │  │  │  ├─ index.ts               主进程入口、窗口创建、CSP 注入
│  │  │  │  │  ├─ ipc/
│  │  │  │  │  │  ├─ projectIpc.ts       项目 / 文件通道
│  │  │  │  │  │  ├─ projectIpcHelpers.ts
│  │  │  │  │  │  ├─ windowIpc.ts        窗口与系统通道
│  │  │  │  │  │  ├─ configIpc.ts        模型配置、用户偏好
│  │  │  │  │  │  ├─ modelProviderIpc.ts provider 模型列表
│  │  │  │  │  │  ├─ modelGatewayIpc.ts  文本 / 图片 / 视频生成入口
│  │  │  │  │  │  ├─ storySyncIpc.ts     本地 story-sync 执行
│  │  │  │  │  │  ├─ agentIpc.ts         Agent IPC handlers
│  │  │  │  │  │  ├─ fieldSyncIpc.ts     创作字段同步
│  │  │  │  │  │  └─ pathGuard.ts        路径白名单
│  │  │  │  │  └─ storySync/runStorySync.ts
│  │  │  │  ├─ preload/index.ts          `window.orisonDesktop` contextBridge
│  │  │  │  ├─ renderer/main.tsx         Vite renderer 入口
│  │  │  │  └─ resources/
│  │  │  └─ ui/                          React 渲染层
│  │  │     └─ src/
│  │  │     ├─ app/App.tsx            页面切换 / bootstrap
│  │  │     ├─ pages/
│  │  │     │  ├─ projects/           项目页
│  │  │     │  └─ workspace/          工作区
│  │  │     ├─ widgets/
│  │  │     │  ├─ layout/             WorkspaceLayout 等跨 feature 外壳
│  │  │     │  └─ projects/           项目页复用块
│  │  │     ├─ features/              产品域 feature
│  │  │     │  ├─ editor/             TiptapEditor / OutlineEditor / ScriptEditor
│  │  │     │  │                      / VideoEditor / ImageGenEditor / ImageEditDialog
│  │  │     │  │                      / FileEditor / StoryboardCanvas
│  │  │     │  ├─ agent-panel/        AgentPanel / AgentInput / AgentMessages
│  │  │     │  │                      / AgentMessageItem / AgentToolCard / DiffCard
│  │  │     │  │                      / AgentConfirmCard / AgentHistory
│  │  │     │  ├─ bottom-panel/       properties / tasks / output
│  │  │     │  ├─ inspector/
│  │  │     │  ├─ project-tree/
│  │  │     │  ├─ search-panel/       搜索面板（与 ProjectTree 互斥）
│  │  │     │  ├─ side-nav/
│  │  │     │  ├─ top-bar/
│  │  │     │  ├─ novel-workbench/
│  │  │     │  ├─ orchestration/
│  │  │     │  ├─ auto-mode/
│  │  │     │  ├─ creative/           创作字段编辑器
│  │  │     │  ├─ memory/             长期记忆面板
│  │  │     │  └─ tasks/
│  │  │     └─ shared/
│  │  │        ├─ api/                IPC helper（preload bridge 层）
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
│  │  │           │  ├─ statusbar.css
│  │  │           │  ├─ notifications.css
│  │  │           │  └─ pages.css
│  │  │           └─ editor/          原 editor.css 拆分而成
│  │  │              ├─ tiptap.css    Tiptap + Outline + Acts
│  │  │              ├─ script.css    Script / Novel 编辑器外壳
│  │  │              ├─ video.css
│  │  │              ├─ image-gen.css 图片生成 + 画廊 + 分页 + model chip
│  │  │              ├─ image-dialog.css 预览弹窗 + 编辑弹窗
│  │  │              ├─ novel.css     Novel Workbench + Memory Panel + 子 tab
│  │  │              ├─ file.css      File Editor + Tab Bar + markdown/code/image
│  │  │              └─ timeline.css  时间线编辑器
│  │  └─ local-bff/                   本地项目数据读写层
│  │     ├─ api/                      project.yaml / chapters / memory 读写
│  │     ├─ sync/                     字段同步桥
│  │     └─ orchestration/            本地编排辅助
├─ packages/
│  ├─ shared-contracts/               Zod schema、IPC 类型、跨进程契约
│  ├─ model-protocols/                统一 OpenAI 兼容适配层（text/image/video 生成 + listModels）
│  └─ story-sync/                     story-sync 共享逻辑（prompt / parse / patch）
├─ docs/
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

## 依赖与框架规范

本仓库使用 pnpm workspace 管理依赖，根目录 `packageManager` 以 `pnpm@10.8.1` 为准。日常安装只使用 `pnpm install`，不要混用 npm、yarn 或在 apps 子目录里单独生成锁文件。

依赖锁文件以根目录 `pnpm-lock.yaml` 为唯一来源，需要随代码提交。`package-lock.json` 和各 app 下的 `package-lock.json` 已视为漂移文件，不再保留；如果本地误生成，删除后重新执行 `pnpm install`。

本地 `node_modules` 已从混装状态清理为 pnpm 单一安装。一次干净安装后，根目录 `node_modules` 约 560 MB，其中 Electron 约 318 MB，是桌面壳运行和打包的主要体积来源。除非拆分桌面端安装边界，否则这是当前框架下的主要固定成本。

原先 `apps/desktop/client/shell` 中直接声明但未直接使用的 `@swc/core` 已移除；它仍可能作为 electron-vite / tsup 的可选平台依赖出现在 pnpm virtual store 中。不要为了”看起来缺失”重新加回直接依赖，除非代码里确实直接 import 或调用它。

允许执行 install/build 脚本的 native 依赖集中维护在根目录 `package.json` 的 `pnpm.onlyBuiltDependencies` 中，目前包括 `@swc/core`、`bcrypt`、`better-sqlite3`、`electron`、`esbuild`。新增 native 依赖时，需要先确认用途、体积和安全性，再同步更新该白名单。

依赖归属遵循“谁 import 谁声明”的原则。比如 `@orison/model-protocols` 不再放在未直接使用它的 desktop-ui 中；跨包能力优先沉到 workspace 包或明确的 app 边界，避免为了测试或临时脚本把依赖散落到多个 apps。

`apps/desktop/agent` 的默认测试脚本只覆盖当前仍然有效的 runtime 和 skill 测试。旧 `src/engine`、`src/nodes` 相关测试属于历史架构漂移，已记录在 `TODO.md`，在迁移完成前不要重新加入默认测试入口。

---

## 本地开发

```powershell
pnpm dev           # 启动桌面端（desktop-shell）
```

构建：

```powershell
pnpm build
pnpm build:desktop
```

测试：

```powershell
pnpm test
pnpm typecheck
pnpm lint
```

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

项目文件、创作字段与后台任务持久化由桌面端本地项目目录和本地 SQLite 承担。

---

## 最近的重要架构变化

### 1. 模型网关迁移到桌面主进程

- `apps/desktop/client/shell/main/ipc/modelGatewayIpc.ts` 成为统一模型出口
- `packages/model-protocols` 负责统一 OpenAI 兼容协议调用

### 2. Story Sync 从 Agent 中抬出

- 桌面主进程先执行 story-sync LLM 提取
- 渲染层把补丁放入 run body 的 `artifacts['chapter.llmPatches']`
- Agent 仅做二次校验与规则回退

### 3. 移除服务端与鉴权

- `apps/server` 已完全移除
- 桌面端为纯本地应用，启动后直接进入项目页
- Agent 已从独立 HTTP 服务改为库内嵌于桌面主进程，通过 IPC 调用

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

- [桌面 IPC 参考](docs/ipc/desktop-ipc.md)
- [模块边界规则](docs/architecture/module-boundaries.md)
- [数据字典](docs/data-dictionary.md)
- [UI 设计说明](docs/ui-design.md)
- [UI 层级结构](docs/ui-hierarchy.md)
- [Agent Panel UI](docs/agent-panel-ui.md)
- [开发记录](docs/plan.md)

---

## License

Private

---

## 当前 Agent Runtime 状态（2026-05-14）

当前 agent 栈已经从偏代码路径的编排服务，演进为更通用的 creative agent runtime 底座。

已实现的 runtime 能力：

- 以 `apps/desktop/agent/src/runtime/workflow.ts` 为核心的分层 runtime 编排
- 带兼容性 SQLite 自动迁移的 session tree 持久化
- runtime 级确认 / 权限流与受控 subagent 分发
- 同时支持目录型 skill 与 manifest skill 的双格式发现
- 带显式 continuation snapshot 的 artifact-aware、reference-aware skill 执行
- 面向长流程 creative 工作流的 context builder 与 compaction 原语

已落地的宿主 / API 接口：

- `POST /v1/agent/sessions`
- `GET /v1/agent/sessions`
- `POST /v1/agent/sessions/:id/stream`
- `POST /v1/agent/sessions/:id/confirm`
- `GET /v1/agent/skills?projectPath=...`
- `POST /v1/agent/sessions/:id/skills/:skillName/execute`

外部 skill root 已内建支持。skill 现在可以来自：

- 项目内本地 skill root
- 环境变量 `ORISON_AGENT_EXTERNAL_SKILL_ROOTS`
- 项目级配置 `.orison/agent.runtime.json`

默认情况下，agent 会自动把 `I:\echo\oh-story-claudecode-main` 作为外部 skill 仓库接入。
如果传入的是仓库根目录而不是 `skills/` 子目录，runtime 会自动解析到 `skills/` 目录。

项目配置示例：

```json
{
  "externalSkillRoots": [
    "I:\\echo\\oh-story-claudecode-main"
  ]
}
```

当前桌面端 Agent Panel 已支持：

- 感知配置的 skill 列表加载
- 手动刷新 skill 列表
- 直接执行 skill
- continuation 就绪状态展示

当前产品层仍有缺口：

- runtime 已返回 continuation restore 数据，但 UI 侧还没有完整恢复 / 续跑入口
- Agent Panel 目前还是轻量 skill launcher，不是完整 workflow workbench
- 现有中文文档与 i18n 文件仍需进一步做编码清理

## 嵌套执行链（2026-05-23）

在 runtime 底座之上,把 agent / skill / 子代理 三者的嵌套调用链跑通,目标是让 LLM 可以像 Claude Code 那样自动召唤 skill 与子代理,而不需要用户手动点按。

新增能力:

- **`skill` 工具下沉为本地工具** — 直接驱动 `WorkflowRuntime`,可在 LLM 对话中按关键词自动触发对应 skill;skill 内部 prompt 节点也会跑完整 runLoop,可继续调用其它 skill 或工具。
- **`spawn_agent` 工具新增** — 在子会话中以独立 runLoop 派出聚焦子代理,完成后只把最终答复回传父会话,避免污染父上下文。
- **`.orison/agents/<role>.md` 子代理定义** — frontmatter (`description` / `model` / `tools`) + 正文作为该 role 的角色 prompt;命中 role 时自动覆盖默认 Orison 系统提示,找不到则回退默认。
- **嵌套 IPC 事件透传** — 新增 `child` 事件类型,前端 `agentSlice` 加 `case 'child'`,带 `[subagent:role:dN]` 角标渲染子代理 / 子 skill 的中间消息。
- **abort 信号串联** — 外层 streamMessage 取消会沿 `SkillExecutorInvokeOptions.abort` 一路下传至所有嵌套 runLoop,立即终止子任务。
- **递归深度兜底** — `MAX_SPAWN_DEPTH = 5`,超过抛 `SpawnDepthExceededError`,防止 A→B→A 互相调用耗光预算。
- **系统提示自动罗列外部 skill** — `buildRuntimeSystemPrompt` 现在同时扫项目内 skill、`externalSkillRoots` option、`.orison/agent.runtime.json`,并按 frontmatter 的 `priority: required / optional` 分组提示 LLM。

仍未处理:

- 子代理 frontmatter 的 `model` / `tools` 字段当前只做解析,未真正接入 model gateway 路由或 tool registry 收紧。
- `child` 事件目前只透传 assistant / tool 类,confirm_required 等其它类型按需扩展。
- Agent Panel UI 对 `child` 事件是角标版渲染,未做嵌套树状折叠。

更多细节见：

- [docs/agent.md](docs/agent.md)
- [docs/agent-panel-ui.md](docs/agent-panel-ui.md)
- [docs/internal/archive/superpowers/specs/2026-05-14-creative-agent-runtime-design.md](docs/internal/archive/superpowers/specs/2026-05-14-creative-agent-runtime-design.md)
- [docs/internal/archive/superpowers/plans/2026-05-14-creative-agent-runtime-plan.md](docs/internal/archive/superpowers/plans/2026-05-14-creative-agent-runtime-plan.md)
