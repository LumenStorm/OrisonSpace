import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listModels, ProtocolHttpError } from '../src';

const ORIGINAL_FETCH = globalThis.fetch;

type CapturedCall = {
  url: string;
  init?: RequestInit;
};

function mockResponse(captured: CapturedCall[], body: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('listModels', () => {
  let captured: CapturedCall[];

  beforeEach(() => {
    captured = [];
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('lists OpenAI models with Authorization: Bearer', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'gpt-4o' }, { id: 'dall-e-3' }, { id: 'sora-1.0' }],
    });
    const models = await listModels('openai', {
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk',
    });
    expect(captured[0].url).toBe('https://api.openai.com/v1/models');
    expect((captured[0].init?.headers as Record<string, string>).authorization).toBe('Bearer sk');
    expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'dall-e-3', 'sora-1.0']);
    expect(models[0].capabilities).toEqual(['text']);
    expect(models[1].capabilities).toEqual(['image']);
    expect(models[2].capabilities).toEqual(['video']);
  });

  it('lists Anthropic models with x-api-key + anthropic-version', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'claude-3-5-sonnet' }],
    });
    const models = await listModels('anthropic', {
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'ant',
    });
    expect(captured[0].url).toBe('https://api.anthropic.com/v1/models');
    const headers = captured[0].init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('ant');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(models[0].id).toBe('claude-3-5-sonnet');
  });

  it('lists GCP/Gemini models with key= query param', async () => {
    globalThis.fetch = mockResponse(captured, {
      models: [
        { name: 'models/gemini-2.5-pro' },
        { name: 'models/imagen-3.0' },
      ],
    });
    const models = await listModels('gcp', {
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'gcp-key',
    });
    expect(captured[0].url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models?key=gcp-key',
    );
    expect((captured[0].init?.headers as Record<string, string>)['x-goog-api-key']).toBe('gcp-key');
    expect(models.map((m) => m.id)).toEqual(['gemini-2.5-pro', 'imagen-3.0']);
  });

  it('handles NewAPI relay: provider=openai listing returns Claude/Gemini ids', async () => {
    // NewAPI exposes its catalog through the OpenAI-compatible /v1/models
    // endpoint, but the catalog can include cross-vendor ids that the user
    // will later mark with the right apiFormat in Settings.
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'claude-3-5-sonnet' }, { id: 'gemini-2.5-pro' }, { id: 'gpt-4o' }],
    });
    const models = await listModels('openai', {
      baseUrl: 'https://newapi.example.com',
      apiKey: 'relay-key',
    });
    expect(captured[0].url).toBe('https://newapi.example.com/v1/models');
    expect(models.map((m) => m.id)).toEqual(['claude-3-5-sonnet', 'gemini-2.5-pro', 'gpt-4o']);
  });

  it('maps non-2xx to ProtocolHttpError', async () => {
    globalThis.fetch = mockResponse(captured, { error: 'unauthorized' }, 401);
    await expect(
      listModels('openai', { baseUrl: 'https://api.openai.com', apiKey: 'bad' }),
    ).rejects.toBeInstanceOf(ProtocolHttpError);
  });
});
