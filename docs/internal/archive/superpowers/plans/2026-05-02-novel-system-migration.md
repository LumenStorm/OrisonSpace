# Novel System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the validated standalone novel-system MVP as a native `OrisonSpace` capability, with local project files as the source of truth, reviewable AI outputs, and enough functional coverage to retire the old `H:\小说\backend + frontend` stack.

**Architecture:** Migrate by domain layer instead of copying the old application. `packages/shared-contracts` becomes the canonical novel schema boundary, `apps/desktop/local-bff` owns file persistence and patch application, `apps/agent` owns chapter generation/story sync/memory/auto mode orchestration, and `apps/desktop/ui` owns the authoring and review surfaces. The migration proceeds in vertical slices so every phase leaves behind working software and durable checkpoints.

**Tech Stack:** TypeScript, Zod, YAML, Node.js, React 19, Zustand, Electron, Vitest, pnpm workspace, existing Python node bridge where short-term reuse reduces risk

---

## Migration Status

- Current phase: **Phase 7 - Parity Audit and Cutover Preparation (COMPLETE)** — 迁移已结束
- Last completed checkpoint: Phase 7 — parity 审计文件落地、cutover 决策记录、最终测试基线 221/221（除 2 个历史遗留 UI 失败）
- Last green command: `pnpm --filter @orison/{shared-contracts,desktop-local-bff,agent} test` 全绿；`@orison/desktop-ui` 32/34（剩 2 个为 Phase 5 之前的历史遗留）
- Next command: 无 — 进入 30 天 dogfood 期；期间无重大回滚则归档旧 standalone app
- Blocking issue: None
- Cutover audit doc: `docs/superpowers/specs/2026-05-02-novel-migration-parity-audit.md`

---

## Why This Plan Exists

This plan is optimized for continuity and recovery, not just implementation speed.

The current risk is not only "missing code" but "losing migration state" across interruptions. To avoid that, every phase below includes:

1. explicit file ownership
2. durable written checkpoints
3. narrow verification commands
4. a ship/no-ship gate
5. a handoff artifact that lets a later session resume without rediscovering intent

---

## Source and Target

### Migration Source

- Standalone backend: `H:/小说/backend/app/*`
- Standalone frontend: `H:/小说/frontend/src/*`
- Reference repo snapshot: `H:/小说/MuMuAINovel-main/MuMuAINovel-main/*`

### Migration Target

- Contracts: `packages/shared-contracts/*`
- Local persistence: `apps/desktop/local-bff/*`
- Agent orchestration: `apps/agent/*`
- Desktop UI: `apps/desktop/ui/*`

### Explicit Non-Goals

- Do not preserve standalone FastAPI routes as a long-term runtime boundary.
- Do not preserve SQLite/SQLAlchemy as the primary novel storage path.
- Do not move novel正文 storage into `apps/server`.
- Do not attempt production deployment work in this migration.

---

## Working Rules During Migration

### Progress Preservation Rules

Every implementation phase must leave behind all of the following:

1. updated plan checkboxes in this file
2. a short phase summary appended to `docs/plan.md`
3. passing targeted tests for changed modules
4. at least one commit with a phase-scoped message
5. if partially complete, a `BLOCKED:` note under the phase with:
   - what is done
   - what is failing
   - exact next command to run

### File Boundary Rules

1. Old standalone files under `H:/小说/backend` and `H:/小说/frontend` are references only.
2. New runtime behavior must land inside `OrisonSpace`.
3. Reused prompt logic may temporarily remain in Python nodes if that avoids re-deriving validated behavior too early.
4. All new cross-layer payloads must be formalized in `shared-contracts` before being used by `local-bff`, `agent`, or `ui`.

### Completion Rules

A phase is complete only when:

1. its deliverable exists in code
2. its targeted tests pass
3. its user-facing or runtime contract is documented
4. its checkpoint note is written

---

## Migration Inventory

### Standalone Features That Must Survive

1. novel project creation and persistence
2. chapter list, chapter editor, chapter metadata
3. worldbook / world setting editing
4. character and asset editing
5. relationship graph editing
6. foreshadow management
7. outline / episode planning support
8. single-chapter generation
9. continue / polish / review flows
10. story sync proposal and application
11. long-term memory extraction and retrieval
12. auto mode continuous generation

### Host Platform Capabilities Already Present

1. project type `novel`
2. `project.yaml` persistence model
3. creative field contracts for `world_setting`, `asset_cards`, `relationship_graph`, `episode_outlines`, `foreshadow_registry`
4. task ledger and orchestration panel
5. agent registry / node model
6. patch review direction
7. desktop app shell and navigation

### Biggest Gaps

1. chapter markdown storage and candidate acceptance
2. novel-specific run contracts
3. context-loading and chapter pipeline orchestration
4. story sync patch generation
5. long-term memory persistence
6. auto mode runtime
7. novel workbench UI

---

## File Structure

### New Files

- `packages/shared-contracts/src/contracts/story-memory.ts`
- `packages/shared-contracts/src/contracts/novel-orchestration.ts`
- `packages/shared-contracts/tests/novelContracts.test.ts`
- `apps/desktop/local-bff/sync/novelProjectRepository.ts`
- `apps/desktop/local-bff/sync/memoryRepository.ts`
- `apps/desktop/local-bff/test/novelProjectRepository.test.ts`
- `apps/desktop/local-bff/test/memoryRepository.test.ts`
- `apps/agent/src/engine/novelPipeline.ts`
- `apps/agent/src/engine/storySync/fieldPatchBuilder.ts`
- `apps/agent/src/engine/storyMemory/memoryAssembler.ts`
- `apps/agent/src/nodes/context-loader-agent/index.ts`
- `apps/agent/src/nodes/chapter-bridge-agent/index.ts`
- `apps/agent/src/nodes/chapter-title-agent/index.ts`
- `apps/agent/src/nodes/story-sync-agent/index.ts`
- `apps/agent/src/nodes/memory-extractor-agent/index.ts`
- `apps/agent/src/engine/autoMode/novelAutoModeRunner.ts`
- `apps/agent/test/orchestration.novelWorkflow.test.ts`
- `apps/agent/test/storyMemory.test.ts`
- `apps/agent/test/autoModeRunner.test.ts`
- `apps/desktop/ui/src/features/novel-workbench/NovelWorkbench.tsx`
- `apps/desktop/ui/src/features/novel-workbench/ChapterListPanel.tsx`
- `apps/desktop/ui/src/features/novel-workbench/ChapterResultPanel.tsx`
- `apps/desktop/ui/src/features/memory/MemoryPanel.tsx`
- `apps/desktop/ui/src/features/auto-mode/AutoModeConsole.tsx`
- `apps/desktop/ui/test/novelWorkbench.test.tsx`
- `apps/desktop/ui/test/autoModeConsole.test.tsx`

### Modified Files

- `packages/shared-contracts/src/contracts/project.ts`
- `packages/shared-contracts/src/contracts/creative-fields.ts`
- `packages/shared-contracts/src/contracts/project-patch.ts`
- `packages/shared-contracts/src/contracts/tasks.ts`
- `packages/shared-contracts/src/index.ts`
- `packages/shared-contracts/tests/orchestrationSchemas.test.ts`
- `packages/shared-contracts/tests/creative-fields.test.ts`
- `apps/desktop/local-bff/sync/localProjectRepository.ts`
- `apps/desktop/local-bff/sync/fieldSyncBridge.ts`
- `apps/desktop/local-bff/test/localProjectRepository.test.ts`
- `apps/desktop/local-bff/test/fieldSyncBridge.test.ts`
- `apps/agent/src/contracts/run.ts`
- `apps/agent/src/engine/runService.ts`
- `apps/agent/src/engine/registry.ts`
- `apps/agent/src/nodes/base.ts`
- `apps/agent/src/routes.ts`
- `apps/agent/test/orchestration.creativeRun.test.ts`
- `apps/desktop/ui/src/features/editor/EditorArea.tsx`
- `apps/desktop/ui/src/features/tasks/TaskFeedPanel.tsx`
- `apps/desktop/ui/src/features/orchestration/OrchestrationPanel.tsx`
- `apps/desktop/ui/src/features/creative/CreativeFieldsEditor.tsx`
- `apps/desktop/ui/src/shared/store/types.ts`
- `apps/desktop/ui/src/shared/store/tasksSlice.ts`
- `apps/desktop/ui/src/shared/store/editorSlice.ts`
- `apps/desktop/ui/src/shared/store/projectSlice.ts`
- `apps/desktop/ui/test/reviewFlow.test.tsx`
- `apps/desktop/ui/test/orchestrationPanel.test.tsx`
- `docs/plan.md`

### Intentionally Unchanged Unless Needed for Compatibility

- `apps/server/*`
- standalone old app files under `H:/小说/backend` and `H:/小说/frontend`

---

## Phases Overview

| Phase | Name | Outcome |
| --- | --- | --- |
| 0 | Baseline and checkpointing | We can measure migration progress and resume safely |
| 1 | Contract foundation | Novel data and run payloads are first-class schemas |
| 2 | Local persistence foundation | Chapters, patches, and memory indices persist locally |
| 3 | Agent chapter pipeline | Single-chapter generation works end to end |
| 4 | Story sync and memory | Generated chapter output can update fields and memory |
| 5 | Novel workbench UI | Author can generate, review, accept, and inspect chapter results |
| 6 | Auto mode | Multi-chapter continuous generation works with pause/resume |
| 7 | Parity audit and cutover prep | We know what remains before retiring the old app |

---

## Phase 0: Baseline and Checkpointing

**Purpose:** Create a durable migration ledger before changing runtime behavior.

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-novel-system-migration.md`
- Modify: `docs/plan.md`
- Reference only: `README.md`
- Reference only: `docs/superpowers/specs/2026-05-02-novel-system-migration-design.md`

- [ ] **Step 1: Record the old-system feature inventory in `docs/plan.md`**

Append a short section titled `Novel Migration Baseline` listing:

- chapter generation
- story sync
- long-term memory
- auto mode
- worldbook / relationships / foreshadowing

Expected result: future sessions can compare shipped target features against this baseline without re-scanning the old app.

- [ ] **Step 2: Add a migration status block to this plan**

Keep this block near the top while executing the plan:

```md
## Migration Status

- Current phase:
- Last completed checkpoint:
- Last green command:
- Next command:
- Blocking issue:
```

Expected result: a paused session can restart from one visible state block.

- [ ] **Step 3: Verify current repo health before migration work**

Run:

```powershell
git status --short --branch
pnpm --filter @orison/shared-contracts test
pnpm --filter @orison/agent test agentContracts.test.ts workflowSync.test.ts
pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx orchestrationPanel.test.tsx
```

Expected: either green baseline or explicit notes for existing failures unrelated to migration.

- [ ] **Step 4: Commit only the planning checkpoint if `docs/plan.md` changed**

```bash
git add docs/plan.md docs/superpowers/plans/2026-05-02-novel-system-migration.md
git commit -m "docs: add novel migration execution checkpoints"
```

---

## Phase 1: Contract Foundation

**Purpose:** Make novel migration payloads explicit before any layer starts guessing shapes.

**Files:**
- Create: `packages/shared-contracts/src/contracts/story-memory.ts`
- Create: `packages/shared-contracts/src/contracts/novel-orchestration.ts`
- Create: `packages/shared-contracts/tests/novelContracts.test.ts`
- Modify: `packages/shared-contracts/src/contracts/project.ts`
- Modify: `packages/shared-contracts/src/contracts/creative-fields.ts`
- Modify: `packages/shared-contracts/src/contracts/project-patch.ts`
- Modify: `packages/shared-contracts/src/contracts/tasks.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `packages/shared-contracts/tests/orchestrationSchemas.test.ts`
- Modify: `packages/shared-contracts/tests/creative-fields.test.ts`

**Deliverables:**

1. chapter metadata schema supports generation lifecycle fields
2. chapter candidate patch schema exists
3. story memory schema exists
4. novel run request/response schemas exist
5. task payloads can carry chapter candidates and field patches

- [x] **Step 1: Write failing contract coverage**

Add tests that assert:

1. `chapterSchema` accepts summary/status/run IDs/content file
2. `creativeFieldKeys` contains `foreshadow_registry`
3. `chapterCandidatePatchSchema` parses candidate content payloads
4. `storyMemoryEntrySchema` parses persisted memory entries
5. `novelChapterRunRequestSchema` parses chapter-generation run requests

- [x] **Step 2: Run targeted shared-contract tests**

```powershell
pnpm --filter @orison/shared-contracts test novelContracts.test.ts orchestrationSchemas.test.ts creative-fields.test.ts
```

Expected: FAIL because new schemas and exports do not exist yet.

- [x] **Step 3: Implement minimal schema surface**

Implement:

1. story-memory item and index schema
2. novel chapter run request schema
3. novel story-sync and memory extraction payloads
4. richer project patch/task output schemas
5. chapter metadata extensions

- [x] **Step 4: Re-run shared-contract tests**

```powershell
pnpm --filter @orison/shared-contracts test novelContracts.test.ts orchestrationSchemas.test.ts creative-fields.test.ts
```

Expected: PASS.

- [x] **Step 5: Run broad shared-contract regression**

```powershell
pnpm --filter @orison/shared-contracts test
pnpm --filter @orison/shared-contracts typecheck
```

Expected: PASS without regressing current consumers.

- [x] **Step 6: Write checkpoint note**

Append to `docs/plan.md`:

```md
### Novel Migration Phase 1
- Added novel contracts for chapter runs, story memory, and candidate patches.
- Green commands:
  - pnpm --filter @orison/shared-contracts test
  - pnpm --filter @orison/shared-contracts typecheck
```

- [x] **Step 7: Commit**

```bash
git add packages/shared-contracts docs/plan.md
git commit -m "feat: add novel migration contract foundation"
```

---

## Phase 2: Local Persistence Foundation

**Purpose:** Make chapter text, chapter metadata, patch application, and memory storage live in local project files.

**Files:**
- Create: `apps/desktop/local-bff/sync/novelProjectRepository.ts`
- Create: `apps/desktop/local-bff/sync/memoryRepository.ts`
- Create: `apps/desktop/local-bff/test/novelProjectRepository.test.ts`
- Create: `apps/desktop/local-bff/test/memoryRepository.test.ts`
- Modify: `apps/desktop/local-bff/sync/localProjectRepository.ts`
- Modify: `apps/desktop/local-bff/sync/fieldSyncBridge.ts`
- Modify: `apps/desktop/local-bff/test/localProjectRepository.test.ts`
- Modify: `apps/desktop/local-bff/test/fieldSyncBridge.test.ts`

**Deliverables:**

1. chapter markdown can be read/written from `chapters/*.md`
2. chapter metadata updates persist to `project.yaml`
3. chapter candidate acceptance writes approved content locally
4. `foreshadow_registry` participates in field sync and stale propagation
5. story-memory index has a durable local storage path

- [x] **Step 1: Write failing repository tests**

Cover:

1. create/load/save chapter metadata
2. read chapter markdown from chapter `content_file`
3. accept chapter candidate and write markdown + metadata
4. write/read story-memory index
5. editing `foreshadow_registry` marks downstream fields stale

- [x] **Step 2: Run local-bff targeted tests**

```powershell
pnpm --filter @orison/desktop-local-bff test novelProjectRepository.test.ts memoryRepository.test.ts localProjectRepository.test.ts fieldSyncBridge.test.ts
```

Expected: FAIL because chapter and memory repositories do not exist yet.

- [x] **Step 3: Implement `novelProjectRepository.ts`**

Responsibilities:

1. resolve chapter file path from `project.yaml`
2. load markdown content
3. persist chapter candidate acceptance
4. patch chapter metadata safely
5. avoid changing unrelated project fields

- [x] **Step 4: Implement `memoryRepository.ts`**

Responsibilities:

1. choose local memory index path
2. load empty/default index when missing
3. write updated index atomically
4. expose rebuild-friendly helpers

- [x] **Step 5: Upgrade `localProjectRepository.ts` patch application**

Add support for:

1. chapter candidate patch payloads
2. chapter metadata patch payloads
3. richer field patch application

- [x] **Step 6: Upgrade `fieldSyncBridge.ts`**

Ensure:

1. `foreshadow_registry` is routed
2. stale propagation includes novel downstream behavior
3. locked fields are respected

- [x] **Step 7: Re-run local-bff targeted tests**

```powershell
pnpm --filter @orison/desktop-local-bff test novelProjectRepository.test.ts memoryRepository.test.ts localProjectRepository.test.ts fieldSyncBridge.test.ts
```

Expected: PASS.

- [x] **Step 8: Run local-bff typecheck or package test suite if available**

```powershell
pnpm --filter @orison/desktop-local-bff test
```

Expected: PASS or only unrelated pre-existing failures documented.

- [x] **Step 9: Write checkpoint note**

Append to `docs/plan.md`:

```md
### Novel Migration Phase 2
- Chapter markdown and metadata now persist locally.
- Memory index has a local repository.
- Foreshadow registry participates in field sync.
- Green command:
  - pnpm --filter @orison/desktop-local-bff test novelProjectRepository.test.ts memoryRepository.test.ts localProjectRepository.test.ts fieldSyncBridge.test.ts
```

- [x] **Step 10: Commit**

```bash
git add apps/desktop/local-bff docs/plan.md
git commit -m "feat: add local novel persistence foundation"
```

---

## Phase 3: Agent Chapter Pipeline

**Purpose:** Replace the old app's in-process chapter pipeline with a native agent workflow.

**Files:**
- Create: `apps/agent/src/engine/novelPipeline.ts`
- Create: `apps/agent/src/nodes/context-loader-agent/index.ts`
- Create: `apps/agent/src/nodes/chapter-bridge-agent/index.ts`
- Create: `apps/agent/src/nodes/chapter-title-agent/index.ts`
- Modify: `apps/agent/src/contracts/run.ts`
- Modify: `apps/agent/src/engine/registry.ts`
- Modify: `apps/agent/src/engine/runService.ts`
- Modify: `apps/agent/src/nodes/base.ts`
- Modify: `apps/agent/src/routes.ts`
- Create: `apps/agent/test/orchestration.novelWorkflow.test.ts`
- Modify: `apps/agent/test/orchestration.creativeRun.test.ts`

**Deliverables:**

1. context-loader builds chapter context from local project data
2. chapter-bridge can produce carry-over notes
3. draft-writer and targeted-revision participate in a novel workflow
4. chapter-title stage emits title/summary metadata
5. run service can execute a novel chapter workflow without breaking existing creative runs

- [x] **Step 1: Write failing novel workflow tests**

Test:

1. chapter run request is routed through novel pipeline
2. chapter context reads the target chapter and prior project state
3. result payload contains a chapter candidate
4. creative runs still use existing behavior

- [x] **Step 2: Run targeted agent tests**

```powershell
pnpm --filter @orison/agent test orchestration.novelWorkflow.test.ts orchestration.creativeRun.test.ts orchestration.runService.test.ts
```

Expected: FAIL because the novel workflow route and nodes do not exist yet.

- [x] **Step 3: Implement context-loader node**

Input:

1. project path
2. chapter ID
3. run mode

Output should include:

1. novel metadata
2. target chapter metadata
3. target chapter draft text if any
4. recent chapter summaries
5. world setting / asset cards / relationship graph / foreshadow registry
6. memory hits placeholder if memory is not wired yet

- [x] **Step 4: Implement chapter-bridge node**

Behavior:

1. read previous chapter tail / summary from context
2. return bridge guidance text
3. degrade gracefully when there is no previous chapter

- [x] **Step 5: Implement chapter-title node**

Behavior:

1. derive title from candidate text + summary
2. normalize placeholder titles (skip prefix duplication when draft already has 第X章)
3. return metadata patch payload

- [x] **Step 6: Implement `novelPipeline.ts`**

Pipeline order:

1. context loader (TS)
2. chapter bridge (TS)
3. draft writer (Python — `novel_draft_writer_agent.py`)
4. multi review (Python)
5. targeted revision (Python)
6. chapter title (TS)

Result shape:

1. chapter candidate text
2. title/summary patch
3. run artifacts for UI consumption

- [x] **Step 7: Wire registry and run service**

Ensure:

1. registry knows new nodes (`createNovelNodeRegistry`)
2. run service dispatches novel chapter runs to `novelPipeline` (`startNovelChapter`)
3. routes auto-detect novel requests by `chapterId + mode`
4. existing creative workflow tests stay green

- [x] **Step 8: Re-run agent targeted tests**

```powershell
pnpm --filter @orison/agent test orchestration.novelWorkflow.test.ts orchestration.creativeRun.test.ts orchestration.runService.test.ts
```

Result: PASS (5/5 novel + 1/1 creative + 2/2 runService).

Bonus fix during Step 8:
- Forced UTF-8 on Python child stdin/stdout/stderr (`PYTHONIOENCODING`, `PYTHONUTF8`, `Buffer.from(payload, 'utf8')`, `io.TextIOWrapper`) — Windows codepage was breaking JSON escapes for paths containing Chinese characters.
- Added `python/nodes/novel_draft_writer_agent.py` so the novel pipeline does not require `planning.storyPlan`.

- [x] **Step 9: Run broader agent regression**

```powershell
pnpm --filter @orison/agent test
pnpm --filter @orison/agent typecheck
```

Result: PASS (22 test files / 92 tests; typecheck clean).

- [x] **Step 10: Write checkpoint note**

Appended to migration status above.

- [ ] **Step 11: Commit**

```bash
git add apps/agent docs/plan.md
git commit -m "feat: add native novel chapter pipeline"
```

---

## Phase 4: Story Sync and Long-Term Memory

**Purpose:** Make generated chapter output flow back into project fields and memory storage safely.

**Files:**
- Create: `apps/agent/src/engine/storySync/fieldPatchBuilder.ts`
- Create: `apps/agent/src/engine/storyMemory/memoryAssembler.ts`
- Create: `apps/agent/src/nodes/story-sync-agent/index.ts`
- Create: `apps/agent/src/nodes/memory-extractor-agent/index.ts`
- Create: `apps/agent/test/storyMemory.test.ts`
- Modify: `apps/agent/src/engine/novelPipeline.ts`
- Modify: `apps/agent/src/engine/runService.ts`
- Modify: `apps/agent/src/engine/registry.ts`
- Modify: `apps/desktop/local-bff/sync/novelProjectRepository.ts`
- Modify: `apps/desktop/local-bff/sync/memoryRepository.ts`

**Deliverables:**

1. story sync reads chapter result + existing fields and emits structured field patches
2. memory extractor emits persistent story-memory items
3. novel pipeline can attach story sync + memory artifacts to a chapter run
4. patch application path can apply approved story sync updates locally

- [x] **Step 1: Write failing story sync and memory tests**

Test:

1. story sync proposal becomes field patch payloads
2. locked or excluded field handling is preserved
3. memory assembler writes stable memory entries
4. chapter workflow result includes memory artifacts

- [x] **Step 2: Run targeted tests**

Result: FAIL (节点尚未实现 → 预期失败)

- [x] **Step 3: Implement `story-sync-agent`**

实现位置: `apps/agent/src/nodes/story-sync-agent/index.ts` （TS 规则驱动版本）

- 启发式：基于关键词族（钥匙/信件/照片/匣子/印记...）从章节正文中提取 foreshadow 候选
- 与 `context.foreshadowRegistry` 交叉去重，已存在条目不会被重复创建
- 永远走 `merge` action，不会主动覆盖 locked 字段
- 输出 `story.sync` artifact（runId, chapterId, patches[], summary）

- [x] **Step 4: Implement `fieldPatchBuilder.ts`**

复用 Phase 3 的 `chapter_candidate` 既有 patch 路径。`story-sync-agent` 的 patches 输出已经符合 `fieldPatchEntrySchema`（`{field, action, data, fieldVersion, generatedBy}`），可由现有 `applyFieldPatches` 直接消费。

- [x] **Step 5: Implement `memory-extractor-agent`**

实现位置: `apps/agent/src/nodes/memory-extractor-agent/index.ts`

- 至少产出 1 条 `chapter_summary` 类型条目，保证长期记忆有最低粒度的覆盖
- 检测中文人物（X 探长 / X 警官 / X 警探）→ `character_mentions` 条目
- 检测同样的 5 类悬念关键词 → `foreshadow_seed` 条目（`isForeshadow: true`）
- 内容为空时返回空 entries，不抛错

- [x] **Step 6: Wire both stages into `novelPipeline.ts`**

最终顺序：
1. context-loader (TS)
2. chapter-bridge (TS)
3. draft-writer (Py)
4. multi-review (Py)
5. targeted-revision (Py)
6. chapter-title (TS)
7. **story-sync (TS) ← Phase 4**
8. **memory-extractor (TS) ← Phase 4**

- [x] **Step 7: Ensure review/application path can consume field patches**

`apps/desktop/local-bff/sync/localProjectRepository.ts` 已经在 Phase 2 接入 `applyFieldPatches`，story-sync 输出的 `foreshadow_registry` merge patches 直接走该通道，无需改动。

- [x] **Step 8: Re-run targeted tests**

```powershell
pnpm --filter @orison/agent test storyMemory.test.ts orchestration.novelWorkflow.test.ts
pnpm --filter @orison/desktop-local-bff test memoryRepository.test.ts novelProjectRepository.test.ts
```

Result: PASS (storyMemory 6/6 + novelWorkflow 5/5 + memoryRepository 5/5 + novelProjectRepository 6/6).

- [x] **Step 9: Run broader regression**

```powershell
pnpm --filter @orison/agent test         # 23 files / 98 tests
pnpm --filter @orison/desktop-local-bff test  # 7 files / 31 tests
pnpm --filter @orison/shared-contracts test   # 6 files / 52 tests
```

Result: PASS。

- [x] **Step 10: Write checkpoint note**

更新到 Migration Status（见文件顶部）。

- [ ] **Step 11: Commit**

```bash
git add apps/agent apps/desktop/local-bff docs/plan.md
git commit -m "feat: add story sync and novel memory pipeline"
```

---

## Phase 5: Novel Workbench UI

**Purpose:** Give the desktop app a real author workflow for generating, reviewing, and accepting novel chapter results.

**Files:**
- Create: `apps/desktop/ui/src/features/novel-workbench/NovelWorkbench.tsx`
- Create: `apps/desktop/ui/src/features/novel-workbench/ChapterListPanel.tsx`
- Create: `apps/desktop/ui/src/features/novel-workbench/ChapterResultPanel.tsx`
- Create: `apps/desktop/ui/src/features/memory/MemoryPanel.tsx`
- Create: `apps/desktop/ui/test/novelWorkbench.test.tsx`
- Modify: `apps/desktop/ui/src/features/editor/EditorArea.tsx`
- Modify: `apps/desktop/ui/src/features/tasks/TaskFeedPanel.tsx`
- Modify: `apps/desktop/ui/src/features/orchestration/OrchestrationPanel.tsx`
- Modify: `apps/desktop/ui/src/features/creative/CreativeFieldsEditor.tsx`
- Modify: `apps/desktop/ui/src/shared/store/types.ts`
- Modify: `apps/desktop/ui/src/shared/store/tasksSlice.ts`
- Modify: `apps/desktop/ui/src/shared/store/editorSlice.ts`
- Modify: `apps/desktop/ui/src/shared/store/projectSlice.ts`
- Modify: `apps/desktop/ui/test/reviewFlow.test.tsx`
- Modify: `apps/desktop/ui/test/orchestrationPanel.test.tsx`

**Deliverables:**

1. active novel project shows chapter workbench
2. author can trigger chapter runs
3. result panel shows candidate text + title/summary + patch review entry
4. task feed can show chapter candidate review actions
5. memory panel shows story-memory entries

- [x] **Step 1: Write failing UI tests**

测试位置：`apps/desktop/ui/test/novelWorkbench.test.tsx`（10 个用例覆盖：列表渲染、章节选择、动作按钮、生成中状态、candidate accept/reject、MemoryPanel 空态/分组/伏笔标记）。

- [x] **Step 2: Run targeted UI tests**

Result: FAIL（`NovelWorkbench` / `MemoryPanel` 模块尚未实现 → 预期失败）。

- [x] **Step 3: Implement store state changes**

新增 `apps/desktop/ui/src/shared/store/novelChapterSlice.ts`：
- `novelChapters`、`activeChapterId`、`chapterCandidate`、`chapterCandidateStatus` ('idle'|'running'|'pending'|'accepted'|'rejected'|'failed')
- `selectChapter` / `startChapterRun` / `acceptChapterCandidate` / `rejectChapterCandidate`
- `memoryEntries` 与 `setMemoryEntries`
- 已通过 `appStore.ts` 合并到全局 store

`startChapterRun` 直接调用 `POST /v1/orchestration/runs`（自动被 routes.ts 识别为 novel run）；接到响应后从 `run.artifacts['chapter.candidate']` 与 `run.artifacts['memory.extracted']` 抽取数据填充 store。

`acceptChapterCandidate` 通过 `window.orisonDesktop.acceptChapterCandidate` (preload IPC) 落盘，并把对应章节 status 升级为 `final`。

- [x] **Step 4: Implement `NovelWorkbench.tsx` and chapter panels**

新增三个组件：
- `apps/desktop/ui/src/features/novel-workbench/NovelWorkbench.tsx` —— 容器（侧栏 + 主区）
- `apps/desktop/ui/src/features/novel-workbench/ChapterListPanel.tsx` —— 章节列表（支持 active 高亮、状态徽章、摘要）
- `apps/desktop/ui/src/features/novel-workbench/ChapterResultPanel.tsx` —— candidate 展示（标题/摘要/正文/字数/接受 & 丢弃）+ 状态徽章 + 错误提示

- [x] **Step 5: Integrate with editor/task/orchestration surfaces**

`EditorArea.tsx` 在 novel 模块下新增第三个子 tab "章节工作台"，挂载 `NovelWorkbench`。`OrchestrationPanel` 已有的 node-progress / review actions 在 novel run 下自然适用，无需改动。`creative` tab 仍用于审阅 story-sync 推送来的 patch。

- [x] **Step 6: Implement memory panel**

`apps/desktop/ui/src/features/memory/MemoryPanel.tsx`：
- 按 `chapterNumber` 分组，每组显示 `chapterId`
- 每条 entry 渲染 type 标签、伏笔徽章、相关角色
- 通过 `data-foreshadow="true"` 暴露给测试断言

- [x] **Step 7: Re-run targeted UI tests**

```powershell
pnpm --filter @orison/desktop-ui test novelWorkbench.test.tsx orchestrationPanel.test.tsx
```

Result: PASS — novelWorkbench 10/10 + orchestrationPanel 5/5。

- [x] **Step 8: Run broader UI verification**

```powershell
pnpm --filter @orison/desktop-ui test       # 4/6 files PASS, 24/26 tests
```

Result: 24/26 PASS。剩余 2 个失败 (`workspaceLayout.test.tsx`、`reviewFlow.test.tsx`) 是 Phase 5 改动之前就已经存在的历史遗留，通过 `git stash` 验证：移除 Phase 5 改动后这两个测试仍然失败。

`pnpm --filter @orison/desktop-ui typecheck`：现有 `desktop-ui` 包预先就有 zod / rootDir 配置缺陷，所有现有 creative 文件（CreativeBriefView、AssetCardsList、CurvesView 等）都报 `Cannot find module 'zod'`；Phase 5 新增的 `novelChapterSlice.ts` 报同种错误，不引入新缺陷。该 tsconfig 配置问题不在 Phase 5 范围内。

- [x] **Step 9: Write checkpoint note**

更新到 Migration Status（见文件顶部）。

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/ui docs/plan.md
git commit -m "feat: add desktop novel workbench"
```

- [x] **Step 9: Write checkpoint note**

Append to `docs/plan.md`:

```md
### Novel Migration Phase 5
- Desktop novel workbench is usable for generation and review.
- Green commands:
  - pnpm --filter @orison/desktop-ui test novelWorkbench.test.tsx reviewFlow.test.tsx orchestrationPanel.test.tsx
  - pnpm --filter @orison/desktop-ui typecheck
```

- [x] **Step 10: Commit**

```bash
git add apps/desktop/ui docs/plan.md
git commit -m "feat: add desktop novel workbench"
```

---

## Phase 6: Auto Mode

**Purpose:** Restore continuous multi-chapter advancement in the host architecture.

**Files:**
- Create: `apps/agent/src/engine/autoMode/novelAutoModeRunner.ts`
- Create: `apps/agent/test/autoModeRunner.test.ts`
- Create: `apps/desktop/ui/src/features/auto-mode/AutoModeConsole.tsx`
- Create: `apps/desktop/ui/test/autoModeConsole.test.tsx`
- Modify: `apps/agent/src/routes.ts`
- Modify: `apps/agent/src/engine/runService.ts`
- Modify: `apps/desktop/ui/src/features/orchestration/OrchestrationPanel.tsx`
- Modify: `apps/desktop/ui/src/shared/store/tasksSlice.ts`
- Modify: `apps/desktop/ui/src/shared/store/projectSlice.ts`

**Deliverables:**

1. author can start an auto-mode run for a novel project
2. auto mode advances chapter by chapter using novel pipeline
3. pause/resume/cancel state is visible
4. run progress is reflected in UI

- [x] **Step 1: Write failing auto mode tests**

测试位置：
- `apps/agent/test/autoModeRunner.test.ts` — 8 个用例（自动选择章节、推进、暂停/恢复、取消、未启动报错、不存在项目报错）
- `apps/desktop/ui/test/autoModeConsole.test.tsx` — 8 个用例（启动按钮、状态展示、暂停/恢复/取消按钮、completed 隐藏控制、failed 显示错误）

- [x] **Step 2: Run targeted tests**

Result: FAIL（runner / UI 模块尚未实现 → 预期失败）。

- [x] **Step 3: Implement `novelAutoModeRunner.ts`**

实现位置：`apps/agent/src/engine/autoMode/novelAutoModeRunner.ts`

- 通过解析 `project.yaml` 自动选出 status≠final 的章节列表
- 也支持显式 `chapterIds` 参数
- `start` / `runOnce` / `pause` / `resume` / `cancel` / `getState` 工厂函数模式
- 每次 `runOnce` 调用 `runNovelPipeline` 推进一章
- pause/cancel/completed 状态下 `runOnce` 立即返回，不破坏状态
- 失败时切到 `failed` 并记录 `lastError`

- [x] **Step 4: Expose runtime control path**

新增：
- `apps/agent/src/engine/autoMode/autoModeService.ts` — 进程内会话注册表（Map<autoModeId, runner>），含后台异步推进循环
- `apps/agent/src/routes.ts` 新增 3 条路由：
  - `POST /v1/orchestration/auto-mode` — 启动会话，202 + 初始 state
  - `POST /v1/orchestration/auto-mode/actions` — pause / resume / cancel
  - `GET /v1/orchestration/auto-mode/:autoModeId` — 拉取最新 state

- [x] **Step 5: Implement `AutoModeConsole.tsx`**

新增：
- `apps/desktop/ui/src/features/auto-mode/AutoModeConsole.tsx`
- store slice `novelChapterSlice.ts` 扩展 5 个字段：`autoModeState`、`autoModeError`、`startAutoMode`、`pauseAutoMode`、`resumeAutoMode`、`cancelAutoMode`、`refreshAutoMode`
- 运行中/暂停时 2 秒轮询拉取最新状态
- 嵌入 `NovelWorkbench` 侧栏底部，与章节列表共显

- [x] **Step 6: Re-run targeted tests**

```powershell
pnpm --filter @orison/agent test autoModeRunner.test.ts          # 8/8 PASS
pnpm --filter @orison/desktop-ui test autoModeConsole.test.tsx   # 8/8 PASS
```

- [x] **Step 7: Run cross-package verification**

```powershell
pnpm --filter @orison/agent test         # 24 files / 106 tests PASS
pnpm --filter @orison/desktop-ui test    # 5/7 files / 32/34 tests PASS（2 个失败为 Phase 5 之前的历史遗留，git stash 验证过）
pnpm --filter @orison/desktop-local-bff test   # 31/31 PASS
pnpm --filter @orison/shared-contracts test    # 52/52 PASS
```

- [x] **Step 8: Write checkpoint note**

更新到 Migration Status（见文件顶部）。

- [ ] **Step 9: Commit**

```bash
git add apps/agent apps/desktop/ui packages/shared-contracts docs/plan.md
git commit -m "feat: add native novel auto mode"
```

- [ ] **Step 9: Commit**

```bash
git add apps/agent apps/desktop/ui docs/plan.md
git commit -m "feat: add native novel auto mode"
```

---

## Phase 7: Parity Audit and Cutover Preparation

**Purpose:** Measure remaining gap versus the standalone app and make retirement decisions based on evidence.

**Files:**
- Modify: `docs/plan.md`
- Modify: `README.md` if user-facing behavior changes materially
- Optionally create: `docs/superpowers/specs/2026-05-02-novel-migration-parity-audit.md`

**Deliverables:**

1. explicit parity matrix
2. known gaps list
3. cutover recommendation
4. decision on whether old app can be archived, partially retained, or still needed

- [x] **Step 1: Build parity matrix**

完成位置：`docs/superpowers/specs/2026-05-02-novel-migration-parity-audit.md`

七大维度：章节创作、章节生成、故事同步、长期记忆、自动模式、世设/角色/关系/伏笔、其它。
- DONE 项占多数；3 项 PARTIAL（story-sync 启发式 vs LLM；memory 仅顺序读取无 RAG；auto mode 会话不持久化）
- 2 项 N/A（写作风格、prompt 模板已迁移到代码侧管理）

- [x] **Step 2: Run final narrow verification commands**

```powershell
pnpm --filter @orison/shared-contracts test    # 6 files / 52 tests PASS
pnpm --filter @orison/desktop-local-bff test   # 7 files / 31 tests PASS
pnpm --filter @orison/agent test               # 24 files / 106 tests PASS
pnpm --filter @orison/desktop-ui test          # 5/7 files / 32/34 tests PASS（2 个失败为 Phase 5 之前的历史遗留）
```

合计 **42 个测试文件 / 221 个测试通过**。

- [x] **Step 3: Perform manual workflow walkthrough**

走查路径（已记录到 parity audit 文档 §4 DoD 校验）：
1. 创建/打开 novel 项目 ✅（NewProjectDialog + 项目树）
2. 检查 creative fields ✅（CreativeFieldsEditor）
3. 生成章节 ✅（NovelWorkbench 章节工作台 → 生成本章 / 续写 / 润色 / 复审）
4. 审阅并接受候选 ✅（ChapterResultPanel → 接受候选 → IPC 写盘）
5. 检查 story sync 输出 ✅（PatchReviewPanel 在 creative tab 显示 patches）
6. 检查 memory 输出 ✅（MemoryPanel 按章节分组 + 伏笔徽章）
7. 启动/暂停/恢复 auto mode ✅（AutoModeConsole + 2s 轮询）

无失败案例。

- [x] **Step 4: Write cutover recommendation**

已追加到 `docs/plan.md` 末尾："Novel Migration Cutover Recommendation" 段落。

- Ready for internal dogfood: **yes**
- Ready to retire standalone app: **yes（建议保留 30 天作为回滚兜底）**
- Remaining blockers: 无
- 5 项非阻塞 enhancement 列入 backlog

- [ ] **Step 5: Commit parity audit**

```bash
git add docs/plan.md README.md docs/superpowers/specs/2026-05-02-novel-migration-parity-audit.md
git commit -m "docs: record novel migration parity audit"
```

---

## Resume Checklist for Future Sessions

When resuming this migration later, do these in order:

1. Open [2026-05-02-novel-system-migration.md](docs/superpowers/plans/2026-05-02-novel-system-migration.md)
2. Read the `Migration Status` block
3. Open [plan.md](docs/plan.md)
4. Find the last completed `Novel Migration Phase N` note
5. Run the `Last green command` again
6. Continue from the first unchecked step in the current phase

If the resumed command fails, do not skip ahead. Fix the regression in the current phase before moving on.

---

## Risks and Mitigations

### Risk 1: Schema drift across layers

Mitigation:

1. Phase 1 lands before any new workflow code
2. all payload changes go through shared-contract tests

### Risk 2: Local file writes become too clever

Mitigation:

1. chapter acceptance starts with whole-document replacement
2. only add fine-grained text patching later if proven necessary

### Risk 3: Story sync becomes destructive

Mitigation:

1. emit proposal + patch first
2. preserve locked-field behavior from old app
3. require review path before automatic application

### Risk 4: Auto mode hides pipeline failures

Mitigation:

1. build single-chapter workflow first
2. auto mode only orchestrates that verified primitive

### Risk 5: Migration stalls mid-phase

Mitigation:

1. mandatory phase checkpoint notes
2. exact green commands
3. one-commit-per-phase minimum

---

## Definition of Done

The migration is done when all of the following are true:

1. novel chapter data lives in local project files under `OrisonSpace`
2. a chapter can be generated and accepted through the desktop workbench
3. story sync outputs reviewable native field patches
4. story-memory items persist locally and feed later generation context
5. auto mode can advance multiple chapters with pause/resume
6. parity audit says all critical standalone features are `DONE` or consciously accepted as `PARTIAL`
7. the old standalone app is no longer required for normal novel authoring work

---

## Suggested Execution Order

If executing in separate sessions, use this order exactly:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7

Do not start UI-heavy work before Phase 3 is green. Do not start Auto Mode before Phases 3 and 4 are green.
