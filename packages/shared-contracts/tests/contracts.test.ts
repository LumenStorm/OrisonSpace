import { describe, expect, it } from 'vitest';
import {
  loginResponseSchema,
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
  modelApiFormatSchema,
  textGenerationRequestSchema,
  textGenerationResponseSchema,
  imageGenerationRequestSchema,
  videoGenerationRequestSchema,
  modelProfileV2Schema,
  modelEntrySchema,
  slotAssignmentMapSchema,
  resolvedModelProfileSchema,
  modelConfigV2Schema,
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

describe('model api format and v2 model schemas', () => {
  it('enumerates every shipping apiFormat', () => {
    expect(modelApiFormatSchema.parse('openai-chat-completions')).toBe('openai-chat-completions');
    expect(modelApiFormatSchema.parse('openai-responses')).toBe('openai-responses');
    expect(modelApiFormatSchema.parse('claude-messages')).toBe('claude-messages');
    expect(modelApiFormatSchema.parse('gemini-generate-content')).toBe('gemini-generate-content');
    expect(modelApiFormatSchema.parse('openai-images')).toBe('openai-images');
    expect(modelApiFormatSchema.parse('gemini-images')).toBe('gemini-images');
    expect(modelApiFormatSchema.parse('gemini-image-edit')).toBe('gemini-image-edit');
    expect(modelApiFormatSchema.parse('sora-videos')).toBe('sora-videos');
    expect(() => modelApiFormatSchema.parse('unknown-format')).toThrow();
  });

  it('preserves apiFormat and namespaced providerOptions on text/image/video requests', () => {
    const text = textGenerationRequestSchema.parse({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
      apiFormat: 'claude-messages',
      providerOptions: {
        'claude-messages': { thinking: { type: 'enabled' } },
        'openai-chat-completions': { tools: [] },
      },
    });
    expect(text.apiFormat).toBe('claude-messages');
    expect(text.providerOptions?.['claude-messages']?.thinking).toBeDefined();
    expect(text.providerOptions?.['openai-chat-completions']?.tools).toEqual([]);

    const image = imageGenerationRequestSchema.parse({
      model: 'dall-e-3',
      prompt: 'a city at dusk',
      apiFormat: 'openai-images',
      providerOptions: { 'openai-images': { style: 'vivid' } },
    });
    expect(image.apiFormat).toBe('openai-images');
    expect(image.providerOptions?.['openai-images']?.style).toBe('vivid');

    const video = videoGenerationRequestSchema.parse({
      model: 'sora-1.0',
      prompt: 'rolling waves',
      apiFormat: 'sora-videos',
      duration: 10,
      width: 1920,
      height: 1080,
    });
    expect(video.apiFormat).toBe('sora-videos');
  });

  it('accepts usage/finishReason/id/created on text generation responses', () => {
    const parsed = textGenerationResponseSchema.parse({
      provider: 'openai',
      model: 'gpt-4o',
      text: 'hello',
      id: 'resp-123',
      created: 1715155200,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    });
    expect(parsed.usage?.totalTokens).toBe(30);
    expect(parsed.finishReason).toBe('stop');
    expect(parsed.id).toBe('resp-123');
  });

  it('accepts image/mask/referenceImages on image generation requests', () => {
    const parsed = imageGenerationRequestSchema.parse({
      model: 'gpt-image-1',
      prompt: 'replace the sofa with a leather chesterfield',
      apiFormat: 'openai-images',
      image: { b64Json: 'YWJj', mimeType: 'image/png' },
      mask: { b64Json: 'ZGVm', mimeType: 'image/png' },
      referenceImages: [
        { b64Json: 'Z2hp', mimeType: 'image/png' },
      ],
    });
    expect(parsed.image?.mimeType).toBe('image/png');
    expect(parsed.mask?.b64Json).toBe('ZGVm');
    expect(parsed.referenceImages?.length).toBe(1);
  });

  it('accepts gemini-image-edit apiFormat', () => {
    expect(modelApiFormatSchema.parse('gemini-image-edit')).toBe('gemini-image-edit');
  });

  it('parses a v2 profile with multiple model entries', () => {
    const profile = modelProfileV2Schema.parse({
      schemaVersion: 2,
      id: 'profile-7f21',
      name: 'OpenAI Main',
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-...',
      models: [
        {
          id: 'gpt-4o',
          alias: 'GPT-4o 主力',
          apiFormat: 'openai-chat-completions',
          capabilities: ['text'],
        },
        {
          id: 'dall-e-3',
          alias: 'DALL-E 3',
          apiFormat: 'openai-images',
          capabilities: ['image'],
        },
      ],
    });
    expect(profile.models).toHaveLength(2);
    expect(profile.models[1].alias).toBe('DALL-E 3');
  });

  it('rejects a v2 profile with empty models', () => {
    expect(() =>
      modelProfileV2Schema.parse({
        schemaVersion: 2,
        id: 'p',
        name: 'p',
        provider: 'openai',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk',
        models: [],
      })
    ).toThrow();
  });

  it('parses slot assignment map with mixed null and pair', () => {
    const map = slotAssignmentMapSchema.parse({
      novel: { profileId: 'p1', modelId: 'gpt-4o' },
      image: { profileId: 'p1', modelId: 'dall-e-3' },
      video: null,
    });
    expect(map.novel?.modelId).toBe('gpt-4o');
    expect(map.video).toBeNull();
  });

  it('rejects slot assignment with missing modelId', () => {
    expect(() =>
      slotAssignmentMapSchema.parse({
        novel: { profileId: 'p1' },
        image: null,
        video: null,
      })
    ).toThrow();
  });

  it('parses ResolvedModelProfile with all required fields', () => {
    const resolved = resolvedModelProfileSchema.parse({
      profileId: 'p1',
      modelId: 'gpt-4o',
      apiFormat: 'openai-chat-completions',
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk',
      capabilities: ['text'],
    });
    expect(resolved.modelId).toBe('gpt-4o');
  });

  it('parses ModelConfigV2 end to end', () => {
    const config = modelConfigV2Schema.parse({
      schemaVersion: 2,
      profiles: [
        {
          schemaVersion: 2,
          id: 'p1',
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com',
          apiKey: 'sk',
          models: [
            { id: 'gpt-4o', alias: 'GPT-4o', apiFormat: 'openai-chat-completions', capabilities: ['text'] },
          ],
        },
      ],
      selected: {
        novel: { profileId: 'p1', modelId: 'gpt-4o' },
        image: null,
        video: null,
      },
    });
    expect(config.profiles[0].models[0].id).toBe('gpt-4o');
  });

  it('allows a model entry where alias mirrors id', () => {
    const entry = modelEntrySchema.parse({
      id: 'gpt-4o',
      alias: 'gpt-4o',
      apiFormat: 'openai-chat-completions',
      capabilities: ['text'],
    });
    expect(entry.alias).toBe(entry.id);
  });
});
