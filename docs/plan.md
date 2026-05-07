# 开发日志

## 一、小说迁移主线回顾

### Phase 0

- 建立迁移执行计划
- 梳理 feature inventory
- 建立基线测试

### Phase 1

- 增加小说相关共享契约
- 引入章节运行、story-sync、memory 提取相关 schema

### Phase 2

- 本地章节仓库与 memory 仓库落地
- `project.yaml` / `chapters/*.md` / `story-memory.yaml` 可以本地持久化

### Phase 3

- 原生章节流水线接入 Agent
- TS + Python 混合节点链路跑通

### Phase 4

- story-sync 与 memory extractor 接入
- 候选补丁、记忆条目开始闭环

### Phase 5

- Novel Workbench 落地到桌面端
- 章节列表、候选审核、memory panel 等主界面能力上线

### Phase 6

- Auto Mode 多章节自动推进落地
- 支持启动、暂停、恢复、取消

### Phase 7

- 完成 parity audit
- 完成 cutover 准备

## 二、后续架构收敛记录

### 1. 桌面模型库

- 模型配置从单一旧结构演进为：
  - `~/.orison/model/index.yaml`
  - `~/.orison/model/profiles/*.yaml`
- 支持 profile 下多模型条目
- 槽位改为 `{ profileId, modelId }`

### 2. 图片生成链路

- 结果先落到项目 `temp/images/generation/`
- 生成页读取 `temp/images/generation/` 中已有图片
- 支持本地图片编辑：可选颜色画笔、画圈、遮罩、裁切
- 用户确认后移动到 `assets/images/`
- 生成图片可转成 asset card 写入创作字段

### 3. IPC 安全与路径校验

- `pathGuard.ts` 统一约束路径边界
- 允许用户显式选择的项目目录进入当前会话允许列表
- 项目相对路径写入仍阻止越界

## 三、2026-05-07 前后的关键变化

### 1. 服务端 generation route 移除

旧的：

- `POST /v1/generation/:provider/text`
- `POST /v1/generation/:provider/image`

当前已经移除。

替代方式：

- renderer -> desktop IPC
- desktop main -> `@orison/model-protocols`
- desktop main 直接请求 provider

### 2. Story Sync 抬到桌面主进程

- 桌面端先执行 story-sync LLM 提取
- 编排 run body 携带 `chapter.llmPatches`
- agent 二次校验补丁，失败则走规则回退

### 3. 启动鉴权调整

当前行为：

- 启动时先执行 session bootstrap
- 使用 `GET /v1/auth/me`
- 过期 token 自动退出
- 最新 user 会回写本地 store

### 4. 模型设置页交互整理

当前 UI 已整理出明确状态：

- 无 profile：空状态
- 新建中：编辑器
- 编辑已有项：编辑器
- 有 profile 但未选择：占位提示

## 四、当前已验证

最近明确跑过：

- `pnpm --filter @orison/desktop-ui test -- authSessionExpiry.test.tsx`
- `pnpm --filter @orison/desktop-ui test -- modelSettingsPage.test.tsx`
- `pnpm --filter @orison/desktop-ui typecheck`
- `pnpm --filter @orison/server test -- auth.test.ts`

## 五、当前仍建议持续维护的事项

### 1. 文档同步

每次涉及以下变化时都要同步：

- server API
- desktop IPC
- 启动鉴权流程
- 模型配置 schema
- 设置页交互

### 2. 历史文档清理

仓库中仍有一部分更早的历史文档、spec、中文日志存在乱码或旧描述，需要继续分批修整。

### 3. UI 命名与文案

模型设置页底层仍是 profile 概念，但 UI 文案可以继续优化，减少“模型”和“配置”混用带来的歧义。
