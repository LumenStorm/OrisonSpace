# Desktop-Direct Model Gateway Design

> Status: design spec for moving every third-party AI provider HTTP call (text, image, video) out of `apps/server` and into the user's machine. Agent stops holding `apiKey`s and stops calling LLMs; story-sync's LLM-driven extraction runs on desktop and ships pre-computed patches into orchestration runs. Reuses the `apiFormat` selector from `2026-05-06-newapi-model-adapter.md`; supersedes that plan's adapter file paths.
>
> **Implementation progress** (see `docs/superpowers/plans/2026-05-06-desktop-model-gateway-migration.md` for task-level status):
> - ✅ Phase 0 — schema additions, server proxy fix
> - ✅ Phase 1 — `@orison/model-protocols` package (33 tests)
> - ⏳ Phase 2 — `@orison/story-sync` package
> - ◻ Phases 3–7 — desktop main, renderer, agent lift-out, server cleanup, docs

## Goals

- Every third-party model HTTP call originates on the user's machine (desktop main process). `apiKey` for any provider never leaves the device, never passes through `apps/server`, and never lives inside `apps/agent`.
- `apps/server` keeps a single role: public-facing JWT-authenticated API gateway for `auth` / `project` / `task` resource state plus a thin proxy to `apps/agent` for orchestration. It never opens an outbound HTTP connection to a model provider.
- `apps/agent` is never directly reachable from the public internet. The only entry path is `desktop → server proxy → agent`. Agent has no provider credentials and runs no LLM calls itself.
- The user flow is: input `baseUrl + apiKey` → list models → assign each model an `alias` and pick its `apiFormat` → save a profile. The renderer thereafter shows `{provider} · {alias}` everywhere a model is referenced.
- Drive request shape from `apiFormat` so a NewAPI relay (where one `baseUrl` proxies multiple vendor protocols) and a direct vendor endpoint share the same profile UX.

## Non-Goals

- Streaming responses. Current call surface stays request → response. Streaming can be added later without breaking the IPC contract.
- Web client support. The architecture assumes desktop is the only client today; if a web client is needed later, a server-side model gateway has to be reintroduced and is out of scope.
- Embeddings / rerank / audio. Same scope cap as `2026-05-06-newapi-model-adapter.md`.
- Cross-device profile sync. Profiles remain local to one machine.

## What Goes Where After This Change

| Capability | Who calls the provider |
|---|---|
| Text / LLM generation (any caller) | desktop main process |
| Image generation | desktop main process |
| Video generation (placeholder) | desktop main process |
| List provider models | desktop main process (existing behaviour, body delegated to the new package) |
| Story-sync LLM-driven patch extraction | desktop main process (lifted out of `apps/agent`) |
| Orchestration run lifecycle, auto-mode state | `apps/agent`, reached only via `apps/server` proxy |
| Auth, project metadata, task queue, asset listing | `apps/server` (postgres) |

## Driving User Flow

1. **Settings → Add Model Profile.** User enters `baseUrl`, `apiKey`, and picks `provider` (`openai` / `gcp` / `anthropic`). `provider` is **functional, not cosmetic**: it determines which `/models` listing protocol to use (`openai` / `newapi`-compatible relays use `GET {baseUrl}/v1/models` with `Authorization: Bearer`; `anthropic` uses `x-api-key` + `anthropic-version`; `gcp` uses `?key=` query param). After the model list is fetched, `provider` becomes informational; all per-model generation routing is driven by `apiFormat`.
2. **List models.** Renderer calls `window.orisonDesktop.listProviderModels({ provider, baseUrl, apiKey })`. Desktop main delegates to `@orison/model-protocols.listModels(provider, ...)` and returns `ProviderModel[]` with inferred `capabilities`.
3. **Per-model detail editing.** For each returned model id, the UI shows a row with three editable fields:
   - `alias` (free text, defaults to the model id with provider prefix removed)
   - `apiFormat` (dropdown; auto-suggested by `inferApiFormat(modelId, provider)`, user can override — required so a Claude model id served via NewAPI's OpenAI-compatible relay can be marked `openai-chat-completions` even though `provider='openai'`)
   - `capabilities` (chips inferred from id; user can adjust)
4. **Save profile.** Desktop main writes `~/.orison/model/profiles/<profileId>.yaml` with the entire model list and an encrypted `apiKey` (Electron `safeStorage`).
5. **Slot assignment.** Settings page assigns one model from any profile to each slot: `selected.novel`, `selected.image`, `selected.video`. The slot stores `{ profileId, modelId }` pair, not just `profileId`.
6. **Generation.** Renderer calls `window.orisonDesktop.generate{Text,Image,Video}({ slot: {profileId, modelId}, request })`. Desktop main resolves the profile and the chosen model entry, dispatches via `getProtocol(modelEntry.apiFormat).generate{Text,Image,Video}`, returns the normalized response. Renderer never sees `apiKey`, `baseUrl`, or any unresolved `apiFormat`.
7. **Orchestration runs.** When the renderer starts a chapter run, it runs the story-sync LLM step locally first (using the `novel` slot), then POSTs `/v1/orchestration/runs` to server with the resulting patches embedded under `artifacts['chapter.llmPatches']`. Server's proxy forwards the body to agent unchanged. Agent's `story-sync-agent` validates the pre-computed patches via the shared safety contract and applies them; if the field is absent, agent falls back to the rules path.

## Architecture

```
                    ┌────────────────────────┐
                    │   desktop renderer     │
                    │   shows {provider} ·    │
                    │   {alias}              │
                    └───────────┬────────────┘
                                │ IPC
                                ▼
       ┌────────────────────────────────────────────────┐
       │  desktop main 进程                              │
       │   modelGatewayIpc.ts                            │
       │     · model:generate-text                       │
       │     · model:generate-image                      │
       │     · model:generate-video                      │
       │   modelProviderIpc.ts                           │
       │     · model:list-provider-models                │
       │   storySyncBridge.ts                            │
       │     · runs LLM extraction locally               │
       │   configIpc.ts (existing, extended)             │
       │     · per-profile YAML with models[]             │
       │     · safeStorage decrypt of apiKey             │
       └──┬────────────────────────┬─────────────────────┘
          │ direct fn call         │ direct fn call
          ▼                        ▼
   @orison/model-protocols   @orison/story-sync
     protocols/<apiFormat>     prompt.ts (build LLM messages)
     listModels.ts              parser.ts (parse + safety check)
     registry.ts
     errors.ts
          │ fetch
          ▼
    third-party provider
    (OpenAI / Claude / Gemini /
     NewAPI relay / Sora ...)


   desktop ─► HTTPS+JWT ─► apps/server ─► localhost ─► apps/agent
                            (public)                     (private)
                            ─ auth                       ─ orchestration state machine
                            ─ projects                   ─ rules-only nodes
                            ─ tasks                      ─ auto-mode persistence
                            ─ orchestration proxy        ─ NO llmClient
                                                         ─ NO apiKey
```

## Module Boundaries (delta vs `module-boundaries.md`)

The following replaces or extends the existing rule sheet.

### Generation Providers (replaces current section)

- All provider/protocol adapters live in `packages/model-protocols/`. The package draws a clear line between two concerns:
  - **`listModels(provider, ...)`** routes by `provider` (`openai` / `anthropic` / `gcp`). One implementation per provider; NewAPI-style relays piggyback on `openai`. This is the only place `provider` affects HTTP behaviour.
  - **`generate{Text,Image,Video}(profile, ...)`** routes by the model entry's `apiFormat`. One adapter file under `protocols/<apiFormat>.ts`.
- The package is pure Node: no Fastify, no Electron, no `dotenv`, no filesystem side-effects beyond `node:buffer` work. Anything platform-specific (keychain, IPC, file-path validation) stays in the caller.
- Each generation adapter exposes only the verbs that format supports: `generateText` for chat / responses / messages / generate-content formats; `generateImage` for image formats; `generateVideo` for video formats. Unsupported verbs throw `ProtocolCapabilityError`.
- Adapters consume and return shapes from `@orison/shared-contracts`. Image responses are normalized to `b64Json + mimeType + dataUrl` inside the adapter.
- Server **must not** import this package.

### Server (replaces current section)

- Server owns only resource-state routes (`auth`, `project`, `task`) and the orchestration proxy. The entire `apps/server/src/modules/generation/` tree is deleted.
- Server's orchestration proxy forwards every `/v1/orchestration/*` route currently used: `runs`, `actions`, `auto-mode`, `auto-mode/actions`, `auto-mode/:id`, `auto-mode/restore`. The four auto-mode routes are added in this migration; today they are silently 404.
- Server is the only public-facing process. JWT validation runs in `authPlugin` before any proxy forward.

### Agent (replaces current LLM-related rules)

- Agent has no `engine/llmClient.ts` and no `ORISON_LLM_SERVER_URL` env. The file and env var are removed.
- Agent never holds `apiKey` and never opens an outbound HTTPS connection to a model provider. If any code path tries to, treat it as a regression.
- `story-sync-agent` runs only the rules path **plus** an "apply pre-computed patches" branch. The pre-computed branch:
  1. Reads `artifacts['chapter.llmPatches']` from the run input.
  2. Validates each patch via `parseStorySyncPatches` from `@orison/story-sync` (shared with desktop main, ensures agent does not blindly trust upstream).
  3. Enforces the existing safety contract: `action='merge'`, `field` whitelisted, `fieldVersion` matches context, `generatedBy='story-sync-agent'`, `runId/chapterId` forced from caller.
  4. Falls back to rules path on any validation failure or absent field.
- All other agent behaviour (auto-mode, orchestration state machine, persistence) is unchanged.

### Desktop Shell and IPC (additive)

- `shell/main/ipc/modelGatewayIpc.ts` (new) owns `model:generate-text`, `model:generate-image`, `model:generate-video`. It is the only place that decrypts `apiKey` for model calls.
- `shell/main/ipc/modelProviderIpc.ts` (existing) keeps the `model:list-provider-models` channel; body delegates to `model-protocols.listModels`.
- `shell/main/ipc/configIpc.ts` (existing, extended) handles the new profile schema: each profile YAML carries a `models[]` list with `id`, `alias`, `apiFormat`, `capabilities`. Encryption / decryption surface is unchanged.
- `shell/main/storySync/` (new directory) holds the LLM-driven extraction logic lifted out of agent: orchestrates "fetch context → build prompt → call LLM via `model-protocols` → parse → return patches". Renderer triggers it via a new `storySync:run` IPC channel before posting an orchestration run to server.
- Renderer never sees a raw `apiKey`. Slot model passed across IPC contains only `{profileId, modelId}` plus non-secret display fields.

### Story-Sync (new top-level rule)

- Shared logic — prompt template, JSON parsing, patch safety validation — lives in `packages/story-sync/` and is imported both by `apps/desktop/shell/main/storySync/` (for execution) and by `apps/agent/src/nodes/story-sync-agent/` (for validation of incoming pre-computed patches).
- `apps/agent/src/nodes/story-sync-agent/{prompt,parser,rules}.ts` are slimmed:
  - `prompt.ts` is deleted (only desktop builds prompts now).
  - `parser.ts` is replaced by an import from `@orison/story-sync` (validation only; no LLM-response parsing remains in agent).
  - `rules.ts` is unchanged — rules path is still the agent's fallback when the desktop-computed patches are missing or invalid.
- Desktop story-sync execution must succeed-or-rules-fallback. A user-visible error is acceptable for image/video failures but story-sync silently downgrades to rules so the chapter run never fails because of LLM unavailability.

## Profile and Registry Schema

`~/.orison/model/profiles/<profileId>.yaml`:

```yaml
schemaVersion: 2
id: profile-7f21
name: OpenAI Main
provider: openai           # UI hint only; not used for routing
baseUrl: https://api.openai.com
apiKey: <safeStorage ciphertext>
models:
  - id: gpt-4o
    alias: GPT-4o 主力
    apiFormat: openai-chat-completions
    capabilities: [text]
  - id: dall-e-3
    alias: DALL-E 3
    apiFormat: openai-images
    capabilities: [image]
```

`~/.orison/model/index.yaml`:

```yaml
schemaVersion: 2
selected:
  novel:
    profileId: profile-7f21
    modelId: gpt-4o
  image:
    profileId: profile-7f21
    modelId: dall-e-3
  video:
    profileId: null
    modelId: null
```

Migration of existing profiles (single-model `provider/model/apiKey/baseUrl/capabilities`) is a one-time read-and-rewrite at first launch on the new schema, performed by `configIpc.ts`. A legacy profile becomes a `models[]` of length 1; the existing single-model `selected.<slot>` strings become `{profileId, modelId}` pairs.

`ResolvedModelProfile` (`packages/shared-contracts/src/contracts/model.ts`, new):

```ts
export const resolvedModelProfileSchema = z.object({
  profileId: z.string(),
  modelId: z.string(),
  apiFormat: modelApiFormatSchema,
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  providerOptions: z.record(z.unknown()).optional(),
});
```

This shape is constructed inside desktop main from the disk profile + selected model entry; it is never serialised across IPC to the renderer or shipped over the network.

## Trust and Security

- **`apiKey` lifecycle:** plaintext exists only inside the desktop main process, sourced from `safeStorage`-decrypted YAML. Renderer never sees it. Server never sees it. Agent never sees it. There is no run-body field carrying `apiKey`.
- **Agent attack surface:** agent listens on private network / localhost only. Generation routes are removed from server, so server's outbound connectivity does not need to reach OpenAI / Claude / Gemini / NewAPI from the production environment. Server's egress firewall can be locked down.
- **Run body integrity:** `chapter.llmPatches` arriving at agent is treated as untrusted input. Agent re-validates via the shared `parser.ts`; on validation failure it falls back to rules and emits a structured warning, never the raw LLM text.
- **Profile alias as audit hint:** because every UI surface and every log entry refers to a model by `{provider} · {alias}` plus the resolved `modelId`, log entries stay readable and traceable when the same `apiFormat` is served by different providers.

## Failure Modes

| Failure | Surface | Behaviour |
|---|---|---|
| Provider 4xx/5xx (any verb) | desktop main | Surface `ProtocolHttpError` with status + body excerpt to renderer; no server log |
| Provider timeout | desktop main | Hard-cap with `AbortSignal`; renderer gets translated error key |
| Adapter schema mismatch | desktop main | Throw `ProtocolSchemaError`, never coerce |
| `sora-videos` invoked before real adapter ships | desktop main | `ProtocolNotImplementedError`; UI renders "video generation not yet available" |
| Story-sync LLM failure on desktop | desktop main | Silently fall back to rules-only patches; warning surfaced in run log; orchestration request still posted to server |
| Pre-computed patches fail safety check on agent | agent | Agent emits warning, falls back to rules path; never applies the rejected patches |
| Slot points to non-existent profile or model id | desktop main | Reject before any network call with a typed error so the user is told to fix the slot in Settings |

## Compatibility Notes

- `2026-05-06-newapi-model-adapter.md`: schema work in Task 1 (the `apiFormat`, `providerOptions` schemas) is unchanged and is a **prerequisite** of this migration. All adapter file paths in that plan are **superseded** by the package layout described here.
- `module-boundaries.md`: rewrite "Server", "Generation Providers", and "Story Sync Agent" sections per this spec; add a "Story-Sync" rule section and "Desktop Model Gateway" subsection under "Desktop Shell and IPC".
- `docs/api/server-api.md`: remove every `/v1/generation/*` row.
- `docs/ipc/desktop-ipc.md`: add `model:generate-text`, `model:generate-image`, `model:generate-video`, `storySync:run`, and the schema bump for `config:load-model` / `config:save-model`.
- Migration of YAML profiles is automatic on first launch; the old `~/.orison/model/config.yaml` legacy path remains read-only for migration as documented in `module-boundaries.md`.

## Test Strategy

- `packages/model-protocols/test/<adapter>.test.ts` — per-adapter request body, headers, response normalization, error mapping. Mock `fetch` at `globalThis`.
- `packages/model-protocols/test/registry.test.ts` — every shipping `apiFormat` resolves; `assertCapability` rejects unsupported verbs.
- `packages/story-sync/test/parser.test.ts` — safety contract held against malformed and adversarial inputs.
- `apps/desktop/shell/test/modelGatewayIpc.test.ts` — profile decrypt → adapter dispatch; renderer-bound payload contains no `apiKey`.
- `apps/desktop/shell/test/storySyncBridge.test.ts` — full path: load profile → build messages → call mocked adapter → parse → return patches; LLM failure falls back to rules path.
- `apps/desktop/shell/test/configIpc.migration.test.ts` — legacy single-model profile migrates to `models[]` shape on load.
- `apps/agent/test/storySyncDispatcher.test.ts` (existing, extended) — agent applies valid pre-computed patches; rejects malformed patches; falls back to rules when field absent.
- `apps/server/test/` — drop generation tests; add a regression asserting `POST /v1/generation/openai/text` returns 404; ensure orchestration auto-mode proxy tests pass.

## Open Questions Captured

- Should `storySync:run` be a separate IPC or always inlined into `model:generate-text`? **Decision:** separate IPC. The story-sync flow has business rules (context loading, patch validation) that do not belong in a generic text-generation IPC.
- Should the renderer be allowed to bypass story-sync (rules-only run) on demand? **Decision:** yes; renderer can already pick `mode: 'rules'` in the run request and that path skips the desktop story-sync step entirely.
- What happens if a user removes a model from a profile while it is assigned to a slot? **Decision:** loading the profile detects the dangling reference, clears the slot, and the renderer surfaces a "slot needs reassignment" notification.
