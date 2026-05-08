# 桌面 IPC 参考

## 概览

桌面端通过 `contextBridge` 向渲染层暴露 `window.orisonDesktop`。

单一类型源定义在：

- `packages/shared-contracts/src/ipc.ts`

实现位置：

- preload：`apps/desktop/shell/preload/index.ts`
- 主进程 handler：`apps/desktop/shell/main/ipc/*.ts`

## 通道分组

### 项目与文件通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `project:pick-directory` | renderer -> main | invoke | 打开目录选择器，返回路径或 `null` |
| `project:create-directory` | renderer -> main | invoke | 在指定父目录下创建项目目录 |
| `project:pick-cover-image` | renderer -> main | invoke | 选择封面图 |
| `project:copy-cover-image` | renderer -> main | invoke | 将封面图复制到项目目录 |
| `project:save-meta` | renderer -> main | invoke | 保存项目元信息 |
| `project:load-meta` | renderer -> main | invoke | 读取项目元信息 |
| `project:read-directory` | renderer -> main | invoke | 读取项目目录树 |
| `project:delete-entry` | renderer -> main | invoke | 删除文件或目录 |
| `project:rename-entry` | renderer -> main | invoke | 重命名文件或目录 |
| `project:create-entry` | renderer -> main | invoke | 创建文件或目录 |
| `project:read-file` | renderer -> main | invoke | 读取 UTF-8 文本文件 |
| `project:read-file-binary` | renderer -> main | invoke | 读取白名单图片二进制，返回 `{ base64, mimeType }` |
| `project:write-file` | renderer -> main | invoke | 写入 UTF-8 文本文件 |
| `project:path-exists` | renderer -> main | invoke | 检查白名单路径是否存在 |
| `project:save-base64-image` | renderer -> main | invoke | 保存 base64 图片到项目目录 |
| `project:move-file` | renderer -> main | invoke | 移动项目内文件 |
| `project:delete-file` | renderer -> main | invoke | 删除项目内文件 |

`project:save-base64-image` 只允许写入 `temp/images/generation` 或 `assets/images`。

### 窗口与系统通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `window:minimize` | renderer -> main | send | 最小化窗口 |
| `window:maximize` | renderer -> main | send | 最大化 / 还原窗口 |
| `window:close` | renderer -> main | send | 关闭窗口 |
| `window:is-maximized` | renderer -> main | invoke | 查询当前是否最大化 |
| `shell:show-item-in-folder` | renderer -> main | send | 在系统文件管理器中定位文件 |
| `shell:open-path` | renderer -> main | send | 用系统默认方式打开路径 |

### 配置通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `config:load-model` | renderer -> main | invoke | 读取 v2 模型配置 |
| `config:save-model` | renderer -> main | invoke | 保存 v2 模型配置 |
| `config:load-user-preferences` | renderer -> main | invoke | 读取用户偏好 |
| `config:save-user-preferences` | renderer -> main | invoke | 保存用户偏好 |

### 模型网关通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `model:list-provider-models` | renderer -> main | invoke | 请求 provider 模型列表 |
| `model:generate-text` | renderer -> main | invoke | 文本生成 |
| `model:generate-image` | renderer -> main | invoke | 图片生成 |
| `model:generate-video` | renderer -> main | invoke | 视频生成 |
| `storySync:run` | renderer -> main | invoke | 本地执行 story-sync 提取 |

### 字段同步通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `field:sync` | renderer -> main | invoke | 将单个创作字段同步回项目文件 |

---

## 当前暴露的 preload API

```ts
window.orisonDesktop = {
  pickProjectDirectory,
  createProjectDirectory,
  pickCoverImage,
  copyCoverImage,
  saveProjectMeta,
  loadProjectMeta,
  getLocale,
  minimize,
  maximize,
  close,
  isMaximized,
  platform,
  syncField,
  loadModelConfig,
  saveModelConfig,
  listProviderModels,
  generateText,
  generateImage,
  generateVideo,
  runStorySync,
  loadUserPreferences,
  saveUserPreferences,
  showItemInFolder,
  openPath,
  readDirectory,
  deleteEntry,
  renameEntry,
  createEntry,
  readFile,
  readFileBinary,
  writeFile,
  saveBase64Image,
  moveProjectFile,
  deleteProjectFile,
}
```

## ModelConfig（v2）

模型配置已经是 v2 结构：

```ts
type ModelConfig = {
  profiles: Array<{
    schemaVersion: 2
    id: string
    name: string
    provider: 'openai' | 'gcp' | 'anthropic'
    apiKey: string
    baseUrl: string
    models: Array<{
      id: string
      alias: string
      apiFormat:
        | 'openai-chat-completions'
        | 'openai-responses'
        | 'claude-messages'
        | 'gemini-generate-content'
        | 'openai-images'
        | 'gemini-images'
        | 'gemini-image-edit'
        | 'sora-videos'
      capabilities: Array<'text' | 'image' | 'video'>
    }>
  }>
  selected: {
    novel: { profileId: string; modelId: string } | null
    image: { profileId: string; modelId: string } | null
    video: { profileId: string; modelId: string } | null
  }
}
```

说明：

- `provider` 决定如何列出 `/models`
- `apiFormat` 决定如何发送生成请求
- 一个 profile 下可以挂多个模型
- 槽位选择的是 `{ profileId, modelId }`

## storySync:run

渲染层在发起章节编排之前，可以先通过这个 IPC 在本地执行 story-sync。

输入大致包含：

- `slot`
- `runId`
- `chapterId`
- `candidate`
- `context`
- `fieldVersions`

输出：

```ts
type RunStorySyncResult = {
  patches: NovelStorySyncPayload['patches']
  summary: string
  fallbackToRules: boolean
}
```

约束：

- 如果本地 LLM 提取失败，不会阻止编排继续
- 会返回 `fallbackToRules: true`
- agent 收到补丁后仍会再次校验

## 安全边界

### 1. 路径校验

所有文件通道都通过 `pathGuard.ts` 做安全限制：

- 默认允许根目录：`~/Documents/OrisonSpace`
- 用户主动选择的项目目录 / 封面图路径会注册进当前 Electron 会话允许列表
- 项目内相对操作仍会使用 `assertWithinProject` 阻止越界

### 2. API Key 边界

模型 `apiKey`：

- 磁盘存储时使用 `safeStorage` 加密
- 解密只发生在 desktop main
- 文本 / 图片 / 视频生成的 renderer payload 中不会携带 `apiKey`
- server 和 agent 都拿不到 provider `apiKey`

### 3. CSP

生产构建下，由主进程通过 `session.webRequest.onHeadersReceived` 动态注入 CSP。

### 4. 渲染层隔离

- `contextIsolation = true`
- `nodeIntegration = false`
- `sandbox = true`

---

## 主要文件归属

| 文件 | 责任 |
|---|---|
| `apps/desktop/shell/main/ipc/projectIpc.ts` | 项目与文件操作 |
| `apps/desktop/shell/main/ipc/windowIpc.ts` | 窗口与系统操作 |
| `apps/desktop/shell/main/ipc/configIpc.ts` | 模型配置与用户偏好 |
| `apps/desktop/shell/main/ipc/modelProviderIpc.ts` | provider 模型列表刷新 |
| `apps/desktop/shell/main/ipc/modelGatewayIpc.ts` | 文本 / 图片 / 视频生成 |
| `apps/desktop/shell/main/ipc/storySyncIpc.ts` | story-sync 入口 |
| `apps/desktop/shell/main/ipc/fieldSyncIpc.ts` | 创作字段同步 |
| `apps/desktop/shell/main/ipc/pathGuard.ts` | 路径安全辅助 |
| `apps/desktop/shell/main/storySync/runStorySync.ts` | story-sync 执行逻辑 |

---

## 2026-05-07 之后的重要变化

### 1. 服务端 generation route 已移除

以前的：

- `/v1/generation/:provider/text`
- `/v1/generation/:provider/image`

现在已经删除，替换为 desktop main IPC：

- `model:generate-text`
- `model:generate-image`
- `model:generate-video`

### 2. Story Sync 已本地化

以前 story-sync 的 LLM 执行在 agent 侧或依赖旧 generation 路径。

现在：

- 渲染层 -> `storySync:run`
- desktop main -> `@orison/story-sync` + `@orison/model-protocols`
- agent 只做补丁校验与规则回退

### 3. 模型设置页交互已经收口

模型设置页当前有明确的 UI 状态：

- 无 profile：空状态
- 新建中：编辑器
- 编辑已有 profile：编辑器
- 有 profile 但当前未选中：显示“请选择一个配置”

---

## 相关文档

- [服务端 API 参考](../api/server-api.md)
- [模块边界规则](../architecture/module-boundaries.md)
