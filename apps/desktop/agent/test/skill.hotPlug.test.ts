import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill hot plugging', () => {
  let homePath = '';
  let projectPath = '';
  let otherProjectPath = '';

  beforeEach(() => {
    homePath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-hot-home-'));
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-hot-project-'));
    otherProjectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-hot-other-'));
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        default: {
          ...actual.default,
          homedir: () => homePath,
        },
        homedir: () => homePath,
      };
    });
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    closeDb(otherProjectPath);
    rmSync(homePath, { recursive: true, force: true });
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(otherProjectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('reloads changed SKILL.md content after the skill was already loaded', async () => {
    const skillDir = writeProjectSkill(projectPath, 'mutable-skill', 'Version one instructions.');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    const first = await runtime.loadSkill(session.id, 'mutable-skill');
    expect(first?.prompt).toContain('Version one instructions.');

    writeSkillFile(skillDir, 'mutable-skill', 'Version two instructions.');

    const second = await runtime.loadSkill(session.id, 'mutable-skill');
    expect(second?.prompt).toContain('Version two instructions.');
    expect(second?.prompt).not.toContain('Version one instructions.');
  });

  it('removes deleted skills from session loading and direct lookup', async () => {
    const skillDir = writeProjectSkill(projectPath, 'deleted-skill', 'Temporary instructions.');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    expect(await runtime.loadSkill(session.id, 'deleted-skill')).toBeDefined();

    rmSync(skillDir, { recursive: true, force: true });

    await expect(runtime.loadSkillsForSession(session.id)).resolves.not.toContain('deleted-skill');
    await expect(runtime.loadSkill(session.id, 'deleted-skill')).resolves.toBeUndefined();
  });

  it('removes disabled skills and disabled packages from direct lookup', async () => {
    writePackagedSkill(projectPath, 'story-pack', 'toggle-skill', 'Toggle skill instructions.');
    writePackagedSkill(projectPath, 'disabled-pack', 'package-skill', 'Package skill instructions.');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { setPackageEnabled, setSkillEnabled } = await import('../src/runtime/config');
    const runtime = createWorkflowRuntime();
    const session = runtime.createSession({ agentName: 'writer', projectPath });

    expect(await runtime.loadSkill(session.id, 'toggle-skill')).toBeDefined();
    expect(await runtime.loadSkill(session.id, 'package-skill')).toBeDefined();

    await setSkillEnabled('story-pack', 'toggle-skill', false);
    await setPackageEnabled('disabled-pack', false);

    const names = await runtime.loadSkillsForSession(session.id);
    expect(names).not.toContain('toggle-skill');
    expect(names).not.toContain('package-skill');
    await expect(runtime.loadSkill(session.id, 'toggle-skill')).resolves.toBeUndefined();
    await expect(runtime.loadSkill(session.id, 'package-skill')).resolves.toBeUndefined();
  });

  it('keeps same-name skills isolated per project', async () => {
    writeProjectSkill(projectPath, 'shared-skill', 'Project A instructions.');
    writeProjectSkill(otherProjectPath, 'shared-skill', 'Project B instructions.');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();
    const sessionA = runtime.createSession({ agentName: 'writer', projectPath });
    const sessionB = runtime.createSession({ agentName: 'writer', projectPath: otherProjectPath });

    expect((await runtime.loadSkill(sessionA.id, 'shared-skill'))?.prompt).toContain('Project A instructions.');
    expect((await runtime.loadSkill(sessionB.id, 'shared-skill'))?.prompt).toContain('Project B instructions.');
    expect((await runtime.loadSkill(sessionA.id, 'shared-skill'))?.prompt).toContain('Project A instructions.');
  });

  it('ignores stale active skill restrictions after that skill is disabled', async () => {
    writePackagedSkill(projectPath, 'story-pack', 'read-only-skill', 'Only inspect files.', [
      'allowed-tools:',
      '  - read_file',
    ]);

    const visibleToolsByCall: string[][] = [];
    const generate = vi.fn(async (_messages, _system, tools) => {
      visibleToolsByCall.push(tools.map((tool: any) => tool.id));
      if (visibleToolsByCall.length === 1) {
        return {
          content: '',
          finishReason: 'tool-calls',
          toolCalls: [{
            id: 'call-load-skill',
            name: 'skill',
            arguments: JSON.stringify({ name: 'read-only-skill' }),
          }],
        };
      }
      return { content: 'done', finishReason: 'stop' };
    });

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const { setSkillEnabled } = await import('../src/runtime/config');
    const { registerBuiltinTools } = await import('../src/tool/builtin');
    registerBuiltinTools();

    const runtime = createWorkflowRuntime({ generate });
    const session = runtime.createSession({ agentName: 'writer', projectPath, mode: 'auto' });

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Load read-only skill.',
      abortSignal: new AbortController().signal,
    });

    expect(visibleToolsByCall[1]).toContain('read_file');
    expect(visibleToolsByCall[1]).not.toContain('write_file');

    await setSkillEnabled('story-pack', 'read-only-skill', false);

    await runtime.sendMessage({
      sessionId: session.id,
      content: 'Continue without that disabled skill.',
      abortSignal: new AbortController().signal,
    });

    expect(visibleToolsByCall[2]).toContain('write_file');
  });
});

function writeProjectSkill(projectPath: string, skillName: string, body: string, extraFrontmatter: string[] = []): string {
  const skillDir = path.join(projectPath, '.orison', 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeSkillFile(skillDir, skillName, body, extraFrontmatter);
  return skillDir;
}

function writePackagedSkill(projectPath: string, packageName: string, skillName: string, body: string, extraFrontmatter: string[] = []): string {
  const skillDir = path.join(projectPath, '.orison', packageName, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeSkillFile(skillDir, skillName, body, extraFrontmatter);
  return skillDir;
}

function writeSkillFile(skillDir: string, skillName: string, body: string, extraFrontmatter: string[] = []): void {
  writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${skillName}`,
    `description: ${skillName} description`,
    ...extraFrontmatter,
    '---',
    '',
    body,
  ].join('\n'), 'utf-8');
}
