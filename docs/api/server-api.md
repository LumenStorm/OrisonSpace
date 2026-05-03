# Server API Reference

## Base URL

`http://localhost:4000`

## Authentication

All endpoints except `/health` and `/v1/auth/*` require a `Bearer` token in the `Authorization` header.

## Endpoints

### GET /health

Returns server health status.

Response: `{ "status": "ok" }`

### POST /v1/auth/register

Create a new user account.

Request body:

```json
{
  "email": "creator@example.com",
  "password": "secret123",
  "displayName": "Creator"
}
```

Response (201):

```json
{
  "accessToken": "string",
  "tokenType": "Bearer",
  "user": {
    "id": "string",
    "email": "creator@example.com",
    "displayName": "Creator"
  }
}
```

Errors:
- `400`: Invalid input
- `409`: Email already registered

### POST /v1/auth/login

Request body:

```json
{
  "email": "creator@example.com",
  "password": "secret123"
}
```

Response (200):

```json
{
  "accessToken": "string",
  "tokenType": "Bearer",
  "user": {
    "id": "string",
    "email": "creator@example.com",
    "displayName": "Creator"
  }
}
```

Errors:
- `401`: Invalid email or password

### POST /v1/projects

Register a local project and allocate a sequential five-digit `projectId`.

Request body:

```json
{
  "name": "Cold City",
  "type": "novel",
  "localFingerprint": "C:/Projects/ColdCity"
}
```

Response (201):

```json
{
  "projectId": "00001",
  "name": "Cold City",
  "type": "novel"
}
```

Behavior notes:
- If the same `localFingerprint` is submitted again, the server returns the existing project record instead of creating a duplicate.

### POST /v1/tasks

Submit a task for execution.

Request body (validated by `taskRequestSchema`):

```json
{
  "projectId": "00001",
  "targetId": "act_1",
  "assetIds": ["char_001", "loc_002"],
  "type": "outline.rewrite",
  "name": "重写第一幕冲突",
  "description": "强化主角和对手第一次正面冲突",
  "input": "让冲突更紧张。"
}
```

Field notes:
- `projectId`: five-digit project ID
- `targetId`: optional target entity ID
- `assetIds`: optional related asset IDs
- `type`: task type string
- `name`: human-readable task name
- `description`: task intent summary
- `input`: text payload passed to execution

Response (202):

```json
{
  "taskId": "20260427214530123_48321",
  "status": "queued"
}
```

Errors:
- `404`: Project not found
- `400`: Invalid request body

### GET /v1/tasks/:taskId

Retrieve the persisted task result.

Response (validated by `taskResultSchema`):

```json
{
  "taskId": "20260427214530123_48321",
  "status": "completed",
  "outputType": "patch",
  "outputPayload": {
    "operations": [
      {
        "op": "replace",
        "path": "story.acts[0].summary",
        "value": "Rewritten: Make the opening darker."
      }
    ]
  },
  "summary": "Mock rewrite completed.",
  "rationale": "The mock adapter echoes the requested direction.",
  "reviewHint": "Confirm the patch targets the intended act.",
  "retryable": true
}
```

Errors:
- `404`: Task not found

### GET /v1/projects/:projectId/tasks

List persisted tasks for a project.

Response (200):

```json
{
  "items": [
    {
      "taskId": "20260427214530123_48321",
      "projectId": "00001",
      "targetId": "act_1",
      "type": "outline.rewrite",
      "name": "重写第一幕冲突",
      "description": "强化主角和对手第一次正面冲突",
      "status": "completed",
      "createdAt": "2026-04-27T14:45:30.123Z",
      "assetIds": ["char_001", "loc_002"]
    }
  ]
}
```

Behavior notes:
- Asset IDs are hydrated with a batched lookup from `task_asset_refs`, avoiding per-task N+1 queries.
- The current implementation returns the full project task list ordered by `createdAt desc`; pagination is not implemented yet.

Errors:
- `404`: Project not found

### GET /v1/projects/:projectId/assets

List lightweight asset index entries for a project.

Response (200):

```json
{
  "items": [
    {
      "assetId": "char_001",
      "projectId": "00001",
      "assetType": "unknown",
      "assetName": "char_001",
      "assetStatus": "active",
      "sourceTaskId": "20260427214530123_48321",
      "summary": "强化主角和对手第一次正面冲突",
      "version": 1,
      "updatedAt": "2026-04-27T14:45:30.456Z"
    }
  ]
}
```

Behavior notes:
- The current server writes placeholder index metadata for task-linked assets:
  - `assetType = "unknown"`
  - `assetName = assetId`
  - `assetStatus = "active"`
- `version` is incremented on upsert for the same `(projectId, assetId)`.

Errors:
- `404`: Project not found

## Limits and Notes

- Request body limit: `1 MB`
- Task execution is currently backed by the mock adapter.
- `GET /v1/tasks/:taskId` returns task result data only; task list metadata and related asset IDs are exposed through the project list endpoints.
- Generation provider contracts live in `packages/shared-contracts/src/contracts/generation.ts`.

## Generation APIs

### POST /v1/generation/:provider/text

Generate text through a provider adapter.

Path params:
- `provider`: `openai`, `gcp`, or `anthropic`

Request body:

```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a story editor." },
    { "role": "user", "content": "Write a short scene outline." }
  ],
  "apiKey": "optional-provider-key",
  "baseUrl": "https://api.openai.com/v1",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

Response (200):

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "text": "Generated text.",
  "raw": {}
}
```

Behavior notes:
- OpenAI-compatible providers call `chat/completions`.
- GCP providers call `models/{model}:generateContent`.
- Anthropic providers call `/v1/messages`.

### POST /v1/generation/:provider/image

Generate images through a provider adapter.

Path params:
- `provider`: `openai`, `gcp`, or `anthropic`

Request body:

```json
{
  "model": "gpt-image-1",
  "prompt": "A cinematic neon city street at night",
  "apiKey": "optional-provider-key",
  "baseUrl": "https://api.openai.com/v1",
  "size": "1024x1024",
  "n": 1
}
```

Response (200):

```json
{
  "provider": "openai",
  "model": "gpt-image-1",
  "images": [
    {
      "url": "https://example.com/image.png",
      "b64Json": "optional-base64",
      "mimeType": "image/png"
    }
  ],
  "raw": {}
}
```

Behavior notes:
- OpenAI-compatible providers call `images/generations`.
- GCP providers call `models/{model}:predict`.
- Anthropic image generation is currently unsupported and returns a provider error.
