# 目录 Skill 工作流运行时设计规格

> 状态：Draft
> 日期：2026-05-18

## 一、目标

把 `apps/agent` 当前的 skill 体系，从“目录 skill = prompt 包装器”升级为“目录 skill = 可执行工作流包”。

目标行为要接近 Claude Code、Codex、OpenCode 这类产品中的文件夹 skill / skill pack：

- 运行时能够读取 `SKILL.md`
- 能够按需加载 `references/`
- 能够受控执行 `scripts/`
- 能够识别并执行 skill 内部的子 skill 调用
- 能够在流程中暂停、确认、恢复、续跑
- 能够把目录 skill 的自然语言工作流，落到 runtime 内部的结构化执行图

这个能力不是小说特化能力，而是 creative agent 平台底座能力。小说、拆剧本、改编、审稿、调研，都应该以 skill pack 的方式挂在这套底座之上。

## 二、当前问题

当前 `apps/agent` 已经具备：

- session / continuation / restore 基础设施
- project + external skill root 发现
- 目录型 skill 与 manifest skill 的基础加载
- prompt skill 的真实模型执行
- 少量 adapter 兼容（如 `oh-story` 的有限白名单）

但当前 skill runtime 的抽象层级不对。

### 2.1 当前 skill 还是“被动文本”

现在的目录 skill 读取逻辑，本质上只是：

1. 读取 `SKILL.md`
2. 收集 `references/` 和 `scripts/` 路径
3. 把 `SKILL.md` 内容当作 prompt 丢给模型

这意味着 runtime 不会：

- 自动判断该读哪个 reference
- 自动判断什么时候调用哪个子 skill
- 自动执行 scripts
- 自动响应 `AskUserQuestion`
- 自动处理 `Agent(...)`
- 自动维护 skill 的阶段推进状态

### 2.2 当前工作流执行器是静态的

当前 `workflowExecutor` 只支持有限的手工 step：

- `prompt`
- `tool`
- `skill`
- `checkpoint`
- `confirm`

这适合 manifest skill 或手写 workflow，不适合运行像 `oh-story` 这种主要通过 `SKILL.md + references/ + scripts/` 描述的目录 skill。

### 2.3 当前 adapter 方案不可扩展

`ohStoryAdapter` 当前只是在白名单 skill 上做 prompt 包装和关键词路由。

这能解决“先有限跑通”，但不能解决“自动实现文件夹 skill 内部工作流流转”。

如果继续沿这个方向补 adapter，会出现：

- 每个 skill pack 都要单独写兼容层
- 兼容逻辑散落在 adapter 里
- runtime 永远学不会“如何运行目录 skill”
- 新 skill pack 无法零改动接入

## 三、设计原则

### 3.1 Skill 运行时必须理解“流程”，而不只是“提示词”

`SKILL.md` 不是普通 prompt 文件，而是工作流说明书。

runtime 必须能从中提取：

- 阶段
- 条件分支
- reference 依赖
- script 依赖
- 子 skill 调用
- 用户确认点
- artifact 读写点
- checkpoint / continuation 边界

### 3.2 目录 skill 与 manifest skill 最终必须统一

目录 skill 是兼容入口，不是长期特殊分支。

最终运行时要把：

- `SKILL.md + references/ + scripts/`
- `skill.json` / manifest

都编译成统一的内部执行模型。

### 3.3 runtime 只提供 primitive，不写死小说语义

runtime 不应该硬编码“章纲”“黄金三章”“伏笔”“番茄平台”等概念。

runtime 只提供执行 primitive，例如：

- `load_reference`
- `run_script`
- `delegate_skill`
- `ask_user`
- `spawn_agent`
- `read_artifact`
- `write_artifact`
- `checkpoint`
- `resume`

小说、拆剧本、审稿只是这些 primitive 的不同组合。

### 3.4 执行必须可暂停、可恢复、可审计

目录 skill 多为长流程 creative work，运行时必须保存：

- 当前阶段
- 已执行 primitive
- 已加载 reference
- 已产出 artifact
- 已发起的 confirmation
- 已完成的 subagent / child skill

否则 continuation 只有“摘要恢复”，没有真正的 workflow 恢复。

## 四、目标架构

建议新增两层，而不是继续给现有 prompt skill 体系打补丁。

### 4.1 Skill Compiler

输入：

- `SKILL.md`
- `references/`
- `scripts/`
- manifest（如果存在）

输出：

- 统一内部 `CompiledSkill`
- 结构化 `ExecutionPlan`

Skill Compiler 的职责：

- frontmatter 解析
- 多段描述抽取
- 阶段识别
- reference 链接抽取
- script 链接抽取
- `Skill("...")` 调用点识别
- `AskUserQuestion` 调用点识别
- `Agent(subagent_type: "...")` 调用点识别
- “按需加载 reference”规则抽取
- “阶段切换条件”抽取

### 4.2 Skill Runtime VM

Skill Runtime VM 负责执行 `ExecutionPlan`。

它不是通用编程语言解释器，而是受限 workflow 虚拟机。

职责：

- 执行 primitive
- 管理运行状态
- 管理 checkpoint
- 管理 continuation / restore
- 管理用户确认
- 管理嵌套 skill
- 管理 subagent 结果回填
- 管理 script 输出和 artifact 绑定

## 五、核心内部模型

### 5.1 CompiledSkill

建议字段：

- `id`
- `name`
- `source`
  - `directory`
  - `manifest`
- `entryPath`
- `location`
- `description`
- `rawPrompt`
- `references`
- `scripts`
- `capabilities`
- `hostCompatibility`
- `compiledPlan`

### 5.2 ExecutionPlan

建议字段：

- `entryNodeId`
- `nodes`
- `resumePolicy`
- `checkpointPolicy`
- `failurePolicy`
- `confirmationPolicy`

### 5.3 ExecutionNode

建议支持以下节点：

- `instruction`
  - 执行一段结构化 prompt 指令
- `load_reference`
  - 读取某个 reference 文件并注入上下文
- `run_script`
  - 执行受控脚本
- `delegate_skill`
  - 调用另一个 skill
- `ask_user`
  - 向宿主请求用户确认或补充输入
- `spawn_agent`
  - 分派子 agent
- `read_artifact`
  - 读取 artifact
- `write_artifact`
  - 写入 artifact
- `checkpoint`
  - 创建 continuation snapshot
- `branch`
  - 条件分支
- `finish`
  - 正常完成

## 六、目录 Skill 编译策略

### 6.1 第一阶段不做完整自然语言理解编译

不建议一上来追求“任意 SKILL.md 自动无损编译”。

第一阶段采用“半结构化编译”：

- 保留 `SKILL.md` 原文作为 instruction source
- 用规则抽取高价值 primitive
- 对无法结构化的部分保留为 instruction node

这样可以先落地 80% 的工作流能力，而不是卡死在完美 DSL 上。

### 6.2 第一阶段优先抽取的模式

应优先识别这些模式：

1. `Skill("skill-name")`
2. `AskUserQuestion`
3. `Agent(subagent_type: "...", prompt: "...")`
4. `加载 [references/xxx.md](...)`
5. `运行 scripts/xxx.js`
6. `写入 某路径 / 某 artifact`
7. `如果 ... 则 ... 否则 ...`
8. `Phase N`

### 6.3 references 的处理

不是一次性把整个 `references/` 全部塞进上下文，而是：

- 编译阶段记录可用 reference 图谱
- 执行阶段按节点声明按需加载
- 支持同一 run 内缓存已读 reference 摘要

### 6.4 scripts 的处理

script 必须走受控执行，不允许由模型自由拼命令。

需要：

- skill 目录内脚本白名单
- 参数 schema
- 执行超时
- stdout / stderr 捕获
- artifact 化结果
- 权限确认

## 七、运行时 Primitive 设计

### 7.1 `load_reference`

输入：

- reference path
- load mode
  - full
  - excerpt
  - summary

输出：

- normalized reference payload

### 7.2 `delegate_skill`

输入：

- target skill name
- input
- artifact bindings

输出：

- child skill result

### 7.3 `run_script`

输入：

- script path
- args
- timeout

输出：

- exit code
- stdout
- stderr
- structured artifact result

### 7.4 `ask_user`

输入：

- question
- context
- choices

输出：

- pending confirmation state
- user answer after resume

### 7.5 `spawn_agent`

输入：

- role / subagent_type
- narrowed context
- prompt

输出：

- child session id
- result summary
- produced artifacts

## 八、状态机与恢复模型

### 8.1 Skill Run State

每次 skill run 至少要保存：

- `runId`
- `sessionId`
- `skillName`
- `planVersion`
- `currentNodeId`
- `completedNodeIds`
- `loadedReferences`
- `artifactsWritten`
- `pendingUserAction`
- `childRuns`

### 8.2 continuation 必须下沉到节点级

现在的 continuation 更像“会话压缩快照”。

升级后需要：

- conversation summary
- workflow state snapshot
- node pointer
- pending branch condition
- pending ask_user
- loaded references cache

这样 restore 才是真正恢复 workflow，而不只是恢复聊天上下文。

## 九、与 `oh-story` 的兼容策略

### 9.1 不再依赖白名单 adapter 作为长期方案

`ohStoryAdapter` 可以保留作过渡层，但长期应退化为：

- 特殊 metadata 修正
- 少量路由补丁

而不是主要执行路径。

### 9.2 第一批优先支持的能力

为了尽快让 `oh-story` 真正能跑内部流程，第一批优先支持：

- `story`
- `story-long-write`
- `story-short-write`
- `story-long-analyze`
- `story-short-analyze`
- `story-deslop`
- `story-review`
- `story-setup`

这里最关键的是：

- `story` 需要自动 `delegate_skill`
- `story-long-write` / `story-short-write` 需要自动 `load_reference`
- `story-review` 需要 `spawn_agent`
- `story-setup` 需要 `ask_user + template/reference write`

### 9.3 暂缓项

第一阶段不强求：

- browser-cdp 全链路
- scan 类 scraper 自动跑通
- 所有模板系统完整迁移
- 所有外部 agent profile 一次性对齐

## 十、目标目录演进

建议新增这些文件：

```text
apps/agent/src/skill/runtime/
  compiler.ts
  compilerRules.ts
  compilerTypes.ts
  executionPlan.ts
  directoryWorkflowAdapter.ts
  referenceResolver.ts
  scriptRunner.ts
  primitiveExecutor.ts

apps/agent/src/runtime/
  skillRunState.ts
  skillContinuation.ts
  confirmation.ts
  nestedSkill.ts
  childAgent.ts
```

现有文件的角色调整：

- `directoryAdapter.ts`
  - 从“目录 skill 直接转 prompt skill”
  - 升级为“目录 skill 原始载入器”
- `workflowExecutor.ts`
  - 从“静态 step 执行器”
  - 升级为“ExecutionPlan VM 执行器”
- `ohStoryAdapter.ts`
  - 从“主要兼容执行入口”
  - 退化为“过渡期兼容补丁层”

## 十一、风险

### 11.1 过度追求通用 DSL

如果一开始就做完整 DSL，会极大拖慢落地。

规避：

- 第一阶段只做半结构化编译
- 先支持高频 primitive

### 11.2 继续把复杂性压进 adapter

如果继续沿 adapter 堆逻辑，最终无法形成通用 skill runtime。

规避：

- 把新能力收敛到 compiler + VM
- adapter 只做 source-format 兼容

### 11.3 reference 全量注入导致上下文爆炸

规避：

- reference 按需加载
- 缓存摘要
- 支持 excerpt / summary 模式

### 11.4 script 执行带来安全问题

规避：

- skill 内脚本白名单
- 参数校验
- timeout
- 权限确认
- 限定工作目录

## 十二、成功标准

这一轮升级完成后，应满足：

1. 目录 skill 不再只是 prompt 包装器
2. runtime 能自动执行目录 skill 内部的 reference / script / subskill 流程
3. `AskUserQuestion` 能落到宿主确认流
4. `Agent(...)` / 子 agent 能落到受控 child session
5. continuation restore 能恢复到 skill workflow 节点，而不只是恢复聊天摘要
6. `oh-story` 这类 skill pack 不需要每个 skill 单独写白名单 adapter 才能运行

## 十三、推荐交付阶段

### Phase A：Compiler 骨架

- 新增 `CompiledSkill` / `ExecutionPlan`
- 目录 skill 原始载入器与规则抽取器

### Phase B：VM Primitive 执行

- `load_reference`
- `delegate_skill`
- `run_script`
- `ask_user`

### Phase C：状态机与恢复

- 节点级 run state
- continuation / restore
- nested skill / child session

### Phase D：`oh-story` 实战兼容

- `story`
- `story-long-write`
- `story-short-write`
- `story-review`
- `story-setup`

这时才可以宣称“目录 skill 工作流自动流转”基本可用。
