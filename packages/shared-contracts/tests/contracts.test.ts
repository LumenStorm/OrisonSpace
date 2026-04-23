import { describe, expect, it } from 'vitest';
import {
  loginResponseSchema,
  projectDocumentSchema,
  taskRequestSchema,
  taskResultSchema
} from '../src';

describe('shared contracts', () => {
  it('accepts a valid task request and result pair', () => {
    const taskRequest = {
      taskId: 'task_123',
      taskType: 'outline.rewrite',
      projectFingerprint: 'project_abc',
      selectedScope: {
        module: 'outline',
        entityId: 'act_1'
      },
      contextPayload: {
        outline: {
          title: 'Cold City',
          acts: [{ id: 'act_1', title: 'Arrival', summary: 'A detective arrives.' }]
        }
      },
      userInstruction: 'Make it darker.',
      privacyLevel: 'minimal',
      expectedOutputType: 'patch'
    };

    const taskResult = {
      taskId: 'task_123',
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
