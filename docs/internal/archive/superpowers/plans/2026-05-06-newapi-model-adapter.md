# NewAPI Model Adapter Implementation Plan

> **Superseded.** Adapter file structure superseded by `2026-05-06-desktop-model-gateway-design.md`. Schema work in Task 1 of this plan was implemented inline in the desktop gateway migration's Phase 0 and remains the source of truth for `apiFormat`. The Phase 0 schemas and the desktop gateway adapters together replace the server-side adapter file paths described below.
>
> See:
> - `docs/superpowers/specs/2026-05-06-desktop-model-gateway-design.md`
> - `docs/superpowers/plans/2026-05-06-desktop-model-gateway-migration.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a NewAPI-compatible model adapter layer that can select the correct upstream API format and forward model-specific parameters without polluting the rest of the app with provider quirks.

**Architecture:** Treat `provider` as the real model vendor only when using direct vendor adapters, and introduce an explicit `apiFormat`/protocol selector for relay scenarios. Keep Orison's external server routes stable (`/v1/generation/:provider/text|image`) while internally routing through small protocol adapters for OpenAI Chat Completions, OpenAI Responses, Claude Messages, Gemini GenerateContent, OpenAI Images, Gemini Images, and Sora Videos. Embeddings and rerank are intentionally out of scope for this phase.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, existing `@orison/shared-contracts`, existing `apps/server/src/modules/generation` adapter pattern, Electron shell model profile storage.

---

## Reference Notes

NewAPI docs used for this plan:

- API overview: AI model interfaces are grouped separately and are OpenAI-compatible in broad shape: `https://docs.newapi.pro/zh/docs/api`
- Models list: `GET /v1/models`, with response format inferred from `Authorization`, `x-api-key` + `anthropic-version`, or Gemini headers/query key: `https://docs.newapi.pro/zh/docs/api/ai-model/models/list/listmodels`
- OpenAI Chat Completions: `POST /v1/chat/completions`, supports `model`, `messages`, `temperature`, `top_p`, `n`, `stream`, `stop`, `max_tokens`, `max_completion_tokens`, penalties, `tools`, `tool_choice`, `response_format`, `seed`, `reasoning_effort`, `modalities`, `audio`: `https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createchatcompletion`
- OpenAI Responses: `POST /v1/responses`, supports `model`, `input`, `instructions`, `max_output_tokens`, `temperature`, `top_p`, `stream`, `tools`, `tool_choice`, `reasoning`, `previous_response_id`, `truncation`: `https://docs.newapi.pro/zh/docs/api/ai-model/chat/openai/createresponse`
- Claude Messages: `POST /v1/messages`, requires `anthropic-version`, supports `model`, `messages`, `system`, `max_tokens`, `temperature`, `top_p`, `top_k`, `stream`, `stop_sequences`, `tools`, `tool_choice`, `thinking`, `metadata`: `https://docs.newapi.pro/zh/docs/api/ai-model/chat/createmessage`
- Gemini text/media: `POST /v1beta/models/{model}:generateContent`, supports `contents`, `generationConfig`, `safetySettings`, `tools`, `systemInstruction`: `https://docs.newapi.pro/zh/docs/api/ai-model/chat/gemini/geminirelayv1beta`
- OpenAI Images: `POST /v1/images/generations`, supports `model`, `prompt`, `n`, `size`, `background`, `moderation`, `quality`, `stream`, `style`, `user`: `https://docs.newapi.pro/zh/docs/api/ai-model/images/openai/post-v1-images-generations`
- Gemini Images: `POST /v1beta/models/{model}:generateContent`, uses `generationConfig.responseModalities` and `imageConfig`: `https://docs.newapi.pro/zh/docs/api/ai-model/images/gemini/geminirelayv1beta-383837589`
- Sora Videos: `POST /v1/videos`, multipart form fields include `model`, `prompt`, `image`, `duration`, `width`, `height`, `fps`, `seed`, `n`, `response_format`, `user`, `metadata`: `https://docs.newapi.pro/zh/docs/api/ai-model/videos/sora/createvideo`
- Embeddings and rerank exist in NewAPI, but are intentionally excluded from this implementation phase.

## Design Decision

Do not infer upstream protocol from `model` alone. A relay can expose a Claude model through OpenAI-compatible `/v1/chat/completions`, while direct Claude uses `/v1/messages`. The model profile must carry an explicit protocol/API format:

```ts
export type ModelApiFormat =
  | 'openai-chat-completions'
  | 'openai-responses'
  | 'claude-messages'
  | 'gemini-generate-content'
  | 'openai-images'
  | 'gemini-images'
  | 'sora-videos';
```

`provider` remains useful as a UI grouping/defaults hint (`openai`, `gcp`, `anthropic`, `newapi`), but request mapping is selected by `apiFormat`.

## File Structure

- Modify: `packages/shared-contracts/src/contracts/generation.ts`
  - Add `modelApiFormatSchema`.
  - Add provider-agnostic text/image/video request schemas with `providerOptions`.
  - Keep existing schemas compatible where possible.
- Modify: `packages/shared-contracts/src/ipc.ts`
  - Add `apiFormat` to `ModelProfile` and `ModelSlotConfig`.
- Create: `apps/server/src/modules/generation/providers/protocols/types.ts`
  - Define protocol adapter interfaces and normalized request/response types.
- Create: `apps/server/src/modules/generation/providers/protocols/registry.ts`
  - Map `apiFormat` to protocol adapter.
- Create: `apps/server/src/modules/generation/providers/protocols/openaiChat.ts`
  - Implement `/v1/chat/completions`.
- Create: `apps/server/src/modules/generation/providers/protocols/openaiResponses.ts`
  - Implement `/v1/responses`.
- Create: `apps/server/src/modules/generation/providers/protocols/claudeMessages.ts`
  - Implement `/v1/messages`.
- Create: `apps/server/src/modules/generation/providers/protocols/geminiGenerateContent.ts`
  - Implement `/v1beta/models/{model}:generateContent`.
- Create: `apps/server/src/modules/generation/providers/protocols/openaiImages.ts`
  - Implement `/v1/images/generations`.
- Create: `apps/server/src/modules/generation/providers/protocols/geminiImages.ts`
  - Implement Gemini image generation through GenerateContent.
- Create: `apps/server/src/modules/generation/providers/protocols/soraVideos.ts`
  - Implement `POST /v1/videos` and video status helpers.
- Modify: `apps/server/src/modules/generation/service.ts`
  - Dispatch by `apiFormat` when supplied; preserve legacy dispatch by `provider` for existing callers.
- Modify: `apps/server/src/modules/generation/routes.ts`
  - Keep existing text/image routes.
  - Add video routes only after the Sora protocol adapter is covered by tests.
- Create: `apps/server/test/newapiProtocolAdapters.test.ts`
  - Unit/integration tests for body mapping, headers, response normalization, and legacy compatibility.
- Modify: `apps/desktop/shell/main/ipc/configIpc.ts`
  - Persist `apiFormat` in model profiles and migrate existing profiles.
- Modify: `apps/desktop/shell/main/ipc/modelProviderIpc.ts`
  - Use `apiFormat` to choose model-list headers/URL/parser instead of guessing solely from `provider`.
- Modify: `apps/desktop/ui/src/shared/components/settings/model/utils.ts`
  - Add API format descriptors and defaults.
- Modify: `apps/desktop/ui/src/shared/components/settings/model/useModelLibrary.ts`
  - Include API format in profile draft/save flow.
- Modify: `apps/desktop/ui/src/shared/api/generation.ts`
  - Forward `apiFormat` and `providerOptions`.
- Modify: `docs/api/server-api.md`
  - Document API format selection and NewAPI relay examples.

---

### Task 1: Add Shared API Format Types

**Files:**
- Modify: `packages/shared-contracts/src/contracts/generation.ts`
- Modify: `packages/shared-contracts/src/ipc.ts`
- Test: `packages/shared-contracts/test/generation.test.ts` or existing shared-contracts generation test file

- [ ] **Step 1: Write the failing shared-contracts test**

Add tests that prove profiles can carry explicit API formats and generation requests can pass provider-specific options without making OpenAI-only fields top-level.

```ts
import { describe, expect, it } from 'vitest';
import {
  imageGenerationRequestSchema,
  modelApiFormatSchema,
  textGenerationRequestSchema,
} from '../src/contracts/generation';

describe('generation api format contracts', () => {
  it('accepts explicit NewAPI/OpenAI-compatible chat format', () => {
    expect(modelApiFormatSchema.parse('openai-chat-completions')).toBe('openai-chat-completions');
  });

  it('preserves provider-specific text options under providerOptions', () => {
    const parsed = textGenerationRequestSchema.parse({
      model: 'claude-3-5-sonnet',
      apiFormat: 'claude-messages',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 1024,
      providerOptions: {
        anthropicVersion: '2023-06-01',
        thinking: { type: 'enabled', budget_tokens: 1024 },
      },
    });

    expect(parsed.apiFormat).toBe('claude-messages');
    expect(parsed.providerOptions).toEqual({
      anthropicVersion: '2023-06-01',
      thinking: { type: 'enabled', budget_tokens: 1024 },
    });
  });

  it('preserves provider-specific image options under providerOptions', () => {
    const parsed = imageGenerationRequestSchema.parse({
      model: 'gpt-image-1',
      apiFormat: 'openai-images',
      prompt: 'cinematic frame',
      providerOptions: {
        background: 'transparent',
        quality: 'high',
        responseFormat: 'b64_json',
      },
    });

    expect(parsed.providerOptions).toMatchObject({
      background: 'transparent',
      quality: 'high',
      responseFormat: 'b64_json',
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @orison/shared-contracts test -- generation.test.ts`

Expected: FAIL because `modelApiFormatSchema` and `providerOptions` do not exist yet.

- [ ] **Step 3: Add minimal shared contract implementation**

Add to `packages/shared-contracts/src/contracts/generation.ts`:

```ts
export const modelApiFormatSchema = z.enum([
  'openai-chat-completions',
  'openai-responses',
  'claude-messages',
  'gemini-generate-content',
  'openai-images',
  'gemini-images',
  'sora-videos',
]);

export const providerOptionsSchema = z.record(z.string(), z.unknown()).default({});
```

Extend existing request schemas:

```ts
export const textGenerationRequestSchema = z.object({
  model: z.string().min(1),
  apiFormat: modelApiFormatSchema.optional(),
  messages: z.array(generationMessageSchema).min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  providerOptions: providerOptionsSchema.optional(),
});
```

```ts
export const imageGenerationRequestSchema = z.object({
  model: z.string().min(1),
  apiFormat: modelApiFormatSchema.optional(),
  prompt: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  size: z.string().optional(),
  n: z.number().int().min(1).max(10).optional(),
  quality: z.enum(['auto', 'low', 'medium', 'high']).optional(),
  background: z.enum(['transparent', 'opaque', 'auto']).optional(),
  outputFormat: z.enum(['png', 'jpeg', 'webp']).optional(),
  outputCompression: z.number().int().min(0).max(100).optional(),
  moderation: z.enum(['low', 'auto']).optional(),
  user: z.string().optional(),
  providerOptions: providerOptionsSchema.optional(),
});
```

Add to `packages/shared-contracts/src/ipc.ts`:

```ts
import type { GenerationProvider, ModelApiFormat } from './contracts/generation';

export type ModelProfile = {
  id: string;
  name: string;
  provider: GenerationProvider;
  apiFormat: ModelApiFormat;
  apiKey: string;
  baseUrl: string;
  model: string;
  capabilities: ModelCapability[];
};

export type ModelSlotConfig = {
  provider: GenerationProvider;
  apiFormat: ModelApiFormat;
  apiKey: string;
  baseUrl: string;
  model: string;
};
```

Also export:

```ts
export type ModelApiFormat = z.infer<typeof modelApiFormatSchema>;
```

- [ ] **Step 4: Run the shared-contracts test**

Run: `pnpm --filter @orison/shared-contracts test -- generation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-contracts/src/contracts/generation.ts packages/shared-contracts/src/ipc.ts packages/shared-contracts/test/generation.test.ts
git commit -m "feat: add explicit model api formats"
```

---

### Task 2: Add Protocol Adapter Registry

**Files:**
- Create: `apps/server/src/modules/generation/providers/protocols/types.ts`
- Create: `apps/server/src/modules/generation/providers/protocols/registry.ts`
- Test: `apps/server/test/newapiProtocolAdapters.test.ts`

- [ ] **Step 1: Write failing registry test**

```ts
import { describe, expect, it } from 'vitest';
import { getProtocolAdapter } from '../src/modules/generation/providers/protocols/registry';

describe('protocol adapter registry', () => {
  it('resolves OpenAI-compatible chat adapter', () => {
    expect(getProtocolAdapter('openai-chat-completions').apiFormat).toBe('openai-chat-completions');
  });

  it('resolves Claude Messages adapter', () => {
    expect(getProtocolAdapter('claude-messages').apiFormat).toBe('claude-messages');
  });

  it('resolves Gemini GenerateContent adapter', () => {
    expect(getProtocolAdapter('gemini-generate-content').apiFormat).toBe('gemini-generate-content');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts`

Expected: FAIL because `protocols/registry.ts` does not exist.

- [ ] **Step 3: Add minimal protocol types and registry**

Create `apps/server/src/modules/generation/providers/protocols/types.ts`:

```ts
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ModelApiFormat,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';

export type ProtocolTextAdapter = {
  apiFormat: ModelApiFormat;
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;
};

export type ProtocolImageAdapter = {
  apiFormat: ModelApiFormat;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
};

export type ProtocolAdapter = Partial<ProtocolTextAdapter & ProtocolImageAdapter> & {
  apiFormat: ModelApiFormat;
};
```

Create `apps/server/src/modules/generation/providers/protocols/registry.ts`:

```ts
import type { ModelApiFormat } from '@orison/shared-contracts';
import { GenerationProviderError } from '../types';
import type { ProtocolAdapter } from './types';

const placeholder = (apiFormat: ModelApiFormat): ProtocolAdapter => ({ apiFormat });

const adapters: Record<ModelApiFormat, ProtocolAdapter> = {
  'openai-chat-completions': placeholder('openai-chat-completions'),
  'openai-responses': placeholder('openai-responses'),
  'claude-messages': placeholder('claude-messages'),
  'gemini-generate-content': placeholder('gemini-generate-content'),
  'openai-images': placeholder('openai-images'),
  'gemini-images': placeholder('gemini-images'),
  'sora-videos': placeholder('sora-videos'),
};

export function getProtocolAdapter(apiFormat: ModelApiFormat): ProtocolAdapter {
  const adapter = adapters[apiFormat];
  if (!adapter) throw new GenerationProviderError(`Unsupported API format: ${apiFormat}`, 400);
  return adapter;
}
```

- [ ] **Step 4: Run registry test**

Run: `pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/generation/providers/protocols apps/server/test/newapiProtocolAdapters.test.ts
git commit -m "feat: add generation protocol registry"
```

---

### Task 3: Implement Text Protocol Adapters

**Files:**
- Create: `apps/server/src/modules/generation/providers/protocols/openaiChat.ts`
- Create: `apps/server/src/modules/generation/providers/protocols/openaiResponses.ts`
- Create: `apps/server/src/modules/generation/providers/protocols/claudeMessages.ts`
- Create: `apps/server/src/modules/generation/providers/protocols/geminiGenerateContent.ts`
- Modify: `apps/server/src/modules/generation/providers/protocols/registry.ts`
- Test: `apps/server/test/newapiProtocolAdapters.test.ts`

- [ ] **Step 1: Add failing text mapping tests**

Mock `globalThis.fetch` and assert each adapter sends the right URL, headers, and body.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProtocolAdapter } from '../src/modules/generation/providers/protocols/registry';

afterEach(() => vi.restoreAllMocks());

describe('text protocol adapters', () => {
  it('maps OpenAI Chat Completions options', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: 'hello' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = getProtocolAdapter('openai-chat-completions');
    const result = await adapter.generateText!({
      model: 'gpt-4o',
      baseUrl: 'https://newapi.example/v1',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.2,
      maxTokens: 256,
      providerOptions: {
        top_p: 0.9,
        reasoning_effort: 'medium',
        response_format: { type: 'json_object' },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://newapi.example/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer sk-test' }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.2,
      max_tokens: 256,
      top_p: 0.9,
      reasoning_effort: 'medium',
      response_format: { type: 'json_object' },
    });
    expect(result.text).toBe('hello');
  });

  it('maps Claude Messages options', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        content: [{ type: 'text', text: 'claude hello' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = getProtocolAdapter('claude-messages');
    const result = await adapter.generateText!({
      model: 'claude-3-5-sonnet',
      baseUrl: 'https://newapi.example',
      apiKey: 'sk-test',
      messages: [
        { role: 'system', content: 'You are precise.' },
        { role: 'user', content: 'Hi' },
      ],
      maxTokens: 1024,
      providerOptions: {
        anthropicVersion: '2023-06-01',
        top_k: 20,
        thinking: { type: 'enabled', budget_tokens: 512 },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://newapi.example/v1/messages', expect.objectContaining({
      headers: expect.objectContaining({
        'x-api-key': 'sk-test',
        'anthropic-version': '2023-06-01',
      }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'claude-3-5-sonnet',
      system: 'You are precise.',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1024,
      top_k: 20,
      thinking: { type: 'enabled', budget_tokens: 512 },
    });
    expect(result.text).toBe('claude hello');
  });

  it('maps Gemini GenerateContent options', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'gemini hello' }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = getProtocolAdapter('gemini-generate-content');
    const result = await adapter.generateText!({
      model: 'gemini-2.5-pro',
      baseUrl: 'https://newapi.example',
      apiKey: 'sk-test',
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
      ],
      temperature: 0.4,
      maxTokens: 512,
      providerOptions: {
        topP: 0.95,
        safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }],
      },
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://newapi.example/v1beta/models/gemini-2.5-pro:generateContent?key=sk-test');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      systemInstruction: { parts: [{ text: 'Be concise.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512, topP: 0.95 },
    });
    expect(result.text).toBe('gemini hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts`

Expected: FAIL because protocol adapters are placeholders.

- [ ] **Step 3: Implement `openaiChat.ts`**

```ts
import type { TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
};

const ALLOWED_OPTIONS = [
  'top_p',
  'n',
  'stream',
  'stream_options',
  'stop',
  'max_completion_tokens',
  'presence_penalty',
  'frequency_penalty',
  'logit_bias',
  'user',
  'tools',
  'tool_choice',
  'response_format',
  'seed',
  'reasoning_effort',
  'modalities',
  'audio',
] as const;

function pickOptions(providerOptions: Record<string, unknown> | undefined) {
  const output: Record<string, unknown> = {};
  for (const key of ALLOWED_OPTIONS) {
    if (providerOptions?.[key] !== undefined) output[key] = providerOptions[key];
  }
  return output;
}

export const openAiChatProtocol = {
  apiFormat: 'openai-chat-completions' as const,
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.openai.com/v1');
    const raw = await postJson<OpenAiChatResponse>({
      url: `${baseUrl}/chat/completions`,
      headers: { authorization: `Bearer ${request.apiKey ?? ''}` },
      body: {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        ...pickOptions(request.providerOptions),
      },
    });

    return {
      provider: 'openai',
      model: request.model,
      text: raw.choices?.[0]?.message?.content ?? '',
      raw,
    };
  },
};
```

- [ ] **Step 4: Implement `claudeMessages.ts`**

```ts
import type { GenerationMessage, TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type ClaudeResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

function splitSystem(messages: GenerationMessage[]) {
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }));
  return { system, conversation };
}

export const claudeMessagesProtocol = {
  apiFormat: 'claude-messages' as const,
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.anthropic.com');
    const options = request.providerOptions ?? {};
    const { system, conversation } = splitSystem(request.messages);
    const raw = await postJson<ClaudeResponse>({
      url: `${baseUrl}/v1/messages`,
      headers: {
        'x-api-key': request.apiKey ?? '',
        'anthropic-version': String(options.anthropicVersion ?? '2023-06-01'),
      },
      body: {
        model: request.model,
        system: system || undefined,
        messages: conversation,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
        top_p: options.top_p,
        top_k: options.top_k,
        stream: options.stream,
        stop_sequences: options.stop_sequences,
        tools: options.tools,
        tool_choice: options.tool_choice,
        thinking: options.thinking,
        metadata: options.metadata,
      },
    });

    return {
      provider: 'anthropic',
      model: request.model,
      text: raw.content?.map((part) => part.text ?? '').join('') ?? '',
      raw,
    };
  },
};
```

- [ ] **Step 5: Implement `geminiGenerateContent.ts`**

```ts
import type { GenerationMessage, TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function toGeminiContents(messages: GenerationMessage[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
}

function toSystemInstruction(messages: GenerationMessage[]) {
  const text = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  return text ? { parts: [{ text }] } : undefined;
}

export const geminiGenerateContentProtocol = {
  apiFormat: 'gemini-generate-content' as const,
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://generativelanguage.googleapis.com');
    const options = request.providerOptions ?? {};
    const raw = await postJson<GeminiResponse>({
      url: `${baseUrl}/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey ?? '')}`,
      body: {
        contents: toGeminiContents(request.messages),
        systemInstruction: toSystemInstruction(request.messages),
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: options.topP,
          topK: options.topK,
          candidateCount: options.candidateCount,
          stopSequences: options.stopSequences,
        },
        safetySettings: options.safetySettings,
        tools: options.tools,
      },
    });

    return {
      provider: 'gcp',
      model: request.model,
      text: raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
      raw,
    };
  },
};
```

- [ ] **Step 6: Implement `openaiResponses.ts`**

```ts
import type { TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type ResponsesApiResponse = {
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

export const openAiResponsesProtocol = {
  apiFormat: 'openai-responses' as const,
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.openai.com/v1');
    const options = request.providerOptions ?? {};
    const raw = await postJson<ResponsesApiResponse>({
      url: `${baseUrl}/responses`,
      headers: { authorization: `Bearer ${request.apiKey ?? ''}` },
      body: {
        model: request.model,
        input: options.input ?? request.messages,
        instructions: options.instructions,
        max_output_tokens: options.max_output_tokens ?? request.maxTokens,
        temperature: request.temperature,
        top_p: options.top_p,
        stream: options.stream,
        tools: options.tools,
        tool_choice: options.tool_choice,
        reasoning: options.reasoning,
        previous_response_id: options.previous_response_id,
        truncation: options.truncation,
      },
    });

    return {
      provider: 'openai',
      model: request.model,
      text: raw.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? '').join('') ?? '',
      raw,
    };
  },
};
```

- [ ] **Step 7: Wire text adapters into registry**

Modify `registry.ts`:

```ts
import { claudeMessagesProtocol } from './claudeMessages';
import { geminiGenerateContentProtocol } from './geminiGenerateContent';
import { openAiChatProtocol } from './openaiChat';
import { openAiResponsesProtocol } from './openaiResponses';

const adapters: Record<ModelApiFormat, ProtocolAdapter> = {
  'openai-chat-completions': openAiChatProtocol,
  'openai-responses': openAiResponsesProtocol,
  'claude-messages': claudeMessagesProtocol,
  'gemini-generate-content': geminiGenerateContentProtocol,
  'openai-images': placeholder('openai-images'),
  'gemini-images': placeholder('gemini-images'),
  'sora-videos': placeholder('sora-videos'),
};
```

- [ ] **Step 8: Run tests**

Run: `pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/modules/generation/providers/protocols apps/server/test/newapiProtocolAdapters.test.ts
git commit -m "feat: add NewAPI text protocol adapters"
```

---

### Task 4: Dispatch Server Text Requests by `apiFormat`

**Files:**
- Modify: `apps/server/src/modules/generation/service.ts`
- Test: `apps/server/test/generation.test.ts`

- [ ] **Step 1: Write failing service dispatch test**

Add a test proving `apiFormat: 'claude-messages'` calls `/v1/messages` even if the path provider is `openai` or `newapi`.

```ts
it('dispatches text generation by apiFormat when provided', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await generateText('openai', {
    model: 'claude-3-5-sonnet',
    apiFormat: 'claude-messages',
    apiKey: 'sk-test',
    baseUrl: 'https://relay.example',
    messages: [{ role: 'user', content: 'hello' }],
    maxTokens: 128,
  });

  expect(fetchMock.mock.calls[0][0]).toBe('https://relay.example/v1/messages');
  expect(result.text).toBe('ok');
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter @orison/server test -- generation.test.ts`

Expected: FAIL because service still dispatches only by provider.

- [ ] **Step 3: Implement dispatch**

Modify `apps/server/src/modules/generation/service.ts`:

```ts
import { getProtocolAdapter } from './providers/protocols/registry';

export async function generateText(
  provider: GenerationProvider,
  request: TextGenerationRequest,
): Promise<TextGenerationResponse> {
  if (request.apiFormat) {
    const adapter = getProtocolAdapter(request.apiFormat);
    if (!adapter.generateText) {
      throw new GenerationProviderError(`API format ${request.apiFormat} does not support text generation`, 400);
    }
    return adapter.generateText(request);
  }
  return getProvider(provider).generateText(request);
}
```

Import `GenerationProviderError` from `./providers`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @orison/server test -- generation.test.ts
pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/generation/service.ts apps/server/test/generation.test.ts
git commit -m "feat: dispatch generation by api format"
```

---

### Task 5: Implement Image Protocol Adapters

**Files:**
- Create: `apps/server/src/modules/generation/providers/protocols/openaiImages.ts`
- Create: `apps/server/src/modules/generation/providers/protocols/geminiImages.ts`
- Modify: `apps/server/src/modules/generation/providers/protocols/registry.ts`
- Modify: `apps/server/src/modules/generation/service.ts`
- Test: `apps/server/test/newapiProtocolAdapters.test.ts`

- [ ] **Step 1: Add failing image mapping tests**

```ts
describe('image protocol adapters', () => {
  it('maps OpenAI Images options', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: [{ b64_json: 'abc' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = getProtocolAdapter('openai-images');
    const result = await adapter.generateImage!({
      model: 'gpt-image-1',
      baseUrl: 'https://newapi.example/v1',
      apiKey: 'sk-test',
      prompt: 'a fox',
      n: 1,
      size: '1024x1024',
      providerOptions: {
        background: 'transparent',
        quality: 'high',
        style: 'vivid',
      },
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://newapi.example/v1/images/generations');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'gpt-image-1',
      prompt: 'a fox',
      n: 1,
      size: '1024x1024',
      background: 'transparent',
      quality: 'high',
      style: 'vivid',
    });
    expect(result.images[0].b64Json).toBe('abc');
  });

  it('maps Gemini Images options', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc' } }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = getProtocolAdapter('gemini-images');
    const result = await adapter.generateImage!({
      model: 'gemini-2.5-flash-image',
      baseUrl: 'https://newapi.example',
      apiKey: 'sk-test',
      prompt: 'a fox',
      providerOptions: {
        aspectRatio: '16:9',
        imageSize: '1024',
      },
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://newapi.example/v1beta/models/gemini-2.5-flash-image:generateContent?key=sk-test');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'a fox' }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '16:9', imageSize: '1024' },
      },
    });
    expect(result.images[0]).toMatchObject({ b64Json: 'abc', mimeType: 'image/png' });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts`

Expected: FAIL because image protocol adapters are placeholders.

- [ ] **Step 3: Implement `openaiImages.ts`**

```ts
import type { ImageGenerationRequest, ImageGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type OpenAiImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; b64Json?: string; base64?: string }>;
};

export const openAiImagesProtocol = {
  apiFormat: 'openai-images' as const,
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.openai.com/v1');
    const options = request.providerOptions ?? {};
    const raw = await postJson<OpenAiImageResponse>({
      url: `${baseUrl}/images/generations`,
      headers: { authorization: `Bearer ${request.apiKey ?? ''}` },
      body: {
        model: request.model,
        prompt: request.prompt,
        n: request.n ?? 1,
        size: request.size,
        background: options.background ?? request.background,
        moderation: options.moderation ?? request.moderation,
        quality: options.quality ?? request.quality,
        stream: options.stream,
        style: options.style,
        user: options.user ?? request.user,
        response_format: options.responseFormat,
        output_format: options.outputFormat ?? request.outputFormat,
        output_compression: options.outputCompression ?? request.outputCompression,
      },
    });

    return {
      provider: 'openai',
      model: request.model,
      images: (raw.data ?? []).map((image) => ({
        url: image.url,
        b64Json: image.b64_json ?? image.b64Json ?? image.base64,
      })),
      raw,
    };
  },
};
```

- [ ] **Step 4: Implement `geminiImages.ts`**

```ts
import type { ImageGenerationRequest, ImageGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type GeminiImageResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
};

export const geminiImagesProtocol = {
  apiFormat: 'gemini-images' as const,
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://generativelanguage.googleapis.com');
    const options = request.providerOptions ?? {};
    const raw = await postJson<GeminiImageResponse>({
      url: `${baseUrl}/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey ?? '')}`,
      body: {
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: options.aspectRatio,
            imageSize: options.imageSize,
          },
        },
      },
    });

    return {
      provider: 'gcp',
      model: request.model,
      images: (raw.candidates ?? [])
        .flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => ({
          b64Json: part.inlineData?.data,
          mimeType: part.inlineData?.mimeType,
        })),
      raw,
    };
  },
};
```

- [ ] **Step 5: Wire image adapters and dispatch by `apiFormat`**

In `registry.ts`, replace placeholders:

```ts
import { geminiImagesProtocol } from './geminiImages';
import { openAiImagesProtocol } from './openaiImages';

'openai-images': openAiImagesProtocol,
'gemini-images': geminiImagesProtocol,
```

In `service.ts`, mirror text dispatch:

```ts
if (request.apiFormat) {
  const adapter = getProtocolAdapter(request.apiFormat);
  if (!adapter.generateImage) {
    throw new GenerationProviderError(`API format ${request.apiFormat} does not support image generation`, 400);
  }
  const response = await adapter.generateImage(request);
  return normalizeImageResponseToBase64(response);
}
```

- [ ] **Step 6: Run image tests**

Run:

```bash
pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts
pnpm --filter @orison/server test -- generation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/generation/providers/protocols apps/server/src/modules/generation/service.ts apps/server/test/newapiProtocolAdapters.test.ts
git commit -m "feat: add NewAPI image protocol adapters"
```

---

### Task 6: Add Desktop Model Profile API Format Configuration

**Files:**
- Modify: `apps/desktop/shell/main/ipc/configIpc.ts`
- Modify: `apps/desktop/ui/src/shared/components/settings/model/utils.ts`
- Modify: `apps/desktop/ui/src/shared/components/settings/model/useModelLibrary.ts`
- Modify: model settings component file that renders provider/profile fields
- Test: `apps/desktop/shell/test/configIpc.test.ts`
- Test: `apps/desktop/ui/test/modelSettingsPage.test.tsx`

- [ ] **Step 1: Write failing persistence test**

Add a shell config test that saves and reloads `apiFormat`.

```ts
it('persists model profile apiFormat', async () => {
  const config = {
    profiles: [{
      id: 'model_001',
      name: 'NewAPI Claude Relay',
      provider: 'openai',
      apiFormat: 'openai-chat-completions',
      apiKey: 'sk-test',
      baseUrl: 'https://newapi.example/v1',
      model: 'claude-3-5-sonnet',
      capabilities: ['text'],
    }],
    selected: { novel: 'model_001', image: null, video: null },
  };

  await saveModelConfig(config);
  expect(readModelConfig().profiles[0].apiFormat).toBe('openai-chat-completions');
});
```

- [ ] **Step 2: Write failing UI test**

Add a model settings test that changes API format independently from provider.

```tsx
it('lets users choose API format separately from provider', async () => {
  render(<ModelSettingsPage />);

  await userEvent.click(screen.getByRole('button', { name: /new model/i }));
  await userEvent.selectOptions(screen.getByLabelText(/API format/i), 'claude-messages');

  expect(screen.getByLabelText(/API format/i)).toHaveValue('claude-messages');
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
pnpm --filter @orison/desktop-shell test -- configIpc.test.ts
pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx
```

Expected: FAIL because profile config does not expose `apiFormat`.

- [ ] **Step 4: Implement config migration**

In `configIpc.ts`, when reading legacy profiles:

```ts
function defaultApiFormat(provider: ModelProfile['provider'], capabilities: ModelProfile['capabilities']) {
  if (capabilities.includes('image')) return provider === 'gcp' ? 'gemini-images' : 'openai-images';
  if (capabilities.includes('video')) return 'sora-videos';
  if (provider === 'anthropic') return 'claude-messages';
  if (provider === 'gcp') return 'gemini-generate-content';
  return 'openai-chat-completions';
}
```

When normalizing profile:

```ts
apiFormat: readApiFormat(raw.apiFormat, defaultApiFormat(provider, capabilities)),
```

Add:

```ts
function readApiFormat(value: unknown, fallback: ModelApiFormat): ModelApiFormat {
  return modelApiFormatSchema.safeParse(value).success ? value as ModelApiFormat : fallback;
}
```

- [ ] **Step 5: Implement UI draft fields**

In `utils.ts`, extend `ProfileDraft`:

```ts
apiFormat: ModelApiFormat;
```

Add descriptors:

```ts
export const API_FORMAT_OPTIONS: Array<{ id: ModelApiFormat; label: string }> = [
  { id: 'openai-chat-completions', label: 'OpenAI Chat Completions / NewAPI relay' },
  { id: 'openai-responses', label: 'OpenAI Responses' },
  { id: 'claude-messages', label: 'Claude Messages' },
  { id: 'gemini-generate-content', label: 'Gemini GenerateContent' },
  { id: 'openai-images', label: 'OpenAI Images' },
  { id: 'gemini-images', label: 'Gemini Images' },
  { id: 'sora-videos', label: 'Sora Videos' },
];
```

Include `apiFormat` in `emptyProfileDraft`, `profileToDraft`, `draftToProfile`, and `isProfileDirty`.

- [ ] **Step 6: Render API format select**

In the model settings component, add:

```tsx
<label>
  <span>API format</span>
  <select
    value={draft.apiFormat}
    onChange={(event) => updateDraft({ apiFormat: event.currentTarget.value as ModelApiFormat })}
  >
    {API_FORMAT_OPTIONS.map((option) => (
      <option key={option.id} value={option.id}>{option.label}</option>
    ))}
  </select>
</label>
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @orison/desktop-shell test -- configIpc.test.ts
pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/shell/main/ipc/configIpc.ts apps/desktop/ui/src/shared/components/settings/model apps/desktop/shell/test/configIpc.test.ts apps/desktop/ui/test/modelSettingsPage.test.tsx
git commit -m "feat: configure model API formats"
```

---

### Task 7: Update Model List Refresh by API Format

**Files:**
- Modify: `apps/desktop/shell/main/ipc/modelProviderIpc.ts`
- Test: `apps/desktop/shell/test/modelProviderIpc.test.ts`

- [ ] **Step 1: Write failing model-list tests**

```ts
it('uses OpenAI model list for OpenAI-compatible NewAPI relay', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ id: 'claude-3-5-sonnet' }] }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await listProviderModels({
    provider: 'openai',
    apiFormat: 'openai-chat-completions',
    baseUrl: 'https://newapi.example/v1',
    apiKey: 'sk-test',
  });

  expect(fetchMock.mock.calls[0][0]).toBe('https://newapi.example/v1/models');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer sk-test' });
  expect(result[0].id).toBe('claude-3-5-sonnet');
});

it('uses Claude headers when API format is claude-messages', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ id: 'claude-3-5-sonnet' }] }),
  });
  vi.stubGlobal('fetch', fetchMock);

  await listProviderModels({
    provider: 'anthropic',
    apiFormat: 'claude-messages',
    baseUrl: 'https://newapi.example',
    apiKey: 'sk-test',
  });

  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
    'x-api-key': 'sk-test',
    'anthropic-version': '2023-06-01',
  });
});

it('uses Gemini model list path when API format is gemini-generate-content', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ models: [{ name: 'models/gemini-2.5-pro' }] }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await listProviderModels({
    provider: 'gcp',
    apiFormat: 'gemini-generate-content',
    baseUrl: 'https://newapi.example',
    apiKey: 'sk-test',
  });

  expect(fetchMock.mock.calls[0][0]).toBe('https://newapi.example/v1beta/models?key=sk-test');
  expect(result[0].id).toBe('gemini-2.5-pro');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @orison/desktop-shell test -- modelProviderIpc.test.ts`

Expected: FAIL because model list still branches only on provider and request type lacks `apiFormat`.

- [ ] **Step 3: Implement API format based model list routing**

In `modelProviderIpc.ts`:

```ts
function isGeminiFormat(apiFormat: ModelApiFormat): boolean {
  return apiFormat === 'gemini-generate-content' || apiFormat === 'gemini-images';
}

function isClaudeFormat(apiFormat: ModelApiFormat): boolean {
  return apiFormat === 'claude-messages';
}

function buildModelsUrl({ apiFormat, baseUrl, apiKey }: ProviderModelListRequest): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const path = isGeminiFormat(apiFormat) ? '/v1beta/models' : '/v1/models';
  const url = new URL(`${trimmed}${path}`);
  if (isGeminiFormat(apiFormat) && apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

function buildModelListHeaders({ apiFormat, apiKey }: ProviderModelListRequest): Record<string, string> {
  if (!apiKey) return {};
  if (isClaudeFormat(apiFormat)) {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  }
  if (isGeminiFormat(apiFormat)) {
    return { 'x-goog-api-key': apiKey };
  }
  return { Authorization: `Bearer ${apiKey}` };
}
```

Parse Gemini response when `isGeminiFormat(request.apiFormat)`; otherwise parse OpenAI list response.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @orison/desktop-shell test -- modelProviderIpc.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/shell/main/ipc/modelProviderIpc.ts apps/desktop/shell/test/modelProviderIpc.test.ts
git commit -m "feat: refresh model lists by API format"
```

---

### Task 8: Forward API Format and Provider Options from Desktop

**Files:**
- Modify: `apps/desktop/ui/src/shared/api/generation.ts`
- Modify: `apps/desktop/ui/src/features/editor/ImageGenEditor.tsx`
- Modify: `apps/desktop/ui/src/shared/imageGen/schema.ts`
- Test: `apps/desktop/ui/test/imageGenEditor.test.tsx`

- [ ] **Step 1: Write failing desktop request test**

Add an image editor/API test proving `apiFormat` is sent:

```ts
it('sends selected image profile apiFormat and providerOptions to server', async () => {
  useAppStore.setState({
    modelConfig: {
      profiles: [{
        id: 'model_001',
        name: 'NewAPI Image',
        provider: 'openai',
        apiFormat: 'openai-images',
        apiKey: 'sk-test',
        baseUrl: 'https://newapi.example/v1',
        model: 'gpt-image-1',
        capabilities: ['image'],
      }],
      selected: { novel: null, image: 'model_001', video: null },
    },
  } as any);

  // trigger generation in existing test helper...

  const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
  expect(body).toMatchObject({
    apiFormat: 'openai-images',
    providerOptions: expect.objectContaining({ quality: 'high' }),
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm --filter @orison/desktop-ui test -- imageGenEditor.test.tsx`

Expected: FAIL because API format is not included in request body yet.

- [ ] **Step 3: Forward `apiFormat` from profile**

In `generation.ts`, include:

```ts
const body: Record<string, unknown> = {
  model: slot.model,
  apiFormat: slot.apiFormat,
  apiKey: slot.apiKey,
  baseUrl: slot.baseUrl,
  prompt,
};
```

Map advanced UI params to `providerOptions`:

```ts
const providerOptions: Record<string, unknown> = {};
if (params.quality !== undefined) providerOptions.quality = params.quality;
if (params.background !== undefined) providerOptions.background = params.background;
if (params.outputFormat !== undefined) providerOptions.outputFormat = params.outputFormat;
if (params.outputCompression !== undefined) providerOptions.outputCompression = params.outputCompression;
if (params.moderation !== undefined) providerOptions.moderation = params.moderation;
if (Object.keys(providerOptions).length > 0) body.providerOptions = providerOptions;
```

Keep common fields `size`, `n`, `user` top-level.

- [ ] **Step 4: Run desktop tests**

Run: `pnpm --filter @orison/desktop-ui test -- imageGenEditor.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/ui/src/shared/api/generation.ts apps/desktop/ui/src/features/editor/ImageGenEditor.tsx apps/desktop/ui/src/shared/imageGen/schema.ts apps/desktop/ui/test/imageGenEditor.test.tsx
git commit -m "feat: forward model API format from desktop"
```

---

### Task 9: Add Video Server Capability

**Files:**
- Modify: `packages/shared-contracts/src/contracts/generation.ts`
- Create: `apps/server/src/modules/generation/providers/protocols/soraVideos.ts`
- Modify: `apps/server/src/modules/generation/providers/protocols/registry.ts`
- Modify: `apps/server/src/modules/generation/routes.ts`
- Modify: `apps/server/src/modules/generation/service.ts`
- Test: `apps/server/test/newapiProtocolAdapters.test.ts`
- Test: `apps/server/test/generation.test.ts`

- [ ] **Step 1: Write failing video contract test**

```ts
it('accepts video request', () => {
  expect(videoGenerationRequestSchema.parse({
    model: 'sora',
    apiFormat: 'sora-videos',
    prompt: 'moving camera',
    duration: 5,
    width: 1280,
    height: 720,
  }).duration).toBe(5);
});
```

- [ ] **Step 2: Run contracts test and verify failure**

Run: `pnpm --filter @orison/shared-contracts test -- generation.test.ts`

Expected: FAIL because `videoGenerationRequestSchema` does not exist.

- [ ] **Step 3: Add schemas**

In `generation.ts`:

```ts
export const videoGenerationRequestSchema = z.object({
  model: z.string().min(1),
  apiFormat: z.literal('sora-videos'),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  prompt: z.string().optional(),
  image: z.string().optional(),
  duration: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
  n: z.number().int().positive().optional(),
  responseFormat: z.string().optional(),
  user: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

- [ ] **Step 4: Add Sora protocol adapter tests**

Test URL/body mapping for multipart `/v1/videos`.

- [ ] **Step 5: Implement Sora adapter**

Add `postFormData` helper in `providers/http.ts`:

```ts
export async function postFormData<T>({ url, headers = {}, form }: { url: string; headers?: Record<string, string>; form: FormData }): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers, body: form });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = typeof parsed?.error?.message === 'string'
      ? parsed.error.message
      : `Generation provider request failed with ${response.status}`;
    throw new GenerationProviderError(message, response.status);
  }
  return parsed as T;
}
```

- [ ] **Step 6: Add routes**

Add:

```ts
app.post('/v1/generation/:provider/video', async (request, reply) => { ... });
```

Use shared schemas and service dispatch.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @orison/shared-contracts test -- generation.test.ts
pnpm --filter @orison/server test -- newapiProtocolAdapters.test.ts
pnpm --filter @orison/server test -- generation.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-contracts/src/contracts/generation.ts apps/server/src/modules/generation apps/server/test
git commit -m "feat: add NewAPI video adapter"
```

---

### Task 10: Document NewAPI Relay Configuration

**Files:**
- Modify: `docs/api/server-api.md`
- Modify: `docs/data-dictionary.md` if model profile fields are documented there
- Modify: `README.md` relevant model configuration notes

- [ ] **Step 1: Add docs section**

Add to `docs/api/server-api.md`:

```md
## Model API Format Selection

`provider` is a UI/default grouping. `apiFormat` chooses the actual upstream protocol.

Examples:

### NewAPI relay exposing Claude through OpenAI-compatible Chat Completions

```json
{
  "provider": "openai",
  "apiFormat": "openai-chat-completions",
  "baseUrl": "https://newapi.example/v1",
  "model": "claude-3-5-sonnet"
}
```

### Direct/NewAPI Claude Messages format

```json
{
  "provider": "anthropic",
  "apiFormat": "claude-messages",
  "baseUrl": "https://newapi.example",
  "model": "claude-3-5-sonnet"
}
```

### Gemini native format

```json
{
  "provider": "gcp",
  "apiFormat": "gemini-generate-content",
  "baseUrl": "https://newapi.example",
  "model": "gemini-2.5-pro"
}
```

Do not infer protocol from model ID alone. A relay may expose non-OpenAI model IDs through OpenAI-compatible routes.
```

- [ ] **Step 2: Run docs sanity check**

Run: `rg -n "apiFormat|openai-chat-completions|claude-messages|gemini-generate-content" docs README.md`

Expected: The new docs are discoverable.

- [ ] **Step 3: Commit**

```bash
git add docs/api/server-api.md docs/data-dictionary.md README.md
git commit -m "docs: document NewAPI model API formats"
```

---

### Task 11: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run shared contracts tests**

Run: `pnpm --filter @orison/shared-contracts test`

Expected: PASS.

- [ ] **Step 2: Run server tests**

Run: `pnpm --filter @orison/server test`

Expected: PASS.

- [ ] **Step 3: Run desktop shell tests**

Run: `pnpm --filter @orison/desktop-shell test`

Expected: PASS.

- [ ] **Step 4: Run focused desktop UI tests**

Run:

```bash
pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx
pnpm --filter @orison/desktop-ui test -- imageGenEditor.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run typechecks**

Run:

```bash
pnpm --filter @orison/shared-contracts typecheck
pnpm --filter @orison/server typecheck
pnpm --filter @orison/desktop-shell typecheck
pnpm --filter @orison/desktop-ui typecheck
```

Expected: PASS. If `@orison/desktop-ui typecheck` fails due to missing `zod` dependency link, run `pnpm install` first and repeat.

- [ ] **Step 6: Run server build**

Run: `pnpm --filter @orison/server build`

Expected: PASS.

- [ ] **Step 7: Final commit**

```bash
git status --short
git commit -m "feat: support NewAPI model protocol formats"
```

Only commit if all verification above passes.

---

## Self-Review

- Spec coverage: The plan covers NewAPI model list, OpenAI Chat Completions, OpenAI Responses, Claude Messages, Gemini GenerateContent, OpenAI/Gemini Images, Sora Videos, model profile configuration, desktop forwarding, docs, and tests. Embeddings and rerank are explicitly out of scope for this phase.
- Placeholder scan: No task relies on "TBD" or "add appropriate handling"; each implementation task includes concrete file paths, code snippets, and commands.
- Type consistency: `apiFormat`, `providerOptions`, `ModelApiFormat`, and protocol adapter naming are used consistently across shared contracts, server adapters, desktop config, and UI forwarding.
