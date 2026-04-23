# TS Orchestrator + Python Nodes Design

## Goal

在保留现有 TypeScript/Fastify 编排器、桌面端 `local-bff`、以及现有前端的前提下，将多 agent 工作流中的每个节点执行器改造成独立 Python 文件，并通过统一 Python runner 接入真实大模型调用。

该设计的目标不是替换现有 orchestration 骨架，而是在现有首版主链上，把“节点是 TypeScript mock 实现”升级成“节点是 Python 执行单元，TS 负责流程编排”。

## Scope

本设计覆盖以下内容：

1. TypeScript 编排器与 Python 节点执行器的边界
2. Python runner 的职责与进程协议
3. Python 节点目录结构与统一接口
4. 节点 YAML 配置如何同时指向 Python 文件和 prompt YAML
5. TS 调度 Python 进程时的超时、重试、错误包装、人工接管策略
6. 真实大模型调用层在 Python 侧的抽象方式

本设计不覆盖以下内容：

1. 完整前端可视化节点图重做
2. 多供应商模型路由矩阵
3. 云端分布式调度
4. 全流程持久化数据库设计
5. 剧本专项化业务规则

## Core Decision

采用以下架构：

- **TS 保留编排权**：状态机、节点路由、人工接管、归档、前端接口都继续留在 TypeScript
- **Python 执行节点**：每个节点是独立 `.py` 文件
- **统一 Python runner**：TS 不直接调用每个节点文件，而是统一调用一个 Python runner，由 runner 装载目标节点脚本
- **YAML 外置节点声明**：每个节点的运行时类型、Python 入口、prompt 文件、模型参数、超时和重试策略都由 YAML 提供

不采用“TS 直接逐个 spawn 每个 `.py` 节点且无 runner 层”的方案，因为那会把协议、错误包装、日志格式和模型初始化分散到每次调用中，后续难以演进。

不采用“整个编排器迁移到 Python”的方案，因为当前桌面端、服务端 API、前端状态流、`local-bff` 都已经建立在 TypeScript 上，整体迁移会造成不必要的架构撕裂。

## Architecture Overview

### 1. TypeScript Orchestration Layer

继续保留在：

- `apps/server/src/modules/orchestration/`

职责：

- 状态机推进
- 节点选择与执行时机控制
- 超时与重试控制
- 人工接管路由
- artifact 写入
- 归档与前端通信

TS 不直接实现节点业务逻辑，也不直接拼接 prompt 文本。

### 2. Python Runtime Layer

新增独立运行时根目录：

- `python-agent/`

建议结构：

```text
python-agent/
  runner/
    main.py
  nodes/
    intake_agent.py
    asset_loader_agent.py
    story_planner_agent.py
    chapter_task_agent.py
    draft_writer_agent.py
    continuity_memory_agent.py
    multi_review_agent.py
    targeted_revision_agent.py
  shared/
    prompt_loader.py
    template.py
    model_client.py
    result_schema.py
    errors.py
    logging.py
  prompts/
```

### 3. YAML Config Layer

节点配置继续外置，保留“默认配置 + 项目级覆写”的解析策略。

建议项目级目录：

- `project-config/agents/*.yaml`
- `project-config/prompts/*.yaml`

## TypeScript to Python Execution Flow

完整调用链如下：

1. TS 状态机决定当前要执行的节点
2. TS 读取节点 YAML 配置
3. TS 校验该节点配置中的 `runtime`、`entry`、`prompt.file`
4. TS 通过统一 `pythonNodeExecutor` 启动 Python runner
5. TS 通过 stdin 传入标准 JSON 请求
6. Python runner 解析请求并装载目标节点文件
7. Python 节点调用 shared runtime 完成 prompt 装配与真实大模型调用
8. Python runner 输出标准 JSON 结果到 stdout
9. TS 解析结果并推进状态机

TS 只关心：

- 这个节点是否成功
- 返回了什么 artifact
- 是否需要 review 路由
- 是否需要重试或进入人工接管

Python 只关心：

- 输入上下文
- 节点业务生成逻辑
- 结构化输出

## Python Runner Responsibilities

统一入口：

- `python-agent/runner/main.py`

职责仅限于：

1. 从 stdin 读取 JSON 请求
2. 校验请求基础结构
3. 根据 `node_file` 动态装载目标 Python 模块
4. 调用目标模块暴露的 `run(context)` 函数
5. 捕获异常并包装成统一错误 JSON
6. 将标准化结果写到 stdout

runner 不应该：

- 自己决定节点路由
- 自己决定是否重试
- 自己写本地项目文件
- 自己决定人工接管

这些都必须回到 TS 编排器处理。

## Python Node Contract

每个节点文件都应暴露统一函数：

```python
def run(context: dict) -> dict:
    ...
```

`context` 至少包含：

- `run_id`
- `node_id`
- `project_path`
- `config`
- `input`
- `prompt`

节点返回结构：

```json
{
  "state_key": "planning.storyPlan",
  "artifact": {
    "summary": "..."
  },
  "review": null,
  "meta": {
    "node": "story-planner-agent",
    "model": "gpt-5.4",
    "prompt_file": "..."
  }
}
```

约束：

- 节点不得直接修改流程状态
- 节点不得直接写 TS store
- 节点必须只返回结构化结果
- 节点内部如需失败，抛出受控异常或返回受控错误结构，由 runner 统一包装

## TS / Python Request-Response Protocol

### Request Shape

TS 传给 Python runner 的请求建议为：

```json
{
  "run_id": "run_123",
  "node_id": "story-planner-agent",
  "node_file": "python-agent/nodes/story_planner_agent.py",
  "config_file": "I:/workspace/demo/project-config/agents/story-planner-agent.yaml",
  "project_path": "I:/workspace/demo",
  "config": {
    "agent": {
      "id": "story-planner-agent",
      "runtime": "python",
      "entry": "./python-agent/nodes/story_planner_agent.py",
      "model": "gpt-5.4"
    }
  },
  "prompt": {
    "system": "You are ...",
    "user": "Requirement: ..."
  },
  "input": {
    "requirement": "Write a dark opening.",
    "artifacts": {
      "intake.requirement": {
        "requirement": "Write a dark opening."
      }
    }
  }
}
```

### Success Response Shape

```json
{
  "ok": true,
  "node_id": "story-planner-agent",
  "state_key": "planning.storyPlan",
  "artifact": {
    "summary": "..."
  },
  "review": null,
  "meta": {
    "model": "gpt-5.4",
    "prompt_file": "I:/workspace/demo/project-config/prompts/story-planner.yaml"
  }
}
```

### Failure Response Shape

```json
{
  "ok": false,
  "node_id": "story-planner-agent",
  "error": {
    "type": "PromptConfigError",
    "message": "Prompt keys not found",
    "retryable": false
  }
}
```

TS 编排器只消费这两类结果，避免解析 Python 内部细节。

## YAML Configuration Model

节点 YAML 应扩展为同时绑定：

1. 运行时类型
2. Python 节点文件
3. prompt 文件
4. 模型参数
5. 超时与重试策略

建议结构：

```yaml
agent:
  id: story-planner-agent
  runtime: python
  entry: ./python-agent/nodes/story_planner_agent.py
  model: gpt-5.4
  temperature: 0.7

execution:
  timeout_ms: 30000
  max_retries: 2

prompt:
  file: ./project-config/prompts/story-planner.yaml
  system_key: system
  user_key: user

inputs:
  from_state:
    - intake.requirement
    - assets.projectContext
  mappings:
    requirement: intake.requirement
    style_rules: assets.projectContext.styleGuide

outputs:
  artifact_type: story_plan
  state_key: planning.storyPlan

review:
  pass_rules:
    - has_structure
  escalate_on:
    - missing_conflict
```

关键要求：

- `runtime` 必须显式声明为 `python`
- `entry` 必须指向独立 `.py` 文件
- `prompt.file` 必须支持项目级自定义 YAML
- `execution` 必须声明超时与重试策略

## Shared Python Runtime

Python 公共能力应放入 `python-agent/shared/`，不允许复制到每个节点文件中。

### `prompt_loader.py`

职责：

- 读取 YAML prompt 文件
- 提取 `system` / `user` key
- 返回标准 prompt 对象

### `template.py`

职责：

- 执行 `{{variable}}` 模板替换
- 只支持有限模板能力，避免复杂模板逻辑污染节点

### `model_client.py`

职责：

- 统一真实大模型调用
- 封装模型名、温度、超时、重试
- 返回结构化 JSON

节点脚本应只调用类似：

```python
from shared.model_client import generate_structured
```

### `result_schema.py`

职责：

- 校验节点返回结果结构
- 防止节点返回任意 shape 导致 TS 端难以路由

### `errors.py`

职责：

- 定义 `PromptConfigError`
- 定义 `ModelCallError`
- 定义 `NodeExecutionError`
- 统一 `retryable` 属性

### `logging.py`

职责：

- 统一日志格式
- 将可观测信息输出到 stderr，不污染 stdout JSON 协议

## Timeout and Retry Strategy

超时和重试必须由 TS 编排器统一控制，而不是交给每个 Python 节点各自实现。

原因：

- 重试属于流程控制，不属于节点业务逻辑
- 如由节点自己重试，会破坏状态机的一致性
- 人工接管触发点需要 TS 统一掌控

TS 执行器应支持：

- 对整个 Python 进程做 `timeout_ms` 控制
- 对节点执行做 `max_retries` 控制
- 根据 Python 返回的 `retryable` 决定是否重试

推荐规则：

- prompt 文件缺失：`retryable = false`
- prompt key 缺失：`retryable = false`
- 模型网络超时：`retryable = true`
- 模型服务暂时失败：`retryable = true`
- 节点逻辑异常：默认 `retryable = false`

## Human-in-the-Loop Policy

人工接管仍然必须由 TS 编排器控制。

进入 `human_in_loop` 的条件：

1. Python 返回不可重试错误
2. review verdict 为 `escalate`
3. 达到 `max_retries`
4. TS 检测到关键 artifact 缺失
5. 用户从前端主动点击介入

用户动作继续沿用现有链路：

- UI 发 action
- `local-bff` 转成 orchestration action
- TS 更新 run state
- TS 再决定是否重跑某个 Python 节点

## File and Responsibility Boundaries

### TypeScript Side

- `runService.ts`
  只负责状态推进
- `pythonNodeExecutor.ts`
  只负责 Python 进程调度
- `registry.ts`
  只负责节点声明与运行时绑定
- `routes.ts`
  只负责 API 暴露

### Python Side

- `runner/main.py`
  只负责协议与节点装载
- `nodes/*.py`
  每个文件只负责一个节点
- `shared/model_client.py`
  只负责真实模型调用

### Configuration Side

- `project-config/agents/*.yaml`
  节点声明
- `project-config/prompts/*.yaml`
  提示词文本

## Error Handling

需要显式覆盖以下错误：

1. Python runner 启动失败
2. Python 节点文件不存在
3. YAML 配置缺失或非法
4. prompt YAML 缺失或 key 不存在
5. 模型调用超时
6. 模型返回格式非法
7. 节点脚本运行异常
8. stdout 非法 JSON

TS 必须把这些错误转换成统一 orchestration 失败或人工接管状态，不把底层实现泄漏给 UI。

## Testing Strategy

### TypeScript Side

需要新增：

- `pythonNodeExecutor` 单测
- TS 对 Python 成功响应的状态推进测试
- TS 对 Python 错误响应的重试/人工接管测试
- YAML 中 `runtime: python` 与 `entry` 的解析测试

### Python Side

需要新增：

- runner 协议测试
- 每个节点 `run(context)` 的单测
- prompt loader 测试
- model client 错误包装测试
- stdout/stderr 分离测试

### Integration Tests

至少覆盖：

1. TS 启动 Python runner 并收到成功 artifact
2. Python 节点返回 `review = revise`，TS 进入 revision 路由
3. Python 节点返回不可重试错误，TS 进入 `human_in_loop`
4. 项目级 YAML 覆盖默认节点 prompt 和 Python entry

## Success Criteria

- TS 编排器仍保持流程控制权
- 每个节点执行器是独立 Python 文件
- TS 通过统一 runner 调度 Python 节点
- YAML 可同时指向 Python 节点文件和自定义 prompt YAML
- 超时、重试、人工接管都由 TS 统一控制
- Python 节点可接真实大模型，不再依赖 mock 产物

## Follow-Up

该设计批准后，下一步应生成新的 implementation plan，按以下优先级执行：

1. 引入 Python runtime 骨架与 runner
2. 引入 TS `pythonNodeExecutor`
3. 改造一个节点为真实 Python 节点打样
4. 扩展到首版主链全部节点
5. 再补人工接管动作与归档闭环
