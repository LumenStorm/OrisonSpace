import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAgent } from '../src/app';

describe('agent skill execution routes', () => {
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-route-project-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-route-external-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('executes a skill by session and name through the HTTP route', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'story-setup');
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
        generate: vi.fn(async () => ({
          content: 'generated: route story context',
          finishReason: 'stop',
        })),
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-setup/execute`,
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
      outputs: ['generated: route story context'],
      continuation: {
        continuationId: expect.any(String),
        sessionId,
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });

    await app.close();
  });

  it('accepts artifact and reference ids for skill execution context', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'story-setup');
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
        generate: vi.fn(async () => ({
          content: 'generated: noir setup context',
          finishReason: 'stop',
        })),
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-setup/execute`,
      payload: {
        input: 'Build a noir setup',
        artifactIds: ['outline-1'],
        referenceIds: ['ref-1'],
      },
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
      outputs: ['generated: noir setup context'],
      continuation: {
        continuationId: expect.any(String),
        sessionId,
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });

    await app.close();
  });

  it('lists stored continuations and restores one into a fork session', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'story-setup');
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
        generate: vi.fn(async () => ({
          content: 'generated: continuation setup',
          finishReason: 'stop',
        })),
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-setup/execute`,
      payload: {
        input: 'Build a noir setup',
      },
    });

    expect(executeResponse.statusCode).toBe(200);

    const listResponse = await app.inject({
      method: 'GET',
      url: `/v1/agent/sessions/${sessionId}/continuations`,
    });

    expect(listResponse.statusCode).toBe(200);
    const listPayload = listResponse.json() as {
      continuations: Array<{ continuationId: string; workflowState: { activeSkill?: string } }>;
    };
    expect(listPayload.continuations).toHaveLength(1);
    expect(listPayload.continuations[0]?.workflowState.activeSkill).toBe('story-setup');

    const restoreResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/continuations/restore`,
      payload: {
        continuationId: listPayload.continuations[0]?.continuationId,
      },
    });

    expect(restoreResponse.statusCode).toBe(200);
    expect(restoreResponse.json()).toMatchObject({
      restored: {
        sourceSessionId: sessionId,
        session: {
          parentId: sessionId,
          sessionRole: 'fork',
        },
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });

    await app.close();
  });

  it('persists node-level workflow state for resumable directory skills', async () => {
    const resumableDir = path.join(externalSkillsRoot, 'story-resumable');
    mkdirSync(path.join(resumableDir, 'references'), { recursive: true });
    writeFileSync(path.join(resumableDir, 'references', 'brief.md'), `# Brief

opening hook
stakes
`, 'utf-8');
    writeFileSync(path.join(resumableDir, 'SKILL.md'), `---
name: story-resumable
description: 可恢复目录 skill
---

# story-resumable

Phase 1

Draft an opening.
加载 [references/brief.md](references/brief.md)
AskUserQuestion

Phase 2

Agent(subagent_type: "narrative-writer", prompt: "Continue the story")
`, 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
        generate: vi.fn(async () => ({
          content: 'generated: resumable opening',
          finishReason: 'stop',
        })),
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-resumable/execute`,
      payload: {
        input: '先写个开头',
      },
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story-resumable',
      status: 'completed',
      outputs: ['generated: resumable opening'],
      continuation: {
        sessionId,
        workflowState: {
          activeSkill: 'story-resumable',
          currentNodeId: 'phase-1:ask:2',
          skillRunState: {
            skill: 'story-resumable',
            currentNodeId: 'phase-1:ask:2',
          },
        },
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: `/v1/agent/sessions/${sessionId}/continuations`,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      continuations: [
        expect.objectContaining({
          workflowState: expect.objectContaining({
            activeSkill: 'story-resumable',
            currentNodeId: 'phase-1:ask:2',
            skillRunState: expect.objectContaining({
              skill: 'story-resumable',
              currentNodeId: 'phase-1:ask:2',
            }),
          }),
        }),
      ],
    });

    const continuationId = (listResponse.json() as {
      continuations: Array<{ continuationId: string }>;
    }).continuations[0]?.continuationId;

    const restoreResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/continuations/restore`,
      payload: {
        continuationId,
      },
    });

    expect(restoreResponse.statusCode).toBe(200);
    expect(restoreResponse.json()).toMatchObject({
      restored: {
        sourceSessionId: sessionId,
        workflowState: {
          activeSkill: 'story-resumable',
          currentNodeId: 'phase-1:ask:2',
          skillRunState: {
            skill: 'story-resumable',
            currentNodeId: 'phase-1:ask:2',
          },
        },
        summary: expect.stringContaining('Current node: phase-1:ask:2'),
        session: {
          parentId: sessionId,
          sessionRole: 'fork',
          skillRunState: {
            skill: 'story-resumable',
            currentNodeId: 'phase-1:ask:2',
          },
        },
      },
    });

    await app.close();
  });

  it('uses the default oh-story external root for end-to-end story execution', async () => {
    const ohStoryRoot = 'I:\\echo\\oh-story-claudecode-main';
    if (!existsSync(path.join(ohStoryRoot, 'skills', 'story', 'SKILL.md'))) {
      return;
    }

    const app = buildAgent({
      runtime: {
        generate: vi.fn(async (messages: Array<{ content: string }>) => {
          const content = messages[0]?.content ?? '';
          if (content.includes('story-short-analyze')) {
            return {
              content: 'generated: default root short analysis',
              finishReason: 'stop',
            };
          }
          return {
            content: 'generated: default root long write',
            finishReason: 'stop',
          };
        }),
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const listResponse = await app.inject({
      method: 'GET',
      url: `/v1/agent/skills?projectPath=${encodeURIComponent(projectPath)}`,
    });

    expect(listResponse.statusCode).toBe(200);
    const listPayload = listResponse.json() as {
      skills: Array<{ name: string; source?: string }>;
    };
    expect(listPayload.skills.find((skill) => skill.name === 'story')?.source).toBe('external');

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story/execute`,
      payload: {
        input: '帮我拆短篇，分析这个故事',
      },
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story',
      status: 'completed',
      outputs: ['generated: default root short analysis'],
      nested: [
        {
          skill: 'story-short-analyze',
          status: 'completed',
        },
      ],
      continuation: {
        sessionId,
        workflowState: {
          activeSkill: 'story',
        },
      },
    });

    await app.close();
  });

  it('runs real oh-story directory workflows for long-write references and review agent spawning', async () => {
    const ohStoryRoot = 'I:\\echo\\oh-story-claudecode-main';
    if (!existsSync(path.join(ohStoryRoot, 'skills', 'story-long-write', 'SKILL.md'))) {
      return;
    }

    const app = buildAgent({
      runtime: {
        generate: vi.fn(async () => ({
          content: 'generated: default root long write workflow',
          finishReason: 'stop',
        })),
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const longWriteResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-long-write/execute`,
      payload: {
        input: '帮我开书，做长篇设定',
      },
    });

    expect(longWriteResponse.statusCode).toBe(200);
    expect(longWriteResponse.json()).toMatchObject({
      skill: 'story-long-write',
      status: 'completed',
      outputs: expect.arrayContaining(['generated: default root long write workflow']),
      continuation: {
        workflowState: {
          activeSkill: 'story-long-write',
          skillRunState: expect.objectContaining({
            skill: 'story-long-write',
            loadedReferenceKeys: expect.arrayContaining([expect.any(String)]),
            resolvedReferences: expect.arrayContaining([
              expect.objectContaining({
                path: expect.stringContaining('references'),
              }),
            ]),
          }),
        },
      },
    });

    const reviewResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-review/execute`,
      payload: {
        input: '审查一下最近章节',
      },
    });

    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewResponse.json()).toMatchObject({
      skill: 'story-review',
      status: 'completed',
      nested: expect.arrayContaining([
        expect.objectContaining({ skill: 'story-architect', status: 'completed' }),
        expect.objectContaining({ skill: 'character-designer', status: 'completed' }),
        expect.objectContaining({ skill: 'narrative-writer', status: 'completed' }),
        expect.objectContaining({ skill: 'consistency-checker', status: 'completed' }),
      ]),
    });

    await app.close();
  });
});
