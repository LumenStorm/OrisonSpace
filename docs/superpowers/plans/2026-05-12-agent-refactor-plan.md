# Agent 重写实施计划

> 日期：2026-05-12
> Spec：`docs/superpowers/specs/2026-05-12-agent-refactor-design.md`

## 总体策略

全新重写 `apps/agent`，旧代码不做渐进迁移而是直接替换。分 6 个 Phase，每个 Phase 可独立验证。

---

## Phase 1：骨架与类型系统

**目标**：搭建新 agent 包的基础结构，定义所有核心类型。

- 清空 `apps/agent/src/`，建立新目录结构
- 定义核心类型：
  - `AgentConfig`：agent 定义
  - `ToolDefinition` / `ToolContext` / `ToolResult`：tool 接口
  - `SkillInfo`：skill 元数据
  - `SessionState` / `SessionMessage`：session 状态
- 实现 `tool/define.ts`：Tool.define() 工厂函数
- 实现 `prompt/render.ts`：模板渲染（读取 orison.md，注入变量）
- 编写 `prompt/orison.md`：系统提示词模板初稿
- Fastify 入口 + 健康检查路由
- **验证**：`pnpm typecheck` 通过，`GET /health` 返回 200

---

## Phase 2：Tool 层

**目标**：实现所有内置 tool，可独立测试。

- `tool/registry.ts`：tool 注册表（注册、按名查找、列出所有）
- 实现内置 tools：
  - `read_file`：读取项目文件（路径安全校验）
  - `write_file`：写入/创建文件
  - `list_files`：glob 列目录
  - `search`：内容搜索（简单 grep 实现）
  - `memory_query`：查询 story-memory.yaml
  - `memory_update`：更新 story-memory.yaml
  - `skill`：加载 SKILL.md 内容注入上下文
  - `task`：派生子 agent session
- **验证**：每个 tool 有 vitest 单元测试

---

## Phase 3：Skill 层

**目标**：skill 发现、加载、内置 skill 定义。

- `skill/discovery.ts`：扫描 `.orison/skills/` 目录，返回 `SkillInfo[]`
- `skill/loader.ts`：解析 SKILL.md（gray-matter frontmatter + body），变量替换
- `skill/types.ts`：SkillInfo 类型定义
- 内置 skill 实现（`skill/builtin/*.ts`）：
  - `draft-chapter`：章节写作 prompt
  - `continue-writing`：续写 prompt
  - `review-content`：审查 prompt
  - `polish-text`：润色 prompt
  - `plan-story`：规划 prompt
  - `extract-memory`：记忆提取 prompt
- **验证**：discovery 扫描测试 + loader 解析测试

---

## Phase 4：LLM Provider + Agentic Loop

**目标**：实现 LLM 调用和 agent 核心循环。

- `provider/ipc-provider.ts`：
  - 实现 Vercel AI SDK 的 custom provider 接口
  - 将 `generateText` / `streamText` 请求转为桌面 IPC `model:generate-text` 调用
  - 处理 tool_use 格式转换
- `agent/loop.ts`：
  - Agentic loop：调用 LLM → 检查 tool_call → 执行 tool → 将 result 追加到 messages → 重复
  - 最大步数限制
  - 流式输出支持（SSE）
- `agent/session.ts`：
  - Session 创建：构建 system prompt（orison.md + project.md + skills summary）
  - Session 运行：接收 user message → 进入 loop → 返回结果
  - Session 状态管理
- `agent/compaction.ts`：
  - Token 计数
  - 阈值触发压缩（摘要旧消息，保留最近 N 轮）
- **验证**：mock provider 的集成测试，验证 tool call 循环正确执行

---

## Phase 5：MCP Client

**目标**：连接外部 MCP server，合并工具到 agent。

- `mcp/config.ts`：加载 `~/.orison/mcp.json` + `<projectPath>/.orison/mcp.json`
- `mcp/transport.ts`：
  - stdio transport：spawn 子进程，JSON-RPC over stdin/stdout
  - HTTP transport：fetch-based streamable HTTP
- `mcp/client.ts`：
  - 连接管理（启动时连接，graceful shutdown）
  - `tools/list` 获取远程工具列表
  - `tools/call` 路由工具调用到对应 server
  - 将 MCP tools 转换为内部 ToolDefinition 格式
- **验证**：mock MCP server 的集成测试

---

## Phase 6：API Routes + 集成

**目标**：暴露 HTTP API，对接桌面端。

- 新 API routes：
  ```
  POST   /v1/agent/sessions              创建 session
  POST   /v1/agent/sessions/:id/messages  发送消息（触发 loop）
  GET    /v1/agent/sessions/:id           获取 session 状态
  DELETE /v1/agent/sessions/:id           终止 session
  GET    /v1/agent/sessions/:id/stream    SSE 流式输出
  GET    /v1/agent/skills                 列出可用 skills
  ```
- Auto Mode 适配：
  - 创建 session → 按预设指令序列自动发送消息
  - 复用 agent session 基础设施
- 旧 API 兼容层（可选）：
  - `/v1/orchestration/runs` → 映射到新 session API
- **验证**：端到端测试（HTTP 请求 → agent 响应）

---

## Phase 7：清理与文档

- 删除所有旧代码（`python/`、旧 `engine/`、旧 `nodes/`）
- 更新 `design.md`、`module-boundaries.md`
- 更新 `shared-contracts` 中的相关类型
- 更新桌面端调用代码（如需要）

---

## 依赖关系

```
Phase 1 (骨架)
    ↓
Phase 2 (Tools) ←→ Phase 3 (Skills)  [可并行]
    ↓                    ↓
Phase 4 (LLM + Loop)  [依赖 2+3]
    ↓
Phase 5 (MCP)  [可与 4 并行]
    ↓
Phase 6 (API)  [依赖 4+5]
    ↓
Phase 7 (清理)
```

## 新增依赖

```json
{
  "ai": "^4.x",                          // Vercel AI SDK
  "gray-matter": "^4.x",                 // SKILL.md frontmatter 解析
  "@modelcontextprotocol/sdk": "^1.x",   // MCP client SDK
  "glob": "^11.x"                        // 文件发现
}
```

## 关键设计决策

| 决策 | 选择 | 对标 opencode |
|------|------|---------------|
| LLM 交互 | Vercel AI SDK custom provider → IPC | opencode 用 AI SDK + provider 抽象 |
| Tool 定义 | `defineTool()` + Zod schema | opencode 的 `Tool.define()` |
| Skill 格式 | SKILL.md (frontmatter + prompt) | opencode 的 SKILL.md 完全一致 |
| Skill 发现 | `.orison/skills/` 两层 | opencode 的 `.opencode/skills/` |
| MCP | `@modelcontextprotocol/sdk` client | opencode 的 MCP client |
| Session | 内存 + 可选持久化 | opencode 用 SQLite |
| Compaction | 摘要式压缩 | opencode 的 structured compaction |
| Agent 层级 | writer (primary) + reader (subagent) | opencode 的 Build + Explore |

## 风险

| 风险 | 缓解 |
|------|------|
| IPC provider 适配复杂 | AI SDK 的 custom provider 接口文档完善，且只需实现 doGenerate/doStream |
| Agent 自主决策质量 | 内置 skill 包含详细 prompt 模板，相当于"软 pipeline" |
| 桌面端 API 变更 | Phase 6 提供兼容层，桌面端可渐进迁移 |
| MCP server 不稳定 | graceful degradation，MCP 工具不可用时仍可用内置工具 |
