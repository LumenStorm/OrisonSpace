import type {
  ResolvedModelProfile,
  RunStorySyncPayload,
  RunStorySyncResult,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import {
  ProtocolCapabilityError,
  ProtocolHttpError,
  ProtocolNotImplementedError,
  ProtocolSchemaError,
  assertCapability,
  getProtocol,
} from '@orison/model-protocols';
import { buildStorySyncMessages, parseStorySyncResponse } from '@orison/story-sync';
import { resolveSlot } from '../ipc/modelGatewayIpc';

const FALLBACK: Pick<RunStorySyncResult, 'patches' | 'fallbackToRules'> = {
  patches: [],
  fallbackToRules: true,
};

/**
 * Run the story-sync LLM extraction locally on the desktop main process.
 *
 * Flow:
 *   load slot -> resolve profile (decrypt apiKey) -> build messages
 *   -> dispatch via model-protocols.generateText -> parse + safety-check
 *
 * Failure mode: never throws. On any LLM-side error (HTTP, schema,
 * not-implemented) we return `fallbackToRules: true` with empty patches so
 * the renderer can submit the orchestration run anyway and let agent's
 * rules path take over.
 */
export async function runStorySync(payload: RunStorySyncPayload): Promise<RunStorySyncResult> {
  let profile: ResolvedModelProfile;
  try {
    profile = resolveSlot(payload.slot);
  } catch (error) {
    return {
      ...FALLBACK,
      summary: `story-sync slot resolve failed: ${(error as Error).message}`,
    };
  }

  if (!profile.capabilities.includes('text')) {
    return {
      ...FALLBACK,
      summary: `story-sync slot ${profile.modelId} is not text-capable`,
    };
  }

  let textResponse: TextGenerationResponse;
  try {
    assertCapability(profile.apiFormat, 'generateText');
    const adapter = getProtocol(profile.apiFormat);
    const request = buildTextRequest(profile, payload);
    textResponse = await adapter.generateText!(profile, request);
  } catch (error) {
    if (
      error instanceof ProtocolHttpError ||
      error instanceof ProtocolSchemaError ||
      error instanceof ProtocolCapabilityError ||
      error instanceof ProtocolNotImplementedError
    ) {
      return {
        ...FALLBACK,
        summary: `story-sync LLM call failed (${error.name}); falling back to rules`,
      };
    }
    return {
      ...FALLBACK,
      summary: `story-sync LLM call threw (${(error as Error).name ?? 'Error'}); falling back to rules`,
    };
  }

  const parsed = parseStorySyncResponse(textResponse.text, {
    runId: payload.runId,
    chapterId: payload.chapterId,
    fieldVersions: normaliseFieldVersions(payload.fieldVersions),
  });
  if (!parsed.ok) {
    return {
      ...FALLBACK,
      summary: `story-sync parse failed: ${parsed.reason}`,
    };
  }

  return {
    patches: parsed.payload.patches,
    summary: parsed.payload.summary,
    fallbackToRules: false,
  };
}

function buildTextRequest(
  profile: ResolvedModelProfile,
  payload: RunStorySyncPayload,
): TextGenerationRequest {
  const messages = buildStorySyncMessages({
    runId: payload.runId,
    chapterId: payload.chapterId,
    candidate: payload.candidate,
    context: payload.context,
  });
  return {
    model: profile.modelId,
    messages,
    temperature: 0.2,
  };
}

function normaliseFieldVersions(
  versions: RunStorySyncPayload['fieldVersions'],
): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const [key, value] of Object.entries(versions ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}
