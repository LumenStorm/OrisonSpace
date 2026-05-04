import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/app';
import { query } from '../src/common/db';

const testEmail = `generation-${Date.now()}@example.com`;
let token = '';

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockBinaryResponse(body: string, status = 200, contentType = 'image/png') {
  const buffer = Buffer.from(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as Response;
}

describe('generation routes', () => {
  beforeAll(async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: testEmail, password: 'test-pass-123', displayName: 'Generation Tester' },
    });
    token = response.json().accessToken;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
    vi.restoreAllMocks();
  });

  it('routes OpenAI-format text generation to chat completions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      choices: [{ message: { content: 'hello from openai' } }],
    }));

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/openai/text',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      text: 'hello from openai',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer sk-test' }),
      }),
    );
  });

  it('routes OpenAI-format image generation to image generations as base64', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [{ b64_json: 'openai-base64' }],
    }));

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/openai/image',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'gpt-image-1',
        apiKey: 'sk-test',
        prompt: 'A quiet workstation',
        size: '1024x1024',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: 'openai',
      model: 'gpt-image-1',
      images: [{
        b64Json: 'openai-base64',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,openai-base64',
      }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"response_format":"b64_json"'),
      }),
    );
  });

  it('normalizes OpenAI-compatible image responses that use base64', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [{ base64: 'data:image/webp;base64,relay-base64' }],
    }));

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/openai/image',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'gpt-image-1',
        apiKey: 'sk-test',
        prompt: 'A quiet workstation',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().images[0]).toMatchObject({
      b64Json: 'relay-base64',
      mimeType: 'image/webp',
      dataUrl: 'data:image/webp;base64,relay-base64',
    });
  });

  it('downloads URL-only image generation results and returns base64 data URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse({
        data: [{ url: 'https://cdn.example.com/image.png' }],
      }))
      .mockResolvedValueOnce(mockBinaryResponse('png-bytes'));

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/openai/image',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'gpt-image-1',
        apiKey: 'sk-test',
        prompt: 'A quiet workstation',
      },
    });

    const json = response.json();
    expect(response.statusCode).toBe(200);
    expect(json.images[0].url).toBe('https://cdn.example.com/image.png');
    expect(json.images[0].mimeType).toBe('image/png');
    expect(json.images[0].b64Json).toBe(Buffer.from('png-bytes').toString('base64'));
    expect(json.images[0].dataUrl).toBe(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`);
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/image.png');
  });

  it('routes Anthropic-format text generation to messages', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      content: [{ type: 'text', text: 'hello from claude' }],
    }));

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/anthropic/text',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'claude-3-5-sonnet',
        apiKey: 'anthropic-key',
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hello' },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().text).toBe('hello from claude');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'anthropic-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });

  it('routes GCP-format image generation to model predict', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      predictions: [{ bytesBase64Encoded: 'abc123', mimeType: 'image/png' }],
    }));

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/gcp/image',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'imagen-3.0-generate-001',
        apiKey: 'gcp-key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        prompt: 'A clean product render',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().images).toEqual([{
      b64Json: 'abc123',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,abc123',
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=gcp-key',
      expect.any(Object),
    );
  });

  it('rejects unsupported Anthropic image generation via provider route', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/anthropic/image',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        model: 'claude-image',
        apiKey: 'anthropic-key',
        prompt: 'A skyline',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('not supported');
  });
});
