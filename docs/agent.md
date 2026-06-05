# Orison Agent

AI 写作助手的 Agent 编排库。基于 agentic loop + tool calling 架构，作为 `@orison/desktop-agent` 包内嵌于桌面主进程，为创作工作区提供智能写作、workflow 编排、skill 执行能力。

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  Desktop Shell (Electron main process)                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Model Gateway (IPC)                            │    │
│  │  model:generate-text / -image / -video           │    │
│  └─────────────────────────────────────────────────┘    │
│         ▲                                               │
│         │ injected via setGenerateTextFn()               │
│         ▼                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  @orison/desktop-agent (library)                │    │
│  │                                                 │    │
│  │  ┌──────────┐   ┌──────────────────┐           │    │
│  │  │  Workflow │──▶│  LLM Provider    │           │    │
│  │  │  Runtime  │   │  (IPC injection) │           │    │
│  │  └──────────┘   └──────────────────┘           │    │
│  │       │                                         │    │
│  │       ▼                                         │    │
│  │  ┌──────────┐                                   │    │
│  │  │  Tools   │                                   │    │
│  │  │  Registry│                                   │    │
│  │  └──────────┘                                   │    │
│  │       │                                         │    │
│  │       ▼                                         │    │
│  │  ┌──────────────────────────────────┐           │    │
│  │  │  Built-in Tools                  │           │    │
│  │  │  • Skills (workflow nodes)       │           │    │
│  │  │  • spawn_agent (subagent)        │           │    │
│  │  └──────────────────────────────────┘           │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────────┐   │    │
│  │  │  Shell-provided Tools (via setExecuteToolFn) │    │
│  │  │  • File I/O (read/write/list)    │           │    │
│  │  │  • Search (regex across files)   │           │    │
│  │  │  • Story Memory (YAML)           │           │    │
│  │  │  • Chapters (list/read/write)    │           │    │
│  │  │  • Image Gen (generate/edit)     │           │    │
│  │  │  • Git (status/commit/log/diff)  │           │    │
│  │  └──────────────────────────────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Agent IPC Handlers (agentIpc.ts)                │   │
│  │  agent:create-session / stream-message / ...     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ▲
         │ IPC (Electron)
         ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend (renderer process)                            │
│  • Chat messages (text + tool calls + images)           │
│  • Tool execution progress                             │
│  • Skill launcher & continuation restore               │
└─────────────────────────────────────────────────────────┘
```

## 集成方式

Agent 不再作为独立 HTTP 服务运行。它是一个 TypeScript 库，通过依赖注入集成到 Electron shell：

```typescript
import { createWorkflowRuntime, setGenerateTextFn, setExecuteToolFn } from '@orison/desktop-agent';

// 注入 LLM 调用能力
setGenerateTextFn(async (body, abort) => { /* shell model gateway */ });
setExecuteToolFn(async (toolId, params, ctx) => { /* shell tool handlers */ });

// 创建 runtime 实例
const runtime = createWorkflowRuntime();
```

通信通过 Electron IPC（`agent:*` 通道），不再需要 HTTP/SSE。

## IPC 通道

Agent 通过 Electron IPC 与渲染层通信（`agent:*` 通道）：

| 通道 | 说明 |
|------|------|
| `agent:create-session` | 创建会话 |
| `agent:get-session` | 获取会话状态 |
| `agent:list-sessions` | 列出项目会话 |
| `agent:delete-session` | 删除会话 |
| `agent:stream-message` | 发送消息并启动流式执行 |
| `agent:resolve-confirmation` | 用户确认/拒绝工具调用 |
| `agent:list-skills` | 列出项目 skills |
| `agent:execute-skill` | 直接执行 skill |
| `agent:list-continuations` | 列出会话 continuations |
| `agent:restore-continuation` | 恢复 continuation |
| `agent:abort-run` | 中止当前执行 |

### Stream 事件格式

通过 `agent:stream-event` IPC 事件推送到渲染层：

```json
{ "type": "assistant", "data": { "id": "...", "content": "...", "toolCalls": [...] } }
{ "type": "tool", "data": { "id": "...", "results": [...] } }
{ "type": "child", "data": { "source": "subagent", "role": "...", "depth": 1, "event": {...} } }
{ "type": "confirm_required", "data": { "sessionId": "...", "callId": "...", "name": "...", "input": {...} } }
{ "type": "done", "data": { "status": "completed" } }
{ "type": "error", "data": { "message": "..." } }
```

- `child` 事件用于把嵌套执行(spawn_agent、skill 内部的子 runLoop)中的 assistant / tool 消息回流给前端,UI 可凭 `source` (`subagent` 或 `skill`) 与 `role`、`depth` 加角标渲染。
- 同一会话只会产出一条最终 `done`,所有 `child` 事件都属于当前会话的子执行。

## 内置 Tools

### 文件操作
| Tool | 说明 |
|------|------|
| `read_file` | 读取项目内文件（支持 offset/limit） |
| `write_file` | 写入文件（自动创建目录） |
| `list_files` | 列出目录文件（支持后缀过滤） |
| `search` | 正则搜索项目文件内容 |

### 小说结构
| Tool | 说明 |
|------|------|
| `chapter_list` | 列出所有章节（标题、字数） |
| `chapter_read` | 读取指定章节全文 |
| `chapter_write` | 写入/更新章节 |
| `rewrite_passage` | 改写章节/文件中的某个选段（不落盘，返回 passage diff 供前端定位回写） |
| `outline_read` | 读取大纲文件 |
| `outline_update` | 更新大纲 |

### 故事记忆
| Tool | 说明 |
|------|------|
| `memory_query` | 查询 story-memory.yaml（角色、事件、世界观） |
| `memory_update` | 更新 story-memory.yaml |

### 图像生成
| Tool | 说明 |
|------|------|
| `generate_image` | 文本生成图像，保存到 assets/images/ |
| `edit_image` | 基于已有图片 + prompt 编辑 |

### 项目管理
| Tool | 说明 |
|------|------|
| `project_meta` | 读取项目配置、风格指南、世界观、目录结构 |
| `git_status` | 查看 git 状态 |
| `git_commit` | 暂存并提交 |
| `git_log` | 查看提交历史 |
| `git_diff` | 查看变更 diff |

### 技能
| Tool | 说明 |
|------|------|
| `skill` | 按名称调用一个 skill 工作流。Skill 的指令进入子 runLoop 执行,可继续调用嵌套 skill、spawn_agent、其它工具,返回 outputs / checkpoints / pending confirmations。 |
| `spawn_agent` | 派出一个聚焦子代理(例如 `story-architect`、`narrative-writer`、`consistency-checker`)。子代理在独立子会话里全权使用工具,完成后只把最终答复回传父会话。当 `.orison/agents/<role>.md` 存在时会自动加载该 role 的角色 prompt。 |

## Agentic Loop

```
User Message
    │
    ▼
┌─────────────────┐
│ Build System    │
│ Prompt + Tools  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ LLM Generate    │────▶│ Tool Calls?  │
└─────────────────┘     └──────┬───────┘
                               │
                    ┌──────────┴──────────┐
                    │ Yes                  │ No
                    ▼                      ▼
            ┌──────────────┐      ┌──────────────┐
            │ Execute Tools│      │ Return Final │
            │ (sequential) │      │ Response     │
            └──────┬───────┘      └──────────────┘
                   │
                   ▼
            ┌──────────────┐
            │ Append Tool  │
            │ Results      │──────▶ Loop back to LLM
            └──────────────┘
```

- 主对话 loop 上限 30 步；skill / spawn_agent 子 loop 上限 50 步（`maxSteps` 默认值，防止无限 loop）
- 支持 AbortSignal 中断（基于 TCP socket close 事件，而非 request body close）
- 同一轮内的多个 tool call 按顺序依次 `await` 执行（非并行），结果按序追加到消息历史
- 单轮 LLM 输出被 `length` 截断时自动注入续写提示继续下一步
- **abort 信号会沿调用链下传** — 外层 SSE 取消时,工具内部派出的 `runChildAgent` / skill 子 runLoop 会立刻收到同一个 abort 信号
- **嵌套深度上限 `MAX_SPAWN_DEPTH = 5`** — `spawn_agent` 与 skill 嵌套深度每层 +1,超过会抛 `SpawnDepthExceededError`,防止 A→B→A 无限互调耗光预算

## 图像生成流程

```
Agent 决定生成图像
    │
    ▼
generate_image tool
    │
    ├── 构建请求 payload（prompt, size, quality, n）
    │
    ├── POST http://localhost:18421/images/generations
    │   （桌面端 Model Gateway → model-protocols → OpenAI API）
    │
    ├── 接收 base64 图像数据
    │
    ├── 保存到 {projectPath}/assets/images/{subdir}/{slug}-{timestamp}.png
    │
    └── 返回相对路径给 LLM（可在后续对话中引用）
```

## Skills 系统

Skills 是可复用的提示词模板，存放在 `.orison/skills/` 目录：

```
.orison/skills/
├── worldbuilding/
│   └── SKILL.md
├── character-voice/
│   └── SKILL.md
└── plot-twist/
    └── SKILL.md
```

SKILL.md 格式：
```markdown
---
name: worldbuilding
description: 生成详细的世界观设定
priority: required
---

你是一个世界观构建专家。根据用户提供的故事背景...
```

- `priority: required` 的 skill 会被列在系统提示的"Required skills — call immediately when triggered"段,LLM 命中关键词后应立即调用
- 不带 `priority` 或 `priority: optional` 的 skill 进入"Optional skills — call when relevant"段
- 系统提示在每轮对话开头自动注入,LLM 通过 `skill` tool 触发,无需用户手动点按
- 同一 skill 在多个 skill root 下重复出现时会按发现顺序去重(项目内 > 外部)

Agent 可通过 `skill` tool 动态加载 skill 内容注入上下文。skill 自身可以在子 runLoop 中继续调用其它 skill 或 spawn_agent,形成 **链式自动召唤**。

## Subagent 子代理

`spawn_agent` 工具用于派遣一个**聚焦**的专用代理。父代理写一段任务描述,子代理在自己的子会话里独立完成,然后只把最终答案回传父会话——父代理的上下文不会被子代理的中间步骤撑爆。

### Agent 定义文件

在项目下放置 `.orison/agents/<role>.md` 即可为某个 role 绑定专属人设:

```markdown
---
description: 故事架构师,负责拆解多线叙事与场景节奏
model: claude-opus-4-7
tools:
  - read_file
  - chapter_read
  - memory_query
---

你是一名资深故事架构师。你的工作是分析提供的故事素材...
```

查找顺序:`.orison/agents/<role>.md` → `.claude/agents/<role>.md` → 外部 skill root。若不存在该文件,子代理回退到默认 Orison 提示词 + 自动追加 "You are acting as the **<role>** subagent" 的提示。

> 注:`model` 字段目前由 frontmatter 解析读取但还未接入路由层,正式生效需要 model gateway 端的额外支持;`tools` 同理,当前未在 registry 层做受限收紧,只是供 LLM 阅读。

### 嵌套执行边界

| 维度 | 处理方式 |
|------|---------|
| **abort 串联** | 外层 streamMessage 收到取消 → 同一个 `AbortSignal` 透传至 `runChildAgent` / `executePrompt` 的内部 runLoop,子任务立即中断 |
| **递归深度** | `ToolContext.spawnDepth` 每嵌套一层 +1,超过 `MAX_SPAWN_DEPTH = 5` 抛错 `SpawnDepthExceededError`,防止 A→B→A 无限递归 |
| **事件透传** | 子 runLoop 的 assistant/tool 消息经 `emitChildEvent` 转译成 `child` IPC 事件,前端按 `[subagent:role:dN]` 角标渲染,父会话只产出一条最终 `done` |
| **会话隔离** | 子代理在 `forkSession` / `createChildSession` 的子会话中执行,父会话只看到子代理的最终 content,中间消息不入父会话历史(避免污染) |

### 典型调用形态

```
[user] 写一个一开始就让主角死的故事

  └─ [skill: story]                            ← LLM 调用 skill 工具
       └─ [child: skill:story:d1] 路由到 oh-story 子 skill
            └─ [spawn_agent: story-architect]   ← skill 内部派遣子代理
                 └─ [child: subagent:story-architect:d2] 在子会话内完成大纲
```

## MCP 扩展

通过 `.orison/mcp.json` 配置外部 MCP servers：

```json
{
  "servers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-web-search"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

MCP servers 的 tools 会被动态发现并注册到 agent 的 tool registry 中。

## 项目适配

Agent 针对 Orison 小说写作项目的特殊适配：

1. **项目结构感知** — 自动识别 chapters/, outlines/, assets/, story-memory.yaml
2. **故事记忆** — 通过 YAML 维护角色、事件、世界观的持久化知识
3. **图像资产管理** — 生成的图片自动归档到 assets/images/，可被章节引用
4. **风格一致性** — 读取 style-guide.md 确保写作风格统一
5. **大纲驱动** — 先读大纲再写章节，保持情节连贯

## 前端集成（已实现）

Agent Panel 作为工作区右侧独立面板（全高，不受 Bottom Panel 截断）：

- 右侧面板展示对话流（`AgentMessages` + `AgentMessageItem`）
- Tool 调用显示为可折叠的执行卡片（`AgentToolCard`），图像结果由该卡片读取 `metadata.paths` 内联预览
- 写入类 tool 在 suggest 模式下显示 DiffCard（Accept/Reject），选段改写额外提供 `SideBySideDiff` 与 `AgentPassageResolveCard`（候选定位确认）
- 支持中断/重试（`cancelAgent`）
- 消息通过 IPC stream 事件实时推送
- 三档权限模式：Read / Suggest / Auto（前端控制，后端无感知）
- 发送时自动附加当前编辑章节上下文，并以结构化 attachment 传递选段引用
- 所有文本已 i18n 化（`agent.*` 命名空间，键在 `shared/i18n/<locale>/agent.yaml`）

详见 [Agent Panel UI 文档](agent-panel-ui.md) 和 [UI 层级结构](ui-hierarchy.md)。
## 当前实现状态（2026-05-25）

Agent runtime 已作为 `@orison/desktop-agent` 库内嵌于桌面主进程。

已实现的 runtime 能力：

- 以 `apps/desktop/agent/src/runtime/workflow.ts` 为核心的分层 runtime 编排
- 带 parent / branch 元数据与兼容性 SQLite 自动迁移的 session tree 持久化
- run-state 持有、并发重入保护、中断处理与面向恢复的 continuation snapshot
- runtime 级 permission / confirmation 流与受控 subagent 分发
- 目录 skill 与 manifest skill 的双格式发现与归一化
- 通过 runtime 配置加载外部 skill root，适用于 `I:\echo\oh-story-claudecode-main` 这类 skill 包
- 通过 `executeSkillByName(...)` 执行 artifact-aware、reference-aware skill
- 面向长流程 creative 工作流的 context builder、compaction 与 continuation 原语

已落地的 IPC 能力：

- `agent:list-skills` 已支持按配置合并项目内 skill root 与外部 skill root
- `agent:execute-skill` 已支持 `input`、`artifactIds`、`referenceIds`
- skill 执行返回里现在会显式带上 `continuation` payload，调用方可以拿到明确恢复入口

当前产品层仍有缺口：

- continuation restore 目前只是数据出口，桌面端还没有完整 resume UX
- Agent Panel 目前提供的是轻量 skill launcher，不是完整多步骤 workflow workbench
- 现有中文文档和 i18n 文件在全面规范化前，仍需要先做编码清理

## 嵌套执行链改造（2026-05-23）

本轮重点完善了"agent 自动召唤 skill / subagent"这条链路的运行时边界,使 LLM 可以像 Claude Code 那样自然地嵌套调用:

- **`skill` 工具改为本地工具** — 在 ToolContext 中通过 `SkillExecutorRef` 直连 `WorkflowRuntime`,可在嵌套 runLoop 中继续递归触发其它 skill。
- **`spawn_agent` 工具新增** — 在 `runChildAgent` 中创建子会话并跑独立 runLoop,子代理拿到完整工具集 + 父会话的全部能力。
- **子代理定义文件** — 按 `.orison/agents/<role>.md` → `.claude/agents/<role>.md` → 外部 root 顺序加载 frontmatter + 正文,作为子会话 system prompt 的前置段。
- **嵌套消息回流** — `RuntimeEventPayload` 新增 `child` 变种,`ChildStreamEvent` 携带 `source` / `role` / `depth` / 内部事件;UI `agentSlice` 已加 `case 'child'`,带 `[subagent:role:dN]` 前缀渲染。
- **abort 信号串联** — `SkillExecutorInvokeOptions { abort, spawnDepth, emitChildEvent }` 沿调用栈下传,外层取消立刻终止所有嵌套 runLoop。
- **递归深度兜底** — `MAX_SPAWN_DEPTH = 5` + `SpawnDepthExceededError`,任意 skill 或 spawn_agent 嵌套超过 5 层直接拒绝。
- **executePrompt 升级** — 之前是单次 generate 直接调用 LLM,现在改为运行完整 runLoop,允许 skill 步骤内 LLM 继续调用工具。
- **buildRuntimeSystemPrompt 多 root 扫描** — 系统提示同时列出项目内 skill、`externalSkillRoots`、`.orison/agent.runtime.json` 配置的 root,并按 `required` / `optional` 分组,鼓励 LLM 主动识别并调用。

### 已知未处理

- 子代理的 `model` / `tools` frontmatter 字段当前只做解析,未实际接入 model gateway 路由 / tool registry 收紧。
- 嵌套 child 事件目前只透传 assistant / tool 两类,confirm_required 等需要后续按需扩展。
- Agent Panel UI 对 `child` 事件的渲染是基础的角标版本,尚未做嵌套树状折叠展示。
