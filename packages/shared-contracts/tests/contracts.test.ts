import { describe, expect, it } from 'vitest';
import {
  projectDocumentSchema,
  projectCreateRequestSchema,
  projectCreateResponseSchema,
  taskRequestSchema,
  taskResultSchema,
  taskListItemSchema,
  taskListQuerySchema,
  taskListResponseSchema,
  projectAssetListItemSchema,
  projectAssetListQuerySchema,
  projectAssetListResponseSchema,
  taskDetailResponseSchema,
  textGenerationRequestSchema,
  textGenerationResponseSchema,
  imageGenerationRequestSchema,
  videoGenerationRequestSchema,
  apiKeyEntrySchema,
  discoveredModelSchema,
  modelConfigSchema,
  resolveModelInfo,
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
      storyboard: {
        shots: []
      }
    });

    expect(parsed.meta.name).toBe('Orison Demo');
  });

  it('parses task list pagination query with defaults and bounds', () => {
    const defaults = taskListQuerySchema.parse({});
    expect(defaults).toEqual({ limit: 50, sort: 'createdDesc' });
    const explicit = taskListQuerySchema.parse({ limit: '25', cursor: 'abc', sort: 'createdAsc' });
    expect(explicit).toEqual({ limit: 25, cursor: 'abc', sort: 'createdAsc' });
    expect(() => taskListQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => taskListQuerySchema.parse({ limit: 201 })).toThrow();
  });

  it('parses task list response with assetIds and nullable nextCursor', () => {
    const parsed = taskListResponseSchema.parse({
      items: [
        {
          taskId: 'task_1',
          projectId: '00001',
          type: 'outline.rewrite',
          name: 'Item',
          description: 'desc',
          status: 'queued',
          createdAt: '2026-05-05T01:00:00.000Z'
        }
      ],
      nextCursor: null
    });
    expect(parsed.items[0].assetIds).toEqual([]);
    expect(parsed.nextCursor).toBeNull();
    expect(taskListItemSchema.shape.targetId.isOptional()).toBe(true);
  });

  it('parses project asset list query and response shapes', () => {
    const defaults = projectAssetListQuerySchema.parse({});
    expect(defaults).toEqual({ limit: 50, sort: 'updatedDesc' });
    const parsed = projectAssetListResponseSchema.parse({
      items: [
        {
          assetId: 'asset_1',
          projectId: '00001',
          assetType: 'unknown',
          assetName: 'Asset',
          assetStatus: 'active',
          version: 1,
          updatedAt: '2026-05-05T01:00:00.000Z'
        }
      ],
      nextCursor: 'next-cursor'
    });
    expect(parsed.nextCursor).toBe('next-cursor');
    expect(projectAssetListItemSchema.shape.summary.isOptional()).toBe(true);
  });

  it('parses task detail response with task metadata and result', () => {
    const parsed = taskDetailResponseSchema.parse({
      task: {
        taskId: 'task_1',
        projectId: '00001',
        type: 'outline.rewrite',
        name: 'Detail',
        description: 'desc',
        status: 'completed',
        createdAt: '2026-05-05T01:00:00.000Z',
        assetIds: ['char_001']
      },
      result: {
        taskId: 'task_1',
        status: 'completed',
        summary: 'done',
        rationale: 'because',
        reviewHint: 'lgtm',
        retryable: true
      }
    });

    expect(parsed.task.assetIds).toEqual(['char_001']);
    expect(parsed.result?.status).toBe('completed');
    expect(taskDetailResponseSchema.parse({
      task: {
        taskId: 'task_2',
        projectId: '00001',
        type: 'outline.rewrite',
        name: 'Detail',
        description: 'desc',
        status: 'queued',
        createdAt: '2026-05-05T01:00:00.000Z',
        assetIds: []
      },
      result: null
    }).result).toBeNull();
  });
});

describe('model config v3 schemas', () => {
  it('parses text generation request', () => {
    const text = textGenerationRequestSchema.parse({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(text.model).toBe('gpt-4o');
  });

  it('parses image generation request', () => {
    const image = imageGenerationRequestSchema.parse({
      model: 'dall-e-3',
      prompt: 'a city at dusk',
    });
    expect(image.model).toBe('dall-e-3');
  });

  it('parses video generation request', () => {
    const video = videoGenerationRequestSchema.parse({
      model: 'sora-1.0',
      prompt: 'rolling waves',
      duration: 10,
    });
    expect(video.model).toBe('sora-1.0');
  });

  it('parses text generation response', () => {
    const parsed = textGenerationResponseSchema.parse({
      model: 'gpt-4o',
      text: 'hello',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });
    expect(parsed.usage?.totalTokens).toBe(30);
    expect(parsed.finishReason).toBe('stop');
  });

  it('parses image generation request with image/mask', () => {
    const parsed = imageGenerationRequestSchema.parse({
      model: 'gpt-image-1',
      prompt: 'replace the sofa',
      image: { b64Json: 'YWJj', mimeType: 'image/png' },
      mask: { b64Json: 'ZGVm', mimeType: 'image/png' },
    });
    expect(parsed.image).toBeDefined();
    expect(parsed.mask).toBeDefined();
  });

  it('parses ApiKeyEntry with discovered models', () => {
    const entry = apiKeyEntrySchema.parse({
      id: 'key-1',
      name: 'My OpenAI',
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-xxx',
      models: [
        { id: 'gpt-4o', capability: 'text', alias: 'GPT-4o', enabled: true },
        { id: 'dall-e-3', capability: 'image', alias: 'DALL·E', enabled: false },
      ],
    });
    expect(entry.models).toHaveLength(2);
    expect(entry.models[0].enabled).toBe(true);
  });

  it('parses ModelConfig with multiple keys', () => {
    const config = modelConfigSchema.parse({
      keys: [
        {
          id: 'k1',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com',
          apiKey: 'sk',
          models: [{ id: 'gpt-4o', capability: 'text', alias: 'GPT-4o', enabled: true }],
        },
      ],
    });
    expect(config.keys[0].models[0].id).toBe('gpt-4o');
  });

  it('parses DiscoveredModel', () => {
    const model = discoveredModelSchema.parse({
      id: 'gpt-4o',
      capability: 'text',
      alias: 'GPT-4o',
      enabled: true,
    });
    expect(model.capability).toBe('text');
  });

  it('resolveModelInfo matches known patterns', () => {
    expect(resolveModelInfo('dall-e-3').capability).toBe('image');
    expect(resolveModelInfo('dall-e-3').alias).toBe('DALL·E 3');
    expect(resolveModelInfo('gpt-4o-mini').capability).toBe('text');
    expect(resolveModelInfo('sora-1.0').capability).toBe('video');
    expect(resolveModelInfo('unknown-model-xyz').capability).toBe('text');
    expect(resolveModelInfo('unknown-model-xyz').alias).toBe('unknown-model-xyz');
  });
});
