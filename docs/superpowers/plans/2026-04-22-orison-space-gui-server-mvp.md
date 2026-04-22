# Orison Space GUI + Server MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-oriented Orison Space MVP around the desktop application and remote server, using the new `apps/ + packages/` monorepo structure and keeping Agent implementation out of scope.

**Architecture:** The desktop application is split into `shell`, `ui`, and `local-bff` so native host concerns, product UI, and adaptation logic stay decoupled. The remote server is organized by Orison Space business modules such as auth, project, task, review, quota, and audit. Shared contracts, shared utilities, and reusable UI primitives are isolated under `packages/`.

**Tech Stack:** Electron, React, TypeScript, pnpm workspaces, Turbo, Tailwind CSS, Zustand, TanStack Query, Fastify, Zod, Vitest, React Testing Library

---

## File Structure

The implementation will converge the repo to this structure:

```text
apps/
  desktop/
    shell/
      main/
      preload/
      resources/
    ui/
      src/
        app/
        pages/
        features/
        widgets/
        shared/
        processes/
      public/
    local-bff/
      api/
      ipc/
      sync/
      index.ts
  server/
    src/
      modules/
        auth/
        user/
        project/
        asset/
        task/
        review/
        quota/
        audit/
      common/
      infra/
      app.ts
    test/
packages/
  shared-contracts/
  shared-utils/
  ui-kit/
  eslint-config/
docs/
  architecture/
  api/
  ipc/
  deployment/
scripts/
.github/
pnpm-workspace.yaml
turbo.json
package.json
```

---

## Module Decoupling Rules

These rules are part of the implementation, not optional cleanup:

- `apps/desktop/ui` may depend on `packages/shared-contracts`, `packages/shared-utils`, and `packages/ui-kit`, but must not import runtime code from `apps/server`
- `apps/desktop/ui` must not import Node.js or Electron host code directly
- `apps/desktop/shell` exposes a minimal preload surface; it must not contain business UI state
- `apps/desktop/local-bff` is the only desktop layer allowed to orchestrate remote API calls, IPC calls, and local sync flows together
- `apps/server` may depend on `packages/shared-contracts` and `packages/shared-utils`, but must not import from `apps/desktop/*`
- `packages/shared-contracts` contains DTOs, schema validators, API contracts, and IPC contracts only
- `packages/shared-utils` contains pure functions only
- `packages/ui-kit` contains reusable UI primitives only; it must not know Orison Space business domains
- `apps/server/src/modules` must follow Orison Space business boundaries, not generic admin-template boundaries
- Future Agent integration must arrive through contracts and replaceable adapters, not through direct GUI-to-Agent coupling

---

### Task 0: Reorganize the repository to the new monorepo structure

**Files:**
- Create: `apps/desktop/shell/`
- Create: `apps/desktop/ui/`
- Create: `apps/desktop/local-bff/`
- Create: `apps/server/`
- Create: `packages/shared-contracts/`
- Create: `packages/shared-utils/`
- Create: `packages/ui-kit/`
- Create: `packages/eslint-config/`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing repository shape test**

```ts
// packages/shared-contracts/test/repository-shape.test.ts
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('repository shape', () => {
  it('uses apps and packages instead of the old layout', () => {
    expect(existsSync('apps/desktop/shell')).toBe(true);
    expect(existsSync('apps/desktop/ui')).toBe(true);
    expect(existsSync('apps/desktop/local-bff')).toBe(true);
    expect(existsSync('apps/server')).toBe(true);
    expect(existsSync('packages/shared-contracts')).toBe(true);
    expect(existsSync('packages/shared-utils')).toBe(true);
    expect(existsSync('packages/ui-kit')).toBe(true);
    expect(existsSync('packages/eslint-config')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the repository shape test to verify it fails**

Run: `pnpm --filter @orison/shared-contracts test repository-shape.test.ts`
Expected: FAIL because the new structure does not exist yet.

- [ ] **Step 3: Perform the repository reorganization**

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - apps/desktop/*
  - packages/*
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^test"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    }
  }
}
```

- [ ] **Step 4: Run the repository shape test to verify it passes**

Run: `pnpm --filter @orison/shared-contracts test repository-shape.test.ts`
Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore apps packages
git commit -m "chore: adopt apps packages monorepo structure"
```

---

### Task 1: Build shared contracts, shared utilities, and UI package foundations

**Files:**
- Create: `packages/shared-contracts/package.json`
- Create: `packages/shared-contracts/src/auth.ts`
- Create: `packages/shared-contracts/src/project.ts`
- Create: `packages/shared-contracts/src/task.ts`
- Create: `packages/shared-contracts/src/ipc.ts`
- Create: `packages/shared-contracts/src/index.ts`
- Create: `packages/shared-contracts/test/contracts.test.ts`
- Create: `packages/shared-utils/package.json`
- Create: `packages/shared-utils/src/index.ts`
- Create: `packages/ui-kit/package.json`
- Create: `packages/ui-kit/src/index.ts`
- Create: `packages/eslint-config/package.json`

- [ ] **Step 1: Write the failing shared-contract test**

```ts
// packages/shared-contracts/test/contracts.test.ts
import { describe, expect, it } from 'vitest';
import {
  loginResponseSchema,
  projectDocumentSchema,
  taskRequestSchema,
  taskResultSchema,
  desktopIpcSchema
} from '../src';

describe('shared contracts', () => {
  it('accepts a valid task request and task result', () => {
    expect(() =>
      taskRequestSchema.parse({
        taskId: 'task_123',
        taskType: 'story.rewrite',
        projectFingerprint: 'project_abc',
        selectedScope: {
          module: 'story',
          entityId: 'act_1'
        },
        contextPayload: {
          story: {
            title: 'Cold City'
          }
        },
        userInstruction: 'Make it darker.',
        privacyLevel: 'minimal',
        expectedOutputType: 'patch'
      })
    ).not.toThrow();

    expect(() =>
      taskResultSchema.parse({
        taskId: 'task_123',
        status: 'completed',
        outputType: 'patch',
        outputPayload: {
          operations: [
            {
              op: 'replace',
              path: 'story.acts[0].summary',
              value: 'Darker version'
            }
          ]
        },
        summary: 'Darkened the opening beat.',
        rationale: 'Added noir tension.',
        reviewHint: 'Check the tonal shift.',
        retryable: true
      })
    ).not.toThrow();
  });

  it('accepts the minimal local project document shape', () => {
    const parsed = projectDocumentSchema.parse({
      meta: {
        id: 'project_1',
        name: 'Orison Demo',
        version: 1
      },
      story: {
        title: 'Orison',
        acts: []
      },
      script: {
        scenes: []
      },
      storyboard: {
        shots: []
      }
    });

    expect(parsed.meta.name).toBe('Orison Demo');
  });

  it('defines a whitelisted desktop IPC surface', () => {
    const parsed = desktopIpcSchema.parse({
      channel: 'project:pick-directory'
    });

    expect(parsed.channel).toBe('project:pick-directory');
  });

  it('requires login responses to return bearer tokens', () => {
    const parsed = loginResponseSchema.parse({
      accessToken: 'token_123',
      tokenType: 'Bearer',
      user: {
        id: 'user_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      }
    });

    expect(parsed.user.id).toBe('user_1');
  });
});
```

- [ ] **Step 2: Run the shared-contract test to verify it fails**

Run: `pnpm --filter @orison/shared-contracts test contracts.test.ts`
Expected: FAIL because the package and schemas do not exist yet.

- [ ] **Step 3: Write the minimal shared package implementation**

```json
// packages/shared-contracts/package.json
{
  "name": "@orison/shared-contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest --run"
  },
  "dependencies": {
    "zod": "^3.24.3"
  }
}
```

```ts
// packages/shared-contracts/src/ipc.ts
import { z } from 'zod';

export const desktopIpcSchema = z.object({
  channel: z.enum(['project:pick-directory'])
});
```

- [ ] **Step 4: Run the shared-contract test to verify it passes**

Run: `pnpm --filter @orison/shared-contracts test contracts.test.ts`
Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages
git commit -m "feat: add shared contracts and package foundations"
```

---

### Task 2: Build the desktop shell and preload boundary

**Files:**
- Create: `apps/desktop/shell/package.json`
- Create: `apps/desktop/shell/main/index.ts`
- Create: `apps/desktop/shell/main/ipc/projectIpc.ts`
- Create: `apps/desktop/shell/preload/index.ts`
- Create: `apps/desktop/shell/resources/.gitkeep`
- Create: `apps/desktop/shell/test/preload-contract.test.ts`

- [ ] **Step 1: Write the failing preload contract test**

```ts
// apps/desktop/shell/test/preload-contract.test.ts
import { describe, expect, it } from 'vitest';
import { exposedDesktopApi } from '../preload/index';

describe('desktop preload contract', () => {
  it('only exposes the whitelisted desktop api surface', () => {
    expect(Object.keys(exposedDesktopApi)).toEqual(['pickProjectDirectory']);
  });
});
```

- [ ] **Step 2: Run the preload contract test to verify it fails**

Run: `pnpm --filter @orison/desktop-shell test preload-contract.test.ts`
Expected: FAIL because the shell package and preload export do not exist yet.

- [ ] **Step 3: Write the minimal shell implementation**

```ts
// apps/desktop/shell/main/ipc/projectIpc.ts
import { dialog, ipcMain } from 'electron';

const allowedChannels = new Set(['project:pick-directory']);

export function registerProjectIpc() {
  if (!allowedChannels.has('project:pick-directory')) {
    throw new Error('IPC whitelist misconfigured');
  }

  ipcMain.handle('project:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });

    return result.canceled ? null : result.filePaths[0];
  });
}
```

```ts
// apps/desktop/shell/preload/index.ts
export const exposedDesktopApi = {
  pickProjectDirectory: () => window.electronAPI?.pickProjectDirectory?.()
};
```

- [ ] **Step 4: Run the preload contract test to verify it passes**

Run: `pnpm --filter @orison/desktop-shell test preload-contract.test.ts`
Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/shell
git commit -m "feat: add desktop shell and preload boundary"
```

---

### Task 3: Build desktop local-bff as the orchestration layer

**Files:**
- Create: `apps/desktop/local-bff/package.json`
- Create: `apps/desktop/local-bff/api/clientApi.ts`
- Create: `apps/desktop/local-bff/ipc/shellBridge.ts`
- Create: `apps/desktop/local-bff/sync/localProjectRepository.ts`
- Create: `apps/desktop/local-bff/index.ts`
- Create: `apps/desktop/local-bff/test/localProjectRepository.test.ts`

- [ ] **Step 1: Write the failing local project repository test**

```ts
// apps/desktop/local-bff/test/localProjectRepository.test.ts
import { describe, expect, it } from 'vitest';
import {
  applyPatchOperations,
  createEmptyProjectDocument
} from '../sync/localProjectRepository';

describe('local project repository helpers', () => {
  it('creates an empty local project document', () => {
    const project = createEmptyProjectDocument('Orison Demo');

    expect(project.meta.name).toBe('Orison Demo');
    expect(project.story.acts).toEqual([]);
    expect(project.script.scenes).toEqual([]);
    expect(project.storyboard.shots).toEqual([]);
  });

  it('applies a replace patch to the first story act summary', () => {
    const project = {
      meta: { id: 'project_1', name: 'Demo', version: 1 },
      story: { title: 'Demo', acts: [{ id: 'act_1', title: 'Arrival', summary: 'Old value' }] },
      script: { scenes: [] },
      storyboard: { shots: [] }
    };

    const updated = applyPatchOperations(project, [
      {
        op: 'replace',
        path: 'story.acts[0].summary',
        value: 'New value'
      }
    ]);

    expect(updated.story.acts[0].summary).toBe('New value');
  });
});
```

- [ ] **Step 2: Run the local project repository test to verify it fails**

Run: `pnpm --filter @orison/desktop-local-bff test localProjectRepository.test.ts`
Expected: FAIL because the local-bff package and sync helpers do not exist yet.

- [ ] **Step 3: Write the minimal local-bff implementation**

```ts
// apps/desktop/local-bff/index.ts
export * from './api/clientApi';
export * from './ipc/shellBridge';
export * from './sync/localProjectRepository';
```

- [ ] **Step 4: Run the local project repository test to verify it passes**

Run: `pnpm --filter @orison/desktop-local-bff test localProjectRepository.test.ts`
Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/local-bff
git commit -m "feat: add desktop local bff layer"
```

---

### Task 4: Build the desktop UI workspace shell

**Files:**
- Create: `apps/desktop/ui/package.json`
- Create: `apps/desktop/ui/src/app/App.tsx`
- Create: `apps/desktop/ui/src/pages/workspace/WorkspacePage.tsx`
- Create: `apps/desktop/ui/src/widgets/layout/WorkspaceLayout.tsx`
- Create: `apps/desktop/ui/src/features/auth/LoginView.tsx`
- Create: `apps/desktop/ui/src/features/project-tree/ProjectTree.tsx`
- Create: `apps/desktop/ui/src/features/editor/EditorTabs.tsx`
- Create: `apps/desktop/ui/src/features/inspector/InspectorPanel.tsx`
- Create: `apps/desktop/ui/src/features/tasks/TaskFeedPanel.tsx`
- Create: `apps/desktop/ui/src/shared/store/appStore.ts`
- Create: `apps/desktop/ui/src/shared/styles/tokens.css`
- Create: `apps/desktop/ui/test/workspaceLayout.test.tsx`

- [ ] **Step 1: Write the failing workspace layout test**

```tsx
// apps/desktop/ui/test/workspaceLayout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceLayout } from '../src/widgets/layout/WorkspaceLayout';

describe('WorkspaceLayout', () => {
  it('renders top bar, project tree, editor tabs, and inspector', () => {
    render(<WorkspaceLayout />);

    expect(screen.getByText('Orison Space')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Project Tree' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Editor Modules' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Inspector Panel' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the workspace layout test to verify it fails**

Run: `pnpm --filter @orison/desktop-ui test workspaceLayout.test.tsx`
Expected: FAIL because the UI package and layout components do not exist yet.

- [ ] **Step 3: Write the minimal workspace UI implementation**

```tsx
// apps/desktop/ui/src/widgets/layout/WorkspaceLayout.tsx
export function WorkspaceLayout() {
  return (
    <div>
      <header>
        <h1>Orison Space</h1>
      </header>
      <div>
        <nav aria-label="Project Tree" />
        <main>
          <div role="tablist" aria-label="Editor Modules" />
        </main>
        <aside aria-label="Inspector Panel" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the workspace layout test to verify it passes**

Run: `pnpm --filter @orison/desktop-ui test workspaceLayout.test.tsx`
Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/ui
git commit -m "feat: add desktop ui workspace shell"
```

---

### Task 5: Build the server foundation with Orison Space business modules

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/common/logger.ts`
- Create: `apps/server/src/common/env.ts`
- Create: `apps/server/src/modules/auth/routes.ts`
- Create: `apps/server/src/modules/task/routes.ts`
- Create: `apps/server/src/modules/task/service.ts`
- Create: `apps/server/src/modules/task/mockAdapter.ts`
- Create: `apps/server/src/modules/task/cachePolicy.ts`
- Create: `apps/server/test/auth.test.ts`
- Create: `apps/server/test/task.test.ts`

- [ ] **Step 1: Write the failing auth and task tests**

```ts
// apps/server/test/auth.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';

describe('server bootstrap', () => {
  it('returns health status without auth', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
```

```ts
// apps/server/test/task.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';

describe('task routes', () => {
  it('creates a task and returns a queued response', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      payload: {
        taskId: 'task_1',
        taskType: 'story.rewrite',
        projectFingerprint: 'project_demo',
        selectedScope: { module: 'story', entityId: 'act_1' },
        contextPayload: { story: { title: 'Cold City' } },
        userInstruction: 'Make it darker.',
        privacyLevel: 'minimal',
        expectedOutputType: 'patch'
      }
    });

    expect(response.statusCode).toBe(202);
  });
});
```

- [ ] **Step 2: Run the server tests to verify they fail**

Run: `pnpm --filter @orison/server test auth.test.ts`
Run: `pnpm --filter @orison/server test task.test.ts`
Expected: FAIL because the server package and modular routes do not exist yet.

- [ ] **Step 3: Write the minimal modular server implementation**

```text
The server must be organized by domain modules from day one:
- auth
- user
- project
- asset
- task
- review
- quota
- audit

For MVP, implement only:
- auth
- task

Create empty module directories for the remaining modules so the boundary is explicit.
```

- [ ] **Step 4: Run the server tests to verify they pass**

Run: `pnpm --filter @orison/server test auth.test.ts`
Run: `pnpm --filter @orison/server test task.test.ts`
Expected: PASS with 2 passing test files.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat: add modular server foundation"
```

---

### Task 6: Connect desktop UI through local-bff to the server review loop

**Files:**
- Create: `apps/desktop/ui/test/reviewFlow.test.tsx`
- Modify: `apps/desktop/ui/src/app/App.tsx`
- Modify: `apps/desktop/ui/src/features/tasks/TaskFeedPanel.tsx`
- Modify: `apps/desktop/ui/src/features/editor/EditorTabs.tsx`
- Modify: `apps/desktop/ui/src/shared/store/appStore.ts`
- Modify: `apps/desktop/local-bff/api/clientApi.ts`
- Modify: `apps/desktop/local-bff/sync/localProjectRepository.ts`

- [ ] **Step 1: Write the failing review flow test**

```tsx
// apps/desktop/ui/test/reviewFlow.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('review flow', () => {
  it('shows a completed task and applies the patch when accepted', async () => {
    render(<App />);

    const createTaskButton = await screen.findByRole('button', { name: 'Run AI Rewrite' });
    await userEvent.click(createTaskButton);

    const acceptButton = await screen.findByRole('button', { name: 'Accept Task Result' });
    await userEvent.click(acceptButton);

    expect(await screen.findByDisplayValue('Rewritten: Make the opening darker.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the review flow test to verify it fails**

Run: `pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx`
Expected: FAIL because the UI is not yet connected through local-bff to the task API and review flow.

- [ ] **Step 3: Write the minimal review-loop integration**

```text
The required dependency direction is:
desktop ui -> desktop local-bff -> shared-contracts -> server

The UI must not import server code directly.
The UI must not call IPC directly for remote task orchestration.
The accept-flow must write accepted patch results back into the local project repository.
```

- [ ] **Step 4: Run the review flow test to verify it passes**

Run: `pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx`
Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/ui apps/desktop/local-bff
git commit -m "feat: connect desktop review loop through local bff"
```

---

### Task 7: Add production hardening for performance, security, and observability

**Files:**
- Create: `apps/server/test/cachePolicy.test.ts`
- Create: `apps/desktop/shell/test/securitySurface.test.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/modules/task/service.ts`
- Modify: `apps/desktop/shell/main/ipc/projectIpc.ts`
- Modify: `apps/desktop/shell/preload/index.ts`
- Modify: `apps/desktop/ui/src/features/tasks/TaskFeedPanel.tsx`
- Modify: `docs/api/`
- Modify: `docs/ipc/`

- [ ] **Step 1: Write the failing hardening tests**

```ts
// apps/server/test/cachePolicy.test.ts
import { describe, expect, it } from 'vitest';
import { TASK_CACHE_TTL_MS } from '../src/modules/task/cachePolicy';

describe('cache policy', () => {
  it('uses a finite short term cache ttl', () => {
    expect(TASK_CACHE_TTL_MS).toBeGreaterThan(0);
    expect(TASK_CACHE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
```

```ts
// apps/desktop/shell/test/securitySurface.test.ts
import { describe, expect, it } from 'vitest';
import { exposedDesktopApi } from '../preload/index';

describe('preload security surface', () => {
  it('only exposes the whitelisted desktop api', () => {
    expect(Object.keys(exposedDesktopApi)).toEqual(['pickProjectDirectory']);
  });
});
```

- [ ] **Step 2: Run the hardening tests to verify they fail**

Run: `pnpm --filter @orison/server test cachePolicy.test.ts`
Run: `pnpm --filter @orison/desktop-shell test securitySurface.test.ts`
Expected: FAIL because the production hardening changes are not complete yet.

- [ ] **Step 3: Write the minimal hardening implementation**

```text
Required baseline:
- server request body limits
- task cache TTL enforcement
- IPC whitelist enforcement
- minimal preload surface
- task-local UI state isolation to reduce rerenders
- docs/api and docs/ipc updated to match implementation
```

- [ ] **Step 4: Run the hardening tests to verify they pass**

Run: `pnpm --filter @orison/server test cachePolicy.test.ts`
Run: `pnpm --filter @orison/desktop-shell test securitySurface.test.ts`
Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps packages docs
git commit -m "chore: harden desktop and server baseline"
```

---

## Self-Review

### Spec coverage

- `GUI + Server` MVP scope is covered by Tasks 0 through 7.
- The new `apps/ + packages/` monorepo structure is adopted explicitly in Task 0.
- Desktop decoupling is covered through separate `shell`, `ui`, and `local-bff` tasks.
- Shared contracts, shared utilities, and reusable UI primitives are isolated under `packages`.
- Server responsibilities are organized by Orison Space business modules instead of generic backend templates.
- Production performance and security requirements are addressed explicitly in Task 7 and partially in Tasks 2 through 6.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain in the tasks.
- Agent implementation remains out of scope and is represented only by replaceable task adapters and shared contracts.

### Type consistency

- `shared-contracts` is the single source of truth for task, auth, project, and IPC contracts.
- `desktop ui -> local-bff -> shared-contracts -> server` remains the only approved dependency direction across the desktop/server boundary.
- Shell contracts and remote API contracts are documented separately to preserve host/network separation.

## Execution Handoff

Plan updated and saved to `docs/superpowers/plans/2026-04-22-orison-space-gui-server-mvp.md`.
