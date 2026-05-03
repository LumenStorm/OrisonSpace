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

  it('routes OpenAI-format image generation to image generations', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({
      data: [{ url: 'https://cdn.example.com/image.png' }],
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
      images: [{ url: 'https://cdn.example.com/image.png' }],
    });
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
    expect(response.json().images).toEqual([{ b64Json: 'abc123', mimeType: 'image/png' }]);
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
