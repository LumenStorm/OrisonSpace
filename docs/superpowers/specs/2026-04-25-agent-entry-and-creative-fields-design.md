# Agent Entry and Creative Field Contract Design

## Goal

本设计把当前“直接启动 orchestration run”的 agent 入口，升级为面向长篇创作的统一入口契约。入口负责把用户自由需求、项目状态、字段版本和子 agent 行为约束组合成稳定上下文；子 agent 只在自己的职责边界内产出结构化结果。

本设计同时重塑项目核心数据字段，使“世设、总大纲、集纲、成长曲线、节奏曲线、情感曲线、资产卡”成为一等字段，而不是散落在 prompt 或临时 artifact 里的文本片段。

## Scope

覆盖内容：

1. Agent 入口请求、上下文构建、返回结构和错误边界。
2. 子 agent 行为契约，包括角色、输入、输出、必须做、禁止做、质量门。
3. 项目创作字段的 schema 方向与字段职责。
4. Agent pipeline 中这些字段的生产、消费和回流方式。
5. 第一阶段落地范围和验证策略。

不覆盖内容：

1. 完整前端 UI 改版。
2. 多模型供应商路由和成本策略。
3. 云端分布式队列。
4. 数据库持久化方案重写。
5. 针对单一题材的专用创作规则库。

## Current Problems

当前 agent 入口是 `POST /v1/orchestration/runs` 直接解析 `startOrchestrationRunSchema` 后进入 `runService.start()`。它缺少三个关键边界：

1. 没有统一的创作任务上下文。`requirement`、`projectPath`、`configRoot` 之外，入口不知道当前项目已有的世设、大纲、资产或曲线版本。
2. 子 agent 行为约束分散。`registry.ts` 有简短英文 prompt，Python 节点内有默认 prompt 和 JSON schema，`apps/agent/prompts/*.yaml` 又有另一份约束，难以判断谁是权威来源。
3. 数据字段过粗。`ProjectDocument` 目前有基础 `outline`、`detailed_outline`、`assets`，但没有稳定表达长篇创作常用结构，如人物成长曲线、节奏曲线、情感曲线、分集/章节集纲和资产卡。

## Core Decision

采用“完整 agent 编排协议，分阶段落地”的方案。

协议层完整定义入口、字段和子 agent 约束；第一阶段只实现最小可用闭环：

- `CreativeRunRequest` 和 `CreativeRunContext`
- 创作字段 schema
- 子 agent 契约注册表
- 关键 Python 节点输出 schema 更新
- contract 和节点级测试

暂不在第一阶段做完整 UI 编辑器，也不重写数据库持久化。这样可以先稳定 agent 产物，避免 UI 和存储层围绕不稳定字段反复返工。

## Reference Orchestration Architecture

编排架构参考 `I:\OneLine2Video-dev\v2.drawio.html`。图中的主链路是：

```text
需求接入
  -> 资产装载
  -> 故事规划
  -> 章节任务卡
  -> 正文初稿生成
  -> 连续性记忆更新
  -> 多维审核
  -> 是否通过
```

审核后的分支是：

- 通过：版本归档 -> 交付输出 -> 数据回流。
- 未通过：定向修订 -> 多维审核。
- 重大冲突：人工接管 -> 多维审核。

图中的两条虚线数据回流必须落实为正式机制：

1. `数据回流 -> 更新资产与规则 -> 资产装载`：审核、初稿和连续性记忆发现的新资产、规则、关系和冲突，必须形成结构化资产补丁，进入资产库候选区或直接上库。
2. `数据回流 -> 影响后续生成与审核 -> 多维审核`：资产、规则、世设、大纲、曲线和集纲变化后，后续生成和审核必须读取最新版本，不允许继续使用旧 artifact。

因此本设计把编排层拆成三类服务：

- `AssetLibraryService`：负责资产卡上库、去重、合并、锁定、版本和来源追踪。
- `WorkflowSyncService`：负责字段版本、依赖图、stale 标记和同步事件。
- `ReviewGate`：负责决定补丁可自动应用、需要用户确认，还是进入人工接管。

## Agent Entry Contract

新增入口语义为 `CreativeRunRequest`。它可以继续由现有 `/v1/orchestration/runs` 承载，也可以在后续新增 `/v1/agent/runs`。第一阶段推荐复用现有路由，内部转换为新上下文，降低外部 API 震荡。

### Request Shape

```ts
type CreativeRunRequest = {
  projectPath: string;
  requirement: string;
  projectDocument?: ProjectDocument;
  runIntent?: 'create' | 'expand' | 'revise' | 'review';
  targetFields?: CreativeFieldKey[];
  configRoot?: string;
  constraints?: {
    language?: 'zh-CN' | 'en-US';
    contentRating?: string;
    episodeCount?: number;
    chapterCount?: number;
    targetLength?: string;
  };
};
```

`projectDocument` 可选，是为了兼容当前只传 `projectPath` 的流程。若缺失，入口仍可运行，但需要在上下文中明确 `projectDocumentStatus: "missing"`，子 agent 不得假装读到了现有项目数据。

### Context Shape

入口将 request 归一化为 `CreativeRunContext`：

```ts
type CreativeRunContext = {
  runId: string;
  projectPath: string;
  requirement: string;
  runIntent: 'create' | 'expand' | 'revise' | 'review';
  targetFields: CreativeFieldKey[];
  projectDocument: ProjectDocument | null;
  fieldVersions: Record<CreativeFieldKey, number>;
  dependencyGraph: FieldDependencyGraph;
  staleFields: CreativeFieldKey[];
  syncEvents: WorkflowSyncEvent[];
  constraints: CreativeConstraints;
  agentPolicy: AgentPolicy;
};
```

`agentPolicy` 是所有子 agent 必须遵守的全局行为约束。

## Global Agent Policy

所有子 agent 共享以下规则：

1. 只输出符合当前节点 schema 的 JSON，不输出解释性散文。
2. 不覆盖不属于本节点职责的字段。
3. 不丢弃上游已确认事实；如果发现冲突，写入 `conflicts` 或 `review.reasons`。
4. 对缺失输入显式降级，不编造“已存在”的项目资料。
5. 保持字段可追踪，关键产物包含 `sourceRefs` 或 `dependsOn`。
6. 中文项目默认使用中文内容，字段名仍保持代码层英文 snake_case。
7. 输出必须满足项目类型：`novel` 和 `script` 可共享核心字段，但章节/场景字段分别落到对应分支。

禁止事项：

1. 子 agent 不直接修改磁盘文件。
2. 子 agent 不自行选择下一个节点。
3. 子 agent 不绕过 schema 返回 Markdown。
4. 子 agent 不把模型推理过程写入项目字段。
5. 子 agent 不把临时审稿意见混入正式设定字段。

## Creative Fields

新增或强化以下项目字段。

### `world_setting` 世设

用途：描述故事世界的稳定规则和审美基础。

建议字段：

- `premise`: 世界核心前提。
- `era`: 年代、时代或技术阶段。
- `locations`: 世界级地点，不替代资产卡中的具体场景卡。
- `rules`: 物理、魔法、科技、社会、行业规则。
- `power_structures`: 阵营、组织、阶层、权力关系。
- `taboos`: 禁忌和不可违背设定。
- `visual_language`: 视觉关键词。
- `tone_rules`: 叙事语气规则。
- `open_questions`: 仍未决定的设定问题。

### `outline` 总大纲

用途：承载故事全局结构，不再只是一组三幕卡片。

建议字段：

- `title`
- `logline`
- `theme`
- `genre`
- `central_conflict`
- `acts[]`: 每幕目标、冲突、转折、代价、结尾状态。
- `major_turning_points[]`
- `ending_direction`
- `constraints`

### `episode_outlines` 集纲

用途：分集或分章节规划。中文产品文案使用“集纲”，代码字段使用 `episode_outlines`。

建议字段：

- `id`
- `index`
- `title`
- `purpose`
- `summary`
- `core_event`
- `character_progressions[]`
- `emotional_beats[]`
- `pacing_beats[]`
- `foreshadowing[]`
- `payoffs[]`
- `hook`
- `dependsOn`
- `status`: `planned | drafted | revised | locked`

对小说项目，`episode_outlines` 可以映射到章节组或章节；对剧本项目，可以映射到集或场次组。

### `growth_curve` 成长曲线

用途：描述角色随故事推进的内在变化。

建议字段：

- `character_id`
- `start_state`
- `wound_or_lack`
- `desire`
- `need`
- `turning_points[]`
- `regressions[]`
- `end_state`
- `linked_episode_ids[]`

### `pacing_curve` 节奏曲线

用途：描述紧张度、信息密度和动作强度的分布。

建议字段：

- `unit`: `act | episode | chapter | scene`
- `points[]`: `{ refId, intensity, informationDensity, actionLevel, recoveryLevel, note }`
- `target_shape`: 例如 `rising`, `wave`, `slow_burn`, `rollercoaster`
- `risks[]`: 节奏拖沓、过密、高潮过早等。

### `emotion_curve` 情感曲线

用途：描述观众/读者情绪体验，而不是角色内心独白的简单列表。

建议字段：

- `unit`
- `points[]`: `{ refId, primaryEmotion, secondaryEmotion, valence, arousal, transition, note }`
- `emotional_promises[]`
- `catharsis_points[]`

### `asset_cards` 资产卡

用途：统一角色、地点、道具、组织、规则等可复用创作资产。

建议字段：

- `id`
- `type`: `character | location | prop | organization | rule | visual_motif | lore`
- `name`
- `summary`
- `details`
- `tags`
- `relationships[]`
- `firstAppearance`
- `sourceRefs[]`
- `status`: `draft | active | deprecated | locked`

现有 `assets.characters` 和 `assets.locations` 第一阶段可保留，但新 agent 应优先写入 `asset_cards`，再由适配层派生旧字段，保持兼容。

### `relationship_graph` 人物关系网

用途：支持用户自定义人物、可视化编辑关系网，并让 agent 在生成与审核时读取最新关系。

建议字段：

- `nodes[]`: `{ id, assetCardId, label, type, locked }`
- `edges[]`: `{ id, from, to, relationType, label, strength, polarity, visibility, sourceRefs, locked }`
- `relationType`: `family | alliance | romance | rivalry | mentor | secret | debt | organization | custom`
- `layout`: 可选的可视化坐标和分组信息。
- `version`
- `updatedBy`: `user | agent | sync`

关系网的节点必须引用 `asset_cards(type=character)` 或相关组织卡。用户编辑优先级高于 agent 建议；被 `locked` 的节点和边只能由用户修改。agent 可以提交关系建议补丁，但不能直接覆盖用户锁定关系。

### Field Metadata

所有自动生成并实时同步的核心字段都必须拥有统一元信息：

- `version`: 字段级版本号。
- `source`: `user | agent | imported | sync`。
- `locked`: 用户锁定后 agent 只能提交候选补丁。
- `dependsOn`: 当前字段依赖的上游字段和版本。
- `stale`: 上游字段变化后，当前字段是否需要重算或审核。
- `lastSyncedAt`

适用字段包括：`world_setting`、`outline`、`growth_curve`、`pacing_curve`、`emotion_curve`、`asset_cards`、`relationship_graph`、`episode_outlines`。

## Sub-Agent Contracts

每个子 agent 在注册表中必须拥有结构化契约：

```ts
type AgentContract = {
  id: string;
  role: string;
  goal: string;
  owns: CreativeFieldKey[];
  reads: CreativeFieldKey[];
  must: string[];
  mustNot: string[];
  outputSchemaName: string;
  qualityGates: string[];
};
```

### Intake Agent

- 目标：把自由需求变成创作 brief。
- 读取：无或现有项目摘要。
- 写入：`creative_brief`。
- 必须：提取题材、语气、受众、篇幅、禁忌、用户明确约束。
- 禁止：生成完整剧情。

### Asset Loader Agent

- 目标：建立初始资产卡和世设素材。
- 读取：`creative_brief`、已有 `asset_cards`、已有 `relationship_graph`、已有 `world_setting`。
- 写入：`asset_cards`、`relationship_graph` 候选补丁、`world_setting` 草案。
- 必须：区分事实设定和建议设定。
- 禁止：覆盖 locked 资产。

### World Builder Agent

第一阶段可由 Asset Loader 合并承担，第二阶段拆出。

- 目标：产出稳定 `world_setting`。
- 读取：`creative_brief`、`asset_cards`。
- 写入：`world_setting`。
- 必须：输出规则、权力结构、禁忌、开放问题。
- 禁止：把剧情梗概塞进世界规则。

### Story Planner Agent

- 目标：生成或修订 `outline`。
- 读取：`creative_brief`、`world_setting`、`asset_cards`、`relationship_graph`。
- 写入：`outline`。
- 必须：明确主题、核心冲突、主要转折。
- 禁止：直接写章节正文。

### Curve Planner Agent

第一阶段可作为 Story Planner 的后置节点，也可独立。

- 目标：产出 `growth_curve`、`pacing_curve`、`emotion_curve`。
- 读取：`outline`、`asset_cards`、`relationship_graph`、`world_setting`。
- 写入：三类曲线。
- 必须：每个曲线点引用 act、episode 或 chapter。
- 禁止：产生无法映射到结构单元的抽象建议。

### Episode Planner Agent

- 目标：生成 `episode_outlines` 集纲。
- 读取：`outline`、三类曲线、`asset_cards`、`relationship_graph`、`world_setting`。
- 写入：`episode_outlines`。
- 必须：每集包含目的、核心事件、情绪点、节奏点、伏笔、回收和钩子。
- 禁止：让集纲与总大纲转折冲突。

### Draft Writer Agent

- 目标：根据指定集纲写初稿。
- 读取：`episode_outlines`、`world_setting`、`asset_cards`、曲线。
- 写入：`draft.initial` 或对应正文文件引用。
- 必须：只写目标 episode/chapter。
- 禁止：重写全局设定。

### Continuity Memory Agent

- 目标：抽取连续性记忆。
- 读取：初稿、`asset_cards`、`relationship_graph`、`world_setting`。
- 写入：`memory.continuity`、候选资产补丁、候选关系补丁。
- 必须：区分事实更新和建议更新。
- 禁止：自动把候选补丁写入 locked 字段。

### Multi Review Agent

- 目标：审查结构、设定、曲线、集纲和正文一致性。
- 读取：所有核心字段。
- 写入：`review.latest`。
- 必须：输出 pass/revise/escalate 和维度评分。
- 禁止：直接修文。

### Targeted Revision Agent

- 目标：按审稿意见做定向修订。
- 读取：审稿意见、目标字段、相关上下文。
- 写入：目标字段补丁或 `draft.revision`。
- 必须：只改 review 指定范围。
- 禁止：无理由扩大改动范围。

## Asset Library and Sync Architecture

资产不再只是 agent run 中的临时 artifact，而是项目级资产库。资产库至少支持三类写入来源：

1. 用户手动创建或编辑。
2. agent 从需求、世设、大纲、集纲、正文和审核中自动发现。
3. 外部导入。

### Asset Auto-Ingestion

自动上库流程：

```text
agent artifact
  -> extract asset candidates
  -> normalize to asset_cards / relationship_graph patches
  -> deduplicate against existing assets
  -> classify auto-apply vs needs-review
  -> apply patch or queue candidate
  -> emit WorkflowSyncEvent
```

自动上库必须满足：

- 每张资产卡有稳定 `id`、`type`、`name`、`sourceRefs`、`status`。
- 同名不等于同资产，合并需要比较类型、关系、首次出现位置和描述相似度。
- 新发现角色、地点、组织、道具、规则、视觉母题都进入 `asset_cards`。
- 新发现人物关系进入 `relationship_graph.edges`。
- 若目标资产或关系被用户锁定，只生成候选补丁，不自动应用。

### Workflow Sync Events

所有核心字段变化后都要发出同步事件：

```ts
type WorkflowSyncEvent = {
  id: string;
  createdAt: string;
  source: 'user' | 'agent' | 'sync';
  field: CreativeFieldKey;
  entityId?: string;
  fromVersion: number;
  toVersion: number;
  reason: string;
  affectedFields: CreativeFieldKey[];
};
```

`WorkflowSyncService` 根据依赖图计算影响范围：

- `asset_cards` 或 `relationship_graph` 变化：影响 `world_setting`、`outline`、三类曲线、`episode_outlines`、审核。
- `world_setting` 变化：影响 `outline`、三类曲线、`episode_outlines`、正文生成、审核。
- `outline` 变化：影响三类曲线、`episode_outlines`、正文生成、审核。
- 任一曲线变化：影响 `episode_outlines`、正文生成、审核。
- `episode_outlines` 变化：影响正文生成、连续性记忆、审核。

受影响字段不一定立即重算。第一阶段可以先标记 `stale`，由下一次 run 或用户操作触发重算；后续阶段再支持后台自动刷新。

## Pipeline

第一阶段推荐 pipeline：

```text
intake-agent
  -> asset-loader-agent
  -> story-planner-agent
  -> curve-planner-agent
  -> episode-planner-agent
  -> draft-writer-agent
  -> continuity-memory-agent
  -> multi-review-agent
  -> targeted-revision-agent when needed
```

若实现成本需要压缩，可先合并为：

```text
intake-agent
  -> asset-loader-agent
  -> story-planner-agent
  -> episode-planner-agent
  -> multi-review-agent
```

合并方案中，`asset-loader-agent` 负责 `world_setting` 和 `asset_cards`，`story-planner-agent` 负责 `outline` 和三类曲线。

该 pipeline 必须保留 draw.io 图中的控制语义：多维审核通过才进入归档和交付；未通过进入定向修订；重大冲突进入人工接管。无论哪个分支结束，只要产生新资产、关系或规则，都进入数据回流和同步事件处理。

## Data Flow

1. 入口解析 request，构造 `CreativeRunContext`。
2. Registry 根据 `runIntent` 和 `targetFields` 选择节点。
3. 每个节点收到：
   - 当前 run 基本信息
   - 只读 project snapshot
   - 节点允许读取的字段
   - 节点专属 prompt
   - 全局 agent policy
4. 节点返回 schema 化 artifact。
5. TS 层校验 artifact，对应写入 `artifacts`。
6. delivery 阶段把 artifacts 转换为 project patch。
7. `AssetLibraryService` 从 artifacts、正文和 review 中提取资产/关系/规则候选。
8. `ReviewGate` 判断候选补丁自动应用、等待用户确认或进入人工接管。
9. `WorkflowSyncService` 应用补丁后更新字段版本、依赖图、stale 标记和同步事件。
10. feedback 阶段把审稿和连续性记忆转换为候选回流补丁。

## Real-Time Workflow Synchronization

“实时同步”在设计上表示：字段变化后，工作流状态立刻知道哪些下游字段过期、哪些节点需要重跑、审核必须读取哪个版本。它不要求第一阶段实现多人协同或 WebSocket 推送。

第一阶段同步能力：

- project patch 应用后立即更新 `fieldVersions`。
- 下游字段被标记到 `staleFields`。
- orchestration run snapshot 返回 `syncEvents`。
- UI 可以据此提示“集纲需要按新世设刷新”或“审核使用的是旧资产版本”。

第二阶段同步能力：

- local-bff 监听项目字段变化，推送到前端 store。
- 用户编辑人物关系网后，自动触发相关字段 stale 标记。
- agent run 可选择 `targetFields`，只刷新 stale 字段。

第三阶段同步能力：

- 后台自动刷新低风险字段。
- 高风险字段仍需要用户确认后应用。
- 多端协作通过字段版本解决冲突。

## Error Handling

入口错误：

- 缺少 `requirement`: 400。
- `projectDocument` 不符合 schema: 400，附字段路径。
- `targetFields` 不受支持: 400。

节点错误：

- 输入缺失但可降级：节点输出 `warnings`，继续。
- 输入缺失且不可运行：`human_in_loop`。
- 输出 schema 不合法：可重试一次，仍失败则 `human_in_loop`。
- 与 locked 字段冲突：不自动覆盖，进入 review。

## Compatibility

第一阶段不删除旧字段。

- `outline` 保留但扩展。
- `detailed_outline` 可逐步由 `episode_outlines` 替代。
- `assets.characters` 和 `assets.locations` 保留，后续可从 `asset_cards` 派生。
- 人物关系先进入 `relationship_graph`，旧 UI 若没有关系网视图，可以忽略该字段。
- 现有 `/v1/orchestration/runs` API 可继续使用，内部转换到 `CreativeRunContext`。

## Testing Strategy

必须新增或更新以下测试：

1. `packages/shared-contracts`：项目字段 schema 能 parse 完整创作文档。
2. `packages/shared-contracts`：`CreativeRunRequest` 和 `CreativeRunContext` schema。
3. `apps/agent`：registry 中每个节点都有 `AgentContract`。
4. `apps/agent`：每个节点的 `owns` 与输出 stateKey 匹配。
5. `apps/agent/python`：关键节点输出符合新 JSON schema。
6. `apps/agent`：最小 run 能产出 `world_setting`、`outline`、`episode_outlines`、`asset_cards`。
7. `apps/agent`：locked 字段冲突不会被自动覆盖。
8. `apps/agent`：资产自动上库会生成 `asset_cards` 和 `relationship_graph` 补丁。
9. `apps/agent`：资产、世设或大纲变更会生成 `WorkflowSyncEvent` 并标记下游 stale 字段。
10. `apps/agent`：审核使用的字段版本必须等于 run snapshot 中记录的版本。

## Rollout Plan

### Phase 1: Contract Foundation

- 扩展 shared contracts。
- 增加 `AgentContract` 注册结构。
- 入口构造 `CreativeRunContext`。
- 更新核心节点输出 schema。
- 增加资产自动上库候选补丁结构。
- 增加字段版本、依赖图、stale 字段和同步事件结构。
- 保持现有 UI 不变。

### Phase 2: Artifact to Project Patch

- delivery 阶段生成项目字段 patch。
- local-bff 能保存并读取新字段。
- 旧字段派生兼容。
- 保存 `asset_cards`、`relationship_graph` 和字段元信息。
- 用户编辑人物关系后能触发同步事件。

### Phase 3: UI Exposure

- 前端显示世设、资产卡、人物关系网、总大纲、集纲和曲线。
- 支持人工锁定字段。
- 支持 review 后选择性应用补丁。
- 支持可视化编辑人物关系网。

## Open Decisions Resolved

- “集钢”按“集纲”处理，代码字段为 `episode_outlines`。
- 第一阶段不做完整 UI。
- 子 agent 约束以 `AgentContract` 为权威来源，prompt 和 Python schema 必须与它一致。
- 旧字段不删除，避免破坏现有项目和测试。
- draw.io 图中的数据回流升级为 `AssetLibraryService`、`WorkflowSyncService` 和 `ReviewGate`。
- 资产自动上库先以候选补丁和字段版本同步落地，避免 agent 覆盖用户锁定内容。

## Success Criteria

1. 任何 agent run 都能说明每个子 agent 能读什么、写什么、不能做什么。
2. 新项目字段能表达世设、总大纲、集纲、成长曲线、节奏曲线、情感曲线和资产卡。
3. 子 agent 输出不再依赖散文式约定，而是由 schema 校验。
4. 第一阶段实现后，不需要前端改版也能在 artifacts 或 project patch 中看到新字段。
5. 后续 UI、持久化和更多 agent 节点可以围绕同一字段契约继续扩展。
6. 资产和人物关系可以自动进入资产库候选区，并保留来源、版本和锁定信息。
7. 世设、大纲、曲线、资产卡、关系网和集纲变化后，工作流能实时标记受影响的下游字段。
8. 多维审核始终知道自己审核的是哪些字段版本。
