# Directory Skill Workflow Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/agent` 的目录 skill 执行模型升级为可自动流转的 workflow runtime，使 `SKILL.md + references/ + scripts/` 可以像 Claude Code / Codex / OpenCode 一样被结构化执行，而不是只作为 prompt 包装器。

**Architecture:** 在现有 `apps/agent` 上新增 `Skill Compiler + Skill Runtime VM` 两层。Compiler 负责把目录 skill 编译成统一 `ExecutionPlan`，VM 负责执行 `load_reference / run_script / delegate_skill / ask_user / spawn_agent / checkpoint` 等 primitive，并把 continuation 下沉到节点级恢复。

**Tech Stack:** TypeScript、Fastify、Vitest、现有 runtime/session/continuation 基础设施、当前 external skill root 支持、受控 PowerShell/script 执行链路。

---

## 文件结构

- Modify: `apps/agent/src/skill/types.ts`
- Modify: `apps/agent/src/skill/loader.ts`
- Modify: `apps/agent/src/skill/runtime/directoryAdapter.ts`
- Modify: `apps/agent/src/skill/runtime/workflowExecutor.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Modify: `apps/agent/src/context/continuation.ts`
- Modify: `apps/agent/src/context/builder.ts`
- Modify: `apps/agent/src/routes.ts`
- Create: `apps/agent/src/skill/runtime/compilerTypes.ts`
- Create: `apps/agent/src/skill/runtime/compiler.ts`
- Create: `apps/agent/src/skill/runtime/compilerRules.ts`
- Create: `apps/agent/src/skill/runtime/executionPlan.ts`
- Create: `apps/agent/src/skill/runtime/referenceResolver.ts`
- Create: `apps/agent/src/skill/runtime/scriptRunner.ts`
- Create: `apps/agent/src/skill/runtime/primitiveExecutor.ts`
- Create: `apps/agent/src/runtime/skillRunState.ts`
- Create: `apps/agent/src/runtime/skillContinuation.ts`
- Test: `apps/agent/test/skill.directoryCompiler.test.ts`
- Test: `apps/agent/test/skill.referenceResolver.test.ts`
- Test: `apps/agent/test/skill.scriptRunner.test.ts`
- Test: `apps/agent/test/skill.workflowVm.test.ts`
- Test: `apps/agent/test/routes.skillExecution.test.ts`
- Test: `apps/agent/test/routes.skillsList.test.ts`

---

### Task 1: 建立目录 Skill 编译模型

**Files:**
- Create: `apps/agent/src/skill/runtime/compilerTypes.ts`
- Create: `apps/agent/src/skill/runtime/executionPlan.ts`
- Modify: `apps/agent/src/skill/types.ts`
- Test: `apps/agent/test/skill.directoryCompiler.test.ts`

- [ ] **Step 1: 写失败测试，锁定编译输出结构**

在 `apps/agent/test/skill.directoryCompiler.test.ts` 中增加测试，覆盖：
- 目录 skill 可以编译出 `CompiledSkill`
- `ExecutionPlan` 至少包含 `instruction`、`load_reference`、`delegate_skill`、`ask_user`、`spawn_agent`、`finish`
- `Phase 1 / Phase 2` 文本会生成节点边界

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test skill.directoryCompiler.test.ts`
Expected: FAIL，因为编译器和类型尚不存在。

- [ ] **Step 3: 新增编译类型**

创建 `apps/agent/src/skill/runtime/compilerTypes.ts`，定义：
- `CompiledSkill`
- `CompiledSkillCapability`
- `PrimitiveNodeType`
- `ExecutionNode`
- `ExecutionEdge`
- `CompileWarning`

同时在 `apps/agent/src/skill/runtime/executionPlan.ts` 中定义：
- `ExecutionPlan`
- `ExecutionPlanState`
- `ExecutionCursor`

- [ ] **Step 4: 扩展 skill 基础类型**

修改 `apps/agent/src/skill/types.ts`，给 `NormalizedSkill` 增加：
- `compiledPlan?: ExecutionPlan`
- `capabilities?: string[]`
- `rawSource?: string`

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test skill.directoryCompiler.test.ts`
Expected: PASS 至少通过类型层和最小结构断言。

- [ ] **Step 6: 提交**

```bash
git add apps/agent/src/skill/runtime/compilerTypes.ts apps/agent/src/skill/runtime/executionPlan.ts apps/agent/src/skill/types.ts apps/agent/test/skill.directoryCompiler.test.ts
git commit -m "feat: add directory skill compiler core types"
```

---

### Task 2: 实现目录 Skill 半结构化编译器

**Files:**
- Create: `apps/agent/src/skill/runtime/compiler.ts`
- Create: `apps/agent/src/skill/runtime/compilerRules.ts`
- Modify: `apps/agent/src/skill/loader.ts`
- Modify: `apps/agent/src/skill/runtime/directoryAdapter.ts`
- Test: `apps/agent/test/skill.directoryCompiler.test.ts`

- [ ] **Step 1: 扩展失败测试，锁定抽取规则**

在 `apps/agent/test/skill.directoryCompiler.test.ts` 中加入 fixture，要求编译器能识别：
- `Skill("story-long-write")`
- `AskUserQuestion`
- `Agent(subagent_type: "narrative-writer", ...)`
- `加载 [references/opening-design.md](...)`
- `Phase 1 / Phase 2`

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test skill.directoryCompiler.test.ts`
Expected: FAIL，因为规则抽取尚未实现。

- [ ] **Step 3: 实现规则抽取器**

在 `apps/agent/src/skill/runtime/compilerRules.ts` 实现：
- `extractPhaseSections`
- `extractReferenceLinks`
- `extractSkillCalls`
- `extractAskUserMarkers`
- `extractAgentCalls`

第一阶段使用规则匹配，不做完整自然语言 parser。

- [ ] **Step 4: 实现编译器**

在 `apps/agent/src/skill/runtime/compiler.ts` 实现：
- `compileDirectorySkill(rawSkill)`
- 生成 `instruction` 节点
- 对识别出的引用生成 `load_reference` 节点
- 对 `Skill(...)` 生成 `delegate_skill` 节点
- 对 `AskUserQuestion` 生成 `ask_user` 节点
- 对 `Agent(...)` 生成 `spawn_agent` 节点

- [ ] **Step 5: 接入目录 skill 载入器**

修改 `apps/agent/src/skill/runtime/directoryAdapter.ts`：
- 保留 `SKILL.md` 原文
- 把编译后的 `compiledPlan` 挂到 `NormalizedSkill`
- 不再默认把目录 skill 等同为纯 `prompt`

- [ ] **Step 6: 修正 loader 行为**

修改 `apps/agent/src/skill/loader.ts`：
- 支持多行 `description`
- 保留原始 frontmatter body
- 避免丢失编译阶段需要的结构信息

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test skill.directoryCompiler.test.ts`
Expected: PASS，能编译出节点和抽取结果。

- [ ] **Step 8: 提交**

```bash
git add apps/agent/src/skill/runtime/compiler.ts apps/agent/src/skill/runtime/compilerRules.ts apps/agent/src/skill/loader.ts apps/agent/src/skill/runtime/directoryAdapter.ts apps/agent/test/skill.directoryCompiler.test.ts
git commit -m "feat: compile directory skills into execution plans"
```

---

### Task 3: 实现 Reference Resolver

**Files:**
- Create: `apps/agent/src/skill/runtime/referenceResolver.ts`
- Modify: `apps/agent/src/context/builder.ts`
- Test: `apps/agent/test/skill.referenceResolver.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/agent/test/skill.referenceResolver.test.ts`，覆盖：
- 解析 skill 内相对 reference 路径
- 读取 reference 文件内容
- 支持 `full` / `excerpt` / `summary` 三种加载模式
- 同一 run 内重复加载命中缓存

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test skill.referenceResolver.test.ts`
Expected: FAIL，因为 resolver 不存在。

- [ ] **Step 3: 实现 resolver**

在 `apps/agent/src/skill/runtime/referenceResolver.ts` 实现：
- `resolveReferencePath`
- `loadReference`
- `buildReferencePayload`
- `cacheReferenceSummary`

- [ ] **Step 4: 接入上下文构建器**

修改 `apps/agent/src/context/builder.ts`，使 skill run context 可以带：
- `resolvedReferences`
- `referenceCache`
- `requestedReferenceIds`

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test skill.referenceResolver.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/agent/src/skill/runtime/referenceResolver.ts apps/agent/src/context/builder.ts apps/agent/test/skill.referenceResolver.test.ts
git commit -m "feat: add directory skill reference resolver"
```

---

### Task 4: 实现受控 Script Runner

**Files:**
- Create: `apps/agent/src/skill/runtime/scriptRunner.ts`
- Test: `apps/agent/test/skill.scriptRunner.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/agent/test/skill.scriptRunner.test.ts`，覆盖：
- 只能执行 skill 目录白名单脚本
- 超时会失败
- stdout / stderr 能被捕获
- 参数会被 schema 校验或最小白名单过滤

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test skill.scriptRunner.test.ts`
Expected: FAIL，因为 script runner 不存在。

- [ ] **Step 3: 实现 runner**

在 `apps/agent/src/skill/runtime/scriptRunner.ts` 实现：
- `runSkillScript`
- `validateScriptPath`
- `normalizeScriptArgs`
- `collectScriptResult`

执行范围仅限 skill 根目录内 `scripts/`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test skill.scriptRunner.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/agent/src/skill/runtime/scriptRunner.ts apps/agent/test/skill.scriptRunner.test.ts
git commit -m "feat: add controlled skill script runner"
```

---

### Task 5: 把执行器升级为 Skill Workflow VM

**Files:**
- Create: `apps/agent/src/skill/runtime/primitiveExecutor.ts`
- Modify: `apps/agent/src/skill/runtime/workflowExecutor.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/skill.workflowVm.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/agent/test/skill.workflowVm.test.ts`，覆盖：
- `load_reference` 节点会自动读取 reference
- `delegate_skill` 节点会调用子 skill
- `ask_user` 节点会挂起执行
- `spawn_agent` 节点会分发 child run
- `instruction` 节点仍可走模型生成

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test skill.workflowVm.test.ts`
Expected: FAIL，因为当前执行器不支持这些 primitive。

- [ ] **Step 3: 实现 primitive executor**

在 `apps/agent/src/skill/runtime/primitiveExecutor.ts` 实现：
- `executeInstructionNode`
- `executeLoadReferenceNode`
- `executeDelegateSkillNode`
- `executeAskUserNode`
- `executeSpawnAgentNode`
- `executeCheckpointNode`

- [ ] **Step 4: 升级 workflowExecutor**

修改 `apps/agent/src/skill/runtime/workflowExecutor.ts`：
- 优先执行 `compiledPlan`
- 保持对旧 `workflow.steps` 的兼容
- 支持节点游标推进
- 返回结构化 `nodeResults`

- [ ] **Step 5: 接入 runtime**

修改 `apps/agent/src/runtime/workflow.ts`：
- `executeSkillByName` 走 VM
- 处理 `ask_user` 的 pending 状态
- 处理 nested skill 和 child session 结果

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test skill.workflowVm.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add apps/agent/src/skill/runtime/primitiveExecutor.ts apps/agent/src/skill/runtime/workflowExecutor.ts apps/agent/src/runtime/workflow.ts apps/agent/test/skill.workflowVm.test.ts
git commit -m "feat: upgrade skill executor into workflow vm"
```

---

### Task 6: 新增节点级 Skill Run State 与 Continuation

**Files:**
- Create: `apps/agent/src/runtime/skillRunState.ts`
- Create: `apps/agent/src/runtime/skillContinuation.ts`
- Modify: `apps/agent/src/context/continuation.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/skill.workflowVm.test.ts`

- [ ] **Step 1: 扩展失败测试**

在 `apps/agent/test/skill.workflowVm.test.ts` 中加入：
- 执行到 `ask_user` 节点时保存 `currentNodeId`
- restore 后从该节点继续
- 已加载 reference 不重复读
- 已完成节点不会重复执行

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test skill.workflowVm.test.ts`
Expected: FAIL，因为当前 continuation 不是节点级。

- [ ] **Step 3: 实现 skill run state**

在 `apps/agent/src/runtime/skillRunState.ts` 定义：
- `SkillRunState`
- `currentNodeId`
- `completedNodeIds`
- `loadedReferenceKeys`
- `writtenArtifactIds`
- `pendingUserAction`

- [ ] **Step 4: 实现 skill continuation**

在 `apps/agent/src/runtime/skillContinuation.ts` 实现：
- `createSkillContinuation`
- `restoreSkillContinuation`
- `mergeConversationSummaryWithRunState`

- [ ] **Step 5: 接入现有 continuation**

修改 `apps/agent/src/context/continuation.ts` 和 `apps/agent/src/runtime/workflow.ts`：
- continuation payload 中挂 skill run state
- restore API 返回可续跑信息

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test skill.workflowVm.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add apps/agent/src/runtime/skillRunState.ts apps/agent/src/runtime/skillContinuation.ts apps/agent/src/context/continuation.ts apps/agent/src/runtime/workflow.ts apps/agent/test/skill.workflowVm.test.ts
git commit -m "feat: add node-level skill continuation state"
```

---

### Task 7: 让 `oh-story` 走通真实目录 Skill 流程

**Files:**
- Modify: `apps/agent/src/skill/runtime/ohStoryAdapter.ts`
- Modify: `apps/agent/test/routes.skillExecution.test.ts`
- Modify: `apps/agent/test/routes.skillsList.test.ts`

- [ ] **Step 1: 写失败测试**

扩展 `apps/agent/test/routes.skillExecution.test.ts`，要求：
- 默认 external root 下 `story` 可加载
- `story` 会编译并自动 `delegate_skill`
- `story-long-write` 会自动触发至少一个 `load_reference`
- `story-review` 的 `spawn_agent` 节点可落到 child session stub

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test routes.skillExecution.test.ts`
Expected: FAIL，因为当前 `ohStoryAdapter` 仍以过渡逻辑为主。

- [ ] **Step 3: 收缩 adapter 角色**

修改 `apps/agent/src/skill/runtime/ohStoryAdapter.ts`：
- 不再直接承担主要执行逻辑
- 只做少量兼容修正
- 默认执行路径交给目录 skill 编译器 + VM

- [ ] **Step 4: 更新技能列表断言**

修改 `apps/agent/test/routes.skillsList.test.ts`：
- 断言默认 root 下 `story`、`story-long-write` 等 skill 可见
- 断言来源为 `external`

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @orison/agent test routes.skillExecution.test.ts routes.skillsList.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/agent/src/skill/runtime/ohStoryAdapter.ts apps/agent/test/routes.skillExecution.test.ts apps/agent/test/routes.skillsList.test.ts
git commit -m "refactor: route oh-story through directory skill workflow runtime"
```

---

### Task 8: Host API 收口与最终验证

**Files:**
- Modify: `apps/agent/src/routes.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/routes.skillExecution.test.ts`
- Test: `apps/agent/test/routes.skillsList.test.ts`
- Test: `apps/agent/test/routes.runtimeCompatibility.test.ts`

- [ ] **Step 1: 写失败测试，锁定宿主行为**

在现有 route 测试中补充：
- `GET /v1/agent/skills` 返回 capability-aware skill list
- `POST /v1/agent/sessions/:id/skills/:skillName/execute` 返回 node-aware continuation
- `POST /v1/agent/sessions/:id/continuations/restore` 返回可恢复的 workflow state

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @orison/agent test routes.skillExecution.test.ts routes.skillsList.test.ts routes.runtimeCompatibility.test.ts`
Expected: FAIL，只在 API 适配未完成处失败。

- [ ] **Step 3: 调整 routes**

修改 `apps/agent/src/routes.ts`：
- skill execute 响应带 `workflowState.currentNodeId`
- continuation restore 响应带 `skillRunState`
- 保持现有 UI/host 可兼容字段

- [ ] **Step 4: 跑相关测试确认通过**

Run: `pnpm --filter @orison/agent test routes.skillExecution.test.ts routes.skillsList.test.ts routes.runtimeCompatibility.test.ts`
Expected: PASS

- [ ] **Step 5: 跑 typecheck**

Run: `pnpm --filter @orison/agent typecheck`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/agent/src/routes.ts apps/agent/src/runtime/workflow.ts apps/agent/test/routes.skillExecution.test.ts apps/agent/test/routes.skillsList.test.ts apps/agent/test/routes.runtimeCompatibility.test.ts
git commit -m "feat: expose workflow-aware directory skill runtime APIs"
```

---

## Self-Review

### Spec 覆盖

- Skill Compiler：Task 1、Task 2
- Reference / Script primitive：Task 3、Task 4
- Workflow VM：Task 5
- 节点级 continuation：Task 6
- `oh-story` 实战兼容：Task 7
- Host API 收口：Task 8

### Placeholder 扫描

- 未保留 `TODO` / `TBD`
- 每个任务都包含了具体文件路径和验证命令
- 没有“写测试”这种空泛步骤，均有明确覆盖点

### 类型一致性

- 统一围绕 `CompiledSkill`、`ExecutionPlan`、`SkillRunState`
- 不再新增小说特化 runtime 类型
- 目录 skill 与 manifest skill 最终都落到 `ExecutionPlan`

## Execution Handoff

Plan complete and saved to [2026-05-18-directory-skill-workflow-runtime-plan.md](docs/superpowers/plans/2026-05-18-directory-skill-workflow-runtime-plan.md). Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
