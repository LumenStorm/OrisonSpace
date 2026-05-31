# Orison Space Platform And MVP Spec

**Date:** 2026-04-22

## 1. Purpose

本 spec 用于统一 Orison Space 的平台架构、产品边界、仓库结构和 MVP 实现方向。

Orison Space 是一款基于桌面工作台的 AI 影视创作产品，定位为：

> AI 驱动的影视创作 IDE（Director Workspace）

其核心工作方式不是“人工主导，AI 辅助”，而是：

> **AI 主导生成，人工负责 review、编辑、反馈与定向修正**

因此系统的核心不是单纯编辑器，而是围绕 AI 结果展开的审阅、接受、拒绝、局部修改和再生成闭环。

---

## 2. Product Principles

### 2.1 Core Product Thesis

- AI 负责初次生成与大部分扩展工作
- 人工负责审阅、筛选、修订和反馈
- 所有核心产物都必须可编辑、可追溯、可回滚
- 创作过程是渐进式构建，不要求一步生成完整项目

### 2.2 Architecture Principles

- 项目正文的权威端在 Client，本地优先
- Remote Server 负责账号、任务承接、短期缓存、审计和业务规则
- Agent 后续作为独立模块接入，不在当前 MVP 中实现
- 当前 MVP 必须做到 GUI 与 Server 解耦，避免未来 Agent 接入时大改桌面端

### 2.3 Production Engineering Principles

- 性能和安全属于一等需求，不是上线前补丁
- 设计优先考虑真实项目规模、长任务、弱网和异常恢复
- 默认采用最小权限、最小暴露面和最小数据上传原则
- 跨进程、跨网络和跨包通信都必须通过显式 contract 和 schema 校验
- Client 与 Server 的错误、任务和关键链路必须可观测、可审计、可恢复

---

## 3. System Boundaries

### 3.1 Desktop Client

桌面端是用户的主要工作环境，负责：

- 登录后的桌面工作台
- 本地项目创建、打开、保存、导入、导出
- 项目树、编辑器、Inspector、任务和 review 面板
- 本地草稿状态、交互状态和已接受结果的落盘
- 选择性提交任务上下文到远端

桌面端不负责：

- 直接对接模型供应商
- 长时 AI 任务执行
- 托管账号与权限真相数据

### 3.2 Remote Server

远端服务是桌面端的唯一远程业务入口，负责：

- 登录、鉴权、授权和额度控制
- 项目能力校验和任务接入
- 保存任务元数据、状态、错误、审计记录
- 短期缓存任务上下文和结果
- 为桌面端提供统一 API 与任务状态通道

远端服务不负责：

- 作为完整项目正文的长期托管端
- 托管用户全部原始素材和本地项目真相

### 3.3 Future Agent

Agent 后续作为与 Server 平行协作的独立 AI 生产模块接入，负责：

- 接收标准化任务
- 返回结构化 patch、候选版本或评估结果
- 不直接暴露给桌面端

当前 MVP 中：

- 不实现独立 Agent 应用
- 仅保留可替换的 mock adapter 和稳定 contract

---

## 4. Data Ownership

### 4.1 Local Authoritative Data

以下数据以桌面端本地为权威：

- 项目结构
- Story / Script / Storyboard / Video 正文
- 资产索引与本地引用关系
- 本地编辑结果
- review 后被接受的正式版本

### 4.2 Remote Data

以下数据以远端服务为主：

- 用户账号
- 会话与登录状态
- 权限与额度
- 任务记录
- 任务状态
- 短期上下文缓存
- 短期结果缓存
- 审计信息与故障排查信息

### 4.3 Update Strategy

系统采用 Partial Update 作为基础修改策略：

- 未提供字段保持原值
- 允许局部 patch
- 允许 AI 只返回局部修改建议
- review 通过后才将 patch 合并进本地权威数据

---

## 5. Core Workflow

MVP 核心工作流为：

1. 用户在桌面端创建或打开本地项目
2. 用户选择模块或具体内容片段
3. 用户发起 AI 任务，或由系统从当前上下文推导任务
4. 桌面端只提取本次任务所需上下文并发送到 Server
5. Server 校验权限、额度并创建任务
6. 当前阶段由 Server 内部 mock adapter 执行任务
7. Server 返回结构化结果、候选项或 patch
8. 桌面端展示结果、差异和建议
9. 用户 review，并执行接受、拒绝、局部编辑或再次反馈
10. 接受后的结果写回本地项目

review 是一级能力，至少包含：

- Accept
- Reject
- Edit Before Accept
- Ask AI To Revise
- Compare Variants

---

## 6. UI Structure

整体采用三栏 IDE 工作台，并吸收 `developAsset` 中已明确的视觉方向。

### 6.1 Top Bar

包含：

- New / Open / Save / Export
- Undo / Redo
- Task Status
- Settings / Help / Account

### 6.2 Left Panel

Project Tree 覆盖：

- Story
- Script
- Storyboard
- Video
- Assets
- Meta

### 6.3 Center Panel

主要标签：

- Story
- Script
- Storyboard
- Video

### 6.4 Right Panel

Inspector + AI Review 面板根据上下文动态变化：

- 选中 Story 时展示节奏、风格、主题等控制项
- 选中 Script 时展示角色、情绪、对话调节
- 选中 Storyboard 时展示镜头参数、时长、风格
- 无选中时展示 Task Feed / AI Assistant

---

## 7. Visual Design Direction

界面风格采用 `The Literary Sanctuary` 设计系统。

关键约束：

- 避免典型 SaaS Dashboard 的硬边框与硬网格
- 使用 warm neutrals、cool charcoals 和 tonal layering
- 以内容区作为“paper on desk”核心画布
- 主内容阅读区强调高品质排版
- 左右面板通过色阶而非硬边界区分

---

## 8. Recommended Repository Structure

当前仓库建议整理为：

```text
OrisonSpace/
├─ apps/
│  ├─ desktop/
│  │  ├─ shell/
│  │  │  ├─ main/
│  │  │  ├─ preload/
│  │  │  └─ resources/
│  │  ├─ ui/
│  │  │  ├─ src/
│  │  │  │  ├─ app/
│  │  │  │  ├─ pages/
│  │  │  │  ├─ features/
│  │  │  │  ├─ widgets/
│  │  │  │  ├─ shared/
│  │  │  │  └─ processes/
│  │  │  └─ public/
│  │  └─ local-bff/
│  │     ├─ api/
│  │     ├─ ipc/
│  │     ├─ sync/
│  │     └─ index.ts
│  └─ server/
│     ├─ src/
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ user/
│     │  │  ├─ project/
│     │  │  ├─ asset/
│     │  │  ├─ task/
│     │  │  ├─ review/
│     │  │  ├─ quota/
│     │  │  └─ audit/
│     │  ├─ common/
│     │  ├─ infra/
│     │  └─ app.ts
│     └─ test/
├─ packages/
│  ├─ shared-contracts/
│  ├─ shared-utils/
│  ├─ ui-kit/
│  └─ eslint-config/
├─ docs/
│  ├─ architecture/
│  ├─ api/
│  ├─ ipc/
│  └─ deployment/
├─ scripts/
├─ .github/
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

### 8.1 Repository Design Rationale

该结构采用 `apps/ + packages/` 的 monorepo 组织方式，目的是让桌面宿主层、桌面 UI、本地适配层、远程服务和共享契约拥有稳定边界。

### 8.2 Directory Responsibilities

- `apps/desktop/shell`: Electron 主进程、preload、安全桥接、原生资源与安装配置
- `apps/desktop/ui`: React 界面层、页面结构、业务 feature、复合 widget、共享前端能力
- `apps/desktop/local-bff`: 桌面端 API 适配、IPC 封装、本地缓存与同步编排
- `apps/server`: 鉴权、项目能力承接、任务接入、review 记录、额度与审计
- `packages/shared-contracts`: 前后端共享 DTO、schema、API/IPС 合同
- `packages/shared-utils`: 纯函数工具与无运行时副作用的通用逻辑
- `packages/ui-kit`: 可复用 UI 组件、设计 token、基础交互模式
- `packages/eslint-config`: 工程规则复用

### 8.3 Decoupling Constraints

- `apps/desktop/ui` 不得直接依赖 `apps/server`
- `apps/desktop/ui` 不得直接访问 Electron `main` 能力，只能经 `preload` 和 `local-bff`
- `apps/desktop/local-bff` 是桌面端与远程/宿主能力之间的唯一编排层
- `apps/server` 不得依赖 `apps/desktop/*`
- `packages/shared-contracts` 不得依赖 `apps/*`
- `packages/shared-utils` 必须保持纯函数特性
- `packages/ui-kit` 不得耦合项目业务域
- `apps/server/src/modules` 按 Orison Space 业务域拆分，不沿用通用后台模板命名

---

## 9. Production Readiness Requirements

### 9.1 Desktop Performance

- 项目打开、模块切换和基础编辑保持流畅
- Project Tree、Storyboard 卡片区和任务列表按大数据量场景设计
- 长任务状态更新不能导致整页频繁重渲染
- 本地保存、自动保存和任务结果写回必须异步化

### 9.2 Server Performance

- API 层保持无状态或近无状态
- 长任务不阻塞同步请求线程
- 任务提交、任务查询、任务订阅和结果拉取清晰分离
- 短期缓存必须有容量控制、TTL 和逐出策略

### 9.3 Security Baseline

- 全链路 HTTPS
- 登录态安全存储与刷新机制
- 所有输入进行 schema 校验和服务端校验
- Electron 启用 `contextIsolation`
- 默认禁用 `nodeIntegration`
- Renderer 不直接接触 Node.js 能力
- IPC 通道白名单化

---

## 10. MVP Scope

### 10.1 In Scope

- 桌面壳
- 桌面 UI 工作台
- 本地项目读写
- Project Tree
- Story / Script / Storyboard 基础编辑
- Inspector 基础字段面板
- 登录能力
- 远程任务提交
- 任务状态展示
- 至少一种 AI 结果 review 流程
- mock adapter 驱动的任务闭环
- `apps/ + packages/` monorepo 重构

### 10.2 Out Of Scope

- 独立 Agent 应用实现
- 完整视频剪辑器
- 完整素材云同步
- 团队协作
- 全量离线运行
- 长期云端项目托管
- 复杂权限系统

### 10.3 MVP Success Criteria

- 用户可以登录桌面端
- 用户可以在本地创建并保存项目
- 用户可以编辑 Story / Script / Storyboard 的基础内容
- 用户可以从某个选中范围发起 AI 任务
- 用户可以看到任务进度与结果
- 用户可以对结果进行 review 并写回本地项目
- 桌面端、Server 和共享包之间的依赖方向保持稳定

---

## 11. Next Planning Unit

下一份实现计划应围绕以下四个切面展开：

1. `apps/desktop/shell`
2. `apps/desktop/ui`
3. `apps/desktop/local-bff`
4. `apps/server`

共享 contract、共享 utils 和 UI kit 作为配套支撑包同步建设。
