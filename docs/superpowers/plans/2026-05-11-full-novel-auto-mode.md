# Full Novel Auto Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an approval-gated full-novel auto mode that generates reusable story assets from a plot summary, then writes chapters continuously while syncing memory.

**Architecture:** Extend shared contracts first, then add a focused planning-bundle module used by the auto-mode runner. Keep the existing chapter pipeline intact and gate it behind explicit planning approval. Expose minimal UI controls in `AutoModeConsole`.

**Tech Stack:** TypeScript, Zod, YAML, Vitest, React, Zustand.

---

## File Structure

- Modify: `packages/shared-contracts/src/contracts/agent-contract.ts`
- Modify: `packages/shared-contracts/src/contracts/novel-orchestration.ts`
- Test: `packages/shared-contracts/tests/agent-contract.test.ts`
- Test: `packages/shared-contracts/tests/orchestrationSchemas.test.ts`
- Modify: `apps/agent/src/nodes/base.ts`
- Modify: selected node factory files under `apps/agent/src/nodes/*/index.ts`
- Create: `apps/agent/src/engine/autoMode/fullNovelPlanning.ts`
- Modify: `apps/agent/src/engine/autoMode/novelAutoModeRunner.ts`
- Modify: `apps/agent/src/engine/autoMode/autoModeService.ts`
- Test: `apps/agent/test/fullNovelPlanning.test.ts`
- Test: `apps/agent/test/autoModeRunner.test.ts`
- Modify: `apps/desktop/ui/src/shared/api/novelChapter.ts`
- Modify: `apps/desktop/ui/src/shared/store/novelChapterSlice.ts`
- Modify: `apps/desktop/ui/src/features/auto-mode/AutoModeConsole.tsx`
- Test: `apps/desktop/ui/test/autoModeConsole.test.tsx`

## Tasks

- [ ] Add shared reusable-node and full-novel approval contracts with schema tests.
- [ ] Attach optional reusable metadata to orchestration nodes.
- [ ] Implement deterministic full-novel planning bundle generation and YAML projection.
- [ ] Gate auto mode chapter execution behind planning approval.
- [ ] Add renderer controls for plot summary start and approval.
- [ ] Run focused shared-contracts, agent, and UI tests.
