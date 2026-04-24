# OpenAI Story Planner Integration Design

## Goal

在现有 “TS 编排 + Python 节点执行” 架构上，优先打通第一个真实 OpenAI 大模型节点：

- `story-planner-agent`

该节点通过 Python 侧统一 `model_client.py` 调用 OpenAI 官方 `Responses API`，从服务端环境变量读取 `OPENAI_API_KEY`，并以严格结构化 JSON 输出直接写入：

- `planning.storyPlan`

本设计只覆盖首个真实模型节点，不扩展到整条主链的所有节点。

## Scope

本设计覆盖：

1. `OPENAI_API_KEY` 的读取方式
2. Python `model_client.py` 与 OpenAI `Responses API` 的边界
3. `story-planner-agent.py` 如何调用 `model_client.py`
4. 严格结构化 JSON 输出的 schema
5. TypeScript 如何消费第一个真实节点结果
6. 相关错误处理与测试策略

本设计不覆盖：

1. 其余 Python 节点的真实模型接入
2. OpenAI 之外的 provider
3. 用户态密钥输入界面
4. 长期密钥托管方案
5. 剧本专项 prompt 工程

## Core Decision

### 1. API 入口

首版采用 OpenAI 官方 `Responses API`，而不是 Chat Completions API。

原因：

- 更适合后续 agent 化、工具调用、结构化输出扩展
- 与未来的多节点工作流方向更一致
- 能避免后面重复改造 `model_client.py`

### 2. 密钥来源

首版只从服务端环境变量读取：

- `OPENAI_API_KEY`

不从项目 YAML、本地文件或前端输入读取。

原因：

- 最低风险
- 与当前服务端 orchestration 运行位置一致
- 避免把密钥扩散到 UI 或本地项目目录

### 3. 输出模式

`story-planner-agent` 首版使用严格结构化 JSON 输出，直接返回 `planning.storyPlan` 对象。

不采用“先生成自由文本再解析”的方式。

原因：

- 更稳
- 更容易验证
- 出错边界更清晰
- 更适合后续主链节点消费

## Architecture

### TypeScript Side

TypeScript 侧不直接调用 OpenAI，也不接触 API key。

职责：

- 启动 Python runner
- 向 Python 节点传入 prompt、input、config
- 消费结构化结果
- 推进状态机

### Python Side

新增或扩展：

- `python-agent/python_agent/shared/model_client.py`

职责：

- 从环境变量读取 `OPENAI_API_KEY`
- 调用 OpenAI `Responses API`
- 接收严格 JSON 输出
- 包装 OpenAI 相关错误

节点：

- `python-agent/nodes/story_planner_agent.py`

职责：

- 从 `context` 取 requirement 和 prompt
- 构造 story planner 的结构化输出请求
- 调用 `model_client.py`
- 返回 `planning.storyPlan`

## Environment Contract

运行时必须存在：

- `OPENAI_API_KEY`

可选扩展环境变量：

- `OPENAI_BASE_URL`
  仅用于兼容未来代理或企业网关，首版默认不必配置
- `OPENAI_MODEL_STORY_PLANNER`
  若未设置则使用默认模型名

默认模型名建议为：

- `gpt-5.4`

如果环境变量缺失：

- Python 节点返回不可重试错误
- TS 编排器进入 `human_in_loop`

## Python Model Client Responsibilities

`model_client.py` 必须统一处理：

1. 环境变量读取
2. OpenAI 请求构造
3. JSON 响应解析
4. 超时控制
5. OpenAI 错误包装

建议暴露接口：

```python
def generate_structured(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_schema: dict,
    timeout_seconds: int = 30,
) -> dict:
    ...
```

约束：

- 节点脚本不得自己直接写 HTTP 请求
- 所有 OpenAI SDK / HTTP 细节都收敛到 `model_client.py`

## Story Planner Output Schema

`story-planner-agent` 的严格输出建议如下：

```json
{
  "title": "string",
  "premise": "string",
  "tone": "string",
  "acts": [
    {
      "id": "act_1",
      "title": "string",
      "goal": "string",
      "conflict": "string",
      "turn": "string"
    }
  ],
  "characters": [
    {
      "id": "char_1",
      "name": "string",
      "role": "string",
      "goal": "string",
      "risk": "string"
    }
  ]
}
```

这个 schema 的目标不是一次到位覆盖所有创作字段，而是确保：

- 下游节点有稳定输入
- 输出能直接落到 `planning.storyPlan`
- 字段数量适中，便于模型稳定返回

## Prompt Strategy

prompt 仍从 YAML 读取，不在代码里硬编码完整提示词。

`story-planner-agent.py` 只做两件事：

1. 取出 `system` / `user`
2. 在 `user` 中注入 requirement

OpenAI 请求中：

- `system_prompt` 负责角色和输出约束
- `user_prompt` 负责输入 requirement 和任务目标

额外要求：

- system prompt 必须明确要求“仅输出符合 schema 的 JSON”
- 禁止 markdown 包裹
- 禁止附加解释文本

## TypeScript Consumption

TS `runService.ts` 不需要因为 OpenAI 接入而改变协议，只需要继续消费 Python runner 的标准成功结构：

```json
{
  "ok": true,
  "node_id": "story-planner-agent",
  "state_key": "planning.storyPlan",
  "artifact": { ... }
}
```

因此本次设计不会改变 TS/Python runner 协议，只改变 Python 节点内部的“artifact 生成方式”。

## Error Handling

必须显式处理以下错误：

1. `OPENAI_API_KEY` 缺失
   - 不可重试
   - 返回 `ConfigurationError`

2. OpenAI 网络失败
   - 可重试
   - 返回 `ModelCallError`

3. OpenAI 超时
   - 可重试
   - 返回 `ModelCallError`

4. OpenAI 返回非 JSON 或 JSON 不符合 schema
   - 首版默认不可重试一次以上
   - 返回 `ModelOutputError`

5. 节点 prompt 缺失
   - 不可重试
   - 返回 `PromptConfigError`

这些错误都必须由 Python runner 包装后交给 TS，再由 TS 决定：

- 重试
- `failed`
- `human_in_loop`

## Testing Strategy

### Python Side

需要新增：

1. `model_client.py` 环境变量测试
2. `model_client.py` 成功解析结构化输出测试
3. `story_planner_agent.py` 调用 `model_client.generate_structured()` 的测试
4. 缺失 `OPENAI_API_KEY` 的失败测试

### TypeScript Side

需要新增：

1. `story-planner-agent` 通过真实 Python node 路径返回结构化 `planning.storyPlan`
2. Python 返回 OpenAI 配置错误时，TS 进入 `human_in_loop`

### Verification Boundary

首版验收不要求线上真实 API key 一定可用，但必须满足：

- 本地无 key 时失败路径正确
- mock OpenAI 成功响应时结构化输出路径正确
- TS 对成功和失败两类结果都能正确推进状态机

如果用户后续提供真实 `OPENAI_API_KEY`，再单独执行一次集成验证。

## Success Criteria

- `story-planner-agent` 成为第一个真实 OpenAI 节点
- OpenAI 调用细节只存在于 `model_client.py`
- `OPENAI_API_KEY` 仅从服务端环境变量读取
- Python 节点输出严格结构化 JSON
- TS 无需理解 OpenAI 细节即可消费结果
- 缺失 key / OpenAI 失败 / 非法 JSON 都能进入受控错误路径

## Follow-Up

该设计批准后，下一步 implementation plan 建议按以下顺序：

1. 新增 `model_client.py` 与测试
2. 改造 `story_planner_agent.py` 接入真实 OpenAI
3. 新增 TS 失败路径测试
4. 完成一次无 key 和 mock key 的双路径验证
5. 再考虑将同一接入模式复制到 `chapter-task-agent` 和 `draft-writer-agent`
