import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedModelProfile } from '@orison/shared-contracts';
import {
  claudeMessagesProtocol,
  geminiGenerateContentProtocol,
  geminiImageEditProtocol,
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
        id: 'chatcmpl-xyz',
        created: 1715155200,
        choices: [{ message: { content: 'hello world' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 },
      });

      const result = await openaiChatProtocol.generateText!(profile(), {
        model: 'ignored-by-adapter',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.7,
        maxTokens: 256,
        providerOptions: { 'openai-chat-completions': { tools: [] } },
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
      expect(result.id).toBe('chatcmpl-xyz');
      expect(result.created).toBe(1715155200);
      expect(result.usage).toEqual({ promptTokens: 11, completionTokens: 22, totalTokens: 33 });
      expect(result.finishReason).toBe('stop');
    });

    it('ignores providerOptions entries targeted at other apiFormats', async () => {
      globalThis.fetch = buildMock(captured, {
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      });
      await openaiChatProtocol.generateText!(profile(), {
        model: 'ignored',
        messages: [{ role: 'user', content: 'hi' }],
        providerOptions: {
          'openai-chat-completions': { tools: ['own'] },
          'claude-messages': { thinking: 'should-not-leak' },
        },
      });
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.tools).toEqual(['own']);
      expect(body.thinking).toBeUndefined();
    });

    it('maps finish_reason=length and content_filter to normalized values', async () => {
      globalThis.fetch = buildMock(captured, {
        choices: [{ message: { content: 'x' }, finish_reason: 'length' }],
      });
      const r1 = await openaiChatProtocol.generateText!(profile(), {
        model: 'm',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(r1.finishReason).toBe('length');

      captured.length = 0;
      globalThis.fetch = buildMock(captured, {
        choices: [{ message: { content: 'x' }, finish_reason: 'content_filter' }],
      });
      const r2 = await openaiChatProtocol.generateText!(profile(), {
        model: 'm',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(r2.finishReason).toBe('content_filter');

      captured.length = 0;
      globalThis.fetch = buildMock(captured, {
        choices: [{ message: { content: 'x' }, finish_reason: 'tool_calls' }],
      });
      const r3 = await openaiChatProtocol.generateText!(profile(), {
        model: 'm',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(r3.finishReason).toBe('tool_use');
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
      globalThis.fetch = buildMock(captured, {
        id: 'resp-xyz',
        created_at: 1715155300,
        output_text: 'pong',
        status: 'completed',
        usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 },
      });
      const result = await openaiResponsesProtocol.generateText!(
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
      expect(result.id).toBe('resp-xyz');
      expect(result.created).toBe(1715155300);
      expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 7, totalTokens: 12 });
      expect(result.finishReason).toBe('stop');
    });

    it('maps incomplete + max_output_tokens to length', async () => {
      globalThis.fetch = buildMock(captured, {
        output_text: 'x',
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      });
      const result = await openaiResponsesProtocol.generateText!(
        profile({ apiFormat: 'openai-responses' }),
        { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
      );
      expect(result.finishReason).toBe('length');
    });
  });

  describe('claude-messages', () => {
    it('posts to /v1/messages with x-api-key + anthropic-version', async () => {
      globalThis.fetch = buildMock(captured, {
        id: 'msg_abc',
        content: [{ type: 'text', text: 'sure' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 9, output_tokens: 15 },
      });
      const result = await claudeMessagesProtocol.generateText!(
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
          providerOptions: {
            'claude-messages': { thinking: { type: 'enabled' } },
            'openai-chat-completions': { tools: ['should-not-leak'] },
          },
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
      expect(body.thinking).toEqual({ type: 'enabled' });
      expect(body.tools).toBeUndefined();
      expect(result.id).toBe('msg_abc');
      expect(result.usage).toEqual({ promptTokens: 9, completionTokens: 15, totalTokens: 24 });
      expect(result.finishReason).toBe('stop');
    });

    it('maps max_tokens stop_reason to length', async () => {
      globalThis.fetch = buildMock(captured, {
        content: [{ type: 'text', text: 'x' }],
        stop_reason: 'max_tokens',
      });
      const result = await claudeMessagesProtocol.generateText!(
        profile({ apiFormat: 'claude-messages' }),
        { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
      );
      expect(result.finishReason).toBe('length');
    });
  });

  describe('gemini-generate-content', () => {
    it('posts to v1beta/models/{model}:generateContent with key= query', async () => {
      globalThis.fetch = buildMock(captured, {
        candidates: [{ content: { parts: [{ text: 'gem' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 8, totalTokenCount: 12 },
      });
      const result = await geminiGenerateContentProtocol.generateText!(
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
      expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 8, totalTokens: 12 });
      expect(result.finishReason).toBe('stop');
    });

    it('maps SAFETY/RECITATION finish reasons to content_filter', async () => {
      globalThis.fetch = buildMock(captured, {
        candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'SAFETY' }],
      });
      const result = await geminiGenerateContentProtocol.generateText!(
        profile({ apiFormat: 'gemini-generate-content' }),
        { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
      );
      expect(result.finishReason).toBe('content_filter');
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

    it('switches to /images/edits when request.image is provided', async () => {
      globalThis.fetch = buildMock(captured, { data: [{ b64_json: 'EDIT=' }] });
      const result = await openaiImagesProtocol.generateImage!(
        profile({ apiFormat: 'openai-images', modelId: 'gpt-image-1', capabilities: ['image'] }),
        {
          model: 'gpt-image-1',
          prompt: 'replace the sofa',
          image: { b64Json: 'aW1n', mimeType: 'image/png' },
          mask: { b64Json: 'bWFzaw==', mimeType: 'image/png' },
          size: '1024x1024',
        },
      );
      expect(captured[0].url).toBe('https://api.openai.com/images/edits');
      expect(captured[0].init?.body).toBeInstanceOf(FormData);
      const form = captured[0].init?.body as FormData;
      expect(form.get('model')).toBe('gpt-image-1');
      expect(form.get('prompt')).toBe('replace the sofa');
      expect(form.get('size')).toBe('1024x1024');
      expect(form.get('image')).toBeInstanceOf(Blob);
      expect(form.get('mask')).toBeInstanceOf(Blob);
      // fetch will auto-set content-type with boundary; we should NOT set it ourselves
      const headers = captured[0].init?.headers as Record<string, string> | undefined;
      const contentType = headers ? headers['content-type'] ?? headers['Content-Type'] : undefined;
      expect(contentType).toBeUndefined();
      expect(result.images[0].b64Json).toBe('EDIT=');
    });

    it('keeps /images/generations JSON path when request.image is absent', async () => {
      globalThis.fetch = buildMock(captured, { data: [{ b64_json: 'GEN=' }] });
      await openaiImagesProtocol.generateImage!(
        profile({ apiFormat: 'openai-images', modelId: 'gpt-image-1', capabilities: ['image'] }),
        { model: 'gpt-image-1', prompt: 'a cat' },
      );
      expect(captured[0].url).toBe('https://api.openai.com/images/generations');
      expect(typeof captured[0].init?.body).toBe('string');
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

  describe('gemini-image-edit', () => {
    it('posts to :generateContent with prompt + image + reference parts', async () => {
      globalThis.fetch = buildMock(captured, {
        candidates: [{
          content: {
            parts: [
              { text: 'here is your edited image' },
              { inline_data: { mime_type: 'image/png', data: 'EDITED=' } },
            ],
          },
        }],
      });
      const result = await geminiImageEditProtocol.generateImage!(
        profile({
          apiFormat: 'gemini-image-edit',
          modelId: 'gemini-2.5-flash-image',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: 'gcp-key',
          capabilities: ['image'],
        }),
        {
          model: 'gemini-2.5-flash-image',
          prompt: 'replace the sofa',
          image: { b64Json: 'ORIGINAL=', mimeType: 'image/png' },
          mask: { b64Json: 'MASK=', mimeType: 'image/png' },
          referenceImages: [{ b64Json: 'REF1=', mimeType: 'image/png' }],
        },
      );

      expect(captured[0].url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=gcp-key',
      );
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.contents[0].parts[0]).toEqual({ text: 'replace the sofa' });
      expect(body.contents[0].parts[1]).toEqual({
        inline_data: { mime_type: 'image/png', data: 'ORIGINAL=' },
      });
      expect(body.contents[0].parts[2]).toEqual({
        inline_data: { mime_type: 'image/png', data: 'REF1=' },
      });
      // Mask is silently dropped (Gemini has no pixel mask concept)
      expect(JSON.stringify(body)).not.toContain('MASK=');
      expect(body.generationConfig.responseModalities).toEqual(['IMAGE']);
      expect(result.images[0].b64Json).toBe('EDITED=');
      expect(result.images[0].dataUrl).toBe('data:image/png;base64,EDITED=');
    });

    it('merges providerOptions.gemini-image-edit into generationConfig', async () => {
      globalThis.fetch = buildMock(captured, {
        candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'X=' } }] } }],
      });
      await geminiImageEditProtocol.generateImage!(
        profile({
          apiFormat: 'gemini-image-edit',
          modelId: 'gemini-3.1-flash-image-preview',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: 'k',
          capabilities: ['image'],
        }),
        {
          model: 'gemini-3.1-flash-image-preview',
          prompt: 'x',
          providerOptions: {
            'gemini-image-edit': {
              imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
            },
          },
        },
      );
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
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
