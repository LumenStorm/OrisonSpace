# Orison Agent

AI 写作助手的 Agent 后端服务。基于 agentic loop + tool calling 架构，为桌面端提供智能写作、图像生成、项目管理能力。

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  Desktop Shell (Electron)                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Model Gateway HTTP (port 18421)                │    │
│  │  /model/generate-text                           │    │
│  │  /images/generations                            │    │
│  │  /images/edits                                  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
         ▲
         │ HTTP
         ▼
┌─────────────────────────────────────────────────────────┐
│  Agent Service (port 18422)                             │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │  Routes  │──▶│  Loop    │──▶│  LLM Provider    │    │
│  │  (REST)  │   │  (Agent) │   │  (IPC/HTTP)      │    │
│  └──────────┘   └──────────┘   └──────────────────┘    │
│       │              │                                  │
│       │              ▼                                  │
│       │         ┌──────────┐                            │
│       │         │  Tools   │                            │
│       │         │  Registry│                            │
│       │         └──────────┘                            │
│       │              │                                  │
│       ▼              ▼                                  │
│  ┌──────────┐   ┌──────────────────────────────────┐   │
│  │  Session  │   │  Built-in Tools                  │   │
│  │  Store    │   │  • File I/O (read/write/list)    │   │
│  └──────────┘   │  • Search (regex across files)    │   │
│                  │  • Story Memory (YAML)            │   │
│                  │  • Chapters (list/read/write)     │   │
│                  │  • Outlines (read/update)         │   │
│                  │  • Image Gen (generate/edit)      │   │
│                  │  • Project Meta                   │   │
│                  │  • Git (status/commit/log/diff)   │   │
│                  │  • Skills (load prompt)           │   │
│                  └──────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  MCP Client (optional, .orison/mcp.json)         │   │
│  │  • stdio JSON-RPC transport                      │   │
│  │  • Dynamic tool discovery                        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ▲
         │ REST / SSE
         ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend (VSCode-style side panel)                     │
│  • Chat messages (text + tool calls + images)           │
│  • Tool execution progress                             │
│  • Image inline preview                                │
└─────────────────────────────────────────────────────────┘
```

## 运行

```bash
# 开发模式
pnpm --filter @orison/agent dev

# 构建
pnpm --filter @orison/agent build
```

环境变量（`.env.agent`）：
```
PORT=18422
MODEL_GATEWAY_URL=http://localhost:18421
LOG_LEVEL=info
```

## API 端点

### Session 管理

| Method | Path | 说明 |
|--------|------|------|
| POST | `/v1/agent/sessions` | 创建会话 |
| GET | `/v1/agent/sessions/:id` | 获取会话状态 |
| DELETE | `/v1/agent/sessions/:id` | 删除会话 |
| POST | `/v1/agent/sessions/:id/messages` | 发送消息（同步返回） |
| POST | `/v1/agent/sessions/:id/stream` | 发送消息（SSE 流式返回） |

### 工具与技能

| Method | Path | 说明 |
|--------|------|------|
| GET | `/v1/agent/tools` | 列出所有可用 tools |
| GET | `/v1/agent/skills?projectPath=...` | 列出项目 skills |

### SSE 事件格式

```
event: assistant
data: {"id":"...","content":"...","toolCalls":[...]}

event: tool
data: {"id":"...","results":[{"toolId":"...","output":"..."}]}

event: done
data: {"status":"completed"}

event: error
data: {"message":"..."}
```

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
| `skill` | 加载 .orison/skills/ 下的 SKILL.md 提示词 |

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
            │ (parallel)   │      │ Response     │
            └──────┬───────┘      └──────────────┘
                   │
                   ▼
            ┌──────────────┐
            │ Append Tool  │
            │ Results      │──────▶ Loop back to LLM
            └──────────────┘
```

- 最大 50 步循环（防止无限 loop）
- 支持 AbortSignal 中断
- Tool 执行结果自动追加到消息历史
- 上下文超长时自动压缩（compaction）

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
---

你是一个世界观构建专家。根据用户提供的故事背景...
```

Agent 可通过 `skill` tool 动态加载 skill 内容注入上下文。

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
- Tool 调用显示为可折叠的执行卡片（`AgentToolCard`）
- 写入类 tool 在 suggest 模式下显示 DiffCard（Accept/Reject）
- 图像结果内联预览（`AgentImageResult`）
- 支持中断/重试（`cancelAgent`）
- 消息通过 SSE 实时推送
- 三档权限模式：Read / Suggest / Auto（前端控制，后端无感知）
- 发送时自动附加当前编辑章节上下文
- 所有文本已 i18n 化（`agent.*` 命名空间）

详见 [Agent Panel UI 文档](agent-panel-ui.md) 和 [UI 层级结构](ui-hierarchy.md)。
