import { describe, expect, it } from 'vitest';
import {
  loginResponseSchema,
  projectDocumentSchema,
  projectCreateRequestSchema,
  projectCreateResponseSchema,
  taskRequestSchema,
  taskResultSchema
} from '../src';

describe('shared contracts', () => {
  it('accepts a simplified task request and result pair', () => {
    const taskRequest = {
      projectId: '00001',
      targetId: 'act_1',
      assetIds: ['char_001', 'loc_002'],
      type: 'outline.rewrite',
      name: '重写第一幕冲突',
      description: '强化主角和对手第一次正面冲突',
      input: '这里是提交给任务处理的文本内容'
    };

    const taskResult = {
      taskId: '20260427214530123_48321',
      status: 'completed',
      outputType: 'patch',
      outputPayload: {
        operations: [
          {
            op: 'replace',
            path: 'outline.acts[0].summary',
            value: 'A detective arrives in a rain-soaked city full of dread.'
          }
        ]
      },
      summary: 'Darkened the opening beat.',
      rationale: 'Added noir tone and tension.',
      reviewHint: 'Check whether the tone is too bleak for the intended audience.',
      retryable: true
    };

    expect(() => taskRequestSchema.parse(taskRequest)).not.toThrow();
    expect(() => taskResultSchema.parse(taskResult)).not.toThrow();
  });

  it('accepts project create request and response payloads', () => {
    const request = {
      name: 'Cold City',
      type: 'novel',
      localFingerprint: 'local_project_cold_city'
    };

    const response = {
      projectId: '00001',
      name: 'Cold City',
      type: 'novel'
    };

    expect(() => projectCreateRequestSchema.parse(request)).not.toThrow();
    expect(() => projectCreateResponseSchema.parse(response)).not.toThrow();
  });

  it('requires the login response to include a bearer token and user id', () => {
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

  it('accepts the minimal local project document shape', () => {
    const now = new Date().toISOString();
    const parsed = projectDocumentSchema.parse({
      meta: {
        id: 'project_1',
        name: 'Orison Demo',
        type: 'novel',
        version: 1,
        created_at: now,
        updated_at: now
      },
      outline: {
        title: 'Orison',
        acts: []
      },
      storyboard: {
        shots: []
      }
    });

    expect(parsed.meta.name).toBe('Orison Demo');
  });
});
