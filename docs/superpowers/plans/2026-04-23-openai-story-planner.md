# OpenAI Story Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the first real OpenAI-powered node into the current TS orchestrator + Python nodes workflow by upgrading `story-planner-agent` to call the OpenAI `Responses API` and return strict structured JSON to `planning.storyPlan`.

**Architecture:** The TypeScript server keeps orchestration control and still launches Python nodes through the existing runner protocol. Python gains a centralized `model_client.py` that reads `OPENAI_API_KEY` from the server environment, calls OpenAI `Responses API`, validates structured output, and returns a normalized result to `story_planner_agent.py`. Only `story-planner-agent` becomes a real model-backed node in this slice; all other nodes remain unchanged.

**Tech Stack:** TypeScript, Fastify, Vitest, Python 3, pytest, OpenAI Python SDK, PyYAML, stdin/stdout JSON runner protocol

---

## File Structure

This implementation should touch the following files:

```text
python-agent/
  requirements.txt
  python_agent/
    shared/
      errors.py
      model_client.py
    nodes/
      # optional package file if needed
  nodes/
    story_planner_agent.py
  tests/
    test_model_client.py
    test_story_planner_node.py

apps/server/
  test/
    orchestration.openaiStoryPlanner.test.ts
    orchestration.openaiStoryPlannerFailure.test.ts

docs/superpowers/specs/
  2026-04-23-openai-story-planner-design.md
docs/superpowers/plans/
  2026-04-23-openai-story-planner.md
```

## Runtime Boundaries

- Only `python-agent/python_agent/shared/model_client.py` may call OpenAI directly.
- `story_planner_agent.py` may assemble prompts and schema, but must not build raw HTTP requests.
- `OPENAI_API_KEY` is read only from environment variables at runtime.
- TypeScript orchestration code must remain provider-agnostic and consume only Python runner success/failure payloads.

---

### Task 1: Add the OpenAI model client contract and dependency

**Files:**
- Modify: `python-agent/requirements.txt`
- Modify: `python-agent/python_agent/shared/errors.py`
- Create: `python-agent/python_agent/shared/model_client.py`
- Create: `python-agent/tests/test_model_client.py`

- [ ] **Step 1: Write the failing model client tests**

```python
# python-agent/tests/test_model_client.py
import os
from unittest.mock import MagicMock, patch

import pytest

from python_agent.shared.model_client import generate_structured
from python_agent.shared.errors import ConfigurationError, ModelCallError


def test_generate_structured_raises_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(ConfigurationError):
        generate_structured(
            model="gpt-5.4",
            system_prompt="system",
            user_prompt="user",
            response_schema={"type": "object"},
        )


@patch("python_agent.shared.model_client.OpenAI")
def test_generate_structured_returns_parsed_json(mock_openai, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    client = MagicMock()
    mock_openai.return_value = client
    client.responses.create.return_value.output_text = '{"title":"Cold City","premise":"A detective returns.","tone":"noir","acts":[],"characters":[]}'

    result = generate_structured(
        model="gpt-5.4",
        system_prompt="system",
        user_prompt="user",
        response_schema={"type": "object"},
    )

    assert result["title"] == "Cold City"
    client.responses.create.assert_called_once()
```

- [ ] **Step 2: Run the Python model-client tests to verify they fail**

Run: `python -m pytest python-agent/tests/test_model_client.py -q`
Expected: FAIL with missing `model_client.py` and missing `ConfigurationError`.

- [ ] **Step 3: Add the OpenAI dependency**

```text
# python-agent/requirements.txt
PyYAML==6.0.3
pytest==8.4.1
openai>=1.0.0
```

- [ ] **Step 4: Extend Python error types for configuration and output failures**

```python
# python-agent/python_agent/shared/errors.py
class NodeExecutionError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class PromptConfigError(NodeExecutionError):
    pass


class ModelCallError(NodeExecutionError):
    pass


class ConfigurationError(NodeExecutionError):
    pass


class ModelOutputError(NodeExecutionError):
    pass
```

- [ ] **Step 5: Implement the OpenAI model client**

```python
# python-agent/python_agent/shared/model_client.py
import json
import os

from openai import OpenAI

from .errors import ConfigurationError, ModelCallError, ModelOutputError


def generate_structured(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_schema: dict,
    timeout_seconds: int = 30,
) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
      raise ConfigurationError("OPENAI_API_KEY is not set", retryable=False)

    client = OpenAI(api_key=api_key)

    try:
      response = client.responses.create(
          model=model,
          input=[
              {"role": "system", "content": system_prompt},
              {"role": "user", "content": user_prompt},
          ],
          text={
              "format": {
                  "type": "json_schema",
                  "name": "story_plan",
                  "schema": response_schema,
              }
          },
          timeout=timeout_seconds,
      )
    except Exception as error:
      raise ModelCallError(f"OpenAI request failed: {error}", retryable=True) from error

    try:
      return json.loads(response.output_text)
    except Exception as error:
      raise ModelOutputError(f"OpenAI returned invalid JSON: {error}", retryable=False) from error
```

- [ ] **Step 6: Run the Python model-client tests to verify they pass**

Run: `python -m pytest python-agent/tests/test_model_client.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add python-agent/requirements.txt python-agent/python_agent/shared/errors.py python-agent/python_agent/shared/model_client.py python-agent/tests/test_model_client.py
git commit -m "feat: add openai model client for python nodes"
```

---

### Task 2: Upgrade `story_planner_agent.py` to use structured OpenAI output

**Files:**
- Modify: `python-agent/nodes/story_planner_agent.py`
- Modify: `python-agent/tests/test_story_planner_node.py`

- [ ] **Step 1: Write the failing story planner node test for structured output**

```python
# python-agent/tests/test_story_planner_node.py
from unittest.mock import patch

from python_agent.nodes.story_planner_agent import run


@patch("python_agent.nodes.story_planner_agent.generate_structured")
def test_story_planner_node_calls_model_client_and_returns_story_plan(mock_generate):
    mock_generate.return_value = {
        "title": "Cold City",
        "premise": "A detective returns.",
        "tone": "noir",
        "acts": [],
        "characters": [],
    }

    payload = run({
        "node_id": "story-planner-agent",
        "config": {"agent": {"model": "gpt-5.4"}},
        "prompt": {
            "system": "You are a planner. Return JSON only.",
            "user": "Requirement: {{requirement}}"
        },
        "input": {"requirement": "Write a dark opening."},
    })

    assert payload["state_key"] == "planning.storyPlan"
    assert payload["artifact"]["title"] == "Cold City"
    mock_generate.assert_called_once()
```

- [ ] **Step 2: Run the story planner node test to verify it fails**

Run: `python -m pytest python-agent/tests/test_story_planner_node.py -q`
Expected: FAIL because the node still returns mocked local data and does not call `generate_structured`.

- [ ] **Step 3: Implement the structured story planner node**

```python
# python-agent/nodes/story_planner_agent.py
from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template

STORY_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "premise": {"type": "string"},
        "tone": {"type": "string"},
        "acts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "goal": {"type": "string"},
                    "conflict": {"type": "string"},
                    "turn": {"type": "string"},
                },
                "required": ["id", "title", "goal", "conflict", "turn"],
                "additionalProperties": False,
            },
        },
        "characters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "goal": {"type": "string"},
                    "risk": {"type": "string"},
                },
                "required": ["id", "name", "role", "goal", "risk"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "premise", "tone", "acts", "characters"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    requirement = context["input"]["requirement"]
    prompt = render_template(context["prompt"]["user"], {"requirement": requirement})
    config = context.get("config", {})
    agent_config = config.get("agent", {})
    model = agent_config.get("model") or config.get("model") or "gpt-5.4"

    story_plan = generate_structured(
        model=model,
        system_prompt=context["prompt"]["system"],
        user_prompt=prompt,
        response_schema=STORY_PLAN_SCHEMA,
        timeout_seconds=30,
    )

    return success(
        node_id=context.get("node_id") or context.get("nodeId", "story-planner-agent"),
        state_key="planning.storyPlan",
        artifact=story_plan,
        meta={"model": model},
    )
```

- [ ] **Step 4: Run the Python story planner node tests to verify they pass**

Run: `python -m pytest python-agent/tests/test_story_planner_node.py python-agent/tests/test_runner_main.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add python-agent/nodes/story_planner_agent.py python-agent/tests/test_story_planner_node.py
git commit -m "feat: connect story planner node to openai model client"
```

---

### Task 3: Add TypeScript failure-path handling tests for missing `OPENAI_API_KEY`

**Files:**
- Create: `apps/server/test/orchestration.openaiStoryPlannerFailure.test.ts`

- [ ] **Step 1: Write the failing server test for missing API key**

```ts
// apps/server/test/orchestration.openaiStoryPlannerFailure.test.ts
import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('openai story planner failure path', () => {
  it('routes to human_in_loop when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('human_in_loop');
    expect(run.currentNodeId).toBe('story-planner-agent');
    expect(run.review?.summary ?? '').toContain('OPENAI_API_KEY');
  });
});
```

- [ ] **Step 2: Run the server failure-path test to verify it fails**

Run: `pnpm --filter @orison/server test orchestration.openaiStoryPlannerFailure.test.ts`
Expected: FAIL because the current node still does not surface a missing-key failure into this specific path.

- [ ] **Step 3: Verify the existing TS failure routing needs no logic change or patch the error summary if needed**

```ts
// apps/server/src/modules/orchestration/engine/runService.ts
// Keep the existing human_in_loop mapping for non-retryable Python failures.
// Only adjust message handling if the missing-key error is swallowed or normalized incorrectly.
```

- [ ] **Step 4: Run the server failure-path test to verify it passes**

Run: `pnpm --filter @orison/server test orchestration.openaiStoryPlannerFailure.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/test/orchestration.openaiStoryPlannerFailure.test.ts apps/server/src/modules/orchestration/engine/runService.ts
git commit -m "test: cover openai story planner failure routing"
```

---

### Task 4: Add a success-path integration test with mocked OpenAI output

**Files:**
- Create: `apps/server/test/orchestration.openaiStoryPlanner.test.ts`

- [ ] **Step 1: Write the failing success-path integration test**

```ts
// apps/server/test/orchestration.openaiStoryPlanner.test.ts
import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('openai story planner success path', () => {
  it('writes a structured story plan artifact through the python node', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('approved');
    expect(run.artifacts['planning.storyPlan']).toMatchObject({
      title: 'Cold City',
      tone: 'noir'
    });
  });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `pnpm --filter @orison/server test orchestration.openaiStoryPlanner.test.ts`
Expected: FAIL because the test still needs an OpenAI mock strategy.

- [ ] **Step 3: Add a Python-side mock hook through environment variables**

```python
# python-agent/python_agent/shared/model_client.py
mock_payload = os.getenv("OPENAI_RESPONSES_MOCK_JSON")
if mock_payload:
    return json.loads(mock_payload)
```

This must be checked before the SDK call so tests can force deterministic output without making real network requests.

- [ ] **Step 4: Update the server test to inject the mock payload**

```ts
// apps/server/test/orchestration.openaiStoryPlanner.test.ts
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_RESPONSES_MOCK_JSON = JSON.stringify({
  title: 'Cold City',
  premise: 'A detective returns.',
  tone: 'noir',
  acts: [],
  characters: []
});
```

- [ ] **Step 5: Run verification**

Run: `pnpm --filter @orison/server test orchestration.openaiStoryPlanner.test.ts`
Expected: PASS

Run: `python -m pytest python-agent/tests/test_model_client.py python-agent/tests/test_story_planner_node.py -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add python-agent/python_agent/shared/model_client.py apps/server/test/orchestration.openaiStoryPlanner.test.ts python-agent/tests/test_model_client.py python-agent/tests/test_story_planner_node.py
git commit -m "feat: add mocked openai story planner integration path"
```

---

### Task 5: Run the full non-database verification set for this OpenAI slice

**Files:**
- Modify: none unless verification exposes defects

- [ ] **Step 1: Run the Python verification suite**

Run: `python -m pytest python-agent/tests -q`
Expected: PASS

- [ ] **Step 2: Run the server orchestration verification suite for this slice**

Run: `pnpm --filter @orison/server exec vitest --run test/orchestration.configLoader.test.ts test/orchestration.pythonRegistry.test.ts test/orchestration.pythonExecutor.test.ts test/orchestration.runService.test.ts test/orchestration.pythonRunService.test.ts test/orchestration.pythonRetry.test.ts test/orchestration.openaiStoryPlanner.test.ts test/orchestration.openaiStoryPlannerFailure.test.ts`
Expected: PASS

- [ ] **Step 3: Commit any final fixes if verification found issues**

```bash
git add python-agent apps/server
git commit -m "fix: stabilize openai story planner verification"
```

---

## Self-Review

### Spec coverage

- `OPENAI_API_KEY` from environment only: covered in Tasks 1 and 3.
- Centralized OpenAI client in Python: covered in Task 1.
- `story-planner-agent` as the first real OpenAI node: covered in Task 2.
- Strict structured JSON output: covered in Task 2’s schema and mocked success path in Task 4.
- TypeScript consumption remains protocol-based: covered by Tasks 3 and 4 without changing the runner contract.

### Placeholder scan

- No `TBD`, `TODO`, or vague “add error handling later” steps remain.
- The mock OpenAI path is explicit test scaffolding and not a substitute for the real implementation.

### Type consistency

- Python returns `planning.storyPlan` consistently.
- TypeScript verifies `planning.storyPlan` in both success and failure paths.
- Error naming is consistent between Python exceptions and TS human-in-loop handling.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-openai-story-planner.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
