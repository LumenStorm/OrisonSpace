# Server API Reference

## Base URL

`http://localhost:4000`

## Authentication

All endpoints except `/health` and `/v1/auth/login` require a `Bearer` token in the `Authorization` header.

## Endpoints

### GET /health

Returns server health status.

Response: `{ "status": "ok" }`

### POST /v1/auth/login

Request body: `{ "email": string, "password": string }`

Response: `{ "accessToken": string, "tokenType": "Bearer", "user": { "id": string, "email": string, "displayName": string } }`

### POST /v1/tasks

Submit an AI task for execution.

Request body (validated by `taskRequestSchema`):
- `taskId`: string
- `taskType`: string (e.g. `story.rewrite`)
- `projectFingerprint`: string
- `selectedScope`: `{ module: "story" | "script" | "storyboard" | "video", entityId?: string }`
- `contextPayload`: record of key-value pairs
- `userInstruction`: string
- `privacyLevel`: `"minimal"` | `"standard"`
- `expectedOutputType`: `"patch"` | `"candidate"`

Response (202): `{ "taskId": string, "status": "queued" }`

### GET /v1/tasks/:taskId

Retrieve task status and result.

Response (validated by `taskResultSchema`):
- `taskId`: string
- `status`: `"queued"` | `"running"` | `"completed"` | `"failed"`
- `outputType?`: `"patch"` | `"candidate"`
- `outputPayload?`: `{ operations: PatchOperation[] }`
- `summary`: string
- `rationale`: string
- `reviewHint`: string
- `retryable`: boolean

## Limits

- Request body limit: 1 MB
- Task cache TTL: 15 minutes
