import { describe, expect, it } from 'vitest';
import {
  apiFormatCapabilities,
  apiFormats,
  assertCapability,
  getProtocol,
  inferApiFormat,
  ProtocolCapabilityError,
} from '../src';

describe('registry', () => {
  it('lists every shipping apiFormat', () => {
    expect(apiFormats).toEqual([
      'openai-chat-completions',
      'openai-responses',
      'claude-messages',
      'gemini-generate-content',
      'openai-images',
      'gemini-images',
      'sora-videos',
    ]);
  });

  it('returns the right adapter from getProtocol', () => {
    expect(getProtocol('openai-chat-completions').apiFormat).toBe('openai-chat-completions');
    expect(getProtocol('claude-messages').apiFormat).toBe('claude-messages');
    expect(getProtocol('sora-videos').apiFormat).toBe('sora-videos');
  });

  it('throws ProtocolCapabilityError on unknown apiFormat', () => {
    expect(() => getProtocol('unknown' as any)).toThrow(ProtocolCapabilityError);
  });

  it('passes assertCapability for supported verbs', () => {
    expect(() => assertCapability('openai-chat-completions', 'generateText')).not.toThrow();
    expect(() => assertCapability('openai-images', 'generateImage')).not.toThrow();
    expect(() => assertCapability('sora-videos', 'generateVideo')).not.toThrow();
  });

  it('rejects assertCapability for unsupported verbs', () => {
    expect(() => assertCapability('openai-images', 'generateText')).toThrow(ProtocolCapabilityError);
    expect(() => assertCapability('claude-messages', 'generateImage')).toThrow(ProtocolCapabilityError);
    expect(() => assertCapability('openai-chat-completions', 'generateVideo')).toThrow(ProtocolCapabilityError);
  });

  it('exposes the canonical capability map', () => {
    expect(apiFormatCapabilities['openai-chat-completions']).toEqual(['text']);
    expect(apiFormatCapabilities['openai-images']).toEqual(['image']);
    expect(apiFormatCapabilities['sora-videos']).toEqual(['video']);
  });
});

describe('inferApiFormat', () => {
  it('routes Claude ids on Anthropic to claude-messages', () => {
    expect(inferApiFormat('claude-3-5-sonnet', 'anthropic')).toBe('claude-messages');
    expect(inferApiFormat('claude-opus-4', 'anthropic')).toBe('claude-messages');
  });

  it('routes Gemini ids on GCP to gemini-generate-content', () => {
    expect(inferApiFormat('gemini-2.5-pro', 'gcp')).toBe('gemini-generate-content');
    expect(inferApiFormat('gemini-1.5-flash', 'gcp')).toBe('gemini-generate-content');
  });

  it('routes Claude ids served via NewAPI/openai-compatible relay to openai-chat-completions', () => {
    // NewAPI relay registers as provider='openai' but proxies Claude ids.
    expect(inferApiFormat('claude-3-5-sonnet', 'openai')).toBe('openai-chat-completions');
    expect(inferApiFormat('gemini-2.5-pro', 'openai')).toBe('openai-chat-completions');
  });

  it('routes OpenAI image families regardless of provider hint', () => {
    expect(inferApiFormat('dall-e-3', 'openai')).toBe('openai-images');
    expect(inferApiFormat('gpt-image-1', 'openai')).toBe('openai-images');
    expect(inferApiFormat('gpt-image-2', 'openai')).toBe('openai-images');
  });

  it('routes Imagen ids to gemini-images', () => {
    expect(inferApiFormat('imagen-3.0', 'gcp')).toBe('gemini-images');
    expect(inferApiFormat('imagen-4.0-generate-preview', 'gcp')).toBe('gemini-images');
  });

  it('routes Sora-style ids to sora-videos', () => {
    expect(inferApiFormat('sora-1.0', 'openai')).toBe('sora-videos');
    expect(inferApiFormat('sora-turbo', 'openai')).toBe('sora-videos');
  });

  it('defaults gpt-* on openai to chat-completions', () => {
    expect(inferApiFormat('gpt-4o', 'openai')).toBe('openai-chat-completions');
    expect(inferApiFormat('gpt-4-turbo', 'openai')).toBe('openai-chat-completions');
  });
});
