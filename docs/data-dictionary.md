# Orison Space 数据字典

## 1. 数据边界总览

系统采用”本地创作文件 + 桌面本地状态”结构：

- 本地项目目录负责创作正文与创作字段
- 桌面本地 SQLite 负责后台任务恢复与项目索引
- 桌面主进程负责模型配置与 provider 调用

## 2. 已废弃：PostgreSQL（服务端）

> 服务端（`apps/server`）已移除。以下表结构仅保留为历史记录。当前系统不使用远程数据库。

### 2.1 users

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | 用户 ID |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | 登录邮箱 |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt 哈希 |
| `display_name` | VARCHAR(100) | 可空 | 显示名称 |
| `created_at` | TIMESTAMPTZ | default now() | 创建时间 |

### 2.2 projects

当前服务端实现不创建 `projects` 表。项目元数据以本地项目目录中的 `project.yaml` 为主，桌面端最近项目列表由渲染层状态与本地项目读取逻辑维护。

### 2.3 tasks

当前服务端实现不创建 `tasks` 表。桌面端后台任务通过 Electron 主进程写入本地 SQLite，见本文档 3.1。

### 2.4 task_asset_refs

当前服务端实现不创建 `task_asset_refs` 表。任务与资产关系目前由本地项目文件、任务输出负载和创作字段同步逻辑表达。

### 2.5 project_assets

当前服务端实现不创建 `project_assets` 表。确认保存后的图片资产写入本地项目 `assets/images/`，结构化资产卡写入 `project.yaml`。

关键点：

- 服务端已移除，不再有远程数据库
- 所有持久化数据在本地（项目文件 + 桌面端 SQLite）

## 3. 本地项目文件（创作内容主存）

典型目录结构：

```text
<project>/
├─ project.yaml
├─ chapters/
│  ├─ ch_001.md
│  └─ ...
├─ scenes/
│  ├─ sc_001.md
│  └─ ...
├─ memory/
│  └─ story-memory.yaml
├─ temp/
│  └─ images/
│     └─ generation/
└─ assets/
   └─ images/
```

说明：

- `project.yaml` 存放结构化字段（大纲、曲线、资产卡等）
- `chapters/*.md` / `scenes/*.md` 存放正文
- `memory/story-memory.yaml` 存放长期记忆索引
- `temp/images/generation` 存放新生成图片与本地编辑结果（待确认）
- `assets/images` 存放已确认保存的图片资产

## 3.1 本地 SQLite（桌面主进程）

位置：`~/.orison/data/projects.db`

### projects 表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `project_id` | TEXT | PK | 项目唯一 ID |
| `project_name` | TEXT | NOT NULL | 项目名称 |
| `project_type` | TEXT | NOT NULL, CHECK(novel/script) | 项目类型 |
| `local_fingerprint` | TEXT | UNIQUE NOT NULL | 本地目录指纹 |
| `logline` | TEXT | 可空 | 一句话概要 |
| `genre` | TEXT | 可空 | 类型标签 |
| `writing_style` | TEXT | 可空 | 写作风格 |
| `created_at` | TEXT | NOT NULL | ISO 时间戳 |
| `updated_at` | TEXT | NOT NULL | ISO 时间戳 |

### tasks 表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `task_id` | TEXT | PK | 前端生成的唯一 ID |
| `project_id` | TEXT | NOT NULL, FK -> projects | 所属项目 |
| `target_id` | TEXT | 可空 | 目标实体 ID |
| `task_type` | TEXT | NOT NULL | 任务类型（如 `image_gen`） |
| `name` | TEXT | NOT NULL | 任务显示名 |
| `description` | TEXT | NOT NULL DEFAULT '' | 描述 |
| `input_text` | TEXT | NOT NULL DEFAULT '' | 输入文本 |
| `status` | TEXT | NOT NULL | queued/running/completed/failed |
| `output_type` | TEXT | 可空 | 输出类型 |
| `output_payload` | TEXT | 可空 | JSON 序列化的输出 |
| `result_summary` | TEXT | 可空 | 结果摘要 |
| `rationale` | TEXT | NOT NULL DEFAULT '' | 决策理由 |
| `review_hint` | TEXT | NOT NULL DEFAULT '' | 审阅提示 |
| `retryable` | INTEGER | NOT NULL DEFAULT 1 | 是否可重试 |
| `error_message` | TEXT | 可空 | 错误信息 |
| `created_at` | TEXT | NOT NULL | ISO 时间戳 |
| `started_at` | TEXT | 可空 | 开始时间 |
| `finished_at` | TEXT | 可空 | 完成时间 |
| `updated_at` | TEXT | NOT NULL | ISO 时间戳 |

### task_asset_refs 表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `task_id` | TEXT | PK, FK -> tasks ON DELETE CASCADE | 任务 ID |
| `asset_id` | TEXT | PK | 资产 ID |

### project_assets 表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `asset_id` | TEXT | PK (复合) | 资产唯一 ID |
| `project_id` | TEXT | PK (复合), FK -> projects ON DELETE CASCADE | 所属项目 |
| `asset_type` | TEXT | NOT NULL | 资产类型（如 `image`） |
| `asset_name` | TEXT | NOT NULL | 资产显示名（可编辑） |
| `asset_group` | TEXT | NOT NULL DEFAULT '' | 分组名（角色/场景/道具/自定义） |
| `asset_status` | TEXT | NOT NULL | 状态（active 等） |
| `relative_path` | TEXT | NOT NULL DEFAULT '' | 项目内相对路径 |
| `source_task_id` | TEXT | 可空 | 来源任务 ID |
| `summary` | TEXT | 可空 | 资产描述 |
| `version` | INTEGER | NOT NULL DEFAULT 1 | 版本号 |
| `updated_at` | TEXT | NOT NULL | ISO 时间戳 |

说明：

- 用于持久化渲染层 `backgroundTasksSlice` 中的后台任务
- 应用重启后通过 `task:list` IPC 恢复未完成任务
- `cancelled` 状态在写入时映射为 `failed`（符合 CHECK 约束）
- 离线模式（无 projectId）时任务仅存内存，不写 SQLite
- `project_assets` 表为图片资产提供元数据管理（名称、分组、描述），AssetsPanel 以磁盘文件为主、DB 记录为辅

## 4. 模型配置存储（桌面主进程）

模型配置不在服务端数据库中，位于用户目录：

- `~/.orison/model/keys/*.yaml`

### 4.1 key 文件（凭据 + 发现的模型）

```yaml
id: key_001
name: OpenAI 主配置
baseUrl: https://api.openai.com
apiKey: <ciphertext>
models:
  - id: gpt-4o
    capability: text
    alias: GPT-4o
    enabled: true
  - id: gpt-image-1
    capability: image
    alias: GPT Image
    enabled: true
```

说明：

- `apiKey` 落盘是加密密文（Electron `safeStorage`）
- 只有 desktop main 会解密
- 渲染层、服务端、agent 都不持有 provider 明文 key
- `baseUrl` 支持带或不带 `/v1` 后缀，协议层通过 `normalizeBaseUrl` 自动补齐
- `models[]` 从远端 `/v1/models` 发现后，由 `model-registry` 自动推断 `capability` 和 `alias`
- `enabled` 控制模型是否在 UI 中可选

## 5. 用户偏好

用户偏好存储：

- `~/.orison/user/preferences.yaml`

当前字段：

```yaml
theme: system
locale: system
autoApplyPatches: true
```

## 6. 鉴权会话数据

> 已废弃：桌面端为纯本地应用，无需登录。启动后直接进入项目页。

## 7. Orchestration / Auto Mode 相关文件

Agent 侧 auto mode 持久化位置：

```text
<projectPath>/runs/auto-mode/<autoModeId>.yaml
```

用于：

- 进程重启后的会话恢复
- Agent runtime 内部 restore

## 8. 已废弃/迁移说明

### 8.1 服务端 generation route

以下路由已移除（2026-05-07）：

- `/v1/generation/:provider/text`
- `/v1/generation/:provider/image`

生成请求改为桌面 IPC：

- `model:generate-text`
- `model:generate-image`

### 8.2 旧模型配置路径

旧路径 `~/.orison/model/config.yaml`、`~/.orison/model/index.yaml`、`~/.orison/model/profiles/*.yaml` 只用于迁移读取，不再作为长期写入格式。

---

## 9. 字段关系要点

| 源字段 | 目标字段 | 说明 |
|---|---|---|
| `local tasks.project_id` | renderer project id | 桌面本地后台任务所属项目 |
| `project.yaml novel.chapters[].content_file` | `chapters/*.md` | 章节正文路径 |
| `modelConfig.keys[].models[].id` | `ModelRef.modelId` | 生成请求模型引用 |
| `storyboard.shots[].source_ref` | novel/script 实体 ID | 分镜来源引用 |

---

## 10. 备注

- 本文档描述的是当前代码实现对应的数据结构，不是早期设计草案。
- 若后续对 auth 启动流程、模型配置 schema、任务索引字段有调整，必须同步更新本文档。
