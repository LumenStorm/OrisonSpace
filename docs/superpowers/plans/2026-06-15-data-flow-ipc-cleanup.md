# Data Flow IPC Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix project data writeback inconsistencies, stale/unsafe IPC paths, mock fallbacks, and contract drift without changing UI styling or layout.

**Architecture:** Keep renderer writes behind preload APIs and main-process IPC. Split user edits and agent patch application into distinct persistence paths so metadata source/version semantics stay correct. Use existing toast/error behavior and current components; do not introduce new visual design, CSS, layout, or styling changes.

**Tech Stack:** TypeScript, React, Zustand, Electron IPC, Vitest, local BFF YAML persistence, `@orison/shared-contracts`.

---

## Guardrails

- Do not modify CSS files, theme files, layout styles, dimensions, colors, spacing, or component visual structure.
- Do not add hardcoded mojibake text. Read and write source files as UTF-8.
- Do not introduce new landing pages, dialogs, panels, or visual redesign.
- Use existing i18n keys where possible. If a new user-visible string is unavoidable, add it to both `zh-CN` and `en-US` YAML files in UTF-8.
- Keep fixes scoped to data flow, IPC, error propagation, contract alignment, and mock/dead-code cleanup.
- Run targeted tests after each task and a final typecheck/test pass.

## File Structure

**Local BFF persistence**
- Modify `apps/desktop/local-bff/sync/fieldSyncBridge.ts`: keep `onFieldEdited()` for user edits and add a separate agent patch persistence function.
- Modify `apps/desktop/local-bff/sync/localProjectRepository.ts`: reuse or tighten `applyFieldPatches()` behavior only if needed by the new BFF function.
- Test `apps/desktop/local-bff/test/fieldSyncBridge.test.ts`: add coverage for agent patch source/version/delete/locked behavior.

**Shell IPC**
- Modify `apps/desktop/client/shell/main/ipc/fieldSyncIpc.ts`: register a new agent patch IPC channel next to `field:sync`.
- Modify `apps/desktop/client/shell/main/ipc/projectIpc.ts`: stop swallowing save errors for metadata/chapter sync paths that callers need to observe.
- Modify `apps/desktop/client/shell/preload/index.ts`: expose the new patch API and search API through `orisonDesktop`.
- Modify `packages/shared-contracts/src/ipc.ts`: add new API methods and bring the IPC channel schema closer to actual preload/main surface.
- Test `apps/desktop/client/shell/test/fieldSyncIpc.test.ts`: assert the new patch channel persists agent metadata correctly.
- Create or modify a shell test for project IPC save error propagation if a suitable existing test is present.

**Renderer store and feature logic**
- Modify `apps/desktop/client/ui/src/shared/store/creativeFieldsSlice.ts`: use the new agent patch API in `applySelectedPatches()`.
- Modify `apps/desktop/client/ui/src/features/search-panel/SearchPanel.tsx`: replace direct `fetch('http://localhost:18421/tool/execute')` with preload API.
- Modify `apps/desktop/client/shell/main/ipc/projectIpc.ts` or a focused new IPC file if preferred: implement project search behind IPC.
- Modify `apps/desktop/client/ui/src/features/project-tree/ProjectTree.tsx`: remove mock fallback for real project directory load failures.
- Modify `apps/desktop/client/ui/src/features/editor/VideoEditor.tsx`: remove fixed `mockClips` display and retain existing empty/generated state using current markup classes.
- Test relevant UI behavior with existing tests or add focused tests under `apps/desktop/client/ui/test/`.

**Lint and hygiene**
- Modify package `lint` scripts only if a minimal non-stylistic check can be added without broad formatting churn.
- Do not run formatters that rewrite unrelated files.

---

### Task 1: Add Agent Patch Persistence Semantics

**Files:**
- Modify: `apps/desktop/local-bff/sync/fieldSyncBridge.ts`
- Test: `apps/desktop/local-bff/test/fieldSyncBridge.test.ts`

- [ ] **Step 1: Write failing tests for agent patch persistence**

Add tests that prove agent patches do not get persisted as user edits. The assertions must cover:

```ts
import type { ProjectFieldPatch } from '@orison/shared-contracts';
import { applyAgentFieldPatch } from '../sync/fieldSyncBridge';

it('persists agent field patches with agent metadata instead of user metadata', () => {
  const project = createEmptyProjectDocument('Agent Patch Sync');
  saveProject(TEST_PROJECT_DIR, project);

  const patch: ProjectFieldPatch = {
    runId: 'run_001',
    createdAt: new Date().toISOString(),
    patches: [{
      field: 'world_setting',
      action: 'set',
      fieldVersion: 7,
      data: {
        premise: 'A sealed city depends on borrowed memories.',
        era: '',
        locations: [],
        rules: [],
        power_structures: [],
        taboos: [],
        visual_language: [],
        tone_rules: [],
        open_questions: [],
      },
    }],
  };

  const result = applyAgentFieldPatch(TEST_PROJECT_DIR, patch);
  expect(result.applied).toEqual(['world_setting']);
  expect(result.skipped).toEqual([]);

  const loaded = loadProject(TEST_PROJECT_DIR)!;
  expect(loaded.world_setting?.premise).toBe('A sealed city depends on borrowed memories.');
  expect(loaded.field_metadata?.world_setting?.source).toBe('agent');
  expect(loaded.field_metadata?.world_setting?.version).toBe(7);
  expect(loaded.field_metadata?.world_setting?.stale).toBe(false);
});

it('reports locked agent patches as skipped without overwriting the field', () => {
  const project = createEmptyProjectDocument('Locked Agent Patch');
  saveProject(TEST_PROJECT_DIR, {
    ...project,
    world_setting: {
      premise: 'Keep this',
      era: '',
      locations: [],
      rules: [],
      power_structures: [],
      taboos: [],
      visual_language: [],
      tone_rules: [],
      open_questions: [],
    },
    field_metadata: {
      world_setting: {
        version: 3,
        source: 'user',
        locked: true,
        dependsOn: [],
        stale: false,
      },
    },
  });

  const result = applyAgentFieldPatch(TEST_PROJECT_DIR, {
    runId: 'run_002',
    createdAt: new Date().toISOString(),
    patches: [{
      field: 'world_setting',
      action: 'set',
      fieldVersion: 4,
      data: {
        premise: 'Overwrite attempt',
        era: '',
        locations: [],
        rules: [],
        power_structures: [],
        taboos: [],
        visual_language: [],
        tone_rules: [],
        open_questions: [],
      },
    }],
  });

  expect(result.applied).toEqual([]);
  expect(result.skipped).toEqual([{ field: 'world_setting', reason: 'locked' }]);
  expect(loadProject(TEST_PROJECT_DIR)!.world_setting?.premise).toBe('Keep this');
});
```

- [ ] **Step 2: Run the local BFF field sync test and verify failure**

Run: `pnpm --filter @orison/desktop-local-bff test -- fieldSyncBridge.test.ts`

Expected: FAIL because `applyAgentFieldPatch` does not exist.

- [ ] **Step 3: Implement `applyAgentFieldPatch`**

In `apps/desktop/local-bff/sync/fieldSyncBridge.ts`, add:

```ts
import type { ProjectFieldPatch } from '@orison/shared-contracts';

type AgentPatchApplyResult = {
  applied: string[];
  skipped: Array<{ field: string; reason: 'locked' | 'stale' | 'unsupported' }>;
};

export function applyAgentFieldPatch(projectPath: string, fieldPatch: ProjectFieldPatch): AgentPatchApplyResult {
  const project = loadProject(projectPath) ?? bootstrapProjectFromMeta(projectPath);
  const next = structuredClone(project) as Record<string, any>;
  const applied: string[] = [];
  const skipped: Array<{ field: string; reason: 'locked' | 'stale' | 'unsupported' }> = [];

  if (!next.field_metadata) next.field_metadata = {};

  for (const patch of fieldPatch.patches) {
    if (patch.field === 'overview') {
      skipped.push({ field: patch.field, reason: 'unsupported' });
      continue;
    }

    const docKey = FIELD_TO_KEY[patch.field];
    if (!docKey) {
      skipped.push({ field: patch.field, reason: 'unsupported' });
      continue;
    }

    const currentMeta = next.field_metadata[patch.field] ?? {
      version: 0,
      source: 'agent',
      locked: false,
      dependsOn: [],
      stale: false,
    };

    if (currentMeta.locked) {
      skipped.push({ field: patch.field, reason: 'locked' });
      continue;
    }

    if (typeof currentMeta.version === 'number' && patch.fieldVersion < currentMeta.version) {
      skipped.push({ field: patch.field, reason: 'stale' });
      continue;
    }

    if (patch.action === 'delete') {
      delete next[docKey];
    } else if (patch.action === 'merge') {
      const currentValue = next[docKey];
      if (Array.isArray(currentValue) && Array.isArray(patch.data)) {
        next[docKey] = [...currentValue, ...patch.data];
      } else if (
        currentValue &&
        typeof currentValue === 'object' &&
        patch.data &&
        typeof patch.data === 'object' &&
        !Array.isArray(patch.data)
      ) {
        next[docKey] = { ...currentValue, ...(patch.data as object) };
      } else {
        next[docKey] = patch.data;
      }
    } else {
      next[docKey] = patch.data;
    }

    next.field_metadata[patch.field] = {
      ...currentMeta,
      version: patch.fieldVersion,
      source: 'agent',
      stale: false,
    };
    applied.push(patch.field);
  }

  if (!next.meta || typeof next.meta !== 'object') {
    const now = new Date().toISOString();
    next.meta = {
      id: crypto.randomUUID(),
      name: typeof next.name === 'string' ? next.name : 'Untitled',
      type: next.type === 'script' ? 'script' : 'novel',
      version: 0,
      created_at: now,
      updated_at: now,
    };
  }
  next.meta.version = (typeof next.meta.version === 'number' ? next.meta.version : 0) + 1;
  next.meta.updated_at = new Date().toISOString();

  const validated = projectDocumentSchema.parse(next);
  saveProject(projectPath, validated);
  return { applied, skipped };
}
```

Keep `onFieldEdited()` unchanged for user edits.

- [ ] **Step 4: Run the local BFF test and verify pass**

Run: `pnpm --filter @orison/desktop-local-bff test -- fieldSyncBridge.test.ts`

Expected: PASS.

---

### Task 2: Add Agent Patch IPC and Preload API

**Files:**
- Modify: `apps/desktop/client/shell/main/ipc/fieldSyncIpc.ts`
- Modify: `apps/desktop/client/shell/preload/index.ts`
- Modify: `packages/shared-contracts/src/ipc.ts`
- Test: `apps/desktop/client/shell/test/fieldSyncIpc.test.ts`

- [ ] **Step 1: Write failing shell IPC test**

Extend `fieldSyncIpc.test.ts`:

```ts
it('registers an agent patch handler that preserves agent patch metadata', async () => {
  saveProject(TEST_PROJECT_PATH, createEmptyProjectDocument('Agent Patch IPC'));

  registerFieldSyncIpc();

  const patchCall = handle.mock.calls.find(([channel]) => channel === 'field:apply-agent-patch');
  expect(patchCall).toBeTruthy();

  const [, handler] = patchCall!;
  allowPath(TEST_PROJECT_PATH);

  const result = await handler({}, TEST_PROJECT_PATH, {
    runId: 'run_ipc_001',
    createdAt: new Date().toISOString(),
    patches: [{
      field: 'world_setting',
      action: 'set',
      fieldVersion: 5,
      data: {
        premise: 'IPC patch',
        era: '',
        locations: [],
        rules: [],
        power_structures: [],
        taboos: [],
        visual_language: [],
        tone_rules: [],
        open_questions: [],
      },
    }],
  });

  expect(result).toEqual({ applied: ['world_setting'], skipped: [] });
  const project = loadProject(TEST_PROJECT_PATH);
  expect(project?.field_metadata?.world_setting?.source).toBe('agent');
  expect(project?.field_metadata?.world_setting?.version).toBe(5);
});
```

- [ ] **Step 2: Run shell field sync test and verify failure**

Run: `pnpm --filter @orison/desktop-shell test -- fieldSyncIpc.test.ts`

Expected: FAIL because `field:apply-agent-patch` is not registered.

- [ ] **Step 3: Implement main IPC handler**

In `fieldSyncIpc.ts`, import `projectFieldPatchSchema` and `applyAgentFieldPatch`, then register:

```ts
ipcMain.handle('field:apply-agent-patch', async (_event, projectPath: string, patch: unknown) => {
  assertSafePath(projectPath);
  const parsedPatch = projectFieldPatchSchema.parse(patch);
  return applyAgentFieldPatch(projectPath, parsedPatch);
});
```

Keep the existing `field:sync` handler unchanged.

- [ ] **Step 4: Expose preload API and contract type**

In `preload/index.ts`, add:

```ts
applyAgentFieldPatch: (projectPath: string, patch: ProjectFieldPatch) =>
  ipcRenderer.invoke('field:apply-agent-patch', projectPath, patch) as Promise<{
    applied: string[];
    skipped: Array<{ field: string; reason: string }>;
  }>,
```

In `packages/shared-contracts/src/ipc.ts`:

```ts
import type { ProjectFieldPatch } from './contracts/project-patch';
```

Add the channel to `desktopIpcSchema` and add this method to `OrisonDesktopApi`:

```ts
applyAgentFieldPatch(projectPath: string, patch: ProjectFieldPatch): Promise<{
  applied: string[];
  skipped: Array<{ field: string; reason: string }>;
}>;
```

- [ ] **Step 5: Run shell test and shared contract typecheck**

Run:
- `pnpm --filter @orison/desktop-shell test -- fieldSyncIpc.test.ts`
- `pnpm --filter @orison/shared-contracts typecheck`
- `pnpm --filter @orison/desktop-shell typecheck`

Expected: all PASS.

---

### Task 3: Route Agent Patch UI Persistence Through the New API

**Files:**
- Modify: `apps/desktop/client/ui/src/shared/store/creativeFieldsSlice.ts`
- Test: `apps/desktop/client/ui/test/creativeFieldsEditor.test.tsx` or create `apps/desktop/client/ui/test/creativeFieldsSlice.test.ts`

- [ ] **Step 1: Write failing store test**

Create a focused Zustand slice test if one does not already exist:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createCreativeFieldsSlice, type CreativeFieldsSlice } from '../src/shared/store/creativeFieldsSlice';

type TestState = CreativeFieldsSlice & {
  currentProject: { path: string; name: string; type: 'novel' } | null;
  saveProject: () => Promise<void>;
};

const useTestStore = create<TestState>()((...args) => ({
  currentProject: { path: '/project', name: 'Demo', type: 'novel' },
  saveProject: vi.fn(async () => undefined),
  ...createCreativeFieldsSlice(...args as Parameters<typeof createCreativeFieldsSlice>),
}));

describe('creativeFieldsSlice agent patch persistence', () => {
  beforeEach(() => {
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = {
      syncField: vi.fn(async () => undefined),
      applyAgentFieldPatch: vi.fn(async () => ({ applied: ['world_setting'], skipped: [] })),
    };
    useTestStore.setState({
      creativeFields: {},
      fieldMetadata: {},
      pendingPatch: null,
      patchSelections: {},
      currentProject: { path: '/project', name: 'Demo', type: 'novel' },
    });
  });

  it('persists selected non-overview patches through applyAgentFieldPatch instead of syncField', () => {
    useTestStore.getState().setPendingPatch({
      runId: 'run_ui_001',
      createdAt: new Date().toISOString(),
      patches: [{
        field: 'world_setting',
        action: 'set',
        fieldVersion: 8,
        data: {
          premise: 'UI agent patch',
          era: '',
          locations: [],
          rules: [],
          power_structures: [],
          taboos: [],
          visual_language: [],
          tone_rules: [],
          open_questions: [],
        },
      }],
    });

    useTestStore.getState().applySelectedPatches();

    expect(window.orisonDesktop.applyAgentFieldPatch).toHaveBeenCalledTimes(1);
    expect(window.orisonDesktop.applyAgentFieldPatch).toHaveBeenCalledWith('/project', expect.objectContaining({
      runId: 'run_ui_001',
      patches: [expect.objectContaining({ field: 'world_setting', fieldVersion: 8 })],
    }));
    expect(window.orisonDesktop.syncField).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the UI test and verify failure**

Run: `pnpm --filter @orison/desktop-ui test -- creativeFieldsSlice.test.ts`

Expected: FAIL because the slice still calls `syncField()`.

- [ ] **Step 3: Replace agent patch persistence call**

In `applySelectedPatches()`, keep the existing optimistic state update. Replace the loop that calls `syncField()` for selected creative patches with one call:

```ts
const persistablePatches = selectedPatches.filter((patch) => patch.field !== 'overview');
if (path && persistablePatches.length > 0 && window.orisonDesktop?.applyAgentFieldPatch) {
  const locale = (get() as any).resolvedLocale ?? 'en-US';
  window.orisonDesktop.applyAgentFieldPatch(path, {
    runId: pendingPatch.runId,
    createdAt: pendingPatch.createdAt,
    patches: persistablePatches,
  }).then((result) => {
    if (result.skipped.length > 0) {
      useToastStore.getState().showToast(
        translate(locale, 'creative.field.syncFailed', {
          field: result.skipped.map((item) => item.field).join(', '),
          reason: result.skipped.map((item) => item.reason).join(', '),
        }),
        'error',
      );
    }
  }).catch((err) => reportSyncFailure(locale, 'world_setting', err));
}
```

Use the existing toast mechanism. Do not add CSS or new visual components.

- [ ] **Step 4: Run targeted UI test and typecheck**

Run:
- `pnpm --filter @orison/desktop-ui test -- creativeFieldsSlice.test.ts`
- `pnpm --filter @orison/desktop-ui typecheck`

Expected: PASS.

---

### Task 4: Remove Direct Localhost Fetch From Search

**Files:**
- Modify: `apps/desktop/client/ui/src/features/search-panel/SearchPanel.tsx`
- Modify: `apps/desktop/client/shell/preload/index.ts`
- Modify: `apps/desktop/client/shell/main/ipc/projectIpc.ts` or create `apps/desktop/client/shell/main/ipc/searchIpc.ts`
- Modify: `packages/shared-contracts/src/ipc.ts`
- Test: add shell test for search IPC and UI test for SearchPanel if practical.

- [ ] **Step 1: Add a project search IPC test**

Create `apps/desktop/client/shell/test/projectSearchIpc.test.ts`:

```ts
import path from 'node:path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('electron', () => ({ ipcMain: { handle }, dialog: {} }));

import { registerProjectIpc } from '../main/ipc/projectIpc';
import { allowPath } from '../main/ipc/pathGuard';

const TEST_DIR = path.join(process.cwd(), 'test-tmp-project-search');

describe('project search IPC', () => {
  beforeEach(() => {
    handle.mockReset();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(path.join(TEST_DIR, 'chapter.md'), 'alpha\nneedle line\nomega', 'utf8');
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('searches text files inside the project directory', async () => {
    allowPath(TEST_DIR);
    registerProjectIpc();
    const call = handle.mock.calls.find(([channel]) => channel === 'project:search');
    expect(call).toBeTruthy();

    const [, handler] = call!;
    const results = await handler({}, TEST_DIR, 'needle', 10);

    expect(results).toEqual([
      expect.objectContaining({
        line: 2,
        text: 'needle line',
      }),
    ]);
    expect(results[0].path).toContain('chapter.md');
  });
});
```

- [ ] **Step 2: Run the search IPC test and verify failure**

Run: `pnpm --filter @orison/desktop-shell test -- projectSearchIpc.test.ts`

Expected: FAIL because `project:search` is not registered.

- [ ] **Step 3: Implement project search IPC**

In `projectIpc.ts`, add an `ipcMain.handle('project:search', ...)` handler. Keep it small:

```ts
ipcMain.handle('project:search', async (_, projectDir: string, query: string, maxResults = 100) => {
  assertSafePath(projectDir);
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const entries = readDirectoryRecursive(projectDir, projectDir, 10);
  const results: Array<{ path: string; line: number; text: string }> = [];

  const visit = (items: typeof entries) => {
    for (const entry of items) {
      if (results.length >= maxResults) return;
      if (entry.isDir) {
        if (entry.children) visit(entry.children);
        continue;
      }
      if (!/\.(md|txt|json|yaml|yml)$/i.test(entry.name)) continue;
      const fullPath = path.join(projectDir, entry.path.replace(/^\//, ''));
      const content = decodeFileToUtf8(readFileSync(fullPath));
      content.split('\n').forEach((line, index) => {
        if (results.length >= maxResults) return;
        if (line.toLowerCase().includes(needle)) {
          results.push({ path: fullPath, line: index + 1, text: line });
        }
      });
    }
  };

  visit(entries);
  return results;
});
```

- [ ] **Step 4: Expose `searchProject` in preload and contract**

In `preload/index.ts`:

```ts
searchProject: (projectDir: string, query: string, maxResults?: number) =>
  ipcRenderer.invoke('project:search', projectDir, query, maxResults) as Promise<Array<{
    path: string;
    line: number;
    text: string;
  }>>,
```

In `OrisonDesktopApi`:

```ts
searchProject(projectDir: string, query: string, maxResults?: number): Promise<Array<{
  path: string;
  line: number;
  text: string;
}>>;
```

Add `project:search` to `desktopIpcSchema`.

- [ ] **Step 5: Replace renderer direct fetch**

In `SearchPanel.tsx`, replace the `fetch()` block with:

```ts
const data = await window.orisonDesktop?.searchProject?.(currentProject.path, query.trim(), 100);
setResults(data ?? []);
```

On catch, keep the existing visual shape and use `setResults([])`. Do not change styles or layout.

- [ ] **Step 6: Run verification**

Run:
- `pnpm --filter @orison/desktop-shell test -- projectSearchIpc.test.ts`
- `pnpm --filter @orison/desktop-ui typecheck`
- `rg -n "localhost:18421|fetch\\(" apps\\desktop\\client\\ui\\src`

Expected:
- Tests PASS.
- Typecheck PASS.
- `rg` shows no direct localhost fetch in renderer source.

---

### Task 5: Remove Real-Project Mock Fallbacks

**Files:**
- Modify: `apps/desktop/client/ui/src/features/project-tree/ProjectTree.tsx`
- Modify or delete: `apps/desktop/client/ui/src/shared/data/mockFileContents.ts` only if no remaining imports exist.
- Test: add or update a ProjectTree-focused UI test if practical.

- [ ] **Step 1: Write a focused assertion for no mock fallback**

Add a test that renders `ProjectTree` with a current project and a failing `readDirectory`, then verifies `mockFileContents` content is not opened. If the existing ProjectTree test setup is too heavy, use static verification in Step 4 and keep this as a manual review check.

Core expectation:

```ts
expect(window.orisonDesktop.readDirectory).toHaveBeenCalled();
expect(screen.queryByText('示例章节')).toBeNull();
```

- [ ] **Step 2: Remove `mockFileContents` import and fallback for real project failures**

In `ProjectTree.tsx`:

```ts
// Remove:
import { mockFileContents } from '../../shared/data/mockFileContents';
```

Change directory loading so a real project read failure sets an empty tree with the project root rather than demo content:

```ts
if (!cancelled) setFileTree([{ name: currentProject.name, path: '/', isDir: true, children: [] }]);
```

Change `handleSelect()` no-project branch to open empty content or return:

```ts
if (!projectPath) {
  openFile(entry.path, entry.name, '');
  return;
}
```

Do not add visual styling.

- [ ] **Step 3: Delete `mockFileContents.ts` only if unused**

Run: `rg -n "mockFileContents" apps\\desktop\\client\\ui\\src apps\\desktop\\client\\ui\\test`

If no imports remain, delete `apps/desktop/client/ui/src/shared/data/mockFileContents.ts`. If tests still import it, leave it until those tests are updated.

- [ ] **Step 4: Run verification**

Run:
- `pnpm --filter @orison/desktop-ui typecheck`
- `rg -n "mockFileContents|Fall through to mock data" apps\\desktop\\client\\ui\\src`

Expected:
- Typecheck PASS.
- No production source references to `mockFileContents` or mock fallback comments.

---

### Task 6: Remove Fixed Mock Video Clips

**Files:**
- Modify: `apps/desktop/client/ui/src/features/editor/VideoEditor.tsx`
- Test: `apps/desktop/client/ui/test/videoEditor.test.tsx`

- [ ] **Step 1: Extend video editor test**

Add an assertion to existing `videoEditor.test.tsx`:

```ts
expect(screen.queryByText(/Shot 01/i)).toBeNull();
expect(screen.queryByText(/Shot 02/i)).toBeNull();
expect(screen.queryByText(/Shot 03/i)).toBeNull();
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm --filter @orison/desktop-ui test -- videoEditor.test.tsx`

Expected: FAIL while fixed `mockClips` are rendered.

- [ ] **Step 3: Remove fixed mock clips without changing layout classes**

In `VideoEditor.tsx`:

```ts
// Remove mockClips constant.
```

Replace the grid body:

```tsx
<div className="video-clips-grid">
  {generatedCount > 0 ? (
    <div className="video-clip-card">
      <div className="video-clip-thumb">
        <span className="material-symbols-outlined" aria-hidden="true">movie</span>
      </div>
      <span className="video-clip-label">{`Generated ${generatedCount} video(s)`}</span>
    </div>
  ) : null}
</div>
```

This reuses existing classes and does not change CSS.

- [ ] **Step 4: Run verification**

Run:
- `pnpm --filter @orison/desktop-ui test -- videoEditor.test.tsx`
- `pnpm --filter @orison/desktop-ui typecheck`

Expected: PASS.

---

### Task 7: Make Save Failures Observable

**Files:**
- Modify: `apps/desktop/client/shell/main/ipc/projectIpc.ts`
- Test: existing project IPC test or new focused test.

- [ ] **Step 1: Identify swallowed persistence paths**

Focus on:

```ts
ipcMain.handle('project:sync-meta', ...)
ipcMain.handle('project:sync-chapters-meta', ...)
```

Do not change read-only paths that intentionally return `null`.

- [ ] **Step 2: Change catch blocks to throw useful errors**

Replace:

```ts
} catch { /* best-effort... */ }
```

with:

```ts
} catch (error) {
  throw new Error(error instanceof Error ? error.message : 'Failed to sync project metadata');
}
```

For chapters:

```ts
} catch (error) {
  throw new Error(error instanceof Error ? error.message : 'Failed to sync chapter metadata');
}
```

- [ ] **Step 3: Run shell tests**

Run: `pnpm --filter @orison/desktop-shell test`

Expected: PASS or failures that reveal callers/tests relying on silent success. If such failures occur, update tests/callers to expect rejection and show existing UI error handling.

---

### Task 8: Align IPC Contract With Exposed Surface

**Files:**
- Modify: `packages/shared-contracts/src/ipc.ts`
- Test: `packages/shared-contracts/tests/contracts.test.ts` or create `packages/shared-contracts/tests/ipc-contract.test.ts`

- [ ] **Step 1: Add contract test for key channels**

Create or extend a test:

```ts
import { describe, expect, it } from 'vitest';
import { desktopIpcSchema } from '../src/ipc';

describe('desktop IPC schema', () => {
  it.each([
    'project:create-directory',
    'project:search',
    'field:apply-agent-patch',
    'task:list',
    'asset:list',
    'agent:create-session',
    'orchestration:start-run',
  ])('includes %s', (channel) => {
    expect(() => desktopIpcSchema.parse({ channel })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run shared-contracts tests and verify failure**

Run: `pnpm --filter @orison/shared-contracts test -- ipc-contract.test.ts`

Expected: FAIL for currently missing channels.

- [ ] **Step 3: Add missing channels used by preload/main**

Update `desktopIpcSchema` enum to include all channels currently exposed through `preload/index.ts` and registered in main. At minimum include channels from Task 2 and Task 4 plus the high-traffic missing groups:

```ts
'project:create-directory',
'project:pick-cover-image',
'project:copy-cover-image',
'project:import-docx',
'project:docx-to-html',
'project:docx-to-markdown',
'project:save-meta',
'project:ensure-document',
'project:sync-meta',
'project:sync-chapters-meta',
'project:search',
'project:read-directory',
'project:read-file',
'project:write-file',
'field:apply-agent-patch',
'task:list',
'task:upsert',
'task:update-status',
'task:delete',
'asset:list',
'asset:upsert',
'asset:update',
'asset:delete',
'agent:create-session',
'agent:get-session',
'agent:stream-message',
'orchestration:start-run',
'orchestration:get-run',
'orchestration:action',
'orchestration:auto-mode-start',
'orchestration:auto-mode-action',
'orchestration:auto-mode-get',
```

- [ ] **Step 4: Run shared-contracts tests**

Run:
- `pnpm --filter @orison/shared-contracts test -- ipc-contract.test.ts`
- `pnpm --filter @orison/shared-contracts typecheck`

Expected: PASS.

---

### Task 9: Minimal Lint/Dead-Code Guard

**Files:**
- Modify package `package.json` files only if the change is low-risk.

- [ ] **Step 1: Decide whether to replace placeholder lint scripts**

If the repo has no ESLint config, do not introduce a full lint stack in this cleanup. Instead, keep placeholder lint as a documented residual risk and rely on:

```bash
pnpm --filter @orison/shared-contracts typecheck
pnpm --filter @orison/desktop-local-bff typecheck
pnpm --filter @orison/desktop-shell typecheck
pnpm --filter @orison/desktop-ui typecheck
```

- [ ] **Step 2: Static dead-code checks**

Run:

```bash
rg -n "localhost:18421|mockFileContents|mockClips|lint placeholder|No longer rendered in bottom panel" apps packages
```

Expected after earlier tasks:
- No `localhost:18421`.
- No production use of `mockFileContents`.
- No `mockClips`.
- `lint placeholder` may remain only if Task 9 intentionally defers lint stack introduction.
- Deprecated `InspectorPanel` should be reviewed. Delete only if `rg -n "InspectorPanel" apps\\desktop\\client\\ui\\src` shows no production imports.

---

### Task 10: Final Verification

**Files:** no edits unless verification finds defects.

- [ ] **Step 1: Confirm no style files changed**

Run:

```bash
git diff --name-only
```

Expected: no files under:
- `apps/desktop/client/ui/src/shared/styles/`
- `apps/desktop/client/ui/src/shared/themes/`
- CSS files

- [ ] **Step 2: Confirm renderer has no forbidden direct local service call**

Run:

```bash
rg -n "localhost:18421|fetch\\(" apps\\desktop\\client\\ui\\src
```

Expected: no direct localhost search call. Any remaining `fetch()` must be reviewed and justified.

- [ ] **Step 3: Run targeted package tests**

Run:

```bash
pnpm --filter @orison/desktop-local-bff test -- fieldSyncBridge.test.ts
pnpm --filter @orison/desktop-shell test -- fieldSyncIpc.test.ts
pnpm --filter @orison/desktop-shell test -- projectSearchIpc.test.ts
pnpm --filter @orison/desktop-ui test -- creativeFieldsSlice.test.ts
pnpm --filter @orison/desktop-ui test -- videoEditor.test.tsx
pnpm --filter @orison/shared-contracts test -- ipc-contract.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Run typechecks**

Run:

```bash
pnpm --filter @orison/shared-contracts typecheck
pnpm --filter @orison/desktop-local-bff typecheck
pnpm --filter @orison/desktop-shell typecheck
pnpm --filter @orison/desktop-ui typecheck
```

Expected: all PASS.

- [ ] **Step 5: Review UTF-8 handling**

Run:

```bash
Get-Content -Encoding UTF8 apps\desktop\client\ui\src\features\search-panel\SearchPanel.tsx
Get-Content -Encoding UTF8 apps\desktop\local-bff\sync\fieldSyncBridge.ts
```

Expected: Chinese text, if present, reads correctly. No mojibake introduced.

---

## Self-Review Notes

- Spec coverage: data writeback, IPC boundary, mock fallbacks, video mock module, save error propagation, IPC contract drift, UTF-8 guardrails, and no-style-change constraint are covered.
- Placeholder scan: no implementation step says to add unspecified handling; each code-changing task has concrete file paths and code shape.
- Type consistency: new API name is consistently `applyAgentFieldPatch`; IPC channel is consistently `field:apply-agent-patch`; search API is consistently `searchProject` and `project:search`.
