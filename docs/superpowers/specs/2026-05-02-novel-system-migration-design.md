# Novel System Migration Design

## Goal

把当前 `H:\小说` 下的小说最小实现迁入 `OneLine2Video-git`，并且以 `oneline2video` 的现有架构为主干完成正式产品化整合。迁入后的小说功能不再以独立 `FastAPI + React/Vite + SQLite` 应用存在，而是成为 `shared-contracts + local-bff + agent + desktop/ui` 体系中的一等能力。

目标状态不是“能在同一仓库里共存”，而是“在 `oneline2video` 内部接近完整替代当前小说系统”，包含：

1. 小说项目读写与本地文件持久化
2. 角色、世界观、关系图、伏笔、集纲、章节的统一编辑
3. 单章生成、续写、润色、审校、接受 patch
4. Story Sync 设定回流
5. 长期记忆参与生成
6. Auto Mode 连续推进

## Scope

本设计覆盖：

1. 小说系统迁入 `oneline2video` 后的目标架构
2. 当前小说系统模块到主项目模块的映射关系
3. 哪些模块必须重写，哪些逻辑可以复用
4. 主项目需要新增的契约、同步层、agent 节点和 UI 功能
5. 一个可执行的分阶段迁移顺序

本设计不覆盖：

1. 每个 agent 节点的完整 prompt 文案
2. 详细 UI 视觉设计
3. 完整实现计划与逐文件任务拆解
4. 生产部署、云端队列或多租户问题

## Current Situation

当前有两套相关系统：

### 1. 小说最小实现

- 后端：`backend/app/*`
- 前端：`frontend/src/*`
- 数据：`SQLite + SQLAlchemy` 为主，`Chroma` 用于长期记忆
- 工作流：章节生成流水线、Story Sync、记忆抽取、Auto Mode 已经成形

这套系统的价值主要在：

1. 已经验证过的小说领域模型
2. 已经跑通的章节生成闭环
3. Story Sync 和长期记忆这两层中间能力
4. 一批真实可用的 prompt 和测试边界

### 2. OneLine2Video-git 主项目

- Monorepo：`pnpm + turbo`
- Server：`apps/server`
- Agent：`apps/agent`
- Desktop shell/UI：`apps/desktop/shell`、`apps/desktop/ui`
- 本地项目桥接：`apps/desktop/local-bff`
- 契约：`packages/shared-contracts`

主项目已经具备小说功能所需的结构骨架：

1. `project.yaml` 为核心的数据结构
2. `ProjectDocument` 中已有 `novel`、`script`、`storyboard`
3. creative fields 中已有 `world_setting`、`asset_cards`、`relationship_graph`、`foreshadow_registry`、`episode_outlines`
4. 已有任务账本、orchestration panel、task feed、patch 接受机制

因此这次迁入不是“找地方塞小说功能”，而是“把最小实现拆解后挂回主项目原生边界”。

## Core Decision

采用“领域能力重挂，运行时原生迁入，重逻辑允许短期桥接”的策略。

具体来说：

1. 最终架构必须服从 `oneline2video` 现有边界
2. 当前小说系统的 `FastAPI API`、`SQLite/SQLAlchemy`、独立 `React` 前端不保留为长期边界
3. 当前小说系统中真正保留的是领域逻辑、流程顺序、提示词经验和测试边界
4. 如果第一阶段为了降低风险，需要保留少量 Python 逻辑，可暂时挂到 `apps/agent/python`，但不能继续以独立服务形态存在

换句话说，迁入目标是“主项目原生小说功能”，不是“主项目里嵌一个小说子应用”。

## Target Architecture

迁入后的小说功能拆成五层：

### 1. `packages/shared-contracts`

职责：

1. 定义小说项目的结构契约
2. 定义小说任务、patch、Story Sync、长期记忆和 Auto Mode 的输入输出
3. 作为 `local-bff`、`agent`、`desktop/ui` 的共同边界

### 2. `apps/desktop/local-bff`

职责：

1. 统一读写 `project.yaml`
2. 统一读写章节 Markdown 文件
3. 应用 creative field patch 与章节 patch
4. 标记字段 `stale`、维护本地同步桥
5. 为桌面 UI 提供小说项目的本地桥接 API

### 3. `apps/server`

职责：

1. 用户认证
2. 项目登记
3. 任务账本
4. run 状态与审查结果

明确不承担的职责：

1. 小说正文主存储
2. 小说设定主存储
3. 长期记忆向量主存储

### 4. `apps/agent`

职责：

1. 单章生成流水线
2. 续写、润色、审校
3. Story Sync
4. 长期记忆抽取与检索
5. Auto Mode 编排

### 5. `apps/desktop/ui`

职责：

1. 小说工作台 UI
2. 章节编辑器与生成工作台
3. 设定字段与关系图编辑
4. 记忆面板
5. Auto Mode 控制台
6. patch review 与接受

核心原则：

- 小说内容以本地项目文件为主
- AI 结果以 patch 或 run artifact 形式流动
- server 只做账本，不做正文主存储

## Module Mapping

下面是当前小说系统到主项目的目标映射。

### Data Model Mapping

| 当前小说系统 | 迁入后位置 |
| --- | --- |
| `Novel` | `ProjectDocument.meta + novel` |
| `Chapter` | `novel.chapters[] + chapters/*.md` |
| `Character` | `asset_cards` 中的 `character` 类型 |
| `Relationship` | `relationship_graph` |
| `Foreshadowing` | `foreshadow_registry` |
| `WorldbookEntry` | `world_setting` |
| `StoryMemory` | 新增 `story-memory` 契约 + 本地记忆索引 |

### Runtime Mapping

| 当前小说系统 | 迁入后位置 |
| --- | --- |
| `backend/app/api/*` | `apps/server` + `apps/desktop/local-bff` + `apps/agent` |
| `chapter_pipeline.py` | `apps/agent` 的正式 orchestration chain |
| `story_sync.py` | `apps/agent` 的 story sync module，输出 patch |
| `story_memory.py` | `apps/agent` 的 memory module |
| `frontend/src/pages/*` | `apps/desktop/ui/src/features/*` |
| `frontend/src/stores/*` | 主项目现有 `zustand` store slices |

## Required Changes

以下改动是迁入时必须发生的。

### 1. 数据源从数据库切到本地项目文件

当前章节生成、Story Sync、记忆抽取都直接读取数据库模型。迁入后必须改为：

1. 从 `ProjectDocument` 读取结构化设定
2. 从 `chapters/*.md` 读取正文
3. 将章节标题、摘要、状态写回 `project.yaml`
4. 将正文 patch 写回 markdown 文件

这意味着当前 `SQLAlchemy` 查询不能保留为核心依赖。

### 2. Patch 系统从演示级扩成正式能力

当前主项目的 patch 能力过浅，只适合非常简单的字段替换。迁入小说系统后，patch 至少要支持：

1. creative field 全量覆盖或合并
2. 章节元数据 patch
3. 章节 Markdown 内容 patch
4. Story Sync 产生的设定回流 patch
5. Auto Mode 逐步提交结果

如果 patch/apply 层不先补齐，后续所有小说任务都会卡在“结果回不去本地项目”。

### 3. Field Sync 必须补齐小说字段

当前 `fieldSyncBridge` 和 `localProjectRepository` 已经支持一批 creative fields，但还不够完整。为了接小说系统，需要确保：

1. `foreshadow_registry` 进入正式同步链
2. 字段依赖图能表达小说工作流中的上下游关系
3. 用户手改设定后，agent 下游结果会正确标记 `stale`
4. 锁定字段不会被自动覆盖

### 4. 单章流水线必须 node 化

当前小说系统的单章流水线是应用内函数链。迁入后必须改成 `apps/agent` 的 node orchestration，至少包含：

1. `context-loader`
2. `chapter-bridge`
3. `draft-writer`
4. `continuity-review`
5. `targeted-revision`
6. `chapter-title`
7. `story-sync`
8. `memory-extractor`

### 5. Story Sync 必须改成 patch 输出，而不是直接写库

当前 Story Sync 是直接更新数据库记录。迁入后它应该：

1. 读取当前项目的角色、关系、设定、伏笔
2. 产出结构化 proposal
3. 产出 patch
4. 通过 review gate 决定自动应用、人工确认或人工接管

### 6. 长期记忆需要重新落位

主项目目前没有小说长期记忆的正式位置。迁入后建议：

1. 记忆条目 schema 进入 `shared-contracts`
2. 向量索引和缓存放本地项目隐藏目录或 `apps/agent` cache
3. 记忆元数据可部分写入本地项目索引，但不把全文向量主存储塞进 PostgreSQL

### 7. UI 需要从独立页面改成桌面工作台 feature

当前小说前端的页面体系不能直接搬运。迁入后 UI 应拆成：

1. `creative` 下的设定视图
2. `editor` 下的章节正文编辑
3. `novel-workbench` 的生成/审校/接受 patch 工作台
4. `memory` 面板
5. `auto-mode` 控制台
6. `orchestration/task feed` 的小说运行反馈

## Reuse Strategy

以下内容建议直接复用逻辑或经验，而不是从零重想：

1. 章节流水线的步骤顺序
2. Story Sync 的锁定规则和跳过规则
3. 长期记忆抽取的用途与输入构造方式
4. 写作配置和 prompt 组织方式
5. 现有回归测试覆盖的行为边界

以下内容建议只作为参考，不直接迁文件：

1. `backend/app/api/*`
2. `backend/app/models/*`
3. `backend/app/db/*`
4. `frontend/src/pages/*`
5. `frontend/src/services/api.ts`
6. `frontend/src/stores/*`

## Directory-Level Migration Checklist

### `packages/shared-contracts`

需要：

1. 扩展 `project.ts`
2. 扩展 `creative-fields.ts`
3. 扩展 `tasks.ts`
4. 新增 `story-memory` 契约
5. 新增 `novel-orchestration` 契约

### `apps/desktop/local-bff`

需要：

1. 扩展 `localProjectRepository.ts`
2. 扩展 `fieldSyncBridge.ts`
3. 新增 `novelProjectRepository.ts`
4. 新增 `memoryRepository.ts`
5. 新增小说任务桥接 API

### `apps/agent`

需要：

1. 将现有 stub 节点替换成真实小说节点
2. 新增章节流水线 orchestrator
3. 新增 story sync module
4. 新增 memory module
5. 新增 auto mode module
6. 必要时在 `apps/agent/python` 保留短期过渡逻辑

### `apps/desktop/ui`

需要：

1. 扩展 creative field 编辑器
2. 扩展章节编辑器
3. 新增 `novel-workbench`
4. 新增 `memory-panel`
5. 新增 `auto-mode-console`
6. 扩展 orchestration 与 task feed 的小说表现层

### `apps/server`

需要：

1. 保持 project/task/run 账本角色
2. 可能新增小说 run 类型登记和状态查询
3. 不引入正文主存储职责

## Delivery Phases

### Phase 1: 主干打通

目标：

1. 契约到位
2. 本地项目读写到位
3. patch/apply 到位
4. 小说项目在主项目中成为一等对象

### Phase 2: 单章工作流迁入

目标：

1. 单章生成闭环迁入
2. 章节工作台可用
3. patch review 可用

### Phase 3: 记忆与设定回流迁入

目标：

1. 长期记忆参与生成
2. Story Sync 正式回写 creative fields
3. 用户可见记忆和同步反馈

### Phase 4: Auto Mode 与完整替代

目标：

1. 连续编排上线
2. 暂停、继续、人工干预上线
3. 独立小说应用边界彻底退出

## Risks

### 1. Patch 能力不足导致后续连锁返工

如果先做 agent 和 UI，再补 patch/apply，后面会因为结果落地方式不稳产生大量返工。

### 2. 章节 Markdown 与项目元数据双写复杂

正文放 markdown，摘要/状态放 `project.yaml`，这要求 `local-bff` 明确谁负责一致性。

### 3. 记忆模块落位不清会导致后续边界漂移

如果把记忆错误地塞进 `apps/server` 数据库，主项目会重新走回“服务端主存储正文”的方向。

### 4. UI 一次性追平太多页面会拖慢主干落地

应该优先让章节工作流和设定回流闭环成立，再逐步补齐视图体验。

## Open Questions

虽然整体方向已确定，但后续实现计划开始前还需要明确三件事：

1. 长期记忆索引最终放在项目目录隐藏区，还是 `apps/agent` 统一缓存目录
2. 章节正文 patch 是使用文本级 patch，还是直接以“候选全文替换 + review accept”作为第一阶段策略
3. Auto Mode 的第一版是否允许部分节点仍走 `apps/agent/python` 过渡

## Recommended Next Step

下一步应基于本设计编写实现计划，按阶段拆到：

1. shared contracts
2. local-bff
3. agent nodes and pipeline
4. desktop UI features
5. testing and migration cleanup

在实现计划阶段，优先保证 `Phase 1 -> Phase 2` 的闭环先成立，再继续扩展记忆与 Auto Mode。
