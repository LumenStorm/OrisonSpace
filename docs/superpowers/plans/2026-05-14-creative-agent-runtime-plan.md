# Creative Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `apps/agent` into a desktop-first creative runtime that supports session trees, subagents, permission gates, workflow-grade skill execution, dual-format skill loading, and creative-task compaction without migrating external story skill content.

**Architecture:** Keep the current Fastify host entry points and desktop shell tool bridge, but move orchestration into new runtime services under `apps/agent/src`. Implement the refactor in place: first introduce runtime boundaries, then session tree and permission services, then dual-format skill workflow execution, then context/compaction and host compatibility hardening.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, existing desktop shell HTTP tool bridge, desktop UI fetch/SSE client, existing agent package build and test scripts.

---

## File Structure

- Modify: `apps/agent/src/app.ts`
- Modify: `apps/agent/src/routes.ts`
- Modify: `apps/agent/src/types.ts`
- Modify: `apps/agent/src/agent/session.ts`
- Modify: `apps/agent/src/agent/loop.ts`
- Modify: `apps/agent/src/agent/persistence.ts`
- Modify: `apps/agent/src/skill/discovery.ts`
- Modify: `apps/agent/src/skill/loader.ts`
- Modify: `apps/agent/src/skill/types.ts`
- Modify: `apps/agent/src/tool/builtin.ts`
- Modify: `apps/agent/src/tool/registry.ts`
- Modify: `apps/agent/src/tool/remote.ts`
- Modify: `apps/desktop/ui/src/shared/api/agent.ts`
- Modify: `apps/server/src/modules/agent/proxy.ts`
- Create: `apps/agent/src/runtime/sessionTree.ts`
- Create: `apps/agent/src/runtime/runState.ts`
- Create: `apps/agent/src/runtime/permission.ts`
- Create: `apps/agent/src/runtime/subagent.ts`
- Create: `apps/agent/src/runtime/workflow.ts`
- Create: `apps/agent/src/skill/runtime/registry.ts`
- Create: `apps/agent/src/skill/runtime/normalize.ts`
- Create: `apps/agent/src/skill/runtime/directoryAdapter.ts`
- Create: `apps/agent/src/skill/runtime/manifestAdapter.ts`
- Create: `apps/agent/src/skill/runtime/workflowExecutor.ts`
- Create: `apps/agent/src/context/builder.ts`
- Create: `apps/agent/src/context/compaction.ts`
- Create: `apps/agent/src/context/continuation.ts`
- Create: `apps/agent/src/artifact/types.ts`
- Create: `apps/agent/src/artifact/store.ts`
- Test: `apps/agent/test/runtime.sessionTree.test.ts`
- Test: `apps/agent/test/runtime.permission.test.ts`
- Test: `apps/agent/test/runtime.subagent.test.ts`
- Test: `apps/agent/test/runtime.workflow.test.ts`
- Test: `apps/agent/test/skill.directoryAdapter.test.ts`
- Test: `apps/agent/test/skill.manifestAdapter.test.ts`
- Test: `apps/agent/test/skill.workflowExecutor.test.ts`
- Test: `apps/agent/test/context.compaction.test.ts`
- Test: `apps/agent/test/routes.runtimeCompatibility.test.ts`

---

### Task 1: Lock the Runtime Boundary

**Files:**
- Modify: `apps/agent/src/app.ts`
- Modify: `apps/agent/src/routes.ts`
- Modify: `apps/agent/src/types.ts`
- Create: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/routes.runtimeCompatibility.test.ts`

- [ ] **Step 1: Write the failing runtime-compatibility test**

Create `apps/agent/test/routes.runtimeCompatibility.test.ts` with coverage for:
- session creation still returns `id`
- message route still returns assistant/tool payload shape
- stream route still exposes SSE events

- [ ] **Step 2: Run the new test to verify it fails**

Run: `pnpm --filter @orison/agent test runtimeCompatibility.test.ts`
Expected: FAIL because the runtime entry service and test fixture do not exist yet.

- [ ] **Step 3: Introduce a runtime entry contract**

Add a new orchestration-facing service in `apps/agent/src/runtime/workflow.ts` that owns:
- create session request handling
- send message request handling
- stream request handling

Keep route code as translation only. Do not move full logic in one shot; define the interface first and stub through existing code.

- [ ] **Step 4: Rewire `routes.ts` to call the runtime entry service**

Update `apps/agent/src/routes.ts` so route handlers delegate to runtime methods rather than owning orchestration logic directly.

- [ ] **Step 5: Update shared agent types**

Extend `apps/agent/src/types.ts` with runtime-facing types for:
- workflow run status
- runtime event payloads
- pending confirmation state

Do not introduce domain-specific story fields.

- [ ] **Step 6: Run the compatibility test again**

Run: `pnpm --filter @orison/agent test runtimeCompatibility.test.ts`
Expected: PASS

- [ ] **Step 7: Run package typecheck**

Run: `pnpm --filter @orison/agent typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/agent/src/app.ts apps/agent/src/routes.ts apps/agent/src/types.ts apps/agent/src/runtime/workflow.ts apps/agent/test/routes.runtimeCompatibility.test.ts
git commit -m "refactor: introduce creative runtime entry boundary"
```

---

### Task 2: Add Session Tree Primitives

**Files:**
- Create: `apps/agent/src/runtime/sessionTree.ts`
- Modify: `apps/agent/src/agent/session.ts`
- Modify: `apps/agent/src/agent/persistence.ts`
- Modify: `apps/agent/src/types.ts`
- Test: `apps/agent/test/runtime.sessionTree.test.ts`

- [ ] **Step 1: Write the failing session-tree test**

Create `apps/agent/test/runtime.sessionTree.test.ts` covering:
- creating a primary session
- creating a child session with `parentId`
- listing children of a parent session
- forking an existing session branch

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orison/agent test runtime.sessionTree.test.ts`
Expected: FAIL because session tree APIs do not exist.

- [ ] **Step 3: Add session tree types**

Update `apps/agent/src/types.ts` to add:
- `parentId?: string`
- `children?: string[]`
- `branchFromMessageId?: string`
- `sessionRole?: 'primary' | 'child' | 'fork'`

- [ ] **Step 4: Implement `sessionTree.ts`**

Add runtime helpers for:
- `createPrimarySession`
- `createChildSession`
- `forkSession`
- `listChildren`

Keep these as runtime services over existing session storage.

- [ ] **Step 5: Update session persistence**

Modify `apps/agent/src/agent/persistence.ts` and `apps/agent/src/agent/session.ts` so new session metadata is persisted and recoverable.

- [ ] **Step 6: Run the session-tree test again**

Run: `pnpm --filter @orison/agent test runtime.sessionTree.test.ts`
Expected: PASS

- [ ] **Step 7: Run focused regression tests for current session behavior**

Run: `pnpm --filter @orison/agent test orchestration.routes.test.ts env.test.ts`
Expected: PASS or targeted failures only if test fixtures require updates for new metadata.

- [ ] **Step 8: Commit**

```bash
git add apps/agent/src/runtime/sessionTree.ts apps/agent/src/agent/session.ts apps/agent/src/agent/persistence.ts apps/agent/src/types.ts apps/agent/test/runtime.sessionTree.test.ts
git commit -m "feat: add session tree primitives for creative runtime"
```

---

### Task 3: Add Runtime Run State and Abort/Resume Control

**Files:**
- Create: `apps/agent/src/runtime/runState.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Modify: `apps/agent/src/agent/loop.ts`
- Test: `apps/agent/test/runtime.workflow.test.ts`

- [ ] **Step 1: Write the failing run-state test**

Create `apps/agent/test/runtime.workflow.test.ts` covering:
- marking a session as running
- preventing overlapping runs in the same session
- aborting an in-flight run
- resuming a checkpointed run skeleton

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orison/agent test runtime.workflow.test.ts`
Expected: FAIL because run-state coordination does not exist.

- [ ] **Step 3: Implement `runState.ts`**

Add runtime state management for:
- idle/running/completed/error/aborted
- active abort controller per session
- resumable checkpoint metadata placeholder

- [ ] **Step 4: Rewire `agent/loop.ts` to use runtime run-state ownership**

Update the loop entry path so each run registers with run-state before execution and releases state after completion or abort.

- [ ] **Step 5: Update workflow entry methods**

Modify `apps/agent/src/runtime/workflow.ts` to:
- reject overlapping runs
- expose abort hooks
- store minimal resume metadata

- [ ] **Step 6: Run the run-state test again**

Run: `pnpm --filter @orison/agent test runtime.workflow.test.ts`
Expected: PASS

- [ ] **Step 7: Run loop-related regression tests**

Run: `pnpm --filter @orison/agent test orchestration.runService.test.ts orchestration.routes.test.ts`
Expected: PASS or limited fixture updates only.

- [ ] **Step 8: Commit**

```bash
git add apps/agent/src/runtime/runState.ts apps/agent/src/runtime/workflow.ts apps/agent/src/agent/loop.ts apps/agent/test/runtime.workflow.test.ts
git commit -m "feat: add runtime run-state management"
```

---

### Task 4: Introduce Runtime Permission Service

**Files:**
- Create: `apps/agent/src/runtime/permission.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Modify: `apps/agent/src/types.ts`
- Modify: `apps/desktop/ui/src/shared/api/agent.ts`
- Modify: `apps/server/src/modules/agent/proxy.ts`
- Test: `apps/agent/test/runtime.permission.test.ts`

- [ ] **Step 1: Write the failing permission test**

Create `apps/agent/test/runtime.permission.test.ts` covering:
- `allow`
- `ask`
- `deny`
- storing a pending confirmation item for a session

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orison/agent test runtime.permission.test.ts`
Expected: FAIL because runtime permission service does not exist.

- [ ] **Step 3: Implement permission rule evaluation**

Add `apps/agent/src/runtime/permission.ts` with support for:
- permission class
- pattern match
- action resolution
- pending confirmation queue

Use creative-operation classes, not story-only semantics.

- [ ] **Step 4: Add confirm endpoint support to runtime**

Update `apps/agent/src/runtime/workflow.ts` and `apps/agent/src/types.ts` so the runtime can:
- register a pending confirmation
- accept or reject it
- continue or fail the run accordingly

- [ ] **Step 5: Align desktop UI and proxy expectations**

Update:
- `apps/desktop/ui/src/shared/api/agent.ts`
- `apps/server/src/modules/agent/proxy.ts`

so the existing confirm route maps to the new runtime permission model instead of staying as dead compatibility surface.

- [ ] **Step 6: Run the permission test again**

Run: `pnpm --filter @orison/agent test runtime.permission.test.ts`
Expected: PASS

- [ ] **Step 7: Run focused host integration tests**

Run: `pnpm --filter @orison/agent test runtime.permission.test.ts runtimeCompatibility.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/agent/src/runtime/permission.ts apps/agent/src/runtime/workflow.ts apps/agent/src/types.ts apps/desktop/ui/src/shared/api/agent.ts apps/server/src/modules/agent/proxy.ts apps/agent/test/runtime.permission.test.ts
git commit -m "feat: add runtime permission and confirmation flow"
```

---

### Task 5: Add Controlled Subagent Dispatch

**Files:**
- Create: `apps/agent/src/runtime/subagent.ts`
- Modify: `apps/agent/src/runtime/sessionTree.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/runtime.subagent.test.ts`

- [ ] **Step 1: Write the failing subagent test**

Create `apps/agent/test/runtime.subagent.test.ts` covering:
- starting a child runtime session for a subagent
- inheriting a narrowed permission envelope
- preserving parent/child linkage
- bubbling completion result back to the parent workflow

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orison/agent test runtime.subagent.test.ts`
Expected: FAIL because subagent runtime does not exist.

- [ ] **Step 3: Implement subagent runtime service**

Add `apps/agent/src/runtime/subagent.ts` with:
- role selection
- child session creation
- narrowed permission scope
- result handoff contract

- [ ] **Step 4: Integrate subagent ownership into workflow runtime**

Modify `apps/agent/src/runtime/workflow.ts` to dispatch nested work through the subagent service rather than raw recursive loop usage.

- [ ] **Step 5: Run the subagent test again**

Run: `pnpm --filter @orison/agent test runtime.subagent.test.ts`
Expected: PASS

- [ ] **Step 6: Run current task-related regression tests**

Run: `pnpm --filter @orison/agent test orchestration.actions.test.ts orchestration.services.test.ts`
Expected: PASS or limited fixture updates if they assumed flat sessions.

- [ ] **Step 7: Commit**

```bash
git add apps/agent/src/runtime/subagent.ts apps/agent/src/runtime/sessionTree.ts apps/agent/src/runtime/workflow.ts apps/agent/test/runtime.subagent.test.ts
git commit -m "feat: add controlled creative subagent dispatch"
```

---

### Task 6: Normalize Dual-Format Skills

**Files:**
- Create: `apps/agent/src/skill/runtime/normalize.ts`
- Create: `apps/agent/src/skill/runtime/directoryAdapter.ts`
- Create: `apps/agent/src/skill/runtime/manifestAdapter.ts`
- Modify: `apps/agent/src/skill/discovery.ts`
- Modify: `apps/agent/src/skill/loader.ts`
- Modify: `apps/agent/src/skill/types.ts`
- Test: `apps/agent/test/skill.directoryAdapter.test.ts`
- Test: `apps/agent/test/skill.manifestAdapter.test.ts`

- [ ] **Step 1: Write the failing directory-skill adapter test**

Create `apps/agent/test/skill.directoryAdapter.test.ts` using a fixture skill with:
- `SKILL.md`
- `references/`
- `scripts/`

Verify normalization into one internal skill definition shape.

- [ ] **Step 2: Write the failing manifest-skill adapter test**

Create `apps/agent/test/skill.manifestAdapter.test.ts` using a fixture manifest skill and verify it normalizes into the same shape as the directory skill.

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm --filter @orison/agent test skill.directoryAdapter.test.ts skill.manifestAdapter.test.ts`
Expected: FAIL because adapters and normalized types do not exist.

- [ ] **Step 4: Extend skill types**

Update `apps/agent/src/skill/types.ts` with normalized runtime-facing types:
- `SkillDefinition`
- `WorkflowDefinition`
- `SkillFormat`

- [ ] **Step 5: Implement directory adapter**

Create `apps/agent/src/skill/runtime/directoryAdapter.ts` to parse:
- `SKILL.md`
- references
- scripts

and infer runtime metadata where absent.

- [ ] **Step 6: Implement manifest adapter**

Create `apps/agent/src/skill/runtime/manifestAdapter.ts` to parse explicit native skill metadata.

- [ ] **Step 7: Implement shared normalization**

Create `apps/agent/src/skill/runtime/normalize.ts` so both adapters return the same internal shape and the rest of the runtime never branches on source format.

- [ ] **Step 8: Update discovery and loader**

Modify `apps/agent/src/skill/discovery.ts` and `apps/agent/src/skill/loader.ts` so discovery can surface both directory and manifest skill candidates.

- [ ] **Step 9: Run both adapter tests again**

Run: `pnpm --filter @orison/agent test skill.directoryAdapter.test.ts skill.manifestAdapter.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/agent/src/skill/runtime/normalize.ts apps/agent/src/skill/runtime/directoryAdapter.ts apps/agent/src/skill/runtime/manifestAdapter.ts apps/agent/src/skill/discovery.ts apps/agent/src/skill/loader.ts apps/agent/src/skill/types.ts apps/agent/test/skill.directoryAdapter.test.ts apps/agent/test/skill.manifestAdapter.test.ts
git commit -m "feat: normalize directory and manifest skills"
```

---

### Task 7: Add Skill Registry and Workflow Executor

**Files:**
- Create: `apps/agent/src/skill/runtime/registry.ts`
- Create: `apps/agent/src/skill/runtime/workflowExecutor.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Modify: `apps/agent/src/tool/builtin.ts`
- Test: `apps/agent/test/skill.workflowExecutor.test.ts`

- [ ] **Step 1: Write the failing workflow-executor test**

Create `apps/agent/test/skill.workflowExecutor.test.ts` covering:
- single skill execution
- multi-step workflow execution
- checkpoint creation
- confirmation pause
- nested skill invocation

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orison/agent test skill.workflowExecutor.test.ts`
Expected: FAIL because workflow execution services do not exist.

- [ ] **Step 3: Implement skill registry**

Create `apps/agent/src/skill/runtime/registry.ts` to:
- register normalized skills
- list skills
- resolve by trigger or id
- prepare workflow definitions

- [ ] **Step 4: Implement workflow executor**

Create `apps/agent/src/skill/runtime/workflowExecutor.ts` to process:
- prompt nodes
- tool nodes
- skill nodes
- review/confirm/checkpoint nodes

Keep branching simple and bounded.

- [ ] **Step 5: Connect the executor to the runtime entry**

Modify `apps/agent/src/runtime/workflow.ts` so skill-oriented requests go through the executor rather than plain prompt summary injection.

- [ ] **Step 6: Update builtin tool exposure if needed**

Modify `apps/agent/src/tool/builtin.ts` only where necessary so runtime workflow steps can request tool capability through the registry cleanly.

- [ ] **Step 7: Run the workflow-executor test again**

Run: `pnpm --filter @orison/agent test skill.workflowExecutor.test.ts`
Expected: PASS

- [ ] **Step 8: Run focused runtime regression tests**

Run: `pnpm --filter @orison/agent test runtime.workflow.test.ts runtime.subagent.test.ts skill.workflowExecutor.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/agent/src/skill/runtime/registry.ts apps/agent/src/skill/runtime/workflowExecutor.ts apps/agent/src/runtime/workflow.ts apps/agent/src/tool/builtin.ts apps/agent/test/skill.workflowExecutor.test.ts
git commit -m "feat: add workflow-grade skill execution runtime"
```

---

### Task 8: Add Lightweight Artifact and Context Services

**Files:**
- Create: `apps/agent/src/artifact/types.ts`
- Create: `apps/agent/src/artifact/store.ts`
- Create: `apps/agent/src/context/builder.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/context.compaction.test.ts`

- [ ] **Step 1: Write the failing context test**

Create `apps/agent/test/context.compaction.test.ts` covering:
- selecting only relevant runtime context for a skill run
- preserving referenced artifacts separately from conversation summary

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orison/agent test context.compaction.test.ts`
Expected: FAIL because artifact/context services do not exist.

- [ ] **Step 3: Add lightweight artifact types**

Create `apps/agent/src/artifact/types.ts` with generic artifact categories:
- `document`
- `outline`
- `entity`
- `relationship`
- `timeline`
- `beat`
- `reference`
- `review_report`
- `task_brief`

- [ ] **Step 4: Add artifact store service**

Create `apps/agent/src/artifact/store.ts` with minimal methods:
- list
- read
- write
- attach to run
- record review output

Do not build domain-deep schema logic in this step.

- [ ] **Step 5: Add context builder**

Create `apps/agent/src/context/builder.ts` to assemble:
- current run state
- selected artifacts
- recent summaries
- related references

for a given skill invocation.

- [ ] **Step 6: Run the context test again**

Run: `pnpm --filter @orison/agent test context.compaction.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/agent/src/artifact/types.ts apps/agent/src/artifact/store.ts apps/agent/src/context/builder.ts apps/agent/src/runtime/workflow.ts apps/agent/test/context.compaction.test.ts
git commit -m "feat: add lightweight artifact and context services"
```

---

### Task 9: Add Creative Compaction and Continuation Snapshots

**Files:**
- Create: `apps/agent/src/context/compaction.ts`
- Create: `apps/agent/src/context/continuation.ts`
- Modify: `apps/agent/src/agent/compaction.ts`
- Modify: `apps/agent/src/runtime/workflow.ts`
- Test: `apps/agent/test/context.compaction.test.ts`

- [ ] **Step 1: Extend the existing context test with continuation coverage**

Add cases for:
- conversation summary generation
- workflow state snapshot generation
- restoring a continuation without replaying full message history

- [ ] **Step 2: Run the updated test to verify it fails**

Run: `pnpm --filter @orison/agent test context.compaction.test.ts`
Expected: FAIL because continuation services do not exist.

- [ ] **Step 3: Implement creative compaction service**

Create `apps/agent/src/context/compaction.ts` to produce:
- `conversationSummary`
- `workflowStateSnapshot`
- `referencedArtifactMemory`

- [ ] **Step 4: Implement continuation model**

Create `apps/agent/src/context/continuation.ts` to:
- save a resumable continuation payload
- restore runtime state from that payload

- [ ] **Step 5: Rewire existing compaction entry point**

Modify `apps/agent/src/agent/compaction.ts` so it delegates to the new creative compaction service rather than remaining a stand-alone legacy utility.

- [ ] **Step 6: Run the updated compaction test again**

Run: `pnpm --filter @orison/agent test context.compaction.test.ts`
Expected: PASS

- [ ] **Step 7: Run broader regression tests**

Run: `pnpm --filter @orison/agent test context.compaction.test.ts orchestration.configLoader.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/agent/src/context/compaction.ts apps/agent/src/context/continuation.ts apps/agent/src/agent/compaction.ts apps/agent/src/runtime/workflow.ts apps/agent/test/context.compaction.test.ts
git commit -m "feat: add creative compaction and continuation snapshots"
```

---

### Task 10: Harden Host Compatibility and Final Verification

**Files:**
- Modify: `apps/agent/src/routes.ts`
- Modify: `apps/desktop/ui/src/shared/api/agent.ts`
- Modify: `apps/server/src/modules/agent/proxy.ts`
- Test: `apps/agent/test/routes.runtimeCompatibility.test.ts`

- [x] **Step 1: Update compatibility test for final runtime behavior**

Make sure `apps/agent/test/routes.runtimeCompatibility.test.ts` checks:
- create session
- send message
- stream events
- confirm route
- status handling with runtime-backed state

- [x] **Step 2: Run the compatibility test to verify remaining gaps**

Run: `pnpm --filter @orison/agent test routes.runtimeCompatibility.test.ts`
Expected: FAIL only if route/UI/proxy layers still assume legacy behavior.

- [x] **Step 3: Align route payloads**

Modify `apps/agent/src/routes.ts` so the runtime-backed responses remain compatible with current desktop consumers wherever possible.

- [x] **Step 4: Align desktop UI client**

Modify `apps/desktop/ui/src/shared/api/agent.ts` so the client handles:
- runtime confirmation requests
- workflow status events
- any evolved message payload shape

- [x] **Step 5: Align server proxy**

Modify `apps/server/src/modules/agent/proxy.ts` so supported runtime routes remain proxied cleanly, including confirm and stream behavior.

- [x] **Step 6: Run focused agent tests**

Run: `pnpm --filter @orison/agent test runtime.sessionTree.test.ts runtime.permission.test.ts runtime.subagent.test.ts runtime.workflow.test.ts skill.directoryAdapter.test.ts skill.manifestAdapter.test.ts skill.workflowExecutor.test.ts context.compaction.test.ts routes.runtimeCompatibility.test.ts`
Expected: PASS

- [x] **Step 7: Run package typecheck**

Run: `pnpm --filter @orison/agent typecheck`
Expected: PASS

- [x] **Step 8: Run server and UI typechecks if touched types changed**

Run: `pnpm --filter @orison/server typecheck`
Expected: PASS

Run: `pnpm --filter @orison/desktop-ui typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/agent/src/routes.ts apps/desktop/ui/src/shared/api/agent.ts apps/server/src/modules/agent/proxy.ts apps/agent/test/routes.runtimeCompatibility.test.ts
git commit -m "refactor: complete creative runtime host compatibility"
```

---

## Execution Status

Tasks 1 through 10 are now implemented at the code level.

Additional implementation notes beyond the original task wording:

- skill execution responses now include an explicit continuation snapshot payload
- `GET /v1/agent/skills` is runtime-config aware and merges project-local plus external skill roots
- the desktop Agent Panel now surfaces a minimal skills list with refresh and direct execution actions
- session persistence includes automatic SQLite schema migration for pre-session-tree `sessions` indexes

Validation completed:

- focused agent runtime tests covering session tree, permission, subagent, workflow, skill adapters, workflow executor, context compaction, compatibility routes, skills list, skill execution, and SQLite schema migration
- `pnpm --filter @orison/agent typecheck`
- `pnpm --filter @orison/server test agentProxy.test.ts`
- `pnpm --filter @orison/server typecheck`
- `pnpm --filter @orison/desktop-ui test agentPanelSkills.test.tsx workspaceLayout.test.tsx`
- `pnpm --filter @orison/desktop-ui typecheck`

## Self-Review

### Spec coverage

- Runtime layering is covered by Tasks 1 and 10.
- Session tree, subagent, permission, and run state are covered by Tasks 2 through 5.
- Dual-format skills and workflow execution are covered by Tasks 6 and 7.
- Lightweight artifacts, context builder, compaction, and continuation are covered by Tasks 8 and 9.
- Desktop-first host compatibility is covered by Tasks 1, 4, and 10.

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" markers remain.
- Each task names exact files and concrete verification commands.
- Each test step includes a concrete command and expected outcome.

### Type consistency

- Runtime orchestration centers on `apps/agent/src/runtime/workflow.ts`.
- Skill normalization is isolated under `apps/agent/src/skill/runtime/*`.
- Context compaction and continuation live under `apps/agent/src/context/*`.
- Session tree and permission remain runtime services, not UI-only helpers.

## Execution Handoff

Plan complete and saved to [2026-05-14-creative-agent-runtime-plan.md](docs/superpowers/plans/2026-05-14-creative-agent-runtime-plan.md). Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
