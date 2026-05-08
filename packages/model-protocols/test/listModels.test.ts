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
    expect(models[1]).toEqual({ id: 'dall-e-3', capability: 'image', alias: 'DALL·E' });
    expect(models[2]).toEqual({ id: 'sora-1.0', capability: 'video', alias: 'Sora' });
  });

  it('handles NewAPI relay with cross-vendor ids', async () => {
    globalThis.fetch = mockResponse(captured, {
      data: [{ id: 'claude-3-5-sonnet' }, { id: 'gemini-2.5-pro' }, { id: 'gpt-4o' }],
    });
    const models = await listModels({ baseUrl: 'https://newapi.example.com', apiKey: 'relay-key' });
    expect(captured[0].url).toBe('https://newapi.example.com/v1/models');
    expect(models[0]).toEqual({ id: 'claude-3-5-sonnet', capability: 'text', alias: 'Claude' });
    expect(models[1]).toEqual({ id: 'gemini-2.5-pro', capability: 'text', alias: 'Gemini' });
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
