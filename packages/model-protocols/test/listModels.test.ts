import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listModels, ProtocolHttpError } from '../src';

const ORIGINAL_FETCH = globalThis.fetch;

type CapturedCall = { url: string; init?: RequestInit };

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

  beforeEach(() => { captured = []; });
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  it('calls /v1/models with Bearer auth and returns capability + alias', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'gpt-4o' }, { id: 'dall-e-3' }, { id: 'sora-1.0' }],
    });
    const models = await listModels({ baseUrl: 'https://api.openai.com', apiKey: 'sk' });
    expect(captured[0].url).toBe('https://api.openai.com/v1/models');
    expect((captured[0].init?.headers as Record<string, string>).authorization).toBe('Bearer sk');
    expect(models[0]).toEqual({ id: 'gpt-4o', capability: 'text', alias: 'GPT-4o' });
    expect(models[1]).toEqual({ id: 'dall-e-3', capability: 'image', alias: 'DALL·E 3' });
    expect(models[2]).toEqual({ id: 'sora-1.0', capability: 'video', alias: 'Sora 1.0' });
  });

  it('calls Anthropic /v1/models with x-api-key auth and maps data ids', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'claude-3-5-sonnet-latest' }, { id: 'claude-opus-4-20250514' }],
    });
    const models = await listModels({
      protocol: 'anthropic-compatible',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant',
    });
    expect(captured[0].url).toBe('https://api.anthropic.com/v1/models');
    expect((captured[0].init?.headers as Record<string, string>)['x-api-key']).toBe('sk-ant');
    expect((captured[0].init?.headers as Record<string, string>)['anthropic-version']).toBeTruthy();
    expect((captured[0].init?.headers as Record<string, string>).authorization).toBeUndefined();
    expect(models).toEqual([
      { id: 'claude-3-5-sonnet-latest', capability: 'text', alias: 'Claude 3-5-sonnet-latest' },
      { id: 'claude-opus-4-20250514', capability: 'text', alias: 'Claude opus-4-20250514' },
    ]);
  });

  it('falls back to the parent /models endpoint for DeepSeek Anthropic-compatible base URLs', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init });
      if (captured.length === 1) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        data: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const models = await listModels({
      protocol: 'anthropic-compatible',
      baseUrl: 'https://api.deepseek.com/anthropic',
      apiKey: 'sk-deepseek',
    });

    expect(captured[0].url).toBe('https://api.deepseek.com/anthropic/v1/models');
    expect((captured[0].init?.headers as Record<string, string>)['x-api-key']).toBe('sk-deepseek');
    expect(captured[1].url).toBe('https://api.deepseek.com/models');
    expect((captured[1].init?.headers as Record<string, string>).authorization).toBe('Bearer sk-deepseek');
    expect(models.map((m) => m.id)).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']);
  });

  it('handles NewAPI relay with cross-vendor ids', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'claude-3-5-sonnet' }, { id: 'gemini-2.5-pro' }, { id: 'gpt-4o' }],
    });
    const models = await listModels({ baseUrl: 'https://newapi.example.com', apiKey: 'relay-key' });
    expect(captured[0].url).toBe('https://newapi.example.com/v1/models');
    expect(models[0]).toEqual({ id: 'claude-3-5-sonnet', capability: 'text', alias: 'Claude 3-5-sonnet' });
    expect(models[1]).toEqual({ id: 'gemini-2.5-pro', capability: 'text', alias: 'Gemini 2.5-pro' });
    expect(models[2]).toEqual({ id: 'gpt-4o', capability: 'text', alias: 'GPT-4o' });
  });

  it('maps non-2xx to ProtocolHttpError', async () => {
    globalThis.fetch = mockResponse(captured, { error: 'unauthorized' }, 401);
    await expect(
      listModels({ baseUrl: 'https://api.openai.com', apiKey: 'bad' }),
    ).rejects.toBeInstanceOf(ProtocolHttpError);
  });

  it('defaults unknown model ids to text capability with id as alias', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'custom-finetune-v3' }],
    });
    const models = await listModels({ baseUrl: 'https://x.com', apiKey: 'k' });
    expect(models[0]).toEqual({ id: 'custom-finetune-v3', capability: 'text', alias: 'custom-finetune-v3' });
  });
});
