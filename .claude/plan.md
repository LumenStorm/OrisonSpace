# Phase 2: Artifact to Project Patch — 实施计划

## 目标

将 Phase 1 的内存态 agent 产物落盘为 YAML 文件，并建立从 agent 产物到 ProjectDocument 的 patch 通路，使 local-bff 能保存和读取新创作字段。

## Spec 要求清单

1. delivery 阶段生成项目字段 patch
2. local-bff 能保存并读取新字段
3. 旧字段派生兼容
4. 保存 `asset_cards`、`relationship_graph` 和字段元信息
5. 用户编辑人物关系后能触发同步事件
6. 将 run 中间产物落盘到 `project-config/runs/<runId>/artifacts/*.yaml`
7. 下游节点通过 `context-packets/*.yaml` 获取瘦身上下文

## 当前状态分析

- `artifactYaml.ts` 已有 write/read/contextPacket 能力，但 runService 从未调用
- `deliveryService.ts` 只知道旧 key（`draft.*`、`planning.*`），不感知新创作字段
- `feedbackService.ts` 的 `AssetPatch` 类型与 shared-contracts 的 `AssetPatchCandidate` 脱节
- `ProjectDocument`（project.ts）没有新创作字段
- `localProjectRepository.ts` 是纯内存 stub，无磁盘 I/O
- `applyPatchOperations` 只处理一个硬编码路径
- `runStore` 是内存 Map，无持久化

## 实施步骤

### Step 1: 扩展 ProjectDocument schema（shared-contracts）

**文件**: `packages/shared-contracts/src/contracts/project.ts`

在 `projectDocumentSchema` 中增加可选的新创作字段：
- `world_setting?: WorldSetting`
- `asset_cards?: AssetCard[]`
- `relationship_graph?: RelationshipGraph`
- `episode_outlines?: EpisodeOutline[]`
- `growth_curve?: GrowthCurve`
- `pacing_curve?: PacingCurve`
- `emotion_curve?: EmotionCurve`
- `creative_brief?: CreativeBrief`
- `field_metadata?: Record<CreativeFieldKey, FieldMetadata>`

从 `creative-fields.ts` 导入 schema，全部标为 `.optional()`，保持旧字段不变。

**测试**: 验证旧 ProjectDocument 仍能 parse，新字段可选填。

### Step 2: 创建 ProjectFieldPatch schema（shared-contracts）

**文件**: `packages/shared-contracts/src/contracts/project-patch.ts`（新建）

定义 `projectFieldPatchSchema`：
```ts
{
  runId: string,
  createdAt: string,
  patches: Array<{
    field: CreativeFieldKey,
    action: 'set' | 'merge' | 'delete',
    data: unknown,
    fieldVersion: number,
    generatedBy: string
  }>
}
```

导出 `ProjectFieldPatch` 类型。在 `index.ts` 中导出。

### Step 3: runService 中间产物落盘（agent engine）

**文件**: `apps/agent/src/engine/runService.ts`

在 `startCreative()` 的节点循环中，每个节点完成后：
1. 调用 `writeArtifactYaml()` 将产物写入 `<configRoot>/runs/<runId>/artifacts/<stateKey>.yaml`
2. 在下一个节点执行前，调用 `writeContextPacketYaml()` 写入瘦身上下文

需要从 `artifactYaml.ts` 导入函数，从 context 获取 fieldVersions。

在 `start()`（旧入口）中不改动，保持兼容。

### Step 4: delivery 阶段生成项目字段 patch（agent engine）

**文件**: `apps/agent/src/engine/deliveryService.ts`

新增 `buildCreativeDelivery(run, context)` 函数：
- 遍历 `run.artifacts`，将已知的 stateKey 映射到 CreativeFieldKey
- 映射规则：`assets.projectContext` → 拆分为 `world_setting` + `asset_cards` + `relationship_graph`；`planning.storyPlan` → `outline`；`intake.requirement` → `creative_brief`；`curves` → 拆分为 `growth_curve` + `pacing_curve` + `emotion_curve`；`episode_outlines` 直接映射
- 返回 `ProjectFieldPatch` 对象
- 保留旧 `buildDeliveryOutput` 不变

**测试**: 验证 creative delivery 能从 run artifacts 生成正确的 patch 列表。

### Step 5: feedbackService 对齐 AssetPatchCandidate（agent engine）

**文件**: `apps/agent/src/engine/feedbackService.ts`

新增 `buildCreativeFeedback(run)` 函数：
- 使用 `extractAssetCandidates` 和 `classifyPatches` 从 `assetLibrary.ts`
- 返回结构化的 `AssetPatchCandidate[]` 而非旧的 `AssetPatch[]`
- 保留旧 `buildFeedback` 不变

### Step 6: localProjectRepository 磁盘读写（local-bff）

**文件**: `apps/desktop/local-bff/sync/localProjectRepository.ts`

新增真正的文件 I/O 函数（保留旧函数不变）：
- `saveProject(projectPath, document)`: 将 ProjectDocument 写入 `<projectPath>/project.yaml`
- `loadProject(projectPath)`: 从 `<projectPath>/project.yaml` 读取并 parse
- `applyFieldPatches(projectPath, patches)`: 加载项目 → 应用 patch → 保存 → 返回更新后的文档
- `getFieldMetadata(projectPath, field)`: 读取单个字段的元信息

**测试**: 写入后读取一致，patch 应用正确，旧文档兼容。

### Step 7: 用户编辑触发同步事件（local-bff）

**文件**: `apps/desktop/local-bff/sync/fieldSyncBridge.ts`（新建）

- `onFieldEdited(projectPath, field, newData)`: 用户手动编辑字段后调用
  - 递增 fieldVersion
  - 调用 `createSyncEvent` 生成事件
  - 调用 `markStaleFields` 标记下游
  - 更新 `field_metadata` 并保存

**测试**: 编辑 relationship_graph 后，episode_outlines 被标记 stale。

### Step 8: 旧字段派生兼容（local-bff）

**文件**: `apps/desktop/local-bff/sync/localProjectRepository.ts`

在 `loadProject` 中增加兼容逻辑：
- 如果旧 `assets.characters` 存在但 `asset_cards` 不存在 → 自动派生 `asset_cards`
- 派生结果标记 `source: 'imported'`，`version: 0`
- 不强制派生所有字段，只处理有明确映射关系的

### Step 9: archiveService 关联 YAML 产物（agent engine）

**文件**: `apps/agent/src/engine/archiveService.ts`

新增 `createCreativeArchiveRecord(run, configRoot)` 函数：
- 列出 `<configRoot>/runs/<runId>/artifacts/*.yaml` 中的实际文件
- 记录每个 artifact 的 fieldVersion
- 保留旧 `createArchiveRecord` 不变

### Step 10: 集成测试

**新建**: `apps/agent/test/orchestration.artifactPersistence.test.ts`
- creative run 完成后，`artifacts/*.yaml` 文件存在且可读
- `context-packets/*.yaml` 文件存在
- delivery 包含 ProjectFieldPatch
- patch 能应用到 ProjectDocument

**更新**: `apps/desktop/local-bff/test/localProjectRepository.test.ts`
- saveProject / loadProject 往返一致
- applyFieldPatches 正确更新字段和元信息
- 旧格式文档加载兼容

**新建**: `apps/desktop/local-bff/test/fieldSyncBridge.test.ts`
- 编辑字段后生成 sync event
- 下游字段被标记 stale

## 文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/shared-contracts/src/contracts/project.ts` | 修改 | ProjectDocument 增加新创作字段 |
| `packages/shared-contracts/src/contracts/project-patch.ts` | 新建 | ProjectFieldPatch schema |
| `packages/shared-contracts/src/index.ts` | 修改 | 导出新模块 |
| `apps/agent/src/engine/runService.ts` | 修改 | startCreative 中落盘 artifact + context packet |
| `apps/agent/src/engine/deliveryService.ts` | 修改 | 新增 buildCreativeDelivery |
| `apps/agent/src/engine/feedbackService.ts` | 修改 | 新增 buildCreativeFeedback |
| `apps/agent/src/engine/archiveService.ts` | 修改 | 新增 createCreativeArchiveRecord |
| `apps/desktop/local-bff/sync/localProjectRepository.ts` | 修改 | 真正的文件 I/O + patch 应用 |
| `apps/desktop/local-bff/sync/fieldSyncBridge.ts` | 新建 | 用户编辑触发同步 |
| `apps/desktop/local-bff/index.ts` | 修改 | 导出新模块 |
| 测试文件 x3 | 新建/修改 | 见 Step 10 |

## 不变项

- 旧 `start()` 入口和默认 registry 不改动
- 旧 `buildDeliveryOutput`、`buildFeedback`、`createArchiveRecord` 保留
- 前端 UI 不改动（Phase 3 范围）
- 数据库持久化不改动（不在 scope 内）
- Python 节点不改动（Phase 1 已对齐）

## 执行顺序

Step 1-2（schema 层）→ Step 3（落盘）→ Step 4-5（delivery/feedback）→ Step 6-8（local-bff）→ Step 9（archive）→ Step 10（测试）
