import type {
  GenerationProvider,
  ModelApiFormat,
  ModelCapability,
} from '@orison/shared-contracts';
import { ProtocolCapabilityError } from './errors';
import type { ProtocolAdapter, ProtocolVerb } from './types';
import { openaiChatProtocol } from './protocols/openaiChat';
import { openaiResponsesProtocol } from './protocols/openaiResponses';
import { claudeMessagesProtocol } from './protocols/claudeMessages';
import { geminiGenerateContentProtocol } from './protocols/geminiGenerateContent';
import { openaiImagesProtocol } from './protocols/openaiImages';
import { geminiImagesProtocol } from './protocols/geminiImages';
import { soraVideosProtocol } from './protocols/soraVideos';

const PROTOCOLS: Record<ModelApiFormat, ProtocolAdapter> = {
  'openai-chat-completions': openaiChatProtocol,
  'openai-responses': openaiResponsesProtocol,
  'claude-messages': claudeMessagesProtocol,
  'gemini-generate-content': geminiGenerateContentProtocol,
  'openai-images': openaiImagesProtocol,
  'gemini-images': geminiImagesProtocol,
  'sora-videos': soraVideosProtocol,
};

export const apiFormats: ModelApiFormat[] = Object.keys(PROTOCOLS) as ModelApiFormat[];

export function getProtocol(apiFormat: ModelApiFormat): ProtocolAdapter {
  const adapter = PROTOCOLS[apiFormat];
  if (!adapter) {
    throw new ProtocolCapabilityError(`Unknown apiFormat: ${apiFormat}`);
  }
  return adapter;
}

export function assertCapability(apiFormat: ModelApiFormat, verb: ProtocolVerb): void {
  const adapter = getProtocol(apiFormat);
  if (!adapter[verb]) {
    throw new ProtocolCapabilityError(
      `apiFormat '${apiFormat}' does not support verb '${verb}'`,
    );
  }
}

export const apiFormatCapabilities: Record<ModelApiFormat, ModelCapability[]> = {
  'openai-chat-completions': ['text'],
  'openai-responses': ['text'],
  'claude-messages': ['text'],
  'gemini-generate-content': ['text'],
  'openai-images': ['image'],
  'gemini-images': ['image'],
  'sora-videos': ['video'],
};

/**
 * Auto-suggest the most likely `apiFormat` for a model id given the profile's
 * `provider` hint. Used by the Settings UI to pre-fill the dropdown when the
 * user lists models.
 *
 * Always prefer NewAPI relays' `provider='openai'` to suggest OpenAI-compatible
 * formats, even for Claude / Gemini ids — the relay re-shapes them at the
 * gateway. Direct vendor providers suggest the native format.
 */
export function inferApiFormat(
  modelId: string,
  provider: GenerationProvider,
): ModelApiFormat {
  const id = modelId.toLowerCase();

  // Image-shaped ids regardless of provider
  if (id.startsWith('dall-e') || id.startsWith('gpt-image')) return 'openai-images';
  if (id.startsWith('imagen')) return 'gemini-images';
  // Video-shaped ids regardless of provider
  if (id.startsWith('sora') || id.includes('video')) return 'sora-videos';

  // Text: native vendor formats unless provider hints otherwise
  if (provider === 'anthropic' && id.includes('claude')) return 'claude-messages';
  if (provider === 'gcp' && id.includes('gemini')) return 'gemini-generate-content';

  // OpenAI direct or NewAPI relay (provider='openai' covers both):
  // default to chat-completions which is the broadest compatible shape.
  return 'openai-chat-completions';
}
