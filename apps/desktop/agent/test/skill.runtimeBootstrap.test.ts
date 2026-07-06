import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill runtime bootstrap', () => {
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-bootstrap-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-external-skills-'));
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('loads skills from the project skill root and returns one by name', async () => {
    const skillsDir = path.join(projectPath, '.orison', 'skills');
    const skillDir = path.join(skillsDir, 'story-setup');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const generate = vi.fn(async () => ({
      content: 'generated: project story context',
      finishReason: 'stop',
    }));
    const runtime = createWorkflowRuntime({
      generate,
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const loaded = await runtime.loadSkillsForSession(session.id);
    expect(loaded).toContain('story-setup');

    const result = await runtime.executeSkillByName(session.id, 'story-setup');
    expect(result).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
    });
    expect(result.outputs[0]).toContain('# Skill: story-setup');
    expect(result.outputs[0]).toContain('Prepare the story context.');
    expect(generate).not.toHaveBeenCalled();
  });

  it('loads skills from explicit external roots and returns one by name', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'scene-expander');
    mkdirSync(externalSkillDir, { recursive: true });

    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'scene-expander',
      description: 'Expand scenes from external pack',
      prompt: 'Expand the external scene.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const generate = vi.fn(async () => ({
      content: 'generated: external scene expansion',
      finishReason: 'stop',
    }));
    const runtime = createWorkflowRuntime({
      externalSkillRoots: [externalSkillsRoot],
      generate,
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const loaded = await runtime.loadSkillsForSession(session.id);
    expect(loaded).toContain('scene-expander');

    const result = await runtime.executeSkillByName(session.id, 'scene-expander');
    expect(result).toMatchObject({
      skill: 'scene-expander',
      status: 'completed',
    });
    expect(result.outputs[0]).toContain('# Skill: scene-expander');
    expect(result.outputs[0]).toContain('Expand the external scene.');
    expect(generate).not.toHaveBeenCalled();
  });

  it('loads prompt skill content without executing it through generate', async () => {
    const skillsDir = path.join(projectPath, '.orison', 'skills');
    const skillDir = path.join(skillsDir, 'story-setup');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime({
      generate: vi.fn(async () => ({
        content: 'generated: story setup result',
        finishReason: 'stop',
      })),
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const result = await runtime.executeSkillByName(session.id, 'story-setup');
    expect(result).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
    });
    expect(result.outputs[0]).toContain('# Skill: story-setup');
    expect(result.outputs[0]).toContain('Prepare the story context.');
  });

  it('exposes authored story skill names without hardcoded wrapper routing', async () => {
    const storyDir = path.join(externalSkillsRoot, 'story');
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(path.join(storyDir, 'SKILL.md'), `---
name: story
description: 网文工具箱主入口
---

# story

根据用户需求自动路由到对应 skill。
`, 'utf-8');

    const writeDir = path.join(externalSkillsRoot, 'story-write');
    mkdirSync(writeDir, { recursive: true });
    writeFileSync(path.join(writeDir, 'SKILL.md'), `---
name: story-write
description: 长篇网文写作
---

# story-write

用于长篇小说写作。
`, 'utf-8');

    const shortAnalyzeDir = path.join(externalSkillsRoot, 'story-analyze');
    mkdirSync(shortAnalyzeDir, { recursive: true });
    writeFileSync(path.join(shortAnalyzeDir, 'SKILL.md'), `---
name: story-analyze
description: 短篇拆文
---

# story-analyze

用于短篇故事分析。
`, 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const generate = vi.fn(async (messages: Array<{ content: string }>) => {
      const content = messages[0]?.content ?? '';
      if (content.includes('story-analyze')) {
        return {
          content: 'generated: short-form analysis result',
          finishReason: 'stop',
        };
      }
      return {
        content: 'generated: long-form writing result',
        finishReason: 'stop',
      };
    });
    const runtime = createWorkflowRuntime({
      externalSkillRoots: [externalSkillsRoot],
      generate,
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const loaded = await runtime.loadSkillsForSession(session.id);
    expect(loaded).toContain('story');
    expect(loaded).toContain('story-write');
    expect(loaded).toContain('story-analyze');

    const result = await runtime.executeSkillByName(session.id, 'story', {
      input: '我想写长篇小说',
    });
    expect(result).toMatchObject({
      skill: 'story',
      status: 'completed',
    });
    expect(result.outputs[0]).toContain('# Skill: story');
    expect(result.outputs[0]).toContain('根据用户需求自动路由到对应 skill。');

    const analysisResult = await runtime.executeSkillByName(session.id, 'story', {
      input: '帮我拆短篇，分析这个故事',
    });
    expect(analysisResult).toMatchObject({
      skill: 'story',
      status: 'completed',
    });
    expect(analysisResult.outputs[0]).toContain('# Skill: story');
    expect(generate).not.toHaveBeenCalled();
  });

  it('does not create workflow run state when loading a skill by name', async () => {
    const skillsDir = path.join(projectPath, '.orison', 'skills');
    const setupDir = path.join(skillsDir, 'story-setup');
    const reviewDir = path.join(skillsDir, 'story-review');
    mkdirSync(setupDir, { recursive: true });
    mkdirSync(reviewDir, { recursive: true });

    writeFileSync(path.join(setupDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');
    writeFileSync(path.join(reviewDir, 'skill.json'), JSON.stringify({
      name: 'story-review',
      description: 'Review story context',
      prompt: 'Review the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime({
      generate: vi.fn(async () => ({
        content: 'generated',
        finishReason: 'stop',
      })),
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    await runtime.executeSkillByName(session.id, 'story-setup');

    const setupContext = runtime.buildSkillContext(session.id, 'story-setup');
    expect(setupContext.skillRunState).toBeUndefined();

    const reviewContext = runtime.buildSkillContext(session.id, 'story-review');
    expect(reviewContext.skillRunState).toBeUndefined();
    expect(reviewContext.resolvedReferences).toEqual([]);
    expect([...reviewContext.referenceCache.values()]).toEqual([]);
  });
});
