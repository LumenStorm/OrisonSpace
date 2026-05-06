import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedModelProfile } from '@orison/shared-contracts';
import {
  claudeMessagesProtocol,
  geminiGenerateContentProtocol,
  geminiImagesProtocol,
  openaiChatProtocol,
  openaiImagesProtocol,
  openaiResponsesProtocol,
  ProtocolHttpError,
  ProtocolNotImplementedError,
  soraVideosProtocol,
} from '../src';

const ORIGINAL_FETCH = globalThis.fetch;

type CapturedCall = {
  url: string;
  init?: RequestInit;
};

function buildMock(captured: CapturedCall[], body: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function profile(overrides: Partial<ResolvedModelProfile> = {}): ResolvedModelProfile {
  return {
    profileId: 'p1',
    modelId: 'gpt-4o',
    apiFormat: 'openai-chat-completions',
    baseUrl: 'https://api.openai.com',
    apiKey: 'sk-test',
    capabilities: ['text'],
    ...overrides,
  };
}

describe('protocol adapters', () => {
  let captured: CapturedCall[];

  beforeEach(() => {
    captured = [];
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  describe('openai-chat-completions', () => {
    it('posts to /chat/completions with Bearer auth and the profile model id', async () => {
      globalThis.fetch = buildMock(captured, {
        choices: [{ message: { content: 'hello world' } }],
      });

      const result = await openaiChatProtocol.generateText!(profile(), {
        model: 'ignored-by-adapter',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.7,
        maxTokens: 256,
        providerOptions: { tools: [] },
      });

      expect(captured[0].url).toBe('https://api.openai.com/chat/completions');
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(256);
      expect(body.tools).toEqual([]);
      expect((captured[0].init?.headers as Record<string, string>).authorization).toBe(
        'Bearer sk-test',
      );
      expect(result.text).toBe('hello world');
      expect(result.model).toBe('gpt-4o');
    });

    it('maps provider 4xx into ProtocolHttpError', async () => {
      globalThis.fetch = buildMock(captured, { error: { message: 'rate limited' } }, 429);
      await expect(
        openaiChatProtocol.generateText!(profile(), {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toMatchObject({ name: 'ProtocolHttpError', status: 429 });
    });
  });

  describe('openai-responses', () => {
    it('posts to /responses with input + instructions split', async () => {
      globalThis.fetch = buildMock(captured, { output_text: 'pong' });
      await openaiResponsesProtocol.generateText!(
        profile({ apiFormat: 'openai-responses' }),
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'hi' },
          ],
          maxTokens: 100,
        },
      );

      expect(captured[0].url).toBe('https://api.openai.com/responses');
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.instructions).toBe('be brief');
      expect(body.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
      ]);
      expect(body.max_output_tokens).toBe(100);
    });
  });

  describe('claude-messages', () => {
    it('posts to /v1/messages with x-api-key + anthropic-version', async () => {
      globalThis.fetch = buildMock(captured, {
        content: [{ type: 'text', text: 'sure' }],
      });
      await claudeMessagesProtocol.generateText!(
        profile({
          apiFormat: 'claude-messages',
          modelId: 'claude-3-5-sonnet',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'ant-key',
        }),
        {
          model: 'claude-3-5-sonnet',
          messages: [
            { role: 'system', content: 'persona' },
            { role: 'user', content: 'hi' },
          ],
        },
      );

      expect(captured[0].url).toBe('https://api.anthropic.com/v1/messages');
      const headers = captured[0].init?.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('ant-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.model).toBe('claude-3-5-sonnet');
      expect(body.system).toBe('persona');
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(body.max_tokens).toBe(1024); // default applied when not specified
    });
  });

  describe('gemini-generate-content', () => {
    it('posts to v1beta/models/{model}:generateContent with key= query', async () => {
      globalThis.fetch = buildMock(captured, {
        candidates: [{ content: { parts: [{ text: 'gem' }] } }],
      });
      await geminiGenerateContentProtocol.generateText!(
        profile({
          apiFormat: 'gemini-generate-content',
          modelId: 'gemini-2.5-pro',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: 'gcp-key',
        }),
        { model: 'gemini-2.5-pro', messages: [{ role: 'user', content: 'hi' }] },
      );

      expect(captured[0].url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=gcp-key',
      );
    });
  });

  describe('openai-images', () => {
    it('detects gpt-image-1 family and forwards background/output_format', async () => {
      globalThis.fetch = buildMock(captured, {
        data: [{ b64_json: 'AAA=' }],
      });
      const result = await openaiImagesProtocol.generateImage!(
        profile({ apiFormat: 'openai-images', modelId: 'gpt-image-1', capabilities: ['image'] }),
        { model: 'gpt-image-1', prompt: 'cat', background: 'transparent', outputFormat: 'png' },
      );

      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.model).toBe('gpt-image-1');
      expect(body.background).toBe('transparent');
      expect(body.output_format).toBe('png');
      expect(body.response_format).toBeUndefined();
      expect(result.images[0].b64Json).toBe('AAA=');
      expect(result.images[0].mimeType).toBe('image/png');
      expect(result.images[0].dataUrl).toBe('data:image/png;base64,AAA=');
    });

    it('rejects gpt-image-2 + transparent background pre-network', async () => {
      globalThis.fetch = buildMock(captured, {});
      await expect(
        openaiImagesProtocol.generateImage!(
          profile({ apiFormat: 'openai-images', modelId: 'gpt-image-2', capabilities: ['image'] }),
          { model: 'gpt-image-2', prompt: 'x', background: 'transparent' },
        ),
      ).rejects.toBeInstanceOf(ProtocolHttpError);
      expect(captured).toHaveLength(0);
    });

    it('falls back to response_format=b64_json for dall-e-* family', async () => {
      globalThis.fetch = buildMock(captured, { data: [{ b64_json: 'BBB=' }] });
      await openaiImagesProtocol.generateImage!(
        profile({ apiFormat: 'openai-images', modelId: 'dall-e-3', capabilities: ['image'] }),
        { model: 'dall-e-3', prompt: 'x' },
      );
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.response_format).toBe('b64_json');
    });
  });

  describe('gemini-images', () => {
    it('posts to v1beta/models/{model}:predict and normalizes the response', async () => {
      globalThis.fetch = buildMock(captured, {
        predictions: [{ bytesBase64Encoded: 'CCC=', mimeType: 'image/png' }],
      });
      const result = await geminiImagesProtocol.generateImage!(
        profile({
          apiFormat: 'gemini-images',
          modelId: 'imagen-3.0',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: 'gcp-key',
          capabilities: ['image'],
        }),
        { model: 'imagen-3.0', prompt: 'a cat' },
      );
      expect(captured[0].url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0:predict?key=gcp-key',
      );
      expect(result.images[0].b64Json).toBe('CCC=');
      expect(result.images[0].dataUrl).toBe('data:image/png;base64,CCC=');
    });
  });

  describe('sora-videos', () => {
    it('throws ProtocolNotImplementedError without making any network call', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await expect(
        soraVideosProtocol.generateVideo!(
          profile({
            apiFormat: 'sora-videos',
            modelId: 'sora-1.0',
            capabilities: ['video'],
          }),
          { model: 'sora-1.0', prompt: 'rolling waves' },
        ),
      ).rejects.toBeInstanceOf(ProtocolNotImplementedError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
