# Agent 重写设计规格

> 状态：Draft — 待对齐确认
> 日期：2026-05-12

## 一、目标

**全新重写** `apps/agent` 包，采用 opencode 风格的单一长上下文 agent 架构：

- 单 agent + 1M 上下文窗口，通过 tool call 和 skill 自主完成创作任务
- 去掉 pipeline、Python 依赖、节点注册表
- Skill 生态：`.orison/skills/` 下用户自定义，内置 skill 代码内嵌
- MCP client：连接外部 MCP server 获取扩展工具
- Vercel AI SDK 做 LLM 交互，通过桌面 IPC 调用模型（apiKey 不出主进程）

## 二、架构总览（对标 opencode）

```
┌─────────────────────────────────────────────────────────────┐
│                     apps/agent (Fastify)                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Agent Session                        │   │
│  │                                                        │   │
│  │  System Prompt:                                        │   │
│  │    orison.md (角色+规则+工具声明+skill列表)            │   │
│  │    + project.md (小说项目元数据)                        │   │
│  │    + skill summaries (name+description)                │   │
│  │                                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │ Built-in │  │  Skills  │  │   MCP Tools      │   │   │
│  │  │  Tools   │  │ (.orison)│  │ (external server)│   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  │                                                        │   │
│  │  Agentic Loop:                                         │   │
│  │    user msg → LLM → [tool_call → execute → result]* → │   │
│  │    assistant response                                  │   │
│  │                                                        │   │
│  │  Compaction: token > threshold → summarize history     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  LLM Provider: Vercel AI SDK → custom provider → IPC →       │
│                desktop main process → actual API call         │
└─────────────────────────────────────────────────────────────┘
```

## 三、核心模块设计

### 3.1 目录结构

```
apps/agent/
├── src/
│   ├── index.ts                 # Fastify app 入口
│   ├── routes.ts                # HTTP API routes
│   │
│   ├── agent/                   # Agent 核心（对标 opencode/src/agent/）
│   │   ├── agent.ts             # Agent 定义：name, tools, prompt, model, steps
│   │   ├── session.ts           # Session 生命周期：create, run, stream
│   │   ├── loop.ts              # Agentic loop：LLM call → tool dispatch → repeat
│   │   └── compaction.ts        # 上下文压缩
│   │
│   ├── tool/                    # Tool 系统（对标 opencode/src/tool/）
│   │   ├── define.ts            # Tool.define() 工厂
│   │   ├── registry.ts          # Tool 注册与查找
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── list-files.ts
│   │   ├── search.ts
│   │   ├── memory-query.ts
│   │   ├── memory-update.ts
│   │   ├── skill.ts             # 加载并注入 skill prompt
│   │   └── task.ts              # 派生子 agent
│   │
│   ├── skill/                   # Skill 系统（对标 opencode/src/skill/）
│   │   ├── discovery.ts         # 扫描 .orison/skills/ 目录
│   │   ├── loader.ts            # 解析 SKILL.md (frontmatter + body)
│   │   ├── types.ts             # SkillInfo 类型
│   │   └── builtin/             # 内置 skill（代码内嵌，不暴露文件）
│   │       ├── draft-chapter.ts
│   │       ├── continue-writing.ts
│   │       ├── review-content.ts
│   │       ├── polish-text.ts
│   │       ├── plan-story.ts
│   │       └── extract-memory.ts
│   │
│   ├── mcp/                     # MCP Client（对标 opencode/src/mcp/）
│   │   ├── client.ts            # MCP client manager
│   │   ├── config.ts            # 加载 .orison/mcp.json
│   │   └── transport.ts         # stdio + streamable-http transport
│   │
│   ├── provider/                # LLM Provider（对标 opencode/src/provider/）
│   │   ├── ipc-provider.ts      # Vercel AI SDK custom provider → 桌面 IPC
│   │   └── index.ts
│   │
│   ├── prompt/                  # 系统提示词
│   │   ├── orison.md            # 主系统提示词模板
│   │   └── render.ts            # 模板渲染（注入 tools/skills/mcp）
│   │
│   └── common/
│       ├── env.ts
│       └── logger.ts
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 3.2 Agent 定义（对标 opencode Agent.Info）

```typescript
// agent/agent.ts
interface AgentConfig {
  name: string;
  description: string;
  model: { provider: string; modelId: string };
  tools: string[];           // 允许使用的 tool 名称列表
  maxSteps: number;          // 最大 agentic loop 步数
  systemPrompt: string;      // 渲染后的完整 system prompt
  temperature?: number;
}

// 预定义 agents（类似 opencode 的 primary/subagent）
const agents = {
  // 主 agent：全能力，用于创作任务
  writer: { name: 'writer', tools: ['*'], maxSteps: 50 },
  // 子 agent：只读，用于分析和查询
  reader: { name: 'reader', tools: ['read_file', 'list_files', 'search', 'memory_query'], maxSteps: 20 },
};
```

### 3.3 Tool 定义（对标 opencode Tool.define()）

```typescript
// tool/define.ts
import { z } from 'zod';

interface ToolDefinition<TParams extends z.ZodType, TResult> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (params: z.infer<TParams>, ctx: ToolContext) => Promise<TResult>;
}

function defineTool<TParams extends z.ZodType, TResult>(
  def: ToolDefinition<TParams, TResult>
): ToolDefinition<TParams, TResult> {
  return def;
}

// 示例
const readFile = defineTool({
  name: 'read_file',
  description: '读取项目内的文件内容',
  parameters: z.object({
    path: z.string().describe('相对于项目根目录的文件路径'),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  execute: async (params, ctx) => {
    // 路径安全校验 + 读取
  },
});
```

### 3.4 Skill 系统

#### SKILL.md 格式

```markdown
---
name: polish
description: 对选中文本进行 AI 润色，优化表达和文学性
trigger: manual
input: selection
output: replacement
---

你是一位资深文学编辑。请对以下文本进行润色：
- 保持原意不变
- 提升文学性和可读性
- 保持角色语气一致

## 输入
{{input}}

## 项目风格参考
{{project.style_guide}}
```

#### 发现路径

```
优先级（高→低）：
1. <projectPath>/.orison/skills/**/SKILL.md   （项目级）
2. ~/.orison/skills/**/SKILL.md               （全局用户级）
3. 内置 skills（代码内嵌，不暴露文件）
```

#### Skill Tool 工作流

1. Agent 在 system prompt 中看到 skill 列表（name + description）
2. Agent 决定调用 `skill` tool，传入 `{ name: "polish", input: "..." }`
3. `skill` tool 加载对应 SKILL.md，渲染模板变量
4. 返回渲染后的 prompt 文本作为 tool result
5. Agent 基于 skill prompt 继续推理和生成

### 3.5 MCP Client

#### 配置格式（`<projectPath>/.orison/mcp.json` 或 `~/.orison/mcp.json`）

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "transport": "stdio"
    },
    "remote-search": {
      "url": "http://localhost:3001/mcp",
      "transport": "streamable-http"
    }
  }
}
```

#### 集成方式

- Agent 启动时连接所有 MCP server
- 调用 `tools/list` 获取外部工具定义
- MCP tools 转换为内部 `ToolDefinition` 格式，合并到 tool registry
- 在 system prompt 中与内置 tools 一起列出
- 工具调用时路由到对应 MCP server 执行

### 3.6 LLM Provider（IPC 适配）

```typescript
// provider/ipc-provider.ts
// Agent 通过 HTTP 调用桌面端暴露的 model gateway
// 将 messages + tools 格式化为 gateway 期望的 payload

function messagesToPayload(messages, system, tools) {
  // system prompt 作为 { role: 'system' } 消息放入 messages 数组
  // assistant 消息带 toolCalls 字段
  // tool 消息带 toolCallId + content

  // tool definitions 使用 zodToJsonSchema(schema, { target: 'jsonSchema7' })
  // 确保 exclusiveMinimum 等字段输出为数字（兼容 OpenAI schema 校验）
  // 剥离 $schema 字段
  const toolDefs = tools.map(t => {
    const { $schema, ...schema } = zodToJsonSchema(t.parameters, { target: 'jsonSchema7' });
    return { type: 'function', function: { name: t.id, description: t.description, parameters: schema } };
  });
}

export async function generate(messages, system, tools, opts) {
  // POST http://localhost:18421/model/generate-text
  // body: { ref: { keyId, modelId }, request: { messages, tools, temperature, maxTokens } }
}
```

Gateway 侧（`model-protocols`）使用 `openai.chat(modelId)` 强制 Chat Completions API（而非 Responses API），
并将 system 消息从 messages 数组中提取出来通过 AI SDK 的 `system` 参数传递。

### 3.7 Agentic Loop（对标 opencode session/generation）

```typescript
// agent/loop.ts
export async function runLoop(opts: LoopOptions): Promise<SessionMessage[]> {
  const { messages, systemPrompt, tools, maxSteps, generate, onMessage, abort } = opts;
  const result: SessionMessage[] = [];
  let steps = 0;

  while (steps < maxSteps) {
    if (abort.aborted) break;
    steps++;

    // 调用 LLM（通过注入的 generate 函数，实际走 HTTP → gateway → AI SDK）
    const response = await generate([...messages, ...result], systemPrompt, tools);

    // 追加 assistant 消息
    const assistantMsg = { role: 'assistant', content: response.content, toolCalls: response.toolCalls };
    result.push(assistantMsg);
    onMessage?.(assistantMsg);

    // 无 tool call 或 finishReason=stop → 结束
    if (!response.toolCalls?.length || response.finishReason === 'stop') break;

    // 执行 tool calls，追加 tool result 消息
    for (const call of response.toolCalls) {
      if (abort.aborted) break;
      const tool = tools.find(t => t.id === call.name);
      const toolResult = await tool.execute(JSON.parse(call.arguments), ctx);
      result.push({ role: 'tool', toolResults: [{ toolCallId: call.id, output: toolResult.output }] });
    }
  }
  return result;
}
```

注意：abort signal 基于 `request.raw.socket.on('close')`（TCP 连接关闭），而非 `request.raw.on('close')`（请求 body 读取完成），避免 SSE 端点过早中断。

### 3.8 上下文压缩（对标 opencode compaction）

| 策略 | 说明 |
|------|------|
| **阈值** | 当 token 使用 > 800K 时触发 |
| **摘要** | 用 LLM 对历史消息生成结构化摘要 |
| **保留** | 最近 N 轮完整消息 + system prompt + 活跃 artifact |
| **artifact 保护** | 当前章节草稿、活跃记忆条目不被压缩 |

## 四、API 设计

### 4.1 新 API（Session-based）

```
POST   /v1/sessions                    # 创建 session
POST   /v1/sessions/:id/messages       # 发送消息（触发 agentic loop）
GET    /v1/sessions/:id/stream         # SSE 流式输出
GET    /v1/sessions/:id                # 获取 session 状态
DELETE /v1/sessions/:id                # 终止 session

GET    /v1/skills                      # 列出可用 skills
GET    /v1/skills/:name                # 获取 skill 详情
```

### 4.2 Session 创建

```typescript
POST /v1/sessions
{
  "projectPath": "/path/to/novel",
  "agent": "writer",              // 可选，默认 writer
  "modelRef": { "keyId": "...", "modelId": "..." }
}
// → { sessionId, status: "ready" }
```

### 4.3 发送消息

```typescript
POST /v1/sessions/:id/messages
{
  "content": "写第三章，要体现主角的内心挣扎",
  "attachments": []               // 可选：附加文件内容
}
// → SSE stream: tool_call events + text chunks + done
```

### 4.4 兼容旧 API

```
POST /v1/orchestration/runs          → 创建 session + 发送初始消息
POST /v1/orchestration/auto-mode     → 创建 session + auto mode 指令序列
```

## 五、orison.md 系统提示词结构

```markdown
# Orison Agent

你是 Orison Space 的创作 Agent，协助用户完成长篇小说创作。

## 角色
- 你是一位专业的小说创作助手
- 你通过工具调用来读写项目文件、查询记忆、执行技能
- 你根据用户指令自主决定使用哪些工具和技能

## 可用工具

{{tools_section}}

## 可用技能

以下技能可通过 `skill` 工具调用：

{{skills_section}}

## MCP 扩展工具

{{mcp_tools_section}}

## 行为规则
- 写作前先用 read_file 了解上下文
- 写作后用 memory_update 更新连续性记忆
- 长篇内容分段写入，每段不超过 3000 字
- 遇到不确定的创作方向时，询问用户
- 保持与 project.md 中定义的风格一致

## 项目上下文

{{project_md_content}}
```

## 六、Skill 生态设计

### 6.1 用户创建 Skill

用户在 `<projectPath>/.orison/skills/my-skill/SKILL.md` 创建文件即可。

### 6.2 Skill 变量

| 变量 | 来源 |
|------|------|
| `{{input}}` | 用户传入的文本/选区 |
| `{{project.title}}` | project.md 中的项目标题 |
| `{{project.style_guide}}` | project.md 中的风格指南 |
| `{{project.genre}}` | project.md 中的类型 |
| `{{context.chapter}}` | 当前章节内容（通过 read_file 获取） |
| `{{context.memory}}` | 相关记忆条目（通过 memory_query 获取） |

### 6.3 Skill 能力声明

```yaml
---
name: my-skill
description: 描述
trigger: manual
input: selection
output: replacement
tools:                    # 该 skill 执行时建议使用的 tools
  - read_file
  - memory_query
---
```

## 七、与桌面端的交互

### 7.1 Model Gateway

Agent 通过 HTTP 调用桌面端暴露的 model gateway：

```
桌面主进程启动时暴露本地 HTTP endpoint:
  POST http://localhost:{port}/model/generate-text
  POST http://localhost:{port}/model/generate-text-stream

Agent 的 IPC provider 将 AI SDK 请求转发到此 endpoint。
```

### 7.2 文件操作

Agent 的 `read_file` / `write_file` 工具直接操作项目文件系统（agent 进程有文件访问权限），不需要走 IPC。路径安全校验确保只能访问 projectPath 内的文件。

## 八、依赖变更

### 新增
- `ai` (Vercel AI SDK v6) — LLM 交互、tool use、streaming
- `@ai-sdk/openai` v3 — OpenAI 兼容 provider（使用 `.chat()` 强制 Chat Completions API）
- `@modelcontextprotocol/sdk` — MCP client
- `gray-matter` — SKILL.md frontmatter 解析

### 保留
- `fastify` + `@fastify/cors` — HTTP 层
- `zod` — schema 验证
- `pino` — 日志
- `yaml` — YAML 文件读写
- `@orison/shared-contracts` — 共享类型

### 删除
- Python 运行时依赖
- 所有 Python 节点相关代码
