# OpenCode Style Skill Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 Skill 系统从“任意 `SKILL.md` 自动编译成 workflow DAG 并执行”改为 OpenCode 风格的“轻量发现 metadata，原生 `skill` 工具按需加载完整说明，资源由模型显式读取，权限由后端执行”。

**Architecture:** Skill discovery 只负责扫描、解析、去重、过滤可见性；`skill` tool 只把指定 skill 的说明和资源清单注入对话，不直接跑 workflow。工具权限在 runtime 层按 session mode、skill `allowed-tools`、tool class 强制过滤和执行前校验，前端 mode 只负责显示，不再是假权限边界。

**Tech Stack:** TypeScript, Vitest, Electron IPC, Zustand UI store, existing `@orison/desktop-agent` runtime.

---

## Scope

本计划只修复 Agent Skill 加载和调用机制，不重写小说生成节点、不改模型网关、不接入 MCP。保留已有 session、tool registry、IPC streaming 架构。

明确目标：

- `SKILL.md` 不再默认编译为 `compiledPlan`。
- 删除通用路径上的 `ohStoryAdapter` 硬编码关键词 router。
- `skill({ name })` 行为改为“加载 skill 内容”，不是“执行 workflow 到完成”。
- `references/`、`scripts/`、`assets/` 作为 skill 资源清单暴露，由模型通过显式资源读取工具按需读取。
- readonly/suggest/auto 和 skill `allowed-tools` 在后端 runtime 强制执行。

非目标：

- 不实现 MCP tool 注册。
- 不恢复旧 skill launcher/workbench。
- 不保留 oh-story 专用路由行为；oh-story 包应作为普通 skill 包暴露。
- 不提交 git commit；本仓库 AGENTS 指令禁止 commit/push/merge/rebase/reset。

---

## File Structure

### Agent Runtime

- Modify `apps/desktop/agent/src/skill/types.ts`
  - 增加 `allowedTools`、`resources`、`visibility`、`permission` 等轻量字段。
  - 保留 `compiledPlan` 类型兼容，但目录 `SKILL.md` 不再填充。

- Modify `apps/desktop/agent/src/skill/loadSkillFromDir.ts`
  - 移除 `classifyOhStorySkill()` 默认链路。
  - 只按标准 `SKILL.md` / `skill.json` 加载。

- Modify `apps/desktop/agent/src/skill/runtime/directoryAdapter.ts`
  - 不调用 `compileDirectorySkill()`。
  - 收集 `references/`、`reference/`、`_reference/`、`scripts/`、`assets/`，生成资源清单。

- Create `apps/desktop/agent/src/skill/catalog.ts`
  - 统一发现 roots、去重、排序、包级和 skill 级 enabled 过滤。
  - 取代 `workflow.ts` 里分散的 `loadProjectSkills()` / prompt discovery 逻辑。

- Create `apps/desktop/agent/src/tool/skill_resource.ts`
  - 新增本地工具 `skill_resource_list` 和 `skill_resource_read`。
  - 仅允许读取已注册 skill 目录内的资源文件。

- Modify `apps/desktop/agent/src/tool/skill.ts`
  - `skill` tool 改为加载 skill 内容和资源清单。
  - 不再调用 `executeSkillByName()` 跑 workflow。
  - 不再返回 `terminal: true`。

- Modify `apps/desktop/agent/src/tool/builtin.ts`
  - 注册 `skill_resource_list` / `skill_resource_read`。

- Create `apps/desktop/agent/src/runtime/toolPolicy.ts`
  - 定义 tool class、session mode 权限、skill `allowed-tools` 权限。
  - 提供 `filterToolsForPolicy()` 和 `assertToolAllowed()`。

- Modify `apps/desktop/agent/src/agent/loop.ts`
  - 每轮 generate 前按权限过滤 tools。
  - 每个 tool 执行前强制校验权限。
  - 处理 `skill` tool result metadata，激活当前 skill 的 `allowed-tools` 限制。

- Modify `apps/desktop/agent/src/runtime/workflow.ts`
  - `buildRuntimeSystemPrompt()` 只列出 metadata，不暗示自动执行 workflow。
  - `loadSkillsForSession()` / `listSkills()` 使用 `skill/catalog.ts`。
  - 保留 `executeSkillByName()` 作为兼容 API，但改为返回 skill activation payload，后续可废弃。
  - `CreateSessionInput` 支持 `mode`，session 持久化支持 `permissionMode`。

- Modify `apps/desktop/agent/src/types.ts`
  - `SessionState` 增加 `permissionMode?: 'readonly' | 'suggest' | 'auto'`。
  - `ToolResult.metadata` 支持 `activeSkill`。

### Shell / UI

- Modify `apps/desktop/client/ui/src/shared/api/agent.ts`
  - `createAgentSession(projectPath, mode, modelRef)` 传 `mode` 字段，不再把 mode 塞进 `agentName`。

- Modify `apps/desktop/client/ui/src/shared/store/agentSessionSlice.ts`
  - 创建 session 时传 `mode`。
  - readonly/suggest/auto 仍控制 UI diff 展示，但不再作为唯一权限边界。

- Modify `apps/desktop/client/shell/main/ipc/agentIpc.ts`
  - 透传 `CreateSessionInput.mode`。

### Tests

- Create `apps/desktop/agent/test/skill.nativeLoad.test.ts`
- Modify `apps/desktop/agent/test/skill.runtimeBootstrap.test.ts`
- Modify `apps/desktop/agent/test/runtime.permission.test.ts`
- Add or modify UI test in `apps/desktop/client/ui/test/agentInputModelSwitch.test.tsx` or create `agentSessionMode.test.ts`

### Docs

- Modify `docs/agent.md`
  - 更新 Skill 系统描述为 OpenCode 风格按需加载。
  - 标注 workflow DAG/oh-story router 已移除。

---

## Task 1: Add Native Skill Loading Tests

**Files:**
- Create: `apps/desktop/agent/test/skill.nativeLoad.test.ts`
- Modify later: `apps/desktop/agent/src/tool/skill.ts`
- Modify later: `apps/desktop/agent/src/runtime/workflow.ts`

- [ ] **Step 1: Write failing test for `skill` as content loader**

Create `apps/desktop/agent/test/skill.nativeLoad.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('native skill loading', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-native-skill-'));
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    rmSync(projectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('loads a SKILL.md into the conversation instead of executing it as a workflow', async () => {
    const skillDir = path.join(projectPath, '.orison', 'story-tools', 'skills', 'brand-voice');
    mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: brand-voice',
      'description: Keep prose consistent with the project voice guide',
      'allowed-tools:',
      '  - read_file',
      '  - skill_resource_read',
      '---',
      '',
      '# Brand Voice',
      '',
      'Read `references/voice.md` only when style details are needed.',
    ].join('\n'), 'utf-8');
    writeFileSync(path.join(skillDir, 'references', 'voice.md'), 'Use short concrete sentences.', 'utf-8');

    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool-calls',
        toolCalls: [{
          id: 'call-load-skill',
          name: 'skill',
          arguments: JSON.stringify({ name: 'brand-voice' }),
        }],
      })
      .mockResolvedValueOnce({
        content: 'Loaded the brand voice skill and will follow it.',
        finishReason: 'stop',
      });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Use the brand voice rules.',
      abortSignal: new AbortController().signal,
    });

    const messages = runtime.getSession(session.id)?.messages ?? [];
    const skillToolMessage = messages.find((msg) =>
      msg.role === 'tool' &&
      msg.toolResults?.some((result) => result.toolName === 'skill'),
    );

    expect(skillToolMessage?.toolResults?.[0]?.output).toContain('# Skill: brand-voice');
    expect(skillToolMessage?.toolResults?.[0]?.output).toContain('# Brand Voice');
    expect(skillToolMessage?.toolResults?.[0]?.output).toContain('references/voice.md');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(messages.at(-1)?.content).toBe('Loaded the brand voice skill and will follow it.');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.nativeLoad.test.ts
```

Expected: fail because current `skill` tool executes `executeSkillByName()` and returns terminal output instead of loading skill content and continuing the loop.

---

## Task 2: Stop Compiling Directory SKILL.md into Workflow DAGs

**Files:**
- Modify: `apps/desktop/agent/src/skill/runtime/directoryAdapter.ts`
- Modify: `apps/desktop/agent/src/skill/types.ts`
- Test: `apps/desktop/agent/test/skill.directoryCompiler.test.ts`
- Test: `apps/desktop/agent/test/skill.nativeLoad.test.ts`

- [ ] **Step 1: Add failing assertion that directory skills have no `compiledPlan`**

Append to `apps/desktop/agent/test/skill.nativeLoad.test.ts`:

```ts
  it('treats directory SKILL.md files as prompt skills without compiledPlan', async () => {
    const skillDir = path.join(projectPath, '.orison', 'skills', 'plain-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: plain-skill',
      'description: Plain skill with phase text that must not become a DAG',
      '---',
      '',
      '## Phase 1',
      'Read the project.',
      '',
      '## Phase 2',
      'Write the answer.',
    ].join('\n'), 'utf-8');

    const { loadSkillFromDir } = await import('../src/skill/loadSkillFromDir');
    const outcome = await loadSkillFromDir(skillDir, 'project');

    expect(outcome.kind).toBe('loaded');
    if (outcome.kind !== 'loaded') return;
    expect(outcome.skill.workflowMode).toBe('prompt');
    expect(outcome.skill.compiledPlan).toBeUndefined();
    expect(outcome.skill.prompt).toContain('## Phase 1');
  });
```

- [ ] **Step 2: Implement directory loader simplification**

Change `loadDirectorySkill()` in `apps/desktop/agent/src/skill/runtime/directoryAdapter.ts` so it does not import or call `compileDirectorySkill()`.

Target shape:

```ts
const normalized = normalizeSkill({
  format: 'directory',
  name: parsed.name,
  description: parsed.description,
  location: skillDir,
  entryPath,
  prompt: parsed.content,
  workflowMode: 'prompt',
  references: await collectReferenceFiles(skillDir),
  scripts: await collectFiles(path.join(skillDir, 'scripts')),
  assets: await collectFiles(path.join(skillDir, 'assets')),
  allowedTools: parsed.allowedTools,
  priority: parsed.priority,
});

return {
  ...normalized,
  rawSource: parsed.content,
  compiledPlan: undefined,
};
```

Also update `normalizeSkill()` and `NormalizedSkillAssets` if they do not yet accept `assets`.

- [ ] **Step 3: Remove compiler-based expectations**

Update `apps/desktop/agent/test/skill.directoryCompiler.test.ts` so it tests the compiler only as a legacy isolated utility, or delete assertions that directory loader auto-runs compiler.

The important behavior after this task:

```ts
expect(outcome.skill.compiledPlan).toBeUndefined();
expect(outcome.skill.assets.references).toContain(path.join(skillDir, 'references', 'voice.md'));
```

- [ ] **Step 4: Run agent skill tests**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.nativeLoad.test.ts skill.directoryCompiler.test.ts
```

Expected: tests pass after loader simplification.

---

## Task 3: Remove Hardcoded Generic Keyword Router

**Files:**
- Modify: `apps/desktop/agent/src/skill/loadSkillFromDir.ts`
- Modify or delete: `apps/desktop/agent/src/skill/runtime/ohStoryAdapter.ts`
- Modify: `apps/desktop/agent/test/skill.runtimeBootstrap.test.ts`
- Test: `apps/desktop/agent/test/skill.nativeLoad.test.ts`

- [ ] **Step 1: Add failing test that oh-story names are exposed as authored**

Add to `apps/desktop/agent/test/skill.nativeLoad.test.ts`:

```ts
  it('does not rewrite authored skill names through a hardcoded story router', async () => {
    const root = path.join(projectPath, '.orison', 'story-pack', 'skills');
    const longWrite = path.join(root, 'story-long-write');
    const router = path.join(root, 'story');
    mkdirSync(longWrite, { recursive: true });
    mkdirSync(router, { recursive: true });

    writeFileSync(path.join(longWrite, 'SKILL.md'), [
      '---',
      'name: story-long-write',
      'description: Long-form novel writing workflow guidance',
      '---',
      'Long-form writing instructions.',
    ].join('\n'), 'utf-8');

    writeFileSync(path.join(router, 'SKILL.md'), [
      '---',
      'name: story',
      'description: Story skill index that explains which authored skill to load',
      '---',
      'If the user wants a long novel, load `story-long-write`.',
    ].join('\n'), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    const names = await runtime.loadSkillsForSession(session.id);

    expect(names).toContain('story');
    expect(names).toContain('story-long-write');
    expect(names).not.toContain('story-write');
    expect(names).not.toContain('story-analyze');
    expect(names).not.toContain('story-revise');
  });
```

- [ ] **Step 2: Remove adapter from default loader chain**

In `apps/desktop/agent/src/skill/loadSkillFromDir.ts`, remove:

```ts
import { classifyOhStorySkill } from './runtime/ohStoryAdapter';
```

Remove the block that calls `classifyOhStorySkill(entryDir)`.

The loader order becomes:

```ts
// 1. standard directory skill
// 2. manifest skill
// 3. bare SKILL.md fallback
```

- [ ] **Step 3: Keep or delete ohStoryAdapter deliberately**

Preferred: delete `apps/desktop/agent/src/skill/runtime/ohStoryAdapter.ts` and update imports/tests.

If deletion creates too much churn, leave the file unused for one release and add a top comment:

```ts
/**
 * Legacy adapter retained only for migration reference.
 * It is not used by loadSkillFromDir; standard SKILL.md loading is the source of truth.
 */
```

- [ ] **Step 4: Update old router tests**

In `apps/desktop/agent/test/skill.runtimeBootstrap.test.ts`, remove or rewrite the test that expects `story` to route to `story-write` / `story-analyze`.

New expectation:

```ts
expect(loaded).toContain('story');
expect(loaded).toContain('story-long-write');
expect(loaded).not.toContain('story-write');
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.nativeLoad.test.ts skill.runtimeBootstrap.test.ts
```

Expected: no hardcoded story router behavior remains in generic skill loading.

---

## Task 4: Add Skill Catalog with Visibility and Disabled Skill Filtering

**Files:**
- Create: `apps/desktop/agent/src/skill/catalog.ts`
- Modify: `apps/desktop/agent/src/runtime/workflow.ts`
- Modify: `apps/desktop/agent/src/runtime/config.ts`
- Test: `apps/desktop/agent/test/skill.discovery.test.ts`
- Test: `apps/desktop/agent/test/runtime.config.test.ts`

- [ ] **Step 1: Write failing catalog test for disabled individual skills**

Create or append in `apps/desktop/agent/test/skill.discovery.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill catalog visibility', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-catalog-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('hides disabled individual skills from listing and execution catalog', async () => {
    const pkg = path.join(projectPath, '.orison', 'story-tools');
    const root = path.join(pkg, 'skills');
    const enabledSkill = path.join(root, 'enabled-skill');
    const disabledSkill = path.join(root, 'disabled-skill');
    mkdirSync(enabledSkill, { recursive: true });
    mkdirSync(disabledSkill, { recursive: true });

    writeFileSync(path.join(enabledSkill, 'SKILL.md'), [
      '---',
      'name: enabled-skill',
      'description: Enabled skill visible to the agent',
      '---',
      'Enabled body.',
    ].join('\n'), 'utf-8');
    writeFileSync(path.join(disabledSkill, 'SKILL.md'), [
      '---',
      'name: disabled-skill',
      'description: Disabled skill hidden from the agent',
      '---',
      'Disabled body.',
    ].join('\n'), 'utf-8');

    const home = mkdtempSync(path.join(os.tmpdir(), 'orison-home-'));
    vi.doMock('node:os', async () => ({
      ...(await vi.importActual<typeof import('node:os')>('node:os')),
      default: { homedir: () => home },
      homedir: () => home,
    }));
    writeFileSync(path.join(home, '.orison', 'skills.json'), JSON.stringify({
      packages: {
        'story-tools': {
          enabled: true,
          disabledSkills: ['disabled-skill'],
        },
      },
    }, null, 2), 'utf-8');

    const { buildSkillCatalog } = await import('../src/skill/catalog');
    const catalog = await buildSkillCatalog(projectPath);

    expect(catalog.skills.map((skill) => skill.name)).toContain('enabled-skill');
    expect(catalog.skills.map((skill) => skill.name)).not.toContain('disabled-skill');

    rmSync(home, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Implement catalog**

Create `apps/desktop/agent/src/skill/catalog.ts`:

```ts
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadRuntimeConfig, loadSkillsConfig } from '../runtime/config';
import { loadSkillFromDir } from './loadSkillFromDir';
import type { NormalizedSkill } from './types';

export interface SkillCatalog {
  skills: NormalizedSkill[];
  byName: Map<string, NormalizedSkill>;
}

export async function buildSkillCatalog(projectPath: string, extraRoots: string[] = []): Promise<SkillCatalog> {
  const runtimeConfig = await loadRuntimeConfig(projectPath);
  const skillsConfig = await loadSkillsConfig();
  const roots = [...extraRoots, ...runtimeConfig.externalSkillRoots];
  const skills: NormalizedSkill[] = [];
  const byName = new Map<string, NormalizedSkill>();

  for (const root of roots) {
    const packageName = inferPackageName(root);
    const packageConfig = skillsConfig.packages[packageName];
    if (packageConfig?.enabled === false) continue;
    const disabled = new Set(packageConfig?.disabledSkills ?? []);

    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (disabled.has(entry.name)) continue;
      const outcome = await loadSkillFromDir(path.join(root, entry.name), 'external');
      if (outcome.kind !== 'loaded') continue;
      if (disabled.has(outcome.skill.name)) continue;
      byName.set(outcome.skill.name, outcome.skill);
    }
  }

  skills.push(...byName.values());
  return { skills, byName };
}

function inferPackageName(root: string): string {
  const normalized = root.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.at(-1) === 'skills' && parts.length >= 2) return parts.at(-2)!;
  return parts.at(-1) ?? root;
}
```

If project-local `.opencode/skills` is added in this task, add it in `loadRuntimeConfig()` with higher priority than `.orison` compatibility roots.

- [ ] **Step 3: Replace workflow skill loading**

In `apps/desktop/agent/src/runtime/workflow.ts`:

```ts
const catalog = await buildSkillCatalog(session.projectPath, externalSkillRoots);
for (const skill of catalog.skills) {
  if (skillRegistry.has(skill.name)) continue;
  skillRegistry.register(skill);
}
return catalog.skills.map((skill) => skill.name);
```

Use the same catalog in `listSkills()` and `buildRuntimeSystemPrompt()`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.discovery.test.ts runtime.config.test.ts
```

Expected: disabled skills are hidden and cannot be registered for execution.

---

## Task 5: Convert `skill` Tool to Native Load Semantics

**Files:**
- Modify: `apps/desktop/agent/src/tool/skill.ts`
- Modify: `apps/desktop/agent/src/types.ts`
- Modify: `apps/desktop/agent/src/agent/loop.ts`
- Test: `apps/desktop/agent/test/skill.nativeLoad.test.ts`

- [ ] **Step 1: Define skill activation metadata**

In `apps/desktop/agent/src/types.ts`, extend `ToolResult.metadata` usage by documenting this shape near `ToolResult`:

```ts
export interface ActiveSkillMetadata {
  name: string;
  allowedTools?: string[];
  resourceBasePath: string;
}
```

No breaking type change is required if `metadata?: Record<string, unknown>` remains.

- [ ] **Step 2: Change skill tool output**

In `apps/desktop/agent/src/tool/skill.ts`, replace workflow execution with catalog load.

Target behavior:

```ts
const skill = await ctx.skillExecutor.loadSkill?.(ctx.sessionId, params.name);
if (!skill) {
  return { title: `skill: ${params.name}`, output: `Skill "${params.name}" was not found.` };
}

return {
  title: `skill: ${skill.name}`,
  output: renderSkillPayload(skill),
  metadata: {
    activeSkill: {
      name: skill.name,
      allowedTools: skill.allowedTools,
      resourceBasePath: skill.location,
    },
  },
};
```

The rendered payload must include:

```md
# Skill: brand-voice

Description: Keep prose consistent with the project voice guide

## Instructions

<SKILL.md body>

## Skill Resources

Base directory: <absolute skill dir>

- references/voice.md
- scripts/helper.js
- assets/template.md

Use `skill_resource_read` with `{ "skill": "brand-voice", "path": "references/voice.md" }` when you need a resource.
```

Do not set `terminal: true`.

- [ ] **Step 3: Update `SkillExecutorRef`**

In `apps/desktop/agent/src/types.ts`, add:

```ts
loadSkill?(sessionId: string, skillName: string): Promise<import('./skill/types').NormalizedSkill | undefined>;
```

Implement it on `WorkflowRuntime` in `apps/desktop/agent/src/runtime/workflow.ts`:

```ts
async loadSkill(sessionId, skillName) {
  await runtime.loadSkillsForSession(sessionId);
  return skillRegistry.get(skillName);
}
```

- [ ] **Step 4: Make loop activate skill policy**

In `apps/desktop/agent/src/agent/loop.ts`, when a tool result has `metadata.activeSkill`, store it in local loop state:

```ts
let activeSkillAllowedTools: string[] | undefined;
```

After tool execution:

```ts
const activeSkill = toolResult.metadata?.activeSkill as { allowedTools?: string[] } | undefined;
if (activeSkill?.allowedTools) {
  activeSkillAllowedTools = activeSkill.allowedTools;
}
```

Use `activeSkillAllowedTools` in Task 7 policy filtering.

- [ ] **Step 5: Run native load test**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.nativeLoad.test.ts
```

Expected: `skill` loads content, returns resource list, and loop continues to a second model call.

---

## Task 6: Add Explicit Skill Resource Tools

**Files:**
- Create: `apps/desktop/agent/src/tool/skill_resource.ts`
- Modify: `apps/desktop/agent/src/tool/builtin.ts`
- Modify: `apps/desktop/agent/src/types.ts`
- Test: `apps/desktop/agent/test/skill.referenceResolver.test.ts`
- Test: `apps/desktop/agent/test/skill.nativeLoad.test.ts`

- [ ] **Step 1: Write failing resource read test**

Append to `apps/desktop/agent/test/skill.nativeLoad.test.ts`:

```ts
  it('reads skill resources only from inside the owning skill directory', async () => {
    const skillDir = path.join(projectPath, '.orison', 'story-tools', 'skills', 'voice');
    mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: voice',
      'description: Voice guide for prose editing and review',
      '---',
      'Read resources when needed.',
    ].join('\n'), 'utf-8');
    writeFileSync(path.join(skillDir, 'references', 'voice.md'), 'No vague adjectives.', 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { skillResourceReadTool } = await import('../src/tool/skill_resource');
    const runtime = createWorkflowRuntime();
    const session = runtime.createSession({ agentName: 'writer', projectPath });
    await runtime.loadSkillsForSession(session.id);

    const ok = await skillResourceReadTool.execute({
      skill: 'voice',
      path: 'references/voice.md',
    }, {
      sessionId: session.id,
      projectPath,
      abort: new AbortController().signal,
      skillExecutor: runtime,
    });

    expect(ok.output).toContain('No vague adjectives.');

    await expect(skillResourceReadTool.execute({
      skill: 'voice',
      path: '../secret.txt',
    }, {
      sessionId: session.id,
      projectPath,
      abort: new AbortController().signal,
      skillExecutor: runtime,
    })).rejects.toThrow(/outside the skill directory/i);
  });
```

- [ ] **Step 2: Implement resource tools**

Create `apps/desktop/agent/src/tool/skill_resource.ts`:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { defineTool } from './define';

const resourceInput = z.object({
  skill: z.string(),
  path: z.string(),
});

export const skillResourceReadTool = defineTool({
  id: 'skill_resource_read',
  description: 'Read a reference/script/asset file from a loaded skill directory by relative path.',
  parameters: resourceInput,
  async execute(params, ctx) {
    const skill = await ctx.skillExecutor?.loadSkill?.(ctx.sessionId, params.skill);
    if (!skill) throw new Error(`skill "${params.skill}" not found`);
    const root = path.resolve(skill.location);
    const target = path.resolve(root, params.path);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error('resource path is outside the skill directory');
    }
    const output = await readFile(target, 'utf-8');
    return {
      title: `skill_resource_read: ${params.skill}/${params.path}`,
      output,
    };
  },
});

export const skillResourceListTool = defineTool({
  id: 'skill_resource_list',
  description: 'List known resource files for a loaded skill.',
  parameters: z.object({ skill: z.string() }),
  async execute(params, ctx) {
    const skill = await ctx.skillExecutor?.loadSkill?.(ctx.sessionId, params.skill);
    if (!skill) throw new Error(`skill "${params.skill}" not found`);
    const resources = [
      ...(skill.assets.references ?? []),
      ...(skill.assets.scripts ?? []),
      ...(skill.assets.assets ?? []),
    ].map((item) => path.relative(skill.location, item).replace(/\\/g, '/'));
    return {
      title: `skill_resource_list: ${params.skill}`,
      output: resources.map((item) => `- ${item}`).join('\n') || '(no resources)',
    };
  },
});
```

- [ ] **Step 3: Register tools**

In `apps/desktop/agent/src/tool/builtin.ts`:

```ts
import { skillResourceListTool, skillResourceReadTool } from './skill_resource';

registry.register(skillResourceListTool);
registry.register(skillResourceReadTool);
```

Register them near `skillTool`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.nativeLoad.test.ts skill.referenceResolver.test.ts
```

Expected: skill resources are explicit and sandboxed.

---

## Task 7: Enforce Backend Tool Permissions and Session Modes

**Files:**
- Create: `apps/desktop/agent/src/runtime/toolPolicy.ts`
- Modify: `apps/desktop/agent/src/agent/loop.ts`
- Modify: `apps/desktop/agent/src/runtime/workflow.ts`
- Modify: `apps/desktop/agent/src/agent/session.ts`
- Modify: `apps/desktop/agent/src/agent/persistence.ts`
- Modify: `apps/desktop/agent/src/types.ts`
- Test: `apps/desktop/agent/test/runtime.permission.test.ts`

- [ ] **Step 1: Write failing backend permission tests**

Append to `apps/desktop/agent/test/runtime.permission.test.ts`:

```ts
  it('filters write tools in readonly sessions before model generation', async () => {
    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const generate = vi.fn(async (_messages, _system, tools) => {
      expect(tools.map((tool: any) => tool.id)).toContain('read_file');
      expect(tools.map((tool: any) => tool.id)).not.toContain('write_file');
      expect(tools.map((tool: any) => tool.id)).not.toContain('chapter_write');
      return { content: 'readonly ok', finishReason: 'stop' };
    });

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
      mode: 'readonly' as any,
    });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Review this project.',
      abortSignal: new AbortController().signal,
    });

    expect(generate).toHaveBeenCalledOnce();
  });

  it('blocks tool execution when an active skill allowed-tools list excludes the tool', async () => {
    const { assertToolAllowed } = await import('../src/runtime/toolPolicy');

    expect(() => assertToolAllowed({
      toolName: 'write_file',
      sessionMode: 'auto',
      activeSkillAllowedTools: ['read_file'],
    })).toThrow(/not allowed by active skill/i);

    expect(() => assertToolAllowed({
      toolName: 'read_file',
      sessionMode: 'auto',
      activeSkillAllowedTools: ['read_file'],
    })).not.toThrow();
  });
```

- [ ] **Step 2: Implement tool policy**

Create `apps/desktop/agent/src/runtime/toolPolicy.ts`:

```ts
import type { ToolDefinition } from '../types';

export type SessionPermissionMode = 'readonly' | 'suggest' | 'auto';

const WRITE_TOOLS = new Set([
  'write_file',
  'chapter_write',
  'memory_update',
  'generate_image',
  'edit_image',
  'git_commit',
]);

const DIFF_TOOLS = new Set([
  'rewrite_passage',
  'outline_update',
  'overview_update',
]);

export function classifyTool(toolName: string): 'read' | 'write' | 'diff' | 'dangerous' {
  if (toolName === 'git_commit') return 'dangerous';
  if (WRITE_TOOLS.has(toolName)) return 'write';
  if (DIFF_TOOLS.has(toolName)) return 'diff';
  return 'read';
}

export function filterToolsForPolicy(input: {
  tools: ToolDefinition[];
  sessionMode?: SessionPermissionMode;
  activeSkillAllowedTools?: string[];
}): ToolDefinition[] {
  return input.tools.filter((tool) => {
    try {
      assertToolAllowed({
        toolName: tool.id,
        sessionMode: input.sessionMode,
        activeSkillAllowedTools: input.activeSkillAllowedTools,
      });
      return true;
    } catch {
      return false;
    }
  });
}

export function assertToolAllowed(input: {
  toolName: string;
  sessionMode?: SessionPermissionMode;
  activeSkillAllowedTools?: string[];
}): void {
  const mode = input.sessionMode ?? 'suggest';
  const allowed = input.activeSkillAllowedTools;
  if (allowed && !allowed.includes(input.toolName) && input.toolName !== 'skill') {
    throw new Error(`tool "${input.toolName}" is not allowed by active skill`);
  }

  const klass = classifyTool(input.toolName);
  if (mode === 'readonly' && (klass === 'write' || klass === 'diff' || klass === 'dangerous')) {
    throw new Error(`tool "${input.toolName}" is not allowed in readonly mode`);
  }

  if (mode === 'suggest' && klass === 'dangerous') {
    throw new Error(`tool "${input.toolName}" requires auto mode`);
  }
}
```

- [ ] **Step 3: Wire policy into runLoop**

In `apps/desktop/agent/src/agent/loop.ts`:

```ts
const visibleTools = filterToolsForPolicy({
  tools,
  sessionMode: opts.permissionMode,
  activeSkillAllowedTools,
});

const response = await generate(allMessages, systemPrompt, visibleTools, abort, cacheConfig);
```

Before executing each tool:

```ts
assertToolAllowed({
  toolName: call.name,
  sessionMode: opts.permissionMode,
  activeSkillAllowedTools,
});
```

When denied, return a tool error message:

```ts
`Error: tool "${call.name}" is not allowed by the current permission policy`
```

- [ ] **Step 4: Persist session mode**

In `apps/desktop/agent/src/types.ts`:

```ts
permissionMode?: import('./runtime/toolPolicy').SessionPermissionMode;
```

In `createSession()` options:

```ts
mode?: SessionPermissionMode;
```

Set:

```ts
permissionMode: options.mode ?? 'suggest',
```

Persist/load it in `agent/persistence.ts`.

- [ ] **Step 5: Pass mode into runLoop**

In `workflow.ts` calls to `runLoop()`:

```ts
permissionMode: session.permissionMode,
```

Also pass it to child/subagent sessions.

- [ ] **Step 6: Run permission tests**

Run:

```bash
pnpm --filter @orison/desktop-agent test runtime.permission.test.ts
```

Expected: readonly sessions cannot see or execute write tools; skill `allowed-tools` restrictions are enforced.

---

## Task 8: Pass Agent Mode from UI to Runtime

**Files:**
- Modify: `apps/desktop/agent/src/runtime/workflow.ts`
- Modify: `apps/desktop/agent/src/types.ts`
- Modify: `apps/desktop/client/ui/src/shared/api/agent.ts`
- Modify: `apps/desktop/client/ui/src/shared/store/agentSessionSlice.ts`
- Modify: `apps/desktop/client/shell/main/ipc/agentIpc.ts`
- Modify: `packages/shared-contracts/src/ipc.ts`
- Test: `apps/desktop/client/ui/test/agentProjectSwitchReset.test.tsx` or create `agentSessionMode.test.ts`

- [ ] **Step 1: Add UI API test**

Create `apps/desktop/client/ui/test/agentSessionMode.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('agent session mode API', () => {
  beforeEach(() => {
    (window as any).orisonDesktop = {
      createAgentSession: vi.fn(async (input) => ({
        id: 's1',
        agentName: input.agentName,
        projectPath: input.projectPath,
        status: 'idle',
        messages: [],
      })),
    };
    vi.resetModules();
  });

  it('sends permission mode separately from agentName', async () => {
    const { createAgentSession } = await import('../src/shared/api/agent');
    await createAgentSession('I:/project', 'readonly', null);

    expect((window as any).orisonDesktop.createAgentSession).toHaveBeenCalledWith({
      agentName: 'writer',
      projectPath: 'I:/project',
      mode: 'readonly',
      modelRef: undefined,
    });
  });
});
```

- [ ] **Step 2: Update frontend API**

In `apps/desktop/client/ui/src/shared/api/agent.ts`:

```ts
export async function createAgentSession(projectPath: string, mode?: AgentMode, modelRef?: ModelRef | null) {
  return api.createAgentSession({
    agentName: 'writer',
    projectPath,
    mode: mode ?? 'suggest',
    modelRef: modelRef ?? undefined,
  });
}
```

- [ ] **Step 3: Update shared IPC types**

In `packages/shared-contracts/src/ipc.ts`, add `mode?: 'readonly' | 'suggest' | 'auto'` to the create agent session input type exposed to preload.

- [ ] **Step 4: Runtime input support**

In `apps/desktop/agent/src/runtime/workflow.ts`:

```ts
export interface CreateSessionInput {
  agentName: string;
  projectPath: string;
  modelRef?: { keyId: string; modelId: string };
  mode?: 'readonly' | 'suggest' | 'auto';
}
```

Pass `input.mode` into `createSession()`.

- [ ] **Step 5: Run UI and type tests**

Run:

```bash
pnpm --filter @orison/desktop-ui test agentSessionMode.test.ts
pnpm --filter @orison/shared-contracts typecheck
pnpm --filter @orison/desktop-agent typecheck
```

Expected: UI mode reaches backend as permission mode.

---

## Task 9: Retire Workflow Execution from Public Skill APIs

**Files:**
- Modify: `apps/desktop/agent/src/runtime/workflow.ts`
- Modify: `apps/desktop/agent/src/skill/runtime/workflowExecutor.ts`
- Modify: `apps/desktop/agent/test/skill.workflowExecutor.test.ts`
- Modify: `apps/desktop/agent/test/skill.workflowVm.test.ts`
- Modify: `docs/agent.md`

- [ ] **Step 1: Mark workflow executor as legacy internal**

Add a file header to `apps/desktop/agent/src/skill/runtime/workflowExecutor.ts`:

```ts
/**
 * Legacy manifest workflow executor.
 *
 * Standard directory SKILL.md files are OpenCode-style prompt skills and must
 * not be compiled into this executor. Keep this only for explicit manifest
 * workflows until those are removed or redesigned.
 */
```

- [ ] **Step 2: Change executeSkillByName compatibility behavior**

In `workflow.ts`, make `executeSkillByName()` call the same loader used by `skill` tool and return a compatibility result:

```ts
return {
  skill: skill.name,
  status: 'completed',
  outputs: [renderSkillPayload(skill)],
  checkpoints: [],
  pendingConfirmations: [],
  nested: [],
  continuation: runtime.createContinuationSnapshot(sessionId, {
    activeSkill: skill.name,
    checkpoints: [],
  }),
};
```

This keeps IPC consumers from crashing but changes semantics to “load skill”.

- [ ] **Step 3: Update tests that expected automatic workflow execution**

For tests named like:

```ts
executes prompt skills through generate instead of echoing raw prompt text
loads skills from the project skill root and executes one by name
```

Change expectations from generated output to loaded skill payload:

```ts
expect(result.outputs[0]).toContain('# Skill: story-setup');
expect(result.outputs[0]).toContain('project story context');
```

- [ ] **Step 4: Run skill tests**

Run:

```bash
pnpm --filter @orison/desktop-agent test skill.runtimeBootstrap.test.ts skill.workflowExecutor.test.ts skill.workflowVm.test.ts
```

Expected: public API no longer auto-executes directory skills; explicit legacy workflow tests either remain isolated or are removed with matching source cleanup.

---

## Task 10: Update Documentation

**Files:**
- Modify: `docs/agent.md`
- Modify: `docs/agent-panel-ui.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Replace Skill docs**

In `docs/agent.md`, replace the “Skills 系统” section with:

```md
## Skills 系统

Skills 采用 OpenCode 风格的按需加载机制。

目录结构：

```text
.opencode/skills/
└── brand-voice/
    ├── SKILL.md
    ├── references/
    ├── scripts/
    └── assets/
```

`SKILL.md` frontmatter:

```yaml
---
name: brand-voice
description: Keep prose consistent with the project voice guide
allowed-tools:
  - read_file
  - skill_resource_read
metadata:
  version: "1.0"
---
```

运行方式：

1. Runtime 扫描 skill roots，只读取 metadata 和资源清单。
2. System prompt 列出可用 skill 的 `name` / `description`。
3. 模型判断需要时调用 `skill({ name })`。
4. `skill` tool 将完整 `SKILL.md` 内容和资源清单返回到对话。
5. 模型按 skill 指令继续调用普通工具或 `skill_resource_read`。

约束：

- `SKILL.md` 不会自动编译成 workflow DAG。
- runtime 不做硬编码关键词 router。
- `references/`、`scripts/`、`assets/` 不自动注入上下文。
- 权限由后端 session mode 和 skill `allowed-tools` 强制执行。
```
```

- [ ] **Step 2: Update UI docs**

In `docs/agent-panel-ui.md`, change mode docs to say:

```md
Mode 由前端传入 runtime，并在后端执行：

- readonly：后端不暴露写入、diff、危险工具。
- suggest：后端允许 read/diff，危险工具拒绝，写入工具需要明确确认或后续策略控制。
- auto：后端允许完整工具集，但仍受 skill `allowed-tools` 限制。
```

- [ ] **Step 3: Changelog entry**

In `CHANGELOG.md`, add under unreleased/current section:

```md
- Agent Skill 改为 OpenCode 风格按需加载：`skill` tool 只加载 `SKILL.md` 内容和资源清单，不再将任意 `SKILL.md` 编译执行为 workflow DAG；后端开始强制执行 session mode 与 skill `allowed-tools` 权限。
```

- [ ] **Step 4: Run docs grep sanity**

Run:

```bash
rg -n "compiledPlan|ohStoryAdapter|story-write|story-analyze|story-revise|priority: required|假权限|前端控制，后端无感知" docs apps/desktop/agent/src
```

Expected: remaining matches are either legacy comments with clear “legacy” wording or removed.

---

## Final Verification

- [ ] Run desktop agent tests:

```bash
pnpm --filter @orison/desktop-agent test
```

Expected: all agent tests pass.

- [ ] Run desktop agent typecheck:

```bash
pnpm --filter @orison/desktop-agent typecheck
```

Expected: no TypeScript errors.

- [ ] Run UI skill/mode tests:

```bash
pnpm --filter @orison/desktop-ui test agentPanelSkills.test.tsx agentSessionMode.test.ts
```

Expected: all selected UI tests pass.

- [ ] Run shared contracts typecheck:

```bash
pnpm --filter @orison/shared-contracts typecheck
```

Expected: no contract type errors.

- [ ] Check git diff only:

```bash
git status --short
git diff --stat
```

Expected: changes limited to agent skill runtime, UI mode wiring, tests, and docs. Do not commit.

---

## Risk Notes

- This is a behavior-breaking change for existing oh-story adapted skills. The intended migration path is to call authored skill names directly, such as `story-long-write` and `story-short-write`, instead of relying on the old `story -> story-write` router.
- Existing workflow executor code can remain temporarily for explicit manifest workflows, but directory `SKILL.md` must not enter it.
- Backend readonly may reveal current assumptions in tests that expected write tools to be visible. Those tests should be updated because the previous behavior was unsafe.
- `suggest` mode needs a clear product decision after this plan: either ask before write execution, or convert write tools to patch-producing tools. This plan enforces the backend boundary first and keeps current diff UI compatible.

---

## Self-Review

Spec coverage:

- “不要把任意 SKILL.md 编译成 workflow DAG” covered by Tasks 2 and 9.
- “不要靠硬编码 keyword router 做通用调用” covered by Task 3.
- “保留轻量 metadata 发现 + 原生 skill tool” covered by Tasks 4 and 5.
- “reference/scripts/assets 当作 skill 目录内资源，由 skill 内容指导模型按需读取” covered by Task 6.
- “权限、可见性、allowed tools 做成明确配置，而不是 UI 层假权限” covered by Tasks 4, 7, and 8.

Placeholder scan:

- No TBD/TODO placeholders.
- Every task names concrete files and commands.
- Test snippets define concrete expected behavior.

Type consistency:

- `permissionMode` is the persisted runtime field.
- UI still uses `AgentMode`, mapped into create-session `mode`.
- `allowedTools` is the normalized field derived from frontmatter `allowed-tools`.

