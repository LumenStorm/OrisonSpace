# Data Flow Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复保存、跨项目异步、Agent runtime 和 `project.yaml` 写入链路中的数据一致性缺陷。

**Architecture:** 保存操作以内容快照确认落盘，项目异步操作以 epoch/token 隔离，Agent session 配置通过显式 IPC 持久化，`project.yaml` 由带锁的结构化 mutation 独占写入。

**Tech Stack:** TypeScript、Zustand、Electron IPC、Vitest、pnpm/Turborepo。

---

### Task 1: 保存快照与失败传播

**Files:**
- Modify: `apps/desktop/client/ui/src/shared/store/fileTabsSlice.ts`
- Modify: `apps/desktop/client/ui/src/shared/store/projectSlice.ts`
- Modify: `apps/desktop/client/ui/src/shared/hooks/useAutoSave.ts`
- Modify: `apps/desktop/client/ui/src/features/top-bar/TopBar.tsx`
- Test: `apps/desktop/client/ui/test/fileTabsSlice.test.ts`
- Test: `apps/desktop/client/ui/test/projectSlice.test.ts`

- [ ] 新增 deferred write 测试，证明保存 A 期间编辑 B 后仍保持 dirty。
- [ ] 新增保存失败时不关闭项目、不刷新磁盘字数、不显示成功的测试。
- [ ] 运行专项测试确认失败。
- [ ] 让 `saveFile` 只确认实际写入的快照，并统一传播 `{ failed }`。
- [ ] 运行 UI 专项测试确认通过。

### Task 2: 后台任务项目隔离

**Files:**
- Modify: `apps/desktop/client/ui/src/shared/store/backgroundTasksSlice.ts`
- Modify: `apps/desktop/client/ui/src/shared/store/projectSubscription.ts`
- Test: `apps/desktop/client/ui/test/backgroundTasksSlice.test.ts`

- [ ] 新增 A/B 项目加载逆序完成测试和任务迟到完成测试。
- [ ] 运行测试确认旧结果会污染新项目。
- [ ] 增加 reset、load token 和 project id guard，同时保留原项目持久化。
- [ ] 运行专项测试确认通过。

### Task 3: Agent 项目隔离与权限模式

**Files:**
- Modify: `apps/desktop/client/ui/src/shared/store/agentSessionSlice.ts`
- Modify: `apps/desktop/client/ui/src/shared/api/agent.ts`
- Modify: `apps/desktop/client/shell/main/ipc/agentIpc.ts`
- Modify: `apps/desktop/client/shell/preload/index.ts`
- Modify: `packages/shared-contracts/src/ipc.ts`
- Modify: `apps/desktop/agent/src/runtime/workflow.ts`
- Modify: `apps/desktop/agent/src/agent/session.ts`
- Test: `apps/desktop/client/ui/test/agentProjectSwitchReset.test.tsx`
- Test: `apps/desktop/agent/test/runtime.permission.test.ts`

- [ ] 新增迟到 create/list/switch session 不回写新项目的测试。
- [ ] 新增已有 session 权限切换成功、失败回滚和持久化测试。
- [ ] 实现 project epoch、operation token 和 `setSessionPermissionMode` IPC。
- [ ] 运行 UI、Shell、Agent 专项测试确认通过。

### Task 4: Agent 取消信号贯通

**Files:**
- Modify: `apps/desktop/client/shell/main/ipc/modelGatewayIpc.ts`
- Modify: `apps/desktop/client/shell/main/ipc/agentIpc.ts`
- Modify: `apps/desktop/client/shell/main/ipc/toolHandlers/types.ts`
- Modify: `apps/desktop/client/shell/main/ipc/toolHandlers/index.ts`
- Modify: `apps/desktop/agent/src/agent/loop.ts`
- Modify: `apps/desktop/agent/src/runtime/workflow.ts`
- Modify: `apps/desktop/agent/src/runtime/runState.ts`
- Test: `apps/desktop/agent/test/runtime.workflow.test.ts`

- [ ] 新增 provider 忽略 signal 后迟到返回的取消回归测试。
- [ ] 将 signal 传到模型和工具边界，并在持久化/完成前二次校验。
- [ ] 用 run identity 防止旧运行覆盖新运行。
- [ ] 运行 Agent 与 Shell 专项测试确认通过。

### Task 5: project.yaml 唯一写入者

**Files:**
- Modify: `apps/desktop/client/shell/main/ipc/projectFileIpc.ts`
- Modify: `apps/desktop/client/shell/main/ipc/toolHandlers/fileHandlers.ts`
- Modify: `apps/desktop/client/shell/main/ipc/projectMetaIpc.ts`
- Modify: `apps/desktop/client/ui/src/features/editor/TextFileEditor.tsx`
- Modify: `apps/desktop/client/ui/src/shared/store/novelChapterSlice.ts`
- Modify: `packages/shared-contracts/src/ipc.ts`
- Test: `apps/desktop/client/shell/test/projectFileIpc.test.ts`
- Test: `apps/desktop/client/ui/test/projectSlice.test.ts`

- [ ] 新增通用 UI/Agent 写入、重命名和删除 `project.yaml` 被拒绝的测试。
- [ ] 新增章节 mutation 失败传播测试。
- [ ] 增加受保护路径 guard、只读编辑状态和 typed mutation result。
- [ ] 运行 UI、Shell、contracts 专项测试确认通过。

### Task 6: 集成验证与复审

- [ ] 运行所有新增专项测试。
- [ ] 运行 `pnpm test`。
- [ ] 运行 `pnpm typecheck`。
- [ ] 运行 `pnpm lint`。
- [ ] 检查 `git diff`，确认没有无关修改和现有未跟踪文件变更。
- [ ] 按原七项 finding 逐项复审并记录残余风险。

> 根据项目 AGENTS.md，本计划不包含任何 Git 提交步骤。
