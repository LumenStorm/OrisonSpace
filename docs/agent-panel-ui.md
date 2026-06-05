# Agent Panel UI/UX 实现计划

## 设计原则（对齐 design.md）

- **用户主导创作，AI 辅助** — Agent 不是自动生成器，而是可控的创作伙伴
- **模型调用发生在用户机器上** — Agent 通过桌面主进程调用模型，apiKey 不离开本地
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

Mode 控制逻辑完全在前端（`agentSlice`），Agent 后端不感知 mode。前端维护写入类 tool 白名单（单一来源 `agentDiffSlice.ts` 导出的 `WRITE_TOOLS`）：`['chapter_write', 'write_file', 'outline_update', 'rewrite_passage']`。

## 双向联动

### 发送时附加上下文

`sendAgentMessage` 发送前自动从 store 读取当前编辑章节（`activeChapterId` + content 前 1500 字）拼为消息前缀；此外把 `pendingAttachments`（章节/文件/选段引用）以结构化 `attachments` 参数随 `agent:stream-message` 透传给后端，并存入 `userMsg.references` 供前端渲染引用卡片。

### Tool 结果写入编辑器

IPC stream 返回 tool 事件时，前端根据 mode 处理：
- **auto**：直接调用 `updateChapter` 写入编辑器
- **suggest**：存入 `pendingDiffs`，渲染 `DiffCard` 组件，用户 Accept 后写入
- **readonly**：忽略

## i18n

Agent 面板所有显示文本通过 `useI18n(resolvedLocale)` + `t('agent.xxx')` 获取，键定义在 `shared/i18n/<locale>/agent.yaml`（按域拆分的多文件结构，如 `en-US/agent.yaml`、`zh-CN/agent.yaml`）的 `agent.*` 命名空间下。

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

## 桌面端 Agent 集成

Agent 作为 `@orison/desktop-agent` 库内嵌于桌面主进程，通过 IPC 与渲染层通信。

Agent 的 tools 通过 shell 提供的注入函数操作文件系统，好处：
1. **路径安全** — 复用 shell 的 pathGuard，防止路径穿越
2. **统一权限** — 所有文件操作经过同一入口
3. **状态同步** — 写入后桌面端可以自动刷新 UI（project tree、editor）

## 文件变更清单

### 主要文件

```
ui/src/features/agent-panel/
├── AgentPanel.tsx              — 主容器（chat / history / settings 三视图切换）
├── AgentMessages.tsx           — 消息流
├── AgentMessageItem.tsx        — 单条消息（含 references 引用卡渲染）
├── AgentToolCard.tsx           — Tool 卡片（折叠/展开，图像结果读 metadata.paths 内联预览）
├── AgentInput.tsx              — 输入框 + 上方工具栏（model/mode 下拉框）
├── AgentHistory.tsx            — 历史 session 列表
├── AgentSettings.tsx           — 设置视图（skill packages 启用/停用）
├── AgentConfirmCard.tsx        — 工具确认卡片（在 AgentInput 上方渲染）
├── AgentPassageResolveCard.tsx — 选段改写候选定位确认卡（在 AgentInput 上方渲染）
├── DiffCard.tsx                — suggest 模式 diff 预览 + Accept/Reject（支持 chapter / passage）
├── SideBySideDiff.tsx          — 并排 diff 视图
└── agent-panel.css             — 样式（使用 tokens.css 变量）

ui/src/shared/store/agentSlice.ts        — Zustand slice 聚合（session / skill / diff 子 slice）
ui/src/shared/store/agentSessionSlice.ts — 会话与流式事件处理
ui/src/shared/store/agentDiffSlice.ts    — pending diff / passage 定位（导出 WRITE_TOOLS）
ui/src/shared/api/agent.ts               — Agent IPC 客户端

shell/main/ipc/agentIpc.ts          — Agent IPC handlers
```

## Store 设计

```typescript
type AgentMode = 'auto' | 'suggest' | 'readonly';

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown }>;
  // 运行时发 toolName；旧形状用 toolId，两者都兼容
  toolResults?: Array<{ toolId?: string; toolName?: string; output: string; metadata?: unknown }>;
  references?: Attachment[];   // 该消息携带的结构化引用（章节/文件/选段）
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

// PendingDiff 是 union：整章改写 | 选段改写（定义在 agentDiffSlice.ts）
type ChapterPendingDiff = {
  kind: 'chapter';
  id: string;
  toolId: string;
  fileName: string;
  content: string;
  chapterId?: string;
};

type PassagePendingDiff = {
  kind: 'passage';
  id: string;
  toolId: string;
  sourceType: 'chapter' | 'file';
  chapterId?: string;
  filePath?: string;
  originalText: string;
  replacement: string;
  anchor?: SelectionAnchor;   // 选区上下文，用于多处命中时消歧定位
};

type PendingDiff = ChapterPendingDiff | PassagePendingDiff;

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

  // 发送上下文：结构化 attachment（章节/文件/选段引用）
  pendingAttachments: Attachment[];
  addAttachment: (a: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  // Skill packages（设置视图：按包/按 skill 启用停用）
  skillPackages: SkillPackageInfo[];
  skillPackagesLoading: boolean;
  loadSkillPackages: () => Promise<void>;
  toggleSkillPackage: (name: string, enabled: boolean) => void;
  toggleSkill: (pkg: string, skill: string, enabled: boolean) => void;

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

  // 选段改写定位：原文漂移/多处命中时由 AgentPassageResolveCard 消费
  pendingPassageResolve: PendingPassageResolve | null;
  resolvePassageAt: (diffId: string, chosenIndex: number) => void;
  cancelPassageResolve: () => void;
};
```

## 通信协议

### IPC 流式

```
agent:stream-message  → 发送消息
agent:stream-event    ← 推送事件

← type: assistant    { id, content, toolCalls }
← type: tool         { id, results }
← type: child        { source, role, sessionId, depth, event }   ← 嵌套 skill / spawn_agent 的子事件
← type: confirm_required   { callId, name, input }   ← 仅 edit 模式
← type: done         { status }
← type: error        { message }
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
agent:resolve-confirmation
{ sessionId, callId, approved: true|false }
```

## 样式设计

- 紧凑风格（参考 Claude Code）：不用气泡，左对齐 + 角色标签
- Tool 卡片：`border-left: 3px solid var(--accent)`，可折叠
- 输入区工具栏：小型 pill 按钮，紧凑排列
- 跟随全局 theme（system/light/dark）
## 当前实现状态（2026-06-05）

桌面端 Agent Panel 已接入 `@orison/desktop-agent` runtime（内嵌库）。

已实现的面板能力：

- chat / history / settings 三视图切换（header 右上角按钮）
- 设置视图通过 `loadSkillPackages` 加载 skill 包，支持按包 / 按 skill 粒度启用停用（`toggleSkillPackage` / `toggleSkill`），感知项目配置与外部 skill root
- 嵌套 child 事件（skill / spawn_agent）以 `[subagent:role:dN]` 角标渲染到聊天流
- suggest 模式下整章改写走 DiffCard，选段改写走 DiffCard + `SideBySideDiff`
- 选段改写原文漂移 / 多处命中时，`AgentPassageResolveCard` 列出候选定位供确认
- 用户消息的结构化引用（章节/文件/选段）渲染为引用卡片

> 注：早期版本的 skill launcher（Run 按钮）、continuation restore/rerun、workbench 面板已下线，skill 改为在设置视图按包管理；continuation 相关 store action 已移除。

### Agent Panel 内部结构（当前实现）

```
agent-panel
├── agent-panel-header
│   ├── Title ("Agent")
│   ├── Settings btn (settings)
│   ├── NewConversation btn (+)
│   └── History btn (history)
├── [view = 'history'] → AgentHistory overlay
├── [view = 'settings'] → AgentSettings
│   └── agent-settings-section: Skills（skill 包列表 + 启用开关）
└── [view = 'chat'] →
    ├── AgentMessages（消息流，auto-scroll）
    │   └── AgentMessageItem × N（user references 卡 / assistant / tool: AgentToolCard | DiffCard）
    └── AgentInput（输入区 + 工具栏）
        ├── [pendingToolConfirm] → AgentConfirmCard
        └── [pendingPassageResolve] → AgentPassageResolveCard
```

注意事项：

- `agent:list-skills` IPC 直接返回数组（非 `{ skills: [...] }` 包装），前端 API 层已兼容两种格式
- store 中 `skillPackages`、`agentSessions` 使用 `?? []` 防御 undefined
- 设置视图打开时自动加载 skill 包（useEffect）

相关实现文件：

- `apps/desktop/client/ui/src/features/agent-panel/AgentPanel.tsx`
- `apps/desktop/client/ui/src/features/agent-panel/AgentSettings.tsx`
- `apps/desktop/client/ui/src/features/agent-panel/SideBySideDiff.tsx`
- `apps/desktop/client/ui/src/features/agent-panel/AgentPassageResolveCard.tsx`
- `apps/desktop/client/ui/src/shared/api/agent.ts`
- `apps/desktop/client/ui/src/shared/store/agentSlice.ts`
- `apps/desktop/client/shell/main/ipc/agentIpc.ts`
