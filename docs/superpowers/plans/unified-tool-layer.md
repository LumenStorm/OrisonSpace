# Plan: 统一 Tool 执行层（方案 D — 编排在服务端，执行在本地）

## 目标

Agent 部署到服务端，保护编排逻辑和 prompt。所有 tool 的实际执行通过反向通道回调到用户的 Desktop Shell。支持多用户并发。

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent 服务端 (你的云)                                           │
│                                                                 │
│  保护内容: system prompt / 编排策略 / tool 选择逻辑              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SessionManager                                           │  │
│  │  ├── session-A → userId: u1, shellId: shell-u1            │  │
│  │  ├── session-B → userId: u2, shellId: shell-u2            │  │
│  │  └── session-C → userId: u1, shellId: shell-u1 (项目2)    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ToolDispatcher                                           │  │
│  │  dispatch(shellId, { requestId, toolId, params })         │  │
│  │  → 通过 WebSocket Hub 发给对应 Shell                       │  │
│  │  → 等待 Shell 返回 { requestId, result }                  │  │
│  │  → 超时 / 断线处理                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WebSocket Hub                                            │  │
│  │  Map<shellId, WebSocket>                                  │  │
│  │  ├── "shell-u1" → ws conn 1                              │  │
│  │  ├── "shell-u2" → ws conn 2                              │  │
│  │  └── ...                                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Agent Loop (per session):                                      │
│  1. Shell 通过 WS 上报 session messages (从本地 JSONL 加载)       │
│  2. 组装 messages + system prompt (保密)                         │
│  3. 调用 LLM → 收到 tool_use                                    │
│  4. ToolDispatcher.dispatch(shellId, toolReq)                   │
│  5. 等待 Shell 返回 ToolResult                                   │
│  6. 拼回 messages → 回到 step 3                                 │
│  7. loop 结束后，Shell 将新 messages 追加写入本地 JSONL           │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ WebSocket (Shell 主动连接上来)
         │
┌─────────────────────────────────────────────────────────────────┐
│  Desktop Shell (用户机器)                                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WS Client                                                │  │
│  │  - 启动时连接 Agent 服务端 WS endpoint                     │  │
│  │  - 注册: { type: 'register', shellId, userId, token }     │  │
│  │  - 断线自动重连 (exponential backoff)                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Tool Execution Layer                                     │  │
│  │                                                           │  │
│  │  收到 tool_request → 路由到 handler → 执行 → 返回结果      │  │
│  │  并发: 多个 requestId 同时处理，无状态 handler             │  │
│  │  文件锁: 写操作对同一文件排队                              │  │
│  │                                                           │  │
│  │  Handlers:                                                │  │
│  │  ├── file: read / write / list / search                   │  │
│  │  ├── chapter: list / read / write                         │  │
│  │  ├── outline: read / update                               │  │
│  │  ├── image: generate / edit (调本地 model gateway)         │  │
│  │  ├── git: status / log / commit / diff                    │  │
│  │  ├── project: meta                                        │  │
│  │  ├── memory: query / update (本地读写 story-memory.yaml)   │  │
│  │  └── session: persistence (本地 .orison/sessions/)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ├── pathGuard (唯一安全校验点)                            │
│         ├── model gateway (图片/视频生成, apiKey 在本地)          │
│         └── webContents.send('tool:event') → UI 刷新             │
└─────────────────────────────────────────────────────────────────┘
```

## WebSocket 协议

### 连接建立

```
Shell → Agent 服务端: wss://agent.orison.app/ws/shell
```

### 消息类型

```typescript
// ═══ Shell → 服务端 ═══

// 注册身份
{ type: 'register', shellId: string, userId: string, token: string }

// tool 执行结果
{ type: 'tool_response', requestId: string, result: { title: string, output: string, metadata?: Record<string, unknown> } }

// tool 执行失败
{ type: 'tool_error', requestId: string, error: string, code?: string }

// 心跳
{ type: 'ping' }

// ═══ 服务端 → Shell ═══

// 注册确认
{ type: 'registered', shellId: string }

// tool 调用请求
{ type: 'tool_request', requestId: string, sessionId: string, toolId: string, params: Record<string, unknown>, projectDir: string }

// 取消 tool (用户中断)
{ type: 'tool_cancel', requestId: string }

// 心跳回复
{ type: 'pong' }
```

### requestId 并发匹配

每个 tool 调用有唯一 `requestId`（UUID）。服务端发出 `tool_request` 后，在内存中维护 `Map<requestId, { resolve, reject, timer }>`。Shell 返回 `tool_response` 或 `tool_error` 时，通过 requestId 匹配并 resolve/reject 对应的 Promise。

## 并发控制

### 服务端

| 场景 | 处理 |
|------|------|
| 多用户同时使用 | 每个用户的 session 绑定 shellId，通过 WS Hub 路由到对应连接 |
| 同一用户多 session | 共享同一个 WS 连接（同一个 shellId），requestId 区分 |
| 模型返回多个 tool_use | 并行发送多个 tool_request，Promise.all 等待全部返回 |
| Shell 断线 | pending 请求全部 reject，Agent loop 收到错误后通知用户 |
| Shell 重连 | 重新注册 shellId，新请求走新连接，旧 pending 已超时 |

### Shell 侧

| 场景 | 处理 |
|------|------|
| 同时收到多个 tool_request | 并发执行（每个 handler 是独立 async 函数） |
| 多个写操作同一文件 | 文件级锁 `Map<filePath, Promise>`，排队执行 |
| tool 执行超时 | Shell 侧设 30s 超时，超时返回 tool_error |
| 收到 tool_cancel | 通过 AbortController 取消正在执行的 tool |

### 超时策略

```
服务端等待 Shell 响应: 60s (含网络延迟)
Shell 执行单个 tool: 30s (本地操作)
图片生成 tool: 120s (模型调用慢)
心跳间隔: 30s, 3次未回复判定断线
```

## 开发/生产双模式

为了开发方便，Shell 同时支持两种模式：

```typescript
// 开发模式: Agent 在本地，Shell 暴露 HTTP 端点
// 生产模式: Agent 在云端，Shell 主动 WS 连接

if (isDev || !agentServerUrl) {
  // 开发: 在 modelGatewayHttp 上注册 POST /tool/execute
  registerToolExecuteRoute(httpServer);
} else {
  // 生产: 启动 WS client 连接 Agent 服务端
  startShellWsClient(agentServerUrl, shellId, userId, token);
}
```

两种模式共享同一个 `ToolExecutionLayer`，只是传输层不同。

## 安全

| 层面 | 措施 |
|------|------|
| WS 连接认证 | Shell 连接时带 JWT token（登录时获取），服务端验证后才接受注册 |
| tool 请求验证 | 服务端只向已注册的 shellId 发送请求，Shell 只处理来自已认证连接的请求 |
| 路径安全 | pathGuard 在 Shell 侧，Agent 无法穿越 |
| apiKey 保护 | apiKey 永远不离开 Shell，模型调用在本地完成 |
| prompt 保护 | system prompt 和编排逻辑在服务端，用户看不到 |
| 传输加密 | WSS (TLS) |

## 改动清单

### Phase 1: Shell — Tool Execution Layer

**新增文件:**
```
apps/desktop/shell/main/ipc/
├── toolExecution.ts              — handleToolExecute() 入口 + handler 注册表
├── toolNotify.ts                 — notifyUI() 事件推送
└── toolHandlers/
    ├── fileHandlers.ts           — read_file, write_file, list_files, search
    ├── chapterHandlers.ts        — chapter_list, chapter_read, chapter_write
    ├── outlineHandlers.ts        — outline_read, outline_update
    ├── imageHandlers.ts          — generate_image, edit_image
    ├── gitHandlers.ts            — git_status, git_log, git_commit, git_diff
    └── projectHandlers.ts        — project_meta, memory_query, memory_update, session_persist
```

**说明**: 记忆（story-memory.yaml）和会话（.orison/sessions/）始终在本地读写，不上传到服务端。Agent 通过 tool 调用读取记忆内容，但原始数据留在用户机器上。

**修改:**
- `modelGatewayHttp.ts` — 新增 `POST /tool/execute` 路由（开发模式）
- `preload/index.ts` — 暴露 `onToolEvent`

### Phase 2: Shell — WS Client（生产模式）

**新增:**
```
apps/desktop/shell/main/ipc/
└── agentWsClient.ts              — WS 连接管理、重连、消息分发
```

**修改:**
- `index.ts` — 根据配置启动 WS client 或 HTTP 路由

### Phase 3: Agent 服务端 — WS Hub + ToolDispatcher

**新增:**
```
apps/agent/src/
├── ws/
│   ├── hub.ts                    — WebSocket Hub (Map<shellId, ws>)
│   └── dispatcher.ts             — ToolDispatcher (发送请求、等待响应、超时)
└── tool/
    └── remote.ts                 — remoteToolProxy (开发模式 HTTP / 生产模式走 dispatcher)
```

**修改:**
- `app.ts` — 挂载 WS endpoint `/ws/shell`
- `agent/loop.ts` — tool 执行改为通过 dispatcher
- `tool/builtin.ts` — 所有 tool 改为 schema-only + remoteToolProxy

**删除/精简:**
- 各 tool 文件中的 `node:fs` 操作和路径校验逻辑

### Phase 4: UI — 事件监听

**新增:**
- `apps/desktop/ui/src/shared/hooks/useToolEvents.ts` — 监听 tool:event 并刷新 UI

**修改:**
- `App.tsx` 或 `WorkspacePage.tsx` — 挂载 useToolEvents

## 不变的部分

- Agent 核心推理仍走 LLM API（服务端直接调 OpenAI/Anthropic 等）
- UI 自身的 Electron IPC 不变
- Agent 的 session/stream REST API 不变（UI 仍然直接调 Agent 的 HTTP 接口）
- ToolResult 接口不变
- **记忆数据始终在本地** — story-memory.yaml 存在用户项目目录，Agent 通过 memory_query/memory_update tool 读写，数据不离开 Shell
- **会话持久化在本地** — .orison/sessions/ 的 JSONL 和 SQLite 索引在用户机器上，Agent 服务端只在内存中维护当前活跃 session 的 messages，不持久化用户对话

## 执行顺序

1. **Phase 1** — Shell Tool Execution Layer + HTTP 路由（开发模式可用）
2. **Phase 3 部分** — Agent tool 改为 remoteToolProxy（开发模式 HTTP 直连）
3. 验证: Agent 调 tool → Shell 执行 → UI 刷新（本地全链路跑通）
4. **Phase 2** — Shell WS Client
5. **Phase 3 剩余** — Agent WS Hub + Dispatcher
6. **Phase 4** — UI 事件监听
7. 验证: 生产模式全链路（Agent 云端 → WS → Shell → 执行 → 返回）

## 后续考虑

- **负载均衡**: Agent 服务端多实例时，WS 连接需要 sticky session 或用 Redis pub/sub 转发
- **离线容错**: Shell 断线期间 Agent 暂停 loop，重连后恢复
- **tool 版本**: Shell 升级新增 tool 时，Agent 需要知道 Shell 支持哪些 tool（注册时上报 tool 列表）
- **限流**: 防止恶意 Agent 请求轰炸 Shell（Shell 侧 rate limit）
