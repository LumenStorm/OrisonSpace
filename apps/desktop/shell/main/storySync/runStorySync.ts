import type {
  ResolvedModel,
  RunStorySyncPayload,
  RunStorySyncResult,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import {
  ProtocolHttpError,
  ProtocolNotImplementedError,
  ProtocolSchemaError,
  generateText,
} from '@orison/model-protocols';
import { buildStorySyncMessages, parseStorySyncResponse } from '@orison/story-sync';
import { resolveModel } from '../ipc/modelGatewayIpc';

const FALLBACK: Pick<RunStorySyncResult, 'patches' | 'fallbackToRules'> = {
  patches: [],
  fallbackToRules: true,
};

export async function runStorySync(payload: RunStorySyncPayload): Promise<RunStorySyncResult> {
  let resolved: ResolvedModel;
  try {
    resolved = resolveModel(payload.ref);
  } catch (error) {
    return {
      ...FALLBACK,
      summary: `story-sync resolve failed: ${(error as Error).message}`,
    };
  }

  let textResponse: TextGenerationResponse;
  try {
    const request = buildTextRequest(resolved, payload);
    textResponse = await generateText(resolved, request);
  } catch (error) {
    if (
      error instanceof ProtocolHttpError ||
      error instanceof ProtocolSchemaError ||
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
  resolved: ResolvedModel,
  payload: RunStorySyncPayload,
): TextGenerationRequest {
  const messages = buildStorySyncMessages({
    runId: payload.runId,
    chapterId: payload.chapterId,
    candidate: payload.candidate,
    context: payload.context,
  });
  return {
    model: resolved.modelId,
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
