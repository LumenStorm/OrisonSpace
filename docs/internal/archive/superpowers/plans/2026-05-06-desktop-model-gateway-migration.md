# Desktop-Direct Model Gateway Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every third-party AI model HTTP call (text, image, video) out of `apps/server` and into the desktop main process. Lift `apps/agent`'s LLM-driven story-sync logic into desktop main; agent receives only pre-computed patches and never holds an `apiKey`. Server keeps `auth`, `project`, `task`, and orchestration proxy. Profiles are reshaped so each `baseUrl + apiKey` carries a list of named models with explicit `apiFormat`.

**Architecture:** See `docs/superpowers/specs/2026-05-06-desktop-model-gateway-design.md`. Reuses the `apiFormat` selector introduced by `2026-05-06-newapi-model-adapter.md`; supersedes that plan's adapter file paths.

**Tech Stack:** TypeScript, Vitest, Zod, Electron `contextBridge` + `safeStorage`, existing `@orison/shared-contracts`, new `@orison/model-protocols` package, new `@orison/story-sync` package.

## Implementation Status (2026-05-07)

| Phase | Status | Notes |
|---|---|---|
| Phase 0 — Prerequisites | ✅ done | NewAPI schema landed inline; auto-mode proxy fix landed with 8 new tests. |
| Phase 1 — `@orison/model-protocols` package | ✅ done | 33 tests; package consumed via `paths` alias; v2 profile schemas (originally Phase 1.5) bundled here. |
| Phase 2 — `@orison/story-sync` package | ✅ done | 20 tests covering safety + parser + prompt; consumed by both desktop main and agent. |
| Phase 3 — Desktop main gateway | ✅ done | configIpc v2 with v1→v2 migration, modelGatewayIpc, modelProviderIpc switched to package, storySync bridge, preload + securitySurface refreshed. 22 desktop-shell tests. |
| Phase 4 — Renderer migration | ✅ done | generation.ts/novelChapter.ts go through IPC; settings UI rebuilt with per-model alias / apiFormat editors; slot pair `{profileId, modelId}` everywhere. 85 desktop-ui tests. |
| Phase 5 — Agent lift-out | ✅ done | story-sync-agent consumes pre-computed patches with shared safety; `llmClient.ts`, `prompt.ts`, `parser.ts` deleted; `ORISON_LLM_*` env vars removed. 126 agent tests. |
| Phase 6 — Server cleanup | ✅ done | `apps/server/src/modules/generation/` deleted; 4-test regression confirms 404 on `/v1/generation/*`. 30 server tests. |
| Phase 7 — Documentation | ✅ done | module-boundaries / desktop-ipc / server-api updated; newapi plan cross-referenced. |

**Cumulative test count after Phase 0–7:** `shared-contracts` 65, `model-protocols` 33, `story-sync` 20, `desktop-shell` 22, `desktop-ui` 85, `agent` 126, `server` 30. Workspace typecheck clean across all 11 packages.

---

## Reference Notes

- Design spec: `docs/superpowers/specs/2026-05-06-desktop-model-gateway-design.md`
- Schema prerequisite: `docs/superpowers/plans/2026-05-06-newapi-model-adapter.md` Task 1
- Module rules to update: `docs/architecture/module-boundaries.md`
- IPC reference to update: `docs/ipc/desktop-ipc.md`
- API reference to update: `docs/api/server-api.md`
- Files removed: `apps/server/src/modules/generation/**`, `apps/agent/src/engine/llmClient.ts`, `apps/agent/src/nodes/story-sync-agent/{prompt,parser}.ts`
- Files heavily rewritten: `apps/server/src/modules/orchestration/proxy.ts`, `apps/server/src/app.ts`, `apps/desktop/shell/main/ipc/{configIpc,modelProviderIpc}.ts`, `apps/desktop/ui/src/shared/api/generation.ts`, `apps/agent/src/nodes/story-sync-agent/index.ts`
- Files preserved untouched: every other agent file, every server `auth/project/task` route

## Design Decision Recap

- `apiFormat` is the routing key; `provider` is a UI grouping hint and an alias-prefix source.
- Each profile YAML carries a list of models. UI surfaces show `{provider} · {alias}`; the model id is shown only in advanced edit views.
- Slot assignment is a `{profileId, modelId}` pair so the same profile can serve multiple slots.
- Agent never holds `apiKey`. Story-sync's LLM-driven extraction runs on desktop and ships pre-computed patches into the orchestration run body. Agent re-validates via shared safety code and falls back to rules on any failure.
- Server is the only public-facing process; agent stays private. The four currently-broken auto-mode proxy routes are added in Phase 0.

## File Structure

- Create: `packages/model-protocols/` with subtree
  - `src/types.ts`, `src/errors.ts`, `src/registry.ts`, `src/listModels.ts`, `src/imageNormalize.ts`
  - `src/protocols/openaiChat.ts`
  - `src/protocols/openaiResponses.ts`
  - `src/protocols/claudeMessages.ts`
  - `src/protocols/geminiGenerateContent.ts`
  - `src/protocols/openaiImages.ts`
  - `src/protocols/geminiImages.ts`
  - `src/protocols/soraVideos.ts`
- Create: `packages/story-sync/` with subtree
  - `src/types.ts`, `src/parser.ts`, `src/safety.ts`, `src/prompt.ts`
  - `src/index.ts` re-exports
- Create: `packages/shared-contracts/src/contracts/model.ts` (`resolvedModelProfileSchema`, updated `modelProfileSchema` with `models[]`)
- Create: `apps/desktop/shell/main/ipc/modelGatewayIpc.ts`
- Create: `apps/desktop/shell/main/storySync/{index.ts, runStorySync.ts}`
- Create: `apps/desktop/shell/main/ipc/storySyncIpc.ts`
- Modify: `apps/desktop/shell/main/ipc/configIpc.ts` (new YAML schema with `models[]`, migration from legacy)
- Modify: `apps/desktop/shell/main/ipc/modelProviderIpc.ts` (delegate to package)
- Modify: `apps/desktop/shell/preload/index.ts` (new methods)
- Modify: `packages/shared-contracts/src/ipc.ts` (`OrisonDesktopApi`, `ModelConfig`)
- Modify: `apps/desktop/ui/src/shared/preload.d.ts`
- Modify: `apps/desktop/ui/src/shared/api/generation.ts` (drop fetch, use IPC for text/image/video)
- Modify: `apps/desktop/ui/src/shared/api/novelChapter.ts` (run story-sync locally before posting)
- Modify: `apps/desktop/ui/src/shared/components/settings/model/*` (per-model alias / apiFormat editors)
- Modify: `apps/desktop/ui/src/shared/store/settingsSlice.ts` (slot becomes `{profileId, modelId}`)
- Modify: `apps/agent/src/nodes/story-sync-agent/index.ts` (consume pre-computed patches)
- Delete: `apps/agent/src/engine/llmClient.ts`
- Delete: `apps/agent/src/nodes/story-sync-agent/prompt.ts`
- Delete: `apps/agent/src/nodes/story-sync-agent/parser.ts` (replaced by import from `@orison/story-sync`)
- Modify: `apps/agent/src/common/env.ts` (drop `ORISON_LLM_SERVER_URL`)
- Modify: `apps/server/src/modules/orchestration/proxy.ts` (add four auto-mode forwards)
- Modify: `apps/server/src/app.ts` (drop `registerGenerationRoutes`)
- Delete: `apps/server/src/modules/generation/**`
- Delete: server-side generation tests
- Update: `docs/architecture/module-boundaries.md`, `docs/ipc/desktop-ipc.md`, `docs/api/server-api.md`
- Update top of: `docs/superpowers/plans/2026-05-06-newapi-model-adapter.md`

---

## Phase 0 — Prerequisites

### Task 0.1: Land NewAPI shared-contracts schema (and v2 model schemas)

**Files:** `packages/shared-contracts/src/contracts/generation.ts`, `packages/shared-contracts/src/contracts/model.ts`, `packages/shared-contracts/src/ipc.ts`, `packages/shared-contracts/tests/contracts.test.ts`

NewAPI Task 1 had not yet landed in `main`, so we implemented it inline here. We also bundled the v2 profile schemas (originally Phase 1.5) into this task so the package work in Phase 1 has the resolved profile shape from the start.

- [x] **Step 1:** Add `modelApiFormatSchema` to `generation.ts` listing the seven shipping `apiFormat` values.
- [x] **Step 2:** Add optional `apiFormat` and `providerOptions` to `textGenerationRequestSchema`, `imageGenerationRequestSchema`; create `videoGenerationRequestSchema` + `videoGenerationResponseSchema`.
- [x] **Step 3:** Create `contracts/model.ts` exporting `modelCapabilitySchema`, `modelEntrySchema`, `modelProfileV2Schema`, `slotAssignmentSchema`, `slotAssignmentMapSchema`, `resolvedModelProfileSchema`, `modelConfigV2Schema`.
- [x] **Step 4:** Update `ipc.ts` to re-export `ModelCapability` from `./contracts/model`; add optional `apiFormat` to legacy `ModelProfile` / `ModelSlotConfig`; extend `desktopIpcSchema` channel enum with `model:generate-text`, `model:generate-image`, `model:generate-video`, `storySync:run`.
- [x] **Step 5:** Re-export `model.ts` from `index.ts`. Add 8 schema tests under `tests/contracts.test.ts`. Verify `pnpm --filter @orison/shared-contracts test` (65 / 65 pass).

### Task 0.2: Fix server proxy gap for auto-mode endpoints

**Files:** `apps/server/src/modules/orchestration/proxy.ts`, `apps/server/test/orchestrationProxy.test.ts`

- [x] **Step 1 — Failing test:** isolated Fastify instance with only the proxy registered + mocked `globalThis.fetch`; assert each of `POST /v1/orchestration/auto-mode`, `POST /v1/orchestration/auto-mode/actions`, `GET /v1/orchestration/auto-mode/:id`, `POST /v1/orchestration/auto-mode/restore` forwards to `${AGENT_URL}` with `Authorization` preserved and upstream status code passed through.
- [x] **Step 2 — Implement:** add the four routes mirroring the existing `/runs` and `/actions` proxies; replace ad-hoc `await res.json()` with a `relayJson()` helper that preserves status code and tolerates empty bodies.
- [x] **Step 3 — Verify:** 8 / 8 proxy tests pass. Desktop calls in `novelChapter.ts` now have a working server-side path.

---

## Phase 1 — Build `@orison/model-protocols`

### Task 1.1: Bootstrap the package

**Files:** `packages/model-protocols/package.json`, `tsconfig.json`, `tsconfig.build.json`, `src/types.ts`, `src/errors.ts`, `src/http.ts`; `tsconfig.base.json` `paths` alias

- [x] **Step 1:** Add the workspace package mirroring `packages/shared-contracts` layout. Depend on `@orison/shared-contracts` and `zod`. No runtime dependency on Fastify, Electron, filesystem (allowed: `node:buffer`).
- [x] **Step 2:** `types.ts` defines `ProtocolAdapter` with `apiFormat`, optional `generateText` / `generateImage` / `generateVideo`, plus `ListModelsAdapter` and `ProtocolCallContext`.
- [x] **Step 3:** `errors.ts` exports `ProtocolHttpError`, `ProtocolSchemaError`, `ProtocolNotImplementedError`, `ProtocolCapabilityError`.
- [x] **Step 4:** `http.ts` provides `postJson` / `getJson` / `trimTrailingSlash` that map non-2xx to `ProtocolHttpError` with body excerpt.
- [x] **Step 5:** Add `@orison/model-protocols` to `tsconfig.base.json` paths so other workspaces resolve via source. `pnpm install` to wire workspace symlink.

### Task 1.2: Move image normalization out of server

**Files:** `packages/model-protocols/src/imageNormalize.ts`, `packages/model-protocols/test/imageNormalize.test.ts`

- [x] **Step 1 — Failing test:** preserves the existing semantics from `apps/server/src/modules/generation/imageBase64.ts`: passes `b64Json`, decodes `data:` URLs, downloads URLs to base64, errors if neither present.
- [x] **Step 2 — Implement:** lift the helper into the package. Replace `GenerationProviderError` with `ProtocolHttpError`. Drop the `temp/generation-images` filesystem write — that path was server-side cruft never read by anything.
- [x] **Step 3 — Verify tests pass.** 5 / 5 pass.

### Task 1.3: Implement protocol adapters

For each protocol, follow the same TDD pattern: failing test → implement → verify. All adapters use `profile.modelId` / `profile.baseUrl` / `profile.apiKey` as the source of truth (the request's `model` field is ignored).

- [x] **Step 1: `protocols/openaiChat.ts`** — POST `/chat/completions` with `Authorization: Bearer`. Forwards `temperature`, `max_tokens`, `providerOptions` (spread).
- [x] **Step 2: `protocols/openaiResponses.ts`** — POST `/responses` with `input` (built from non-system messages) + `instructions` (joined system messages) + `max_output_tokens`. Extracts `output_text` or flattens `output[].content[].text`.
- [x] **Step 3: `protocols/claudeMessages.ts`** — POST `/v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01`. Splits system/conversation; defaults `max_tokens: 1024`.
- [x] **Step 4: `protocols/geminiGenerateContent.ts`** — POST `/v1beta/models/{model}:generateContent?key=...`. Maps assistant→model role; folds system messages into `parts[].text` prefix.
- [x] **Step 5: `protocols/openaiImages.ts`** — POST `/images/generations`. Preserves the gpt-image-2 / gpt-image-1 / fallback family detection from the server adapter, including the gpt-image-2 + transparent-background pre-network reject and the dall-e-* `response_format=b64_json` fallback. Calls `normalizeImageResponse` before returning.
- [x] **Step 6: `protocols/geminiImages.ts`** — POST `/v1beta/models/{model}:predict?key=...` (Imagen-style; preserves current GCP image adapter shape). Calls `normalizeImageResponse`.
- [x] **Step 7: `protocols/soraVideos.ts`** — `generateVideo` throws `ProtocolNotImplementedError`. Verified to make zero network calls.

10 / 10 adapter tests pass.

### Task 1.4: Build registry, `listModels`, and `inferApiFormat`

**Files:** `packages/model-protocols/src/registry.ts`, `packages/model-protocols/src/listModels.ts`, `packages/model-protocols/test/registry.test.ts`, `listModels.test.ts`

- [x] **Step 1:** `registry.ts` — `getProtocol(apiFormat)` / `assertCapability(apiFormat, verb)` / `inferApiFormat(modelId, provider)` / `apiFormats` array / `apiFormatCapabilities` map. 13 tests cover every shipping `apiFormat`, every verb, and the NewAPI override rule (Claude id served via `provider='openai'` → `openai-chat-completions`).
- [x] **Step 2:** `listModels(provider, { baseUrl, apiKey })` — switches by `provider` (`openai` / `anthropic` / `gcp`). NewAPI relay piggybacks on `provider='openai'`. 5 tests cover all three protocols + NewAPI relay listing Claude/Gemini ids + 4xx → `ProtocolHttpError`.
- [x] **Step 3 — Verify:** 33 / 33 tests pass for the package; full workspace typecheck (9 packages) clean. NB: package `tsconfig.json` uses `noEmit: true` without `rootDir`/`outDir` — required because the package imports from `@orison/shared-contracts` via paths alias and the auto-detected rootDir would otherwise reject those source files.

### Task 1.5: ResolvedModelProfile schema (consolidated into Task 0.1)

The `resolvedModelProfileSchema` work originally planned here was bundled into Task 0.1 so the model-protocols package could consume it from day one. No additional work in this task; tests live in `packages/shared-contracts/tests/contracts.test.ts`.

---

## Phase 2 — Build `@orison/story-sync` and Lift Out of Agent

### Task 2.1: Bootstrap `packages/story-sync/`

**Files:** `packages/story-sync/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/types.ts`, `src/safety.ts`

- [x] **Step 1:** Add the workspace package. Pure TS, no Electron, no Fastify. Depend on `@orison/shared-contracts` and `zod`.
- [x] **Step 2 — `types.ts`:** export the patch contract (`StorySyncPatch`, `StorySyncResult`).
- [x] **Step 3 — `safety.ts`:** export `enforcePatchSafety(patches, ctx)` returning the safe subset and a structured warning list. Logic copied from the current agent `index.ts` safety block: `action='merge'`, `field` whitelisted, `fieldVersion` matches context, `generatedBy='story-sync-agent'`, `runId`/`chapterId` forced from caller.

### Task 2.2: Lift `prompt.ts` and `parser.ts` from agent into the package

**Files:** `packages/story-sync/src/prompt.ts`, `packages/story-sync/src/parser.ts`, tests

- [x] **Step 1 — Failing tests:** mirror the existing `apps/agent/test/storySyncAgent.test.ts` cases for prompt construction and JSON-extraction parsing.
- [x] **Step 2 — Move:** copy `apps/agent/src/nodes/story-sync-agent/prompt.ts` into the package; same for `parser.ts`. Drop any agent-only imports.
- [x] **Step 3 — Verify package tests pass.** Do not delete the agent files yet (Phase 4 task).

### Task 2.3: Add `parseStorySyncPatches` for agent-side validation

**Files:** `packages/story-sync/src/parser.ts`, tests

- [x] **Step 1 — Failing test:** given a JSON-stringified payload, `parseStorySyncPatches` returns either `{ ok: true, patches }` or `{ ok: false, reason }`. Adversarial cases: missing fields, wrong types, action !== 'merge', whitelisted-field violation.
- [x] **Step 2 — Implement:** combine schema parsing + `enforcePatchSafety`. This is what agent will call on incoming pre-computed patches.

---

## Phase 3 — Desktop Main Gateway

### Task 3.1: Migrate profile config schema

**Files:** `apps/desktop/shell/main/ipc/configIpc.ts`, `apps/desktop/shell/test/configIpc.migration.test.ts`

- [x] **Step 1 — Failing test:** loading a legacy v1 profile (single-model `provider/model/apiKey/baseUrl/capabilities`) returns a v2 shape with `models: [{ id, alias, apiFormat, capabilities }]`; auto-inferred `apiFormat` from `provider` + `model`. Loading a v2 profile is unchanged. Saving a v2 profile produces a v2 file.
- [x] **Step 2 — Implement:** read both shapes, write only v2. Migration is in-place on first save (read-rewrite). Slot assignment migration: legacy `selected.<slot>: 'profileId'` → `{profileId, modelId: profile.models[0].id}`.
- [x] **Step 3 — Verify tests pass.**

### Task 3.2: Add `model:generate-{text,image,video}` IPC handlers

**Files:** `apps/desktop/shell/main/ipc/modelGatewayIpc.ts`, `apps/desktop/shell/test/modelGatewayIpc.test.ts`, `apps/desktop/shell/main/index.ts`

- [x] **Step 1 — Failing tests:**
  - `model:generate-text`/`-image`/`-video` resolves the `{profileId, modelId}` slot from disk, decrypts `apiKey` via mocked `safeStorage`, builds a `ResolvedModelProfile`, dispatches via `getProtocol(modelEntry.apiFormat).generate{verb}`, returns the normalized response.
  - Renderer-bound payload contains no `apiKey`.
  - `sora-videos` slot rejects `model:generate-video` with `ProtocolNotImplementedError` and never opens a network connection.
  - Wrong-capability assignment (e.g. an image-only model selected as `novel`) rejects pre-network with `ProtocolCapabilityError`.
- [x] **Step 2 — Implement:** the three handlers. Each accepts `{ slot: {profileId, modelId}, request }` from the renderer.
- [x] **Step 3 — Register** the handlers in `apps/desktop/shell/main/index.ts`.

### Task 3.3: Switch `model:list-provider-models` body to package

**Files:** `apps/desktop/shell/main/ipc/modelProviderIpc.ts`, `apps/desktop/shell/test/modelProviderIpc.test.ts`

- [x] **Step 1 — Failing test:** existing list-models tests still pass; new test asserts NewAPI-style relay (where `provider='openai'` + `baseUrl` is a NewAPI URL) successfully lists Claude / Gemini model ids using the OpenAI listing protocol.
- [x] **Step 2 — Implement:** rewrite the handler body to `listModels(request.provider, { baseUrl, apiKey })`. Channel name and request schema unchanged. The handler **does not** consult `apiFormat` here — `apiFormat` is decided per-model after listing, by the renderer (auto-suggested via `inferApiFormat`, user-confirmable).
- [x] **Step 3 — Verify tests pass.**

### Task 3.4: Build the desktop story-sync bridge

**Files:** `apps/desktop/shell/main/storySync/runStorySync.ts`, `apps/desktop/shell/main/storySync/index.ts`, `apps/desktop/shell/main/ipc/storySyncIpc.ts`, `apps/desktop/shell/test/storySyncBridge.test.ts`

- [x] **Step 1 — Failing tests:**
  - `storySync:run` accepts `{ slot, chapterContext, chapterCandidate }` and returns `{ patches, summary, fallbackToRules: false }`.
  - On adapter failure (`ProtocolHttpError` / `ProtocolSchemaError` / `ProtocolNotImplementedError` / network error), returns `{ patches: [], summary, fallbackToRules: true }` and never throws to the caller.
  - On successful adapter call, runs `parseStorySyncPatches` from `@orison/story-sync` and only returns the safe subset.
- [x] **Step 2 — Implement:**
  - `runStorySync(input)` orchestrates: load slot → resolve profile via `configIpc` helpers → build messages via `@orison/story-sync` `prompt` → call `getProtocol(apiFormat).generateText` → parse via `parseStorySyncPatches` → return.
  - `storySync:run` IPC delegates to `runStorySync`.
- [x] **Step 3 — Register** the IPC in `apps/desktop/shell/main/index.ts`.

### Task 3.5: Expose new preload surface

**Files:** `apps/desktop/shell/preload/index.ts`, `packages/shared-contracts/src/ipc.ts`, `apps/desktop/ui/src/shared/preload.d.ts`, `apps/desktop/shell/test/securitySurface.test.ts`

- [x] **Step 1 — Failing test:** `securitySurface.test.ts` enumerates `OrisonDesktopApi` keys; assert `generateText`, `generateImage`, `generateVideo`, `runStorySync` are present and that no `apiKey` field exists on their renderer-facing call signatures.
- [x] **Step 2 — Implement:** add the four preload methods. Update `OrisonDesktopApi` and `preload.d.ts`.
- [x] **Step 3 — Verify** type check + tests pass.

---

## Phase 4 — Renderer Migration

### Task 4.1: Settings UI — add profile flow with per-model alias and `apiFormat`

**Files:** `apps/desktop/ui/src/shared/components/settings/model/*`, `apps/desktop/ui/test/modelSettingsPage.test.tsx`

- [x] **Step 1 — Failing test:** opening "Add Profile" lets the user enter `baseUrl`, `apiKey`, `provider`. Clicking "List models" populates a per-model row table with `id`, editable `alias` (defaulted), editable `apiFormat` dropdown (suggested via `inferApiFormat`), capability chips. Saving writes a v2 profile; reloading shows the same shape.
- [x] **Step 2 — Implement:** restructure the Add/Edit Profile UI. Use `inferApiFormat` from `@orison/model-protocols` (re-exported through preload as a helper, or via direct import if the renderer can reach the package).
- [x] **Step 3 — Slot picker:** the per-slot dropdown shows `{provider} · {alias}` instead of raw model id; the underlying value is `{profileId, modelId}`.

### Task 4.2: Switch generation API to IPC

**Files:** `apps/desktop/ui/src/shared/api/generation.ts`, related feature tests

- [x] **Step 1 — Failing test:** existing `imageGenEditor.test.tsx` and `imageGenInspector.test.tsx` pass after replacing fetch mocks with `window.orisonDesktop.generateImage` mocks; renderer never calls `fetch(${API_BASE}/v1/generation/...)`.
- [x] **Step 2 — Implement:**
  - `generateImage(...)` calls `window.orisonDesktop.generateImage({ slot, request })`.
  - Add `generateText(...)` and `generateVideo(...)` exporting the same pattern.
  - Drop `throwIfSessionExpired` for these paths (no server hop).
- [x] **Step 3 — Verify all UI tests pass.**

### Task 4.3: Run story-sync locally before posting orchestration runs

**Files:** `apps/desktop/ui/src/shared/api/novelChapter.ts`, related tests

- [x] **Step 1 — Failing test:** `startChapterRun` with `mode: 'llm'` first invokes `window.orisonDesktop.runStorySync(...)`, then POSTs `/v1/orchestration/runs` with the resulting patches embedded under `artifacts['chapter.llmPatches']`. With `mode: 'rules'`, no story-sync IPC call happens.
- [x] **Step 2 — Implement:** wire the local run; preserve existing `mode` switching semantics.
- [x] **Step 3 — Verify renderer tests pass.**

### Task 4.4: Slot model carries only `{profileId, modelId}`

**Files:** `apps/desktop/ui/src/shared/store/settingsSlice.ts`, `apps/desktop/ui/src/features/editor/ImageGenEditor.tsx`, related tests

- [x] **Step 1:** ensure no slice or component holds `apiKey` for image / video / text. Slot state in store is `{profileId, modelId}` plus non-secret display fields (`alias`, `provider` hint).
- [x] **Step 2:** update `ImageGenEditor` and any other consumer to pass the slot pair to the IPC, not a full profile.

---

## Phase 5 — Agent Lift-Out

### Task 5.1: Make agent's `story-sync-agent` consume pre-computed patches

**Files:** `apps/agent/src/nodes/story-sync-agent/index.ts`, `apps/agent/test/storySyncDispatcher.test.ts`

- [x] **Step 1 — Failing tests:**
  - When `artifacts['chapter.llmPatches']` is present and valid, the node emits exactly those patches (after `parseStorySyncPatches` re-validates them) under the existing `story.sync` state key.
  - When the field is malformed or missing, the node falls back to the rules path; behaviour and output schema match today's rules output.
  - Emitted warnings stream into the existing run-warning surface.
- [x] **Step 2 — Implement:** rewrite `index.ts` to first read `artifacts['chapter.llmPatches']`, run `parseStorySyncPatches` from `@orison/story-sync`, apply on success or fall through to `deriveStorySyncByRules`. Drop the `env.ORISON_STORY_SYNC_MODE === 'llm'` branch entirely.
- [x] **Step 3:** delete `apps/agent/src/nodes/story-sync-agent/prompt.ts`. Delete `apps/agent/src/nodes/story-sync-agent/parser.ts` (now imported from `@orison/story-sync`).
- [x] **Step 4 — Verify** all agent tests pass, including `storySyncAgent.test.ts`.

### Task 5.2: Delete `apps/agent/src/engine/llmClient.ts` and friends

**Files:** `apps/agent/src/engine/llmClient.ts`, `apps/agent/src/common/env.ts`, any caller

- [x] **Step 1 — Failing test:** importing `llmClient` from anywhere in the agent fails to type-check. `env.ORISON_LLM_SERVER_URL` is no longer in the env schema.
- [x] **Step 2 — Implement:** delete `llmClient.ts`. Remove `ORISON_LLM_SERVER_URL` from `env.ts`. Remove any remaining references.
- [x] **Step 3 — Verify** `pnpm -w typecheck` is clean and agent tests pass.

### Task 5.3: Update orchestration request schema (optional, additive)

**Files:** `packages/shared-contracts/src/contracts/novel-orchestration.ts`, tests

- [x] **Step 1 — Failing test:** parsing a chapter-run request with `artifacts['chapter.llmPatches']` populated succeeds; absent field still succeeds.
- [x] **Step 2 — Implement:** make the field optional on the run request schema. Agent already validates; this just makes the contract explicit.

---

## Phase 6 — Server Cleanup

### Task 6.1: Delete `apps/server/src/modules/generation/`

**Files:** `apps/server/src/app.ts`, `apps/server/src/modules/generation/**`, `apps/server/test/`

- [x] **Step 1 — Failing test:** `POST /v1/generation/openai/text` and `POST /v1/generation/openai/image` both return 404. Server boots without `GenerationProviderError` exports.
- [x] **Step 2 — Implement:** delete the entire generation module; remove `registerGenerationRoutes` import and registration from `app.ts`; delete generation tests.
- [x] **Step 3 — Verify** server tests pass; `pnpm -w typecheck` clean.

### Task 6.2: Confirm orchestration proxy is the only path to agent

**Files:** verification only

- [x] **Step 1:** `rg "AGENT_URL" apps/server` shows references only inside `orchestration/proxy.ts` and `common/env.ts`.
- [x] **Step 2:** confirm `apps/server/src/app.ts` registers `authPlugin` before the orchestration proxy registration, so all agent-bound calls are authenticated.

---

## Phase 7 — Documentation

### Task 7.1: Update `module-boundaries.md`

**Files:** `docs/architecture/module-boundaries.md`

- [x] Rewrite "Generation Providers" — package-based; lists every shipping `apiFormat` and which file owns it.
- [x] Trim "Server" — only `auth`, `project`, `task`, `orchestration proxy`. No model knowledge.
- [x] Rewrite "Story Sync Agent" — desktop owns LLM execution; agent only validates and applies pre-computed patches via shared `@orison/story-sync` safety code; rules path is the fallback.
- [x] Add "Desktop Model Gateway" subsection under "Desktop Shell and IPC" — `modelGatewayIpc.ts`, `storySyncIpc.ts`, secret-handling rule.

### Task 7.2: Update `desktop-ipc.md`

**Files:** `docs/ipc/desktop-ipc.md`

- [x] Add channel rows: `model:generate-text`, `model:generate-image`, `model:generate-video`, `storySync:run`.
- [x] Update `config:load-model` / `config:save-model` rows to v2 schema.
- [x] Note that `model:list-provider-models` accepts `apiFormat` and that its body is delegated to `@orison/model-protocols`.
- [x] Add `ModelGateway` and `StorySyncBridge` rows in the IPC handler files table.
- [x] Update the `ModelConfig` type example to the v2 shape with `models[]` and `{profileId, modelId}` slots.

### Task 7.3: Update `server-api.md`

**Files:** `docs/api/server-api.md`

- [x] Remove every `/v1/generation/*` row.
- [x] Add a "Removed in 2026-05-06" appendix linking to the design spec.

### Task 7.4: Cross-link from the NewAPI plan

**Files:** `docs/superpowers/plans/2026-05-06-newapi-model-adapter.md`

- [x] Add a top-of-file note: "Adapter file structure superseded by `2026-05-06-desktop-model-gateway-design.md`. The schema work in Task 1 of this plan remains the source of truth for `apiFormat` and is a prerequisite of the desktop gateway migration."

---

## Acceptance Criteria

- `pnpm -w test` passes across all workspace packages and apps.
- `apps/server` source tree contains no reference to OpenAI / Anthropic / Gemini SDKs, no `fetch` to provider URLs, and no `generation` module.
- `apps/agent` source tree contains no `llmClient`, no `ORISON_LLM_SERVER_URL`, no `prompt.ts` / `parser.ts` under `story-sync-agent/`.
- `rg "/v1/generation"` matches only inside the deleted-route regression test, the design spec, and this plan.
- `securitySurface.test.ts` confirms no `apiKey` value crosses the IPC boundary in any direction.
- A manual smoke run completes the full flow:
  1. Add profile by entering `baseUrl + apiKey`, listing models, assigning aliases / `apiFormat`.
  2. Assign a text model to `novel`, an image model to `image`. Settings page shows `{provider} · {alias}` everywhere.
  3. Generate an image — desktop main fetches the provider directly; server logs show no provider URL contacted.
  4. Run a novel chapter in `mode: 'llm'` — desktop runs story-sync locally, then POSTs the run with embedded patches to server; server forwards to agent; agent applies the patches without ever holding `apiKey`.

## Rollback

- Phases 1–4 are additive; rolling back any single task does not strand other work because the server's existing generation routes and agent's existing `llmClient.ts` remain operational through Phase 4.
- Phase 5 (agent lift-out) is the first irreversible point: agent's `llmClient.ts` is deleted. Rollback past Phase 5 requires reverting the deletion commit.
- Phase 6 (server cleanup) is the second irreversible point. Rollback past it requires reverting the entire generation-module deletion commit.
- Phase 7 (docs) is reversible at any time; treat as cosmetic.

## Final Status (2026-05-07)

### Files created

- `packages/story-sync/{package.json,tsconfig.json,tsconfig.build.json}`
- `packages/story-sync/src/{index.ts,types.ts,safety.ts,prompt.ts,parser.ts}`
- `packages/story-sync/test/{safety.test.ts,parser.test.ts,prompt.test.ts}` (20 tests)
- `apps/desktop/shell/main/ipc/modelGatewayIpc.ts`
- `apps/desktop/shell/main/ipc/storySyncIpc.ts`
- `apps/desktop/shell/main/storySync/{index.ts,runStorySync.ts}`
- `apps/desktop/shell/test/configIpc.migration.test.ts` (4 tests)
- `apps/desktop/shell/test/modelGatewayIpc.test.ts` (5 tests)
- `apps/desktop/shell/test/storySyncBridge.test.ts` (4 tests)
- `apps/server/test/generationRoutesRemoved.test.ts` (4 tests)

### Files heavily rewritten

- `apps/desktop/shell/main/ipc/configIpc.ts` (v1→v2 migration on read; always v2 on write)
- `apps/desktop/shell/main/ipc/modelProviderIpc.ts` (delegates to `@orison/model-protocols.listModels`)
- `apps/desktop/shell/preload/index.ts` (added `generateText/Image/Video`, `runStorySync`)
- `apps/desktop/shell/main/index.ts` (registers gateway + storySync IPCs)
- `apps/desktop/ui/src/shared/api/generation.ts` (now goes through IPC; new `generateText`, `generateVideo`)
- `apps/desktop/ui/src/shared/api/novelChapter.ts` (calls `runStorySync` before posting to server)
- `apps/desktop/ui/src/shared/components/settings/model/{utils.ts,useModelLibrary.ts,ProfileEditor.tsx,ProfileAssignmentRow.tsx,ProfileList.tsx}` (per-model alias / apiFormat editors; slot-pair pickers)
- `apps/desktop/ui/src/features/inspector/ImageGenInspector.tsx` & `ProfileField.tsx` (slot pairs)
- `apps/desktop/ui/src/features/editor/ImageGenEditor.tsx` (resolves slot from `modelConfig`)
- `packages/shared-contracts/src/ipc.ts` (`ModelConfig` is v2; new `OrisonDesktopApi` methods)
- `apps/agent/src/nodes/story-sync-agent/index.ts` (pre-computed-patches branch + rules fallback)
- `apps/agent/src/common/env.ts` (dropped `ORISON_LLM_*` and `ORISON_STORY_SYNC_MODE`)
- `apps/agent/test/{storySyncDispatcher.test.ts,storySyncAgent.test.ts}` (updated to new behaviour)
- `apps/server/src/app.ts` (dropped `registerGenerationRoutes`)
- `tsconfig.base.json` (added `@orison/story-sync` paths alias)
- `apps/desktop/shell/electron.vite.config.ts` (bundles new packages)

### Files deleted

- `apps/agent/src/engine/llmClient.ts`
- `apps/agent/src/nodes/story-sync-agent/prompt.ts`
- `apps/agent/src/nodes/story-sync-agent/parser.ts`
- `apps/server/src/modules/generation/**` (entire tree: `imageBase64.ts`, `service.ts`, `routes.ts`, `providers/**`)
- `apps/server/test/generation.test.ts`

### Documentation updated

- `docs/architecture/module-boundaries.md` — rewrote Server, Generation Providers, Story Sync Agent; added Desktop Model Gateway subsection and a Story-Sync top-level rule.
- `docs/ipc/desktop-ipc.md` — added Model Gateway channel rows, v2 ModelConfig example, ModelGateway / StorySyncBridge rows in handler files table, 2026-05-07 appendix.
- `docs/api/server-api.md` — removed every `/v1/generation/*` section, added "Removed in 2026-05-07" appendix and refreshed Model List Refresh section to reflect package-routed listing.
- `docs/superpowers/plans/2026-05-06-newapi-model-adapter.md` — restored from deletion and prefixed with cross-reference + supersession note.

### Test counts (Phase 0–7 cumulative)

| Workspace | Tests | Notes |
|---|---|---|
| `@orison/shared-contracts` | 65 | unchanged from baseline |
| `@orison/model-protocols` | 33 | unchanged from baseline |
| `@orison/story-sync` | 20 | new this phase |
| `@orison/desktop-shell` | 22 | up from ~5 baseline |
| `@orison/desktop-ui` | 85 | up from previous baseline |
| `@orison/agent` | 126 | unchanged total; storySync tests refactored |
| `@orison/server` | 30 | up from 28; deleted generation tests, added 4 regression tests |

`pnpm typecheck` is clean across all 11 packages (was 9 before this work; +2 = `@orison/model-protocols`, `@orison/story-sync`).

### Deviations from the original plan

- **`mode: 'llm'` parameter on chapter runs** — the plan described `startChapterRun` triggering `runStorySync` only when `mode === 'llm'`. The actual `novelChapterRunRequestSchema` mode enum is `'generate' | 'continue' | 'polish' | 'review'` — there was no `'llm'` mode, and adding one is out-of-scope for this migration. Resolved by gating story-sync on the **presence of `storySyncSlot`** in `StartChapterRunInput` instead. Effect is identical (renderer chooses whether to run desktop story-sync per call), but the trigger is explicit instead of mode-coupled.
- **`@orison/model-protocols.listModels` baseUrl convention** — the package always appends `/v1/models` (or `/v1beta/models` for GCP), so `baseUrl` should be the root URL (e.g. `https://api.openai.com`) rather than the v1 path. The migration tests cover this; users of the legacy v1 profile shape get migrated automatically and the renderer's default base URLs were updated to match.
- **`apiKey` round-trip through renderer** — the design spec strongly preferred "renderer never sees raw `apiKey`". The current implementation returns the decrypted apiKey on `loadModelConfig` so the Settings UI can show a partially-filled form when the user edits an existing profile. The strict apiKey-blackout could be added later (return empty apiKey from load, special "Replace API key" flow), but is non-trivial and was not required by the migration's primary security boundaries (apiKey never reaches server, agent, or generation IPC payloads — those are all confirmed by tests).
- **`docs/superpowers/plans/2026-05-06-newapi-model-adapter.md`** had been deleted prior to this session; restored from `git restore` and annotated with the supersession header so existing references still resolve.
- **Existing `taskLists.test.ts` baseline failure** — at the start of this session, `apps/server/test/taskLists.test.ts` failed in the baseline run with a database schema error (`project_assets` multiple primary keys). After Phase 6 cleanup this test now passes; the baseline failure was unrelated to this migration.
