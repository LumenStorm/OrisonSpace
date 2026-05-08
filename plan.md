# Plan: 模型配置重构 — 命名 Key + 自动发现 + 按需选择

## 目标

将当前 profile-based（provider + baseUrl + apiKey + 手动添加 models + 全局槽位）改为：
- 用户创建「命名 Key」（name + baseUrl + apiKey）
- 刷新获取远端模型列表
- 系统通过内置映射 YAML 自动推断模型类别（text/image/video）和别名
- 用户勾选启用/禁用模型
- 去掉全局槽位，改为使用页面（生图/视频/小说）内从已启用模型中选择

---

## 新数据模型

### 1. 内置模型注册表（`packages/shared-contracts/model-registry.yaml`）

```yaml
# 模型 ID pattern -> capability + alias 映射
# glob 风格匹配（大小写不敏感），按顺序命中第一个生效
# 未命中：capability=text, alias=模型 ID 本身
entries:
  - pattern: "dall-e-*"
    capability: image
    alias: "DALL·E"
  - pattern: "gpt-image-*"
    capability: image
    alias: "GPT Image"
  - pattern: "stable-diffusion-*"
    capability: image
    alias: "Stable Diffusion"
  - pattern: "sora*"
    capability: video
    alias: "Sora"
  - pattern: "veo*"
    capability: video
    alias: "Veo"
  - pattern: "cogvideox*"
    capability: video
    alias: "CogVideoX"
  - pattern: "gpt-4o*"
    capability: text
    alias: "GPT-4o"
  - pattern: "gpt-4.1*"
    capability: text
    alias: "GPT-4.1"
  - pattern: "claude-*"
    capability: text
    alias: "Claude"
  - pattern: "gemini-*"
    capability: text
    alias: "Gemini"
  - pattern: "deepseek-*"
    capability: text
    alias: "DeepSeek"
```

### 2. 新 TypeScript 类型（替换 ModelProfileV2 / SlotAssignment 等）

```ts
type ApiKeyConfig = {
  id: string;          // uuid
  name: string;        // 用户命名，如 "我的 OpenAI"、"中继站"
  baseUrl: string;
  apiKey: string;      // safeStorage 加密存储
};

type DiscoveredModel = {
  id: string;          // 远端模型 ID
  capability: ModelCapability;  // 系统推断（text/image/video）
  alias: string;       // 从 registry 映射得到的显示名
  enabled: boolean;    // 用户是否启用
};

type ApiKeyEntry = ApiKeyConfig & {
  models: DiscoveredModel[];
};

type ModelConfig = {
  keys: ApiKeyEntry[];
};
```

### 3. 磁盘存储（`~/.orison/model/`）

- `keys/*.yaml` — 每个命名 Key 一个文件（apiKey 经 safeStorage 加密）
- 删除 `index.yaml`（不再有全局槽位）
- 删除 `profiles/` 目录（迁移期自动转换）

---

## 改动范围

### Layer 1: shared-contracts（类型 + 注册表）

| 文件 | 改动 |
|------|------|
| `packages/shared-contracts/model-registry.yaml` | **新建** — 内置模型映射表 |
| `packages/shared-contracts/src/contracts/model.ts` | 重写：删除 `ModelProfileV2`、`SlotAssignment`、`SlotAssignmentMap`；新增 `ApiKeyConfig`、`DiscoveredModel`、`ApiKeyEntry`、`ModelConfig` |
| `packages/shared-contracts/src/contracts/generation.ts` | 删除 `generationProviderSchema`、`modelApiFormatSchema`；生成请求改为传 `{ keyId, modelId }` |
| `packages/shared-contracts/src/ipc.ts` | 更新 `ModelConfig` 类型、`ProviderModelListRequest` 改为 `{ baseUrl, apiKey }`、`OrisonDesktopApi` 接口更新 |

### Layer 2: model-protocols（模型列表 + 生成适配器）

| 文件 | 改动 |
|------|------|
| `packages/model-protocols/src/listModels.ts` | 去掉 `provider` 参数；`inferCapabilities` 改为读取 registry 做 pattern 匹配，返回 `{ id, capability, alias }` |
| 生成适配器 | 统一走 OpenAI 兼容协议（chat-completions / images / videos） |

### Layer 3: desktop shell（IPC + 配置读写 + 生成网关）

| 文件 | 改动 |
|------|------|
| `apps/desktop/shell/main/ipc/configIpc.ts` | 读写改为 `keys/*.yaml`；去掉 slot 逻辑；保留 safeStorage 加解密 |
| `apps/desktop/shell/main/ipc/modelProviderIpc.ts` | 去掉 provider 参数 |
| `apps/desktop/shell/main/ipc/modelGatewayIpc.ts` | `resolveSlot` → `resolveModel(keyId, modelId)`；统一 OpenAI 兼容协议 |
| `apps/desktop/shell/preload/index.ts` | 更新 bridge 接口 |

### Layer 4: desktop UI（设置页 + 使用页）

| 文件 | 改动 |
|------|------|
| `ModelSettingsPage.tsx` | 重写：左侧 Key 列表，右侧 Key 编辑器 + 模型列表 |
| `model/ProfileList.tsx` → `model/KeyList.tsx` | 展示命名 Key 列表 |
| `model/ProfileEditor.tsx` → `model/KeyEditor.tsx` | name + baseUrl + apiKey 表单 + 刷新按钮 |
| 新增 `model/ModelList.tsx` | 按 text/image/video 分组展示模型，每行有启用开关 |
| 删除 `ProfileAssignmentRow.tsx` | 不再有全局槽位 |
| 删除 `ProviderBadge.tsx` | 不再有 provider |
| `useModelLibrary.ts` | 重写：keys CRUD、刷新模型列表、切换 enabled |
| `ImageGenEditor.tsx` | 从 store 取已启用 image 模型列表，页面内下拉选择，生成传 `{ keyId, modelId }` |
| `VideoEditor.tsx` | 同上，取已启用 video 模型列表 |
| 小说生成组件 | 同上，取已启用 text 模型列表 |
| `settingsSlice.ts` | `modelConfig` 类型更新，去掉 `selected` |

---

## 迁移策略

- 读取旧 `profiles/*.yaml` 时自动转换为 `keys/*.yaml`（profile.name → key.name，保留 baseUrl/apiKey/models）
- 旧 `index.yaml` 中的 slot 信息丢弃
- 迁移完成后删除旧文件

---

## 实施顺序

1. 新建 `model-registry.yaml` + pattern 匹配工具函数
2. 重写 `shared-contracts` 类型
3. 更新 `model-protocols/listModels` — 去 provider，返回 `{ id, capability, alias }`
4. 更新 shell IPC — configIpc / modelProviderIpc / modelGatewayIpc
5. 重写设置页 UI — KeyList + KeyEditor + ModelList
6. 更新使用页 — ImageGenEditor / VideoEditor / 小说组件加模型选择下拉
7. 迁移逻辑 — 旧 profile → 新 key 自动转换
8. 清理 — 删除废弃类型/组件，更新测试

---

## 不变的部分

- `~/.orison/model/` 作为配置目录
- apiKey 仍用 Electron `safeStorage` 加密
- 模型列表走 `/v1/models` OpenAI 兼容端点
- 生成请求走 IPC（renderer → main → 上游 API）
