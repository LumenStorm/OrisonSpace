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
| `config:load-model` | renderer -> main | invoke | 读取模型配置 |
| `config:save-model` | renderer -> main | invoke | 保存模型配置 |
| `config:load-user-preferences` | renderer -> main | invoke | 读取用户偏好 |
| `config:save-user-preferences` | renderer -> main | invoke | 保存用户偏好 |

### 模型网关通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `model:list-remote-models` | renderer -> main | invoke | 请求远端模型列表 |
| `model:generate-text` | renderer -> main | invoke | 文本生成 |
| `model:generate-image` | renderer -> main | invoke | 图片生成 |
| `model:generate-video` | renderer -> main | invoke | 视频生成 |
| `storySync:run` | renderer -> main | invoke | 本地执行 story-sync 提取 |

### 任务持久化通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `task:list` | renderer -> main | invoke | 按 projectId 查询任务列表（支持 limit） |
| `task:upsert` | renderer -> main | invoke | 插入或更新任务记录 |
| `task:update-status` | renderer -> main | invoke | 更新任务状态与错误信息 |
| `task:delete` | renderer -> main | invoke | 删除任务记录 |

### 字段同步通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `field:sync` | renderer -> main | invoke | 将单个创作字段同步回项目文件 |

### 版本与更新通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `app:get-version` | renderer -> main | invoke | 获取当前应用版本号 |
| `update:check` | renderer -> main | invoke | 检查是否有新版本可用 |

### 日志通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `log:open-dir` | renderer -> main | invoke | 打开日志目录 |
| `log:write` | renderer -> main | invoke | 写入一条日志 |

### Git 通道

| 通道 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `git:is-repo` | renderer -> main | invoke | 检查目录是否为 Git 仓库 |
| `git:log` | renderer -> main | invoke | 获取提交历史（默认 50 条） |
| `git:commit-diff` | renderer -> main | invoke | 获取指定提交的变更文件列表 |
| `git:file-at-commit` | renderer -> main | invoke | 读取指定提交中某文件的内容 |

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
  listRemoteModels,
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
  ensureProjectRegistration,
  // Task persistence (SQLite)
  listTasks,
  upsertTask,
  updateTaskStatus,
  deleteTask,
  // Logging
  openLogsDir,
  writeLog,
  // Version + update
  getAppVersion,
  checkForUpdate,
  // Git
  gitIsRepo,
  gitLog,
  gitCommitDiff,
  gitFileAtCommit,
}
```

## ModelConfig

模型配置使用 key-based 结构：

```ts
type ModelConfig = {
  keys: Array<{
    id: string
    name: string
    baseUrl: string
    apiKey: string
    models: Array<{
      id: string
      capability: 'text' | 'image' | 'video'
      alias: string
      enabled: boolean
    }>
  }>
}
```

说明：

- 一个 key 表示一组凭据（baseUrl + apiKey）
- `baseUrl` 支持带或不带 `/v1` 后缀，协议层自动补齐
- `models[]` 从远端 `/v1/models` 发现后自动分类
- 模型能力和别名由 `model-registry` glob pattern 推断
- 生成请求使用 `ModelRef`：`{ keyId, modelId }`

## storySync:run

渲染层在发起章节编排之前，可以先通过这个 IPC 在本地执行 story-sync。

输入大致包含：

- `ref`（`{ keyId, modelId }`）
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
| `apps/desktop/shell/main/ipc/taskIpc.ts` | 后台任务持久化（SQLite CRUD） |
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

- 无 key：空状态
- 新建中：编辑器
- 编辑已有 key：编辑器
- 有 key 但当前未选中：显示”请选择一个配置”

### 4. 模型配置从 profile 结构简化为 key 结构

- 移除 `provider`、`apiFormat`、`capabilities` 等手动标注字段
- 模型能力由 `model-registry` glob pattern 自动推断
- 生成请求从 `SlotAssignment`（`{ profileId, modelId }`）改为 `ModelRef`（`{ keyId, modelId }`）
- 协议层从多 adapter 注册表简化为统一 OpenAI 兼容适配器

---

## 相关文档

- [服务端 API 参考](../api/server-api.md)
- [模块边界规则](../architecture/module-boundaries.md)
