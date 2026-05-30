# 项目 Review 报告 — 2026-05-29

> 以代码实现为准，对照文档和架构设计，整理解耦不足、规范问题、以及文档与实现的偏移。

---

## 一、文档与实现的偏移（Doc/Implementation Drift）

### 1.1 README 声称 `pnpm dev:agent` 启动 Agent HTTP 服务（端口 18422）

| 文档 | 实现 |
|------|------|
| README.md: `pnpm dev:agent # 启动 Agent http://localhost:18422` | `apps/desktop/agent/package.json` 中无 `dev:agent` 脚本；Agent 是嵌入式库，无 HTTP 服务器 |

**影响**: 新开发者按文档操作会失败。

### 1.2 `DEFAULT_API_BASE` 指向不存在的 Agent HTTP 服务

| 位置 | 问题 |
|------|------|
| `packages/shared-contracts/src/config.ts` | `DEFAULT_API_BASE = 'http://127.0.0.1:18422'` |
| `apps/desktop/client/ui/src/shared/constants.ts` | 消费此常量作为 `API_BASE` |

Agent 已重构为嵌入式库（通过 IPC 调用），但此常量仍被 UI 层的 orchestration 和 novelChapter API 模块使用，所有 HTTP 请求在运行时必然失败（connection refused）。

### 1.3 UI 中 Orchestration/Auto-Mode HTTP 调用无对应服务端

以下 UI API 模块直接 fetch 端口 18422，但无任何进程监听：

| 文件 | 死调用 |
|------|--------|
| `apps/desktop/client/ui/src/shared/api/novelChapter.ts` | `POST /v1/orchestration/runs`, `POST /v1/orchestration/auto-mode`, `POST /v1/orchestration/auto-mode/actions`, `GET /v1/orchestration/auto-mode/:id` |
| `apps/desktop/client/ui/src/shared/api/orchestration.ts` | `POST /v1/orchestration/runs`, `GET /v1/orchestration/runs/:id`, `POST /v1/orchestration/actions` |

**根因**: Agent 从独立 HTTP 服务迁移为嵌入式库时，UI 层的 HTTP 调用未同步迁移为 IPC 调用。`agent.ts` 已正确使用 IPC，但 orchestration 和 novelChapter 模块未跟进。

### 1.4 `loginResponseSchema` 残留

| 文档 | 实现 |
|------|------|
| README: "已移除服务端鉴权，纯本地应用" | `packages/shared-contracts/src/contracts/auth.ts` 仍导出 `loginResponseSchema` |

该 schema 仅在自身的单元测试中被引用，无任何业务代码消费。属于已废弃架构的残留物。

### 1.5 design.md 提及"登录/注册"UI 职责

`docs/design.md` 第二节"桌面 UI 负责"列表中包含"登录 / 注册"，但实际代码中无任何登录/注册页面或流程。

### 1.6 Agent 测试引用不存在的 `src/app.ts`

`apps/desktop/agent/test/` 下至少 5 个测试文件 import `{ buildAgent } from '../src/app'`，但 `src/app.ts` 不存在。这些测试无法编译，属于旧 HTTP 服务架构的残留。

---

## 二、解耦不足（Coupling Issues）

### 2.1 Zustand Store 切片间的隐式耦合

虽然 UI feature 模块之间无直接 import（这点做得好），但 Zustand store 层存在切片间的紧耦合：

| 耦合关系 | 具体表现 |
|----------|----------|
| `AgentSlice` → `EditorSlice` | AgentSlice 的类型定义中直接依赖 `activeChapterId`、`chapters`、`updateChapter`，无法独立提取 |
| `OrchestrationSlice` → `CreativeFieldsSlice` | OrchestrationSlice 直接调用 `setPendingPatch`、`togglePatchSelection`、`applySelectedPatches` |
| `NovelChapterSlice` → `EditorSlice` | 共享 chapter 数据结构，auto-mode 状态更新直接操作 editor 的 chapter 列表 |

**问题**: 这些切片通过 `type Deps = SliceA & { ...SliceB的字段 }` 模式建立了编译期耦合。如果要将 Agent 功能独立为插件或将 Orchestration 抽离，需要大量重构。

**建议**: 引入事件总线或 store middleware，让切片通过事件通信而非直接引用彼此的 state/action。

### 2.2 HTTP/IPC 双通道不一致

模型调用（text/image/video）有完整的 IPC 通道 + HTTP 通道（端口 18421 供 Agent 内部使用），设计合理。但 orchestration 功能只有 HTTP 通道（指向已死的 18422），缺少 IPC 通道。

| 功能 | IPC 通道 | HTTP 通道 | 状态 |
|------|----------|-----------|------|
| 模型生成 | ✅ `model:generate-*` | ✅ 端口 18421 | 正常 |
| Agent 会话 | ✅ `agent:*` | ❌ | 正常 |
| Story Sync | ✅ `storySync:run` | ❌ | 正常 |
| Orchestration/Auto-Mode | ❌ | ❌ (18422 无服务) | **断裂** |

### 2.3 Gateway Auth 无 Token 签发者

`apps/desktop/client/shell/main/ipc/gatewayAuth.ts` 实现了 Bearer token 验证，但整个系统中无任何 token 签发逻辑。`ORISON_GATEWAY_TOKEN` 环境变量需手动设置，否则所有非 `/health` 请求被 401 拒绝。

这是一个半完成的安全机制：有验证无签发，且与"纯本地应用无需登录"的定位矛盾。

### 2.4 `local-bff` 包定位模糊

| 导出 | 实际使用 | 状态 |
|------|----------|------|
| `clientApi.ts` (HTTP client → 18422) | 无任何调用方 | 死代码 |
| `orchestration/api/client.ts` (HTTP client → 18422) | 无任何调用方 | 死代码 |
| `localProjectRepository.ts` | shell 主进程 import | 活跃 |
| `fieldSyncBridge.ts` | shell 主进程 import | 活跃 |
| `memoryRepository.ts` | shell 主进程 import | 活跃 |

该包同时包含"被 shell 直接 import 的同步工具"和"调用不存在 HTTP 服务的客户端"，职责不清。

### 2.5 Feature 类型泄漏到 shared 层

`shared/store/types.ts` 定义了 `AgentMode`、`ActivePage`、`WorkspacePanel` 等概念上属于特定 feature 的类型，但放在 shared 层导致所有 feature 都能隐式感知其他 feature 的存在。

---

## 三、规范问题（Code Hygiene）

### 3.1 空占位包

| 包 | 状态 |
|----|------|
| `@orison/shared-utils` | `src/index.ts` 导出 `{}`，无任何实现 |
| `@orison/ui-kit` | `src/index.ts` 导出 `{}`，无任何实现 |
| `@orison/eslint-config` | 仅 `package.json`，无配置文件 |

这些包占据 workspace 配置但无实际价值，增加 `pnpm install` 和 `turbo` 的处理开销。

### 3.2 Video Generation 永远抛异常

`model-protocols/src/generate.ts` 中 `generateVideo()` 实现为：
```ts
throw new ProtocolNotImplementedError('generateVideo');
```

但 IPC 和 HTTP 网关都注册了 `model:generate-video` / `POST /model/generate-video` 路由，UI 中也有 `generateVideo` API 封装。整条链路从 UI 到 protocol 层都存在，但永远失败。

### 3.3 `run.sh` 引用已废弃架构

`run.sh` 仍包含 kill 端口 18422 进程和启动 `pnpm dev:agent` 的逻辑，与当前嵌入式 Agent 架构不符。

### 3.4 `tsconfig.build.tsbuildinfo` 未被 gitignore

`packages/shared-contracts/tsconfig.build.tsbuildinfo` 出现在 git status 的 untracked 文件中，应加入 `.gitignore`。

---

## 四、总结与优先级建议

| 优先级 | 问题 | 建议动作 |
|--------|------|----------|
| **P0** | Orchestration/Auto-Mode HTTP 调用指向死端口 | 将 orchestration 功能迁移为 IPC 通道（参照 `agent.ts` 模式），或在 shell 主进程中实现对应 HTTP 路由 |
| **P1** | 5+ Agent 测试文件无法编译 | 删除或重写为针对当前 `createWorkflowRuntime` API 的测试 |
| **P1** | README `pnpm dev:agent` 误导 | 删除该行，更新启动说明 |
| **P2** | Store 切片耦合 | 引入事件/订阅机制解耦 AgentSlice ↔ EditorSlice |
| **P2** | 死代码清理 | 删除 `auth.ts`、`local-bff/api/clientApi.ts`、`local-bff/orchestration/api/client.ts`、`DEFAULT_API_BASE` 常量 |
| **P2** | design.md "登录/注册"描述 | 删除该条目 |
| **P3** | 空占位包 | 删除或合并到实际使用的包中 |
| **P3** | Gateway auth 半成品 | 明确定位：若仅供本机 Agent 调用，改为固定 secret 或移除 |
| **P3** | Video generation 永远失败 | 要么移除整条链路，要么标记为 "coming soon" 并在 UI 禁用入口 |
| **P3** | `tsconfig.build.tsbuildinfo` | 加入 `.gitignore` |

---

## 五、做得好的地方

- Feature 模块之间零直接 import，通过 shared 层通信 — 水平解耦良好
- `shared-contracts` 作为跨进程类型中枢，Zod schema 即文档即验证
- Agent 嵌入式库设计 + 依赖注入（`setGenerateTextFn` / `setExecuteToolFn`）— 可测试性好
- 路径安全（`pathGuard.ts`）对所有文件操作做了沙箱校验
- Model registry 用 YAML + glob 匹配，扩展性好
- Story-sync 的 safety enforcement（白名单字段、版本校验、强制 generatedBy）设计严谨
