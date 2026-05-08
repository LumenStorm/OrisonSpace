# 服务端 API 参考

## Base URL

默认本地开发地址：

`http://localhost:4000`

## 鉴权

除以下接口外，所有接口都要求 `Authorization: Bearer <token>`：

- `GET /health`
- `GET /v1/auth/public-key`
- `POST /v1/auth/register`
- `POST /v1/auth/login`

## 密码传输加密

登录和注册接口的 `password` 字段必须经过 RSA-OAEP 加密后以 base64 传输：

1. 客户端调用 `GET /v1/auth/public-key` 获取 RSA 公钥（PEM 格式）
2. 使用 RSA-OAEP + SHA-256 加密明文密码
3. 将密文 base64 编码后作为 `password` 字段值

服务端使用对应私钥解密后再做 bcrypt 校验。密钥对存放于 `apps/server/keys/`。

## 接口列表

### GET /health

健康检查。

响应：

```json
{
  "status": "ok"
}
```

---

### GET /v1/auth/public-key

获取 RSA 公钥，用于客户端加密密码。

响应 `200`：

```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBI..."
}
```

---

### POST /v1/auth/register

注册用户。

请求体：

```json
{
  "email": "creator@example.com",
  "password": "<RSA-OAEP 加密后的 base64 字符串>",
  "displayName": "Creator"
}
```

成功响应 `201`：

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

错误：

- `400`：输入不合法 / 密码解密失败
- `409`：邮箱已注册

---

### POST /v1/auth/login

用户登录。

请求体：

```json
{
  "email": "creator@example.com",
  "password": "<RSA-OAEP 加密后的 base64 字符串>"
}
```

成功响应 `200`：

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

错误：

- `400`：密码解密失败
- `401`：邮箱或密码错误

---

### GET /v1/auth/me

获取当前 token 对应的用户信息。

成功响应 `200`：

```json
{
  "user": {
    "id": "string",
    "email": "creator@example.com",
    "displayName": "Creator"
  }
}
```

说明：

- 桌面端启动时会调用这个接口做 session bootstrap
- 如果 token 过期或无效，会返回 `401`

---

### POST /v1/projects

登记本地项目，分配五位顺序 `projectId`。

请求体：

```json
{
  "name": "Cold City",
  "type": "novel",
  "localFingerprint": "C:/Projects/ColdCity"
}
```

成功响应 `201`：

```json
{
  "projectId": "00001",
  "name": "Cold City",
  "type": "novel"
}
```

行为说明：

- 若 `localFingerprint` 已存在，返回已有项目而不是创建重复记录

---

### POST /v1/tasks

提交任务。

请求体示例：

```json
{
  "projectId": "00001",
  "targetId": "act_1",
  "assetIds": ["char_001", "loc_002"],
  "type": "outline.rewrite",
  "name": "重写第一幕冲突",
  "description": "强化主角和对手第一次正面对抗",
  "input": "让冲突更紧张。"
}
```

成功响应 `202`：

```json
{
  "taskId": "20260427214530123_48321",
  "status": "queued"
}
```

错误：

- `400`：请求体不合法
- `404`：项目不存在

---

### GET /v1/tasks/:taskId

获取任务执行结果。

说明：

- 这个接口返回的是纯 `TaskResult`
- 为了兼容桌面端旧调用，不带任务元数据

成功响应示例：

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

错误：

- `404`：任务不存在

---

### GET /v1/tasks/:taskId/detail

获取任务元数据与任务结果。

成功响应示例：

```json
{
  "task": {
    "taskId": "20260427214530123_48321",
    "projectId": "00001",
    "targetId": "act_1",
    "type": "outline.rewrite",
    "name": "重写第一幕冲突",
    "description": "强化主角和对手第一次正面对抗",
    "status": "completed",
    "createdAt": "2026-04-27T14:45:30.123Z",
    "assetIds": ["char_001", "loc_002"]
  },
  "result": {
    "taskId": "20260427214530123_48321",
    "status": "completed",
    "outputType": "patch",
    "outputPayload": {
      "operations": []
    },
    "summary": "Mock rewrite completed.",
    "retryable": true
  }
}
```

说明：

- 如果任务还没有结果，`result` 可以为 `null`

错误：

- `404`：任务不存在

---

### GET /v1/projects/:projectId/tasks

按项目列出任务，使用 keyset 分页。

查询参数：

- `limit`：1-100，默认 `50`
- `cursor`：上一页返回的 opaque cursor
- `sort`：`createdDesc` 或 `createdAsc`

成功响应示例：

```json
{
  "items": [
    {
      "taskId": "20260427214530123_48321",
      "projectId": "00001",
      "targetId": "act_1",
      "type": "outline.rewrite",
      "name": "重写第一幕冲突",
      "description": "强化主角和对手第一次正面对抗",
      "status": "completed",
      "createdAt": "2026-04-27T14:45:30.123Z",
      "assetIds": ["char_001", "loc_002"]
    }
  ],
  "nextCursor": "opaque-cursor"
}
```

错误：

- `404`：项目不存在

---

### GET /v1/projects/:projectId/assets

按项目列出轻量资产索引，使用 keyset 分页。

查询参数：

- `limit`：1-100，默认 `50`
- `cursor`：上一页返回的 opaque cursor
- `sort`：`updatedDesc` 或 `updatedAsc`

成功响应示例：

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
      "summary": "强化主角和对手第一次正面对抗",
      "version": 1,
      "updatedAt": "2026-04-27T14:45:30.456Z"
    }
  ],
  "nextCursor": null
}
```

错误：

- `404`：项目不存在

---

## Orchestration 代理

服务端不会自己执行编排逻辑，而是转发到 Agent：

- `POST /v1/orchestration/runs`
- `GET /v1/orchestration/runs/:runId`
- `POST /v1/orchestration/actions`
- `POST /v1/orchestration/auto-mode`
- `POST /v1/orchestration/auto-mode/actions`
- `GET /v1/orchestration/auto-mode/:autoModeId`
- `POST /v1/orchestration/auto-mode/restore`

转发行为：

- 保留调用方的 `Authorization`
- 保留上游状态码
- JSON 与纯文本响应都可透传

---

## 已移除接口

以下接口已在 2026-05-07 的 desktop-direct model gateway 迁移中移除：

- `POST /v1/generation/:provider/text`
- `POST /v1/generation/:provider/image`

当前第三方模型调用方式：

- 渲染层 -> Electron preload -> desktop main IPC
- desktop main -> `@orison/model-protocols`
- desktop main 直接请求第三方模型服务

也就是说：

- server 不再持有 provider `apiKey`
- server 不再转发模型请求
- agent 也不再直接访问模型

---

## 模型列表刷新说明

模型列表刷新不是服务端接口，而是桌面主进程能力。

桌面端通过 `model:list-provider-models` IPC 触发：

- 统一请求 `{baseUrl}/v1/models`（OpenAI 兼容层）
- 覆盖直连 OpenAI、NewAPI/OneAPI 中继等所有 provider

之后由用户在设置页中为每个模型配置：

- `alias`
- `apiFormat`
- `capabilities`

`provider` 只决定“如何列模型”，`apiFormat` 才决定“如何发生成请求”。

---

## 其他约束

- 请求体大小限制：`1 MB`
- CORS 白名单：
  - `http://localhost:5173`
  - `http://localhost:4000`
  - `app://.`

---

## 相关文档

- [桌面 IPC 参考](../ipc/desktop-ipc.md)
- [模块边界规则](../architecture/module-boundaries.md)
- [桌面直连模型网关设计](../superpowers/specs/2026-05-06-desktop-model-gateway-design.md)
