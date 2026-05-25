# Agent Panel UI/UX 实现计划

## 设计原则（对齐 design.md）

- **用户主导创作，AI 辅助** — Agent 不是自动生成器，而是可控的创作伙伴
- **模型调用发生在用户机器上** — Agent 通过桌面端 HTTP Gateway 调用模型，apiKey 不离开本地
- **本地项目文件是创作主存** — Agent 的所有写入操作最终落到本地项目目录
- **IDE 风格布局** — Agent Panel 作为工作区右侧独立面板

## 布局

```
┌──────┬──────────┬──────────────────────┬───────────────────┐
│ Icon │ Project  │                      │                   │
│ Rail │ Tree     │    Editor Area       │   Agent Panel     │
│      │          │                      │   (320px 默认)    │
│      │          │                      │   可拖拽调整宽度   │
│      │          ├──────────────────────┤                   │
│      │          │    Bottom Panel      │                   │
│      │          │    (Console/Tasks)   │                   │
└──────┴──────────┴──────────────────────┴───────────────────┘
```

Agent Panel 独立于 Bottom Panel，从顶部到窗口底部全高显示。Bottom Panel 仅影响 Editor Area 的高度，不截断 Agent Panel。

通过 Icon Rail top section 的 agent 按钮 toggle。

## Agent Panel 内部结构（参考 Claude Code 风格）

```
┌─────────────────────────────────────┐
│              [＋ 新对话] [📋 历史]   │  ← 右上角：新建对话 + 历史列表
├─────────────────────────────────────┤
│                                     │
│  消息流区域（auto-scroll）           │
│                                     │
│  ┌ user ────────────────────────┐   │
│  │ 为第三章生成一张封面插图       │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌ assistant ───────────────────┐   │
│  │ 我来先看看第三章的内容...      │   │
│  │                              │   │
│  │ ┌─ chapter_read ──────────┐  │   │
│  │ │ 📄 03-conflict.md       │  │   │
│  │ │ ✓ 2,340 words           │  │   │
│  │ └────────────────────────┘  │   │
│  │                              │   │
│  │ ┌─ generate_image ────────┐  │   │
│  │ │ 🖼️ "dark forest..."     │  │   │
│  │ │ [缩略图]                 │  │   │
│  │ │ [添加到资产]             │  │   │
│  │ └────────────────────────┘  │   │
│  │                              │   │
│  │ 已生成封面，保存在 assets/... │   │
│  └──────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│ [Model ▾] [Mode ▾] [⚙️]            │  ← 输入框上方工具栏
├─────────────────────────────────────┤
│ [输入消息...]              [↵ 发送] │  ← 底部输入区
└─────────────────────────────────────┘
```

- **右上角**：新建对话按钮 + 历史列表按钮（点击展开 session 列表 overlay）
- **输入框上方**：模型选择、Mode 切换、设置（参考 Claude Code）

## Mode 权限模型

| Mode | 标签 | 行为 |
|------|------|------|
| 👁️ 只读 (Read) | readonly | Agent 只能分析和建议，写入类 tool 结果被前端忽略。 |
| 💡 建议 (Suggest) | suggest | 全部 tools 可用。写入类 tool 执行后前端弹出 DiffCard，用户 Accept 后才写入编辑器。 |
| ⚡ 自动 (Auto) | auto | 全部 tools 直接执行，写入类 tool 结果自动同步到编辑器，无需确认。 |

Mode 控制逻辑完全在前端（`agentSlice`），Agent 后端不感知 mode。前端维护写入类 tool 白名单：`['chapter_write', 'write_file', 'outline_update']`。

## 双向联动

### 发送时附加上下文

`sendAgentMessage` 发送前自动从 store 读取当前编辑章节（`activeChapterId` + content 前 1500 字），拼接为消息前缀发给 Agent 后端。Agent 后端无需改动。

### Tool 结果写入编辑器

SSE 返回 tool 事件时，前端根据 mode 处理：
- **auto**：直接调用 `updateChapter` 写入编辑器
- **suggest**：存入 `pendingDiffs`，渲染 `DiffCard` 组件，用户 Accept 后写入
- **readonly**：忽略

## i18n

Agent 面板所有显示文本通过 `useI18n(resolvedLocale)` + `t('agent.xxx')` 获取，键定义在 `shared/i18n/en-US.yaml` 和 `zh-CN.yaml` 的 `agent:` 命名空间下。

## Session 持久化

存储位置：`{projectPath}/.orison/sessions/`

```
.orison/sessions/
├── index.db              ← SQLite 索引（id, title, createdAt, updatedAt, messageCount）
├── {session-id}.jsonl    ← 完整消息记录（每行一条 AgentMessage JSON）
├── {session-id}.jsonl
└── ...
```

- SQLite 做索引：快速列出/搜索/排序 session
- JSONL 文件存完整消息：避免 SQLite 存大文本，方便 debug 和迁移
- 按项目隔离：每个项目 `.orison/sessions/` 独立

## 桌面端 HTTP 接口（Agent → Shell）

扩展现有的 `modelGatewayHttp.ts`（port 18421），新增以下端点供 Agent 调用：

### 已有

| 端点 | 功能 |
|------|------|
| `POST /images/generations` | 图像生成 |
| `POST /images/edits` | 图像编辑 |
| `POST /model/generate-text` | 文本生成 |

### 新增

| 端点 | 功能 | 对应 IPC |
|------|------|----------|
| `GET /project/current` | 获取当前打开的项目信息 | projectIpc |
| `POST /project/read-file` | 读取项目内文件 | projectIpc (pathGuard) |
| `POST /project/write-file` | 写入项目内文件 | projectIpc (pathGuard) |
| `POST /project/list-dir` | 列出目录 | projectIpc |
| `GET /editor/state` | 获取编辑器当前状态（打开的文件、光标位置） | — |
| `POST /editor/open-file` | 在编辑器中打开文件 | — |
| `GET /config/model` | 获取模型配置（不含 apiKey 明文） | configIpc |
| `POST /git/status` | Git 状态 | gitIpc |
| `POST /git/commit` | Git 提交 | gitIpc |

这样 Agent 的 tools 不再需要自己做文件 I/O，而是通过桌面端 HTTP 接口操作，好处：
1. **路径安全** — 复用 shell 的 pathGuard，防止路径穿越
2. **统一权限** — 所有文件操作经过同一入口
3. **状态同步** — 写入后桌面端可以自动刷新 UI（project tree、editor）
4. **无需 agent 直接访问文件系统** — agent 可以跑在远程/容器中

## 文件变更清单

### 新增文件

```
ui/src/features/agent-panel/
├── AgentPanel.tsx              — 主容器
├── AgentMessages.tsx           — 消息流
├── AgentMessageItem.tsx        — 单条消息
├── AgentToolCard.tsx           — Tool 卡片（折叠/展开）
├── AgentImageResult.tsx        — 图像结果
├── AgentInput.tsx              — 输入框 + 上方工具栏（model/mode 下拉框）
├── AgentHistory.tsx            — 历史 session 列表
├── AgentConfirmCard.tsx        — 确认卡片
├── DiffCard.tsx                — suggest 模式 diff 预览 + Accept/Reject
└── agent-panel.css             — 样式（使用 tokens.css 变量）

ui/src/shared/store/agentSlice.ts   — Zustand slice
ui/src/shared/api/agent.ts          — Agent REST + SSE 客户端

shell/main/ipc/desktopApiHttp.ts    — 扩展 HTTP 接口（project/editor/git）
```

### 修改文件

```
ui/src/shared/store/types.ts             — AgentMode type
ui/src/shared/store/appStore.ts          — 注册 agentSlice
ui/src/shared/store/panelsSlice.ts       — agentPanelOpen + agentPanelWidth
ui/src/shared/constants.ts               — AGENT_PANEL_WIDTH_DEFAULT/MIN/MAX
ui/src/widgets/layout/WorkspaceLayout.tsx — grid 追加 agent panel 列
ui/src/features/side-nav/SideNav.tsx     — Icon Rail top section 新增 agent toggle

shell/main/ipc/modelGatewayHttp.ts       — 路由分发到 desktopApiHttp
shell/main/index.ts                      — 注册新 HTTP 路由
```

## Store 设计

```typescript
type AgentMode = 'auto' | 'suggest' | 'readonly';

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown }>;
  toolResults?: Array<{ toolId: string; output: string; metadata?: unknown }>;
  createdAt: number;
};

type AgentSessionMeta = {
  id: string;
  title: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

type PendingDiff = {
  id: string;
  toolId: string;
  fileName: string;
  content: string;
  chapterId?: string;
};

type AgentSlice = {
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;
  agentModelRef: ModelRef | null;
  setAgentModelRef: (ref: ModelRef | null) => void;

  agentSessionId: string | null;
  agentMessages: AgentMessage[];
  agentLoading: boolean;
  agentError: string | null;
  sendAgentMessage: (content: string) => Promise<void>;
  cancelAgent: () => void;
  newAgentSession: () => Promise<void>;

  agentSessions: AgentSessionMeta[];
  loadAgentSessions: () => Promise<void>;
  switchAgentSession: (sessionId: string) => Promise<void>;
  deleteAgentSession: (sessionId: string) => Promise<void>;

  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  confirmPendingTool: () => void;
  rejectPendingTool: () => void;

  pendingDiffs: PendingDiff[];
  acceptDiff: (id: string) => void;
  rejectDiff: (id: string) => void;
};
```

## 通信协议

### SSE 流式

```
POST /v1/agent/sessions/:id/stream
{ content, mode, modelRef }

← event: assistant    { id, content, toolCalls }
← event: tool         { id, results }
← event: child        { source, role, sessionId, depth, event }   ← 嵌套 skill / spawn_agent 的子事件
← event: confirm_required   { callId, name, input }   ← 仅 edit 模式
← event: done         { status }
← event: error        { message }
```

#### child 事件

当 LLM 在父会话里调用了 `skill` 或 `spawn_agent`,嵌套 runLoop 内的 assistant / tool 消息会以 `child` 事件回流:

- `source`:`'skill'` 或 `'subagent'`
- `role`:子任务的标识(skill 名 / agent 角色名)
- `sessionId`:子会话 id(spawn_agent 时为新建子会话)
- `depth`:嵌套深度,从 1 开始,父级 runLoop 是 0
- `event`:内嵌一条 `{type:'assistant', data}` 或 `{type:'tool', data}`

前端 `agentSlice.case 'child'` 解析后追加到聊天流,渲染时带 `[subagent:role:dN]` 角标(N>1 时)以与父级消息区分。父会话最终仍然只会收到一条 `done`。

### 确认 Tool

```
POST /v1/agent/sessions/:id/confirm
{ callId, approved: true|false }
```

## 样式设计

- 紧凑风格（参考 Claude Code）：不用气泡，左对齐 + 角色标签
- Tool 卡片：`border-left: 3px solid var(--accent)`，可折叠
- 输入区工具栏：小型 pill 按钮，紧凑排列
- 跟随全局 theme（system/light/dark）
## 当前实现状态（2026-05-14）

桌面端 Agent Panel 已经以尽量小的产品层改动接入新的 creative runtime。

已实现的面板能力：

- 从 `GET /v1/agent/skills` 加载 skill 列表，且会感知项目配置与外部 skill root
- 在面板中手动刷新可用 skill 列表
- 针对当前 agent session 直接执行 skill
- 展示 runtime-backed 执行结果中的 continuation 信息，为后续恢复流程预留入口
- 现有 session / message 流程继续兼容 runtime-backed server 路由

当前面板范围：

- skill 能力面目前刻意保持轻量，只提供 list、refresh、run
- continuation 已在 API 返回中可用，但 UI 里还没有专门的 restore / continue 控件
- 只要在 agent runtime 中完成配置，外部 skill 包现在就能在产品层可见

相关实现文件：

- `apps/desktop/ui/src/features/agent-panel/AgentPanel.tsx`
- `apps/desktop/ui/src/shared/api/agent.ts`
- `apps/desktop/ui/src/shared/store/agentSlice.ts`
- `apps/server/src/modules/agent/proxy.ts`
