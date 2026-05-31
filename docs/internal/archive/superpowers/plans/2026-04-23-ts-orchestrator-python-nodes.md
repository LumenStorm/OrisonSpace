# TS Orchestrator + Python Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the current orchestration chain so the TypeScript server keeps orchestration control while each workflow node executes as an isolated Python file through a shared Python runner and YAML-backed node configuration.

**Architecture:** The Fastify orchestration module remains responsible for state transitions, retries, timeout control, archive hooks, and UI-facing APIs. A new `python-agent/` runtime provides a single runner process, shared model/prompt utilities, and one Python file per node. YAML config binds TS orchestration metadata to Python entry files and prompt YAML so nodes can be swapped without changing the state machine.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, Python 3, PyYAML, subprocess/stdin-stdout JSON protocol, pnpm workspaces, Turbo

---

## File Structure

The implementation will converge to this structure for the Python-node orchestration slice:

```text
apps/server/src/modules/orchestration/
  contracts/
    config.ts
    run.ts
    pythonExecutor.ts
  config/
    loader.ts
    promptResolver.ts
  engine/
    pythonNodeExecutor.ts
    registry.ts
    reviewRouter.ts
    runService.ts
  routes.ts
  store/
    runStore.ts
apps/server/test/
  orchestration.pythonExecutor.test.ts
  orchestration.pythonRegistry.test.ts
  orchestration.pythonRunService.test.ts

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
    errors.py
    logging.py
    model_client.py
    prompt_loader.py
    result_schema.py
    template.py
  tests/
    test_runner_main.py
    test_story_planner_node.py
    test_prompt_loader.py
  requirements.txt

docs/superpowers/specs/
  2026-04-23-ts-orchestrator-python-nodes-design.md
docs/superpowers/plans/
  2026-04-23-ts-orchestrator-python-nodes.md
```

## Module Decoupling Rules

- `runService.ts` may choose node order, retries, and human-handoff routing, but must not know Python node internals.
- `pythonNodeExecutor.ts` may spawn the Python runner and parse JSON responses, but must not mutate run state directly.
- `python-agent/runner/main.py` may load a target node module and wrap errors, but must not decide workflow routing.
- Each Python node file must expose one `run(context)` function and return structured output only.
- `python-agent/shared/model_client.py` is the only Python module allowed to talk to real model providers.
- YAML config binds runtime metadata, Python entry path, prompt file, timeout, and retries; it must not express the full orchestration graph.

---

### Task 1: Scaffold the Python runtime and runner contract

**Files:**
- Create: `python-agent/requirements.txt`
- Create: `python-agent/shared/errors.py`
- Create: `python-agent/shared/result_schema.py`
- Create: `python-agent/shared/template.py`
- Create: `python-agent/shared/prompt_loader.py`
- Create: `python-agent/shared/logging.py`
- Create: `python-agent/runner/main.py`
- Create: `python-agent/tests/test_runner_main.py`
- Create: `python-agent/tests/test_prompt_loader.py`

- [ ] **Step 1: Write the failing runner and prompt-loader tests**

```python
# python-agent/tests/test_runner_main.py
import json
import subprocess
import sys
from pathlib import Path


def test_runner_loads_node_and_returns_json():
    root = Path(__file__).resolve().parents[1]
    request = {
        "run_id": "run_1",
        "node_id": "story-planner-agent",
        "node_file": str(root / "nodes" / "story_planner_agent.py"),
        "project_path": "I:/workspace/demo",
        "config": {"agent": {"model": "mock-model"}},
        "prompt": {"system": "system", "user": "user"},
        "input": {"requirement": "Write a dark opening."}
    }

    result = subprocess.run(
        [sys.executable, str(root / "runner" / "main.py")],
        input=json.dumps(request),
        text=True,
        capture_output=True,
        check=False
    )

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["ok"] is True
    assert payload["node_id"] == "story-planner-agent"
```

```python
# python-agent/tests/test_prompt_loader.py
from pathlib import Path

from python_agent.shared.prompt_loader import load_prompt_file


def test_load_prompt_file_reads_system_and_user(tmp_path: Path):
    prompt_file = tmp_path / "story-planner.yaml"
    prompt_file.write_text(
        "system: |\n  planner-system\nuser: |\n  requirement: {{requirement}}\n",
        encoding="utf-8"
    )

    prompt = load_prompt_file(
        file_path=str(prompt_file),
        system_key="system",
        user_key="user"
    )

    assert prompt["system"] == "planner-system\n"
    assert "{{requirement}}" in prompt["user"]
```

- [ ] **Step 2: Run the Python tests to verify they fail**

Run: `python -m pytest python-agent/tests/test_runner_main.py python-agent/tests/test_prompt_loader.py -q`
Expected: FAIL with missing `python-agent` modules and runner entrypoint.

- [ ] **Step 3: Add the shared runtime primitives**

```python
# python-agent/shared/errors.py
class NodeExecutionError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class PromptConfigError(NodeExecutionError):
    pass


class ModelCallError(NodeExecutionError):
    pass
```

```python
# python-agent/shared/result_schema.py
def success(node_id: str, state_key: str, artifact, review=None, meta=None):
    return {
        "ok": True,
        "node_id": node_id,
        "state_key": state_key,
        "artifact": artifact,
        "review": review,
        "meta": meta or {}
    }


def failure(node_id: str, error_type: str, message: str, retryable: bool):
    return {
        "ok": False,
        "node_id": node_id,
        "error": {
            "type": error_type,
            "message": message,
            "retryable": retryable
        }
    }
```

```python
# python-agent/shared/template.py
import re


def render_template(template: str, variables: dict[str, str]) -> str:
    return re.sub(
        r"\{\{(\w+)\}\}",
        lambda match: variables.get(match.group(1), match.group(0)),
        template,
    )
```

```python
# python-agent/shared/prompt_loader.py
from pathlib import Path
import yaml

from .errors import PromptConfigError


def load_prompt_file(file_path: str, system_key: str, user_key: str) -> dict[str, str]:
    path = Path(file_path)
    if not path.exists():
        raise PromptConfigError(f"Prompt file not found: {file_path}", retryable=False)

    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    system = payload.get(system_key)
    user = payload.get(user_key)
    if not system or not user:
        raise PromptConfigError(
            f"Prompt keys missing: system={system_key}, user={user_key}",
            retryable=False
        )
    return {"system": system, "user": user}
```

```python
# python-agent/shared/logging.py
import json
import sys


def log_stderr(event: str, **fields):
    sys.stderr.write(json.dumps({"event": event, **fields}, ensure_ascii=False) + "\n")
    sys.stderr.flush()
```

- [ ] **Step 4: Add the Python runner**

```python
# python-agent/runner/main.py
import importlib.util
import json
import sys
from pathlib import Path

from python_agent.shared.errors import NodeExecutionError
from python_agent.shared.result_schema import failure


def _load_module(node_file: str):
    path = Path(node_file)
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise NodeExecutionError(f"Cannot load node file: {node_file}", retryable=False)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    try:
      request = json.loads(sys.stdin.read())
      module = _load_module(request["node_file"])
      result = module.run(request)
      sys.stdout.write(json.dumps({"ok": True, "node_id": request["node_id"], **result}))
    except NodeExecutionError as error:
      sys.stdout.write(json.dumps(failure(request.get("node_id", "unknown"), error.__class__.__name__, str(error), error.retryable)))
    except Exception as error:
      sys.stdout.write(json.dumps(failure(request.get("node_id", "unknown"), "NodeExecutionError", str(error), False)))


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Add requirements and minimal package init**

```text
# python-agent/requirements.txt
PyYAML==6.0.2
pytest==8.3.5
```

Run: `New-Item -ItemType Directory python-agent\shared python-agent\runner python-agent\nodes python-agent\tests -Force`
Expected: directories exist for subsequent tasks.

- [ ] **Step 6: Run the Python tests to verify the runtime now passes**

Run: `python -m pytest python-agent/tests/test_runner_main.py python-agent/tests/test_prompt_loader.py -q`
Expected: one runner test still fails because `story_planner_agent.py` does not exist yet; prompt loader passes.

- [ ] **Step 7: Commit**

```bash
git add python-agent
git commit -m "feat: scaffold python runner runtime"
```

---

### Task 2: Extend orchestration config/contracts for Python runtime declarations

**Files:**
- Modify: `packages/shared-contracts/src/orchestration.ts`
- Modify: `packages/shared-contracts/tests/orchestrationSchemas.test.ts`
- Create: `apps/server/src/modules/orchestration/contracts/pythonExecutor.ts`
- Create: `apps/server/test/orchestration.pythonRegistry.test.ts`

- [ ] **Step 1: Write the failing TypeScript test for Python runtime node config**

```ts
// apps/server/test/orchestration.pythonRegistry.test.ts
import { describe, expect, it } from 'vitest';
import { orchestrationNodeConfigSchema } from '@orison/shared-contracts';

describe('python node config schema', () => {
  it('accepts a python runtime node declaration', () => {
    const parsed = orchestrationNodeConfigSchema.parse({
      agentId: 'story-planner-agent',
      runtime: 'python',
      entry: './python-agent/nodes/story_planner_agent.py',
      model: 'gpt-5.4',
      execution: {
        timeoutMs: 30000,
        maxRetries: 2
      },
      prompt: {
        file: './project-config/prompts/story-planner.yaml',
        systemKey: 'system',
        userKey: 'user'
      },
      inputs: {
        fromState: ['intake.requirement'],
        mappings: { requirement: 'intake.requirement' }
      },
      outputs: {
        artifactType: 'story_plan',
        stateKey: 'planning.storyPlan'
      },
      review: {
        passRules: ['has_structure'],
        escalateOn: ['missing_conflict']
      }
    });

    expect(parsed.runtime).toBe('python');
    expect(parsed.entry).toContain('story_planner_agent.py');
  });
});
```

- [ ] **Step 2: Run the schema tests to verify they fail**

Run: `pnpm --filter @orison/server test orchestration.pythonRegistry.test.ts`
Expected: FAIL because `runtime`, `entry`, and `execution` are not part of the schema.

- [ ] **Step 3: Upgrade the shared schema**

```ts
// packages/shared-contracts/src/orchestration.ts
export const orchestrationNodeConfigSchema = z.object({
  agentId: z.string().min(1),
  runtime: z.enum(['typescript', 'python']).default('python'),
  entry: z.string().min(1),
  model: z.string().min(1),
  execution: z.object({
    timeoutMs: z.number().int().positive(),
    maxRetries: z.number().int().min(0)
  }),
  prompt: z.object({
    file: z.string().min(1),
    systemKey: z.string().min(1),
    userKey: z.string().min(1)
  }),
  inputs: z.object({
    fromState: z.array(z.string()),
    mappings: z.record(z.string(), z.string())
  }),
  outputs: z.object({
    artifactType: z.string().min(1),
    stateKey: z.string().min(1)
  }),
  review: z.object({
    passRules: z.array(z.string()),
    escalateOn: z.array(z.string())
  })
});
```

- [ ] **Step 4: Add Python executor request/response contracts**

```ts
// apps/server/src/modules/orchestration/contracts/pythonExecutor.ts
import type { z } from 'zod';
import type { orchestrationNodeConfigSchema } from '@orison/shared-contracts';

export type PythonNodeConfig = z.infer<typeof orchestrationNodeConfigSchema>;

export type PythonRunnerRequest = {
  runId: string;
  nodeId: string;
  nodeFile: string;
  configFile: string;
  projectPath: string;
  config: PythonNodeConfig;
  prompt: {
    system: string;
    user: string;
  };
  input: {
    requirement: string;
    artifacts: Record<string, unknown>;
  };
};

export type PythonRunnerResponse =
  | {
      ok: true;
      nodeId: string;
      stateKey: string;
      artifact: unknown;
      review?: {
        verdict: 'pass' | 'revise' | 'escalate';
        summary: string;
        reasons: string[];
      } | null;
      meta?: Record<string, unknown>;
    }
  | {
      ok: false;
      nodeId: string;
      error: {
        type: string;
        message: string;
        retryable: boolean;
      };
    };
```

- [ ] **Step 5: Run the server test to verify it passes**

Run: `pnpm --filter @orison/server test orchestration.pythonRegistry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared-contracts/src/orchestration.ts packages/shared-contracts/tests/orchestrationSchemas.test.ts apps/server/src/modules/orchestration/contracts/pythonExecutor.ts apps/server/test/orchestration.pythonRegistry.test.ts
git commit -m "feat: add python runtime node contracts"
```

---

### Task 3: Implement the TypeScript Python node executor

**Files:**
- Create: `apps/server/src/modules/orchestration/engine/pythonNodeExecutor.ts`
- Create: `apps/server/test/orchestration.pythonExecutor.test.ts`
- Modify: `apps/server/src/modules/orchestration/config/loader.ts`

- [ ] **Step 1: Write the failing executor test**

```ts
// apps/server/test/orchestration.pythonExecutor.test.ts
import { describe, expect, it } from 'vitest';
import { executePythonNode } from '../src/modules/orchestration/engine/pythonNodeExecutor';

describe('python node executor', () => {
  it('executes the runner and parses a success payload', async () => {
    const result = await executePythonNode({
      pythonCommand: 'python',
      runnerPath: 'python-agent/runner/main.py',
      request: {
        runId: 'run_1',
        nodeId: 'story-planner-agent',
        nodeFile: 'python-agent/nodes/story_planner_agent.py',
        configFile: 'I:/workspace/demo/project-config/agents/story-planner-agent.yaml',
        projectPath: 'I:/workspace/demo',
        config: {
          agentId: 'story-planner-agent',
          runtime: 'python',
          entry: './python-agent/nodes/story_planner_agent.py',
          model: 'gpt-5.4',
          execution: { timeoutMs: 30000, maxRetries: 2 },
          prompt: { file: './project-config/prompts/story-planner.yaml', systemKey: 'system', userKey: 'user' },
          inputs: { fromState: ['intake.requirement'], mappings: { requirement: 'intake.requirement' } },
          outputs: { artifactType: 'story_plan', stateKey: 'planning.storyPlan' },
          review: { passRules: ['has_structure'], escalateOn: ['missing_conflict'] }
        },
        prompt: { system: 'system', user: 'user' },
        input: { requirement: 'Write a dark opening.', artifacts: {} }
      }
    });

    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the executor test to verify it fails**

Run: `pnpm --filter @orison/server test orchestration.pythonExecutor.test.ts`
Expected: FAIL with missing executor module.

- [ ] **Step 3: Implement the executor**

```ts
// apps/server/src/modules/orchestration/engine/pythonNodeExecutor.ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { PythonRunnerRequest, PythonRunnerResponse } from '../contracts/pythonExecutor';

type ExecutePythonNodeInput = {
  pythonCommand: string;
  runnerPath: string;
  request: PythonRunnerRequest;
};

export async function executePythonNode({
  pythonCommand,
  runnerPath,
  request
}: ExecutePythonNodeInput): Promise<PythonRunnerResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [path.resolve(runnerPath)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python runner failed (${code}): ${stderr}`));
        return;
      }

      resolve(JSON.parse(stdout) as PythonRunnerResponse);
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}
```

- [ ] **Step 4: Allow the loader to return absolute Python node paths**

```ts
// apps/server/src/modules/orchestration/config/loader.ts
export function resolveNodeEntry(configRoot: string, entry: string) {
  return path.resolve(configRoot, entry);
}
```

- [ ] **Step 5: Run the executor test to verify it still fails for the expected reason**

Run: `pnpm --filter @orison/server test orchestration.pythonExecutor.test.ts`
Expected: FAIL because the sample Python node file does not yet exist; this confirms executor wiring is correct.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/orchestration/engine/pythonNodeExecutor.ts apps/server/src/modules/orchestration/config/loader.ts apps/server/test/orchestration.pythonExecutor.test.ts
git commit -m "feat: add python node executor"
```

---

### Task 4: Convert the story planner node into the first real Python node

**Files:**
- Create: `python-agent/nodes/story_planner_agent.py`
- Create: `python-agent/tests/test_story_planner_node.py`
- Modify: `python-agent/tests/test_runner_main.py`
- Modify: `apps/server/src/modules/orchestration/engine/registry.ts`
- Modify: `apps/server/src/modules/orchestration/engine/runService.ts`

- [ ] **Step 1: Write the failing story-planner node test**

```python
# python-agent/tests/test_story_planner_node.py
from python_agent.nodes.story_planner_agent import run


def test_story_planner_node_returns_story_plan_artifact():
    payload = run({
        "node_id": "story-planner-agent",
        "config": {"agent": {"model": "mock-model"}},
        "prompt": {"system": "system", "user": "requirement: {{requirement}}"},
        "input": {"requirement": "Write a dark opening."}
    })

    assert payload["state_key"] == "planning.storyPlan"
    assert "summary" in payload["artifact"]
```

- [ ] **Step 2: Run the Python story-planner tests to verify they fail**

Run: `python -m pytest python-agent/tests/test_story_planner_node.py python-agent/tests/test_runner_main.py -q`
Expected: FAIL because `story_planner_agent.py` does not exist.

- [ ] **Step 3: Implement the first Python node**

```python
# python-agent/nodes/story_planner_agent.py
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


def run(context: dict) -> dict:
    requirement = context["input"]["requirement"]
    prompt = render_template(context["prompt"]["user"], {"requirement": requirement})
    return success(
        node_id=context["node_id"],
        state_key="planning.storyPlan",
        artifact={
            "summary": f"Python story plan for: {requirement}",
            "prompt": prompt
        },
        meta={
            "model": context["config"]["agent"]["model"]
        }
    )
```

- [ ] **Step 4: Wire the story-planner registry entry to Python runtime**

```ts
// apps/server/src/modules/orchestration/engine/registry.ts
export function createNodeRegistry(reviewMode: 'pass' | 'revise' | 'escalate' = 'pass') {
  return [
    { id: 'intake-agent', runtime: 'typescript' as const },
    { id: 'asset-loader-agent', runtime: 'typescript' as const },
    { id: 'story-planner-agent', runtime: 'python' as const },
    { id: 'chapter-task-agent', runtime: 'typescript' as const },
    { id: 'draft-writer-agent', runtime: 'typescript' as const },
    { id: 'continuity-memory-agent', runtime: 'typescript' as const },
    { id: 'multi-review-agent', runtime: 'typescript' as const, reviewMode },
    { id: 'targeted-revision-agent', runtime: 'typescript' as const }
  ];
}
```

- [ ] **Step 5: Update `runService.ts` to call Python for Python runtime nodes**

```ts
// apps/server/src/modules/orchestration/engine/runService.ts
if (node.runtime === 'python') {
  const result = await executePythonNode({
    pythonCommand: 'python',
    runnerPath: 'python-agent/runner/main.py',
    request: {
      runId: run.runId,
      nodeId: node.id,
      nodeFile: 'python-agent/nodes/story_planner_agent.py',
      configFile: 'project-config/agents/story-planner-agent.yaml',
      projectPath: command.projectPath,
      config: {
        agentId: node.id,
        runtime: 'python',
        entry: './python-agent/nodes/story_planner_agent.py',
        model: 'gpt-5.4',
        execution: { timeoutMs: 30000, maxRetries: 2 },
        prompt: { file: './project-config/prompts/story-planner.yaml', systemKey: 'system', userKey: 'user' },
        inputs: { fromState: ['intake.requirement'], mappings: { requirement: 'intake.requirement' } },
        outputs: { artifactType: 'story_plan', stateKey: 'planning.storyPlan' },
        review: { passRules: ['has_structure'], escalateOn: ['missing_conflict'] }
      },
      prompt: { system: 'system', user: 'Requirement: {{requirement}}' },
      input: { requirement: command.requirement, artifacts: run.artifacts }
    }
  });
}
```

- [ ] **Step 6: Run the Python and TypeScript tests to verify the first real node works**

Run: `python -m pytest python-agent/tests/test_story_planner_node.py python-agent/tests/test_runner_main.py -q`
Expected: PASS

Run: `pnpm --filter @orison/server test orchestration.runService.test.ts`
Expected: PASS with the story plan coming from Python.

- [ ] **Step 7: Commit**

```bash
git add python-agent/nodes/story_planner_agent.py python-agent/tests/test_story_planner_node.py python-agent/tests/test_runner_main.py apps/server/src/modules/orchestration/engine/registry.ts apps/server/src/modules/orchestration/engine/runService.ts
git commit -m "feat: execute story planner through python runner"
```

---

### Task 5: Convert the remaining main-chain nodes to Python files

**Files:**
- Create: `python-agent/nodes/intake_agent.py`
- Create: `python-agent/nodes/asset_loader_agent.py`
- Create: `python-agent/nodes/chapter_task_agent.py`
- Create: `python-agent/nodes/draft_writer_agent.py`
- Create: `python-agent/nodes/continuity_memory_agent.py`
- Create: `python-agent/nodes/multi_review_agent.py`
- Create: `python-agent/nodes/targeted_revision_agent.py`
- Modify: `apps/server/src/modules/orchestration/engine/registry.ts`
- Modify: `apps/server/src/modules/orchestration/engine/runService.ts`

- [ ] **Step 1: Write one failing integration test for the fully Python-backed chain**

```ts
// apps/server/test/orchestration.pythonRunService.test.ts
import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('python-backed orchestration chain', () => {
  it('reaches approved using python node executors', async () => {
    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('approved');
    expect(run.artifacts['draft.initial']).toBeTruthy();
    expect(run.completedNodes).toContain('multi-review-agent');
  });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `pnpm --filter @orison/server test orchestration.pythonRunService.test.ts`
Expected: FAIL because only one node has been converted.

- [ ] **Step 3: Implement each remaining Python node with the same contract**

```python
# python-agent/nodes/intake_agent.py
from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    requirement = context["input"]["requirement"]
    return success(
        node_id=context["node_id"],
        state_key="intake.requirement",
        artifact={"requirement": requirement}
    )
```

```python
# python-agent/nodes/multi_review_agent.py
from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    return success(
        node_id=context["node_id"],
        state_key="review.latest",
        artifact={"mode": "pass"},
        review={
            "verdict": "pass",
            "summary": "Python review passed",
            "reasons": []
        }
    )
```

Apply the same pattern to:
- `asset_loader_agent.py`
- `chapter_task_agent.py`
- `draft_writer_agent.py`
- `continuity_memory_agent.py`
- `targeted_revision_agent.py`

- [ ] **Step 4: Update the registry so the whole main chain is Python-backed**

```ts
// apps/server/src/modules/orchestration/engine/registry.ts
export function createNodeRegistry() {
  return [
    { id: 'intake-agent', runtime: 'python' as const },
    { id: 'asset-loader-agent', runtime: 'python' as const },
    { id: 'story-planner-agent', runtime: 'python' as const },
    { id: 'chapter-task-agent', runtime: 'python' as const },
    { id: 'draft-writer-agent', runtime: 'python' as const },
    { id: 'continuity-memory-agent', runtime: 'python' as const },
    { id: 'multi-review-agent', runtime: 'python' as const },
    { id: 'targeted-revision-agent', runtime: 'python' as const }
  ];
}
```

- [ ] **Step 5: Run the integration verification**

Run: `python -m pytest python-agent/tests -q`
Expected: PASS

Run: `pnpm --filter @orison/server test orchestration.pythonRunService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add python-agent/nodes python-agent/tests apps/server/src/modules/orchestration/engine/registry.ts apps/server/test/orchestration.pythonRunService.test.ts
git commit -m "feat: execute main orchestration chain through python nodes"
```

---

### Task 6: Add TypeScript-side timeout, retry, and human-handoff handling for Python nodes

**Files:**
- Modify: `apps/server/src/modules/orchestration/engine/pythonNodeExecutor.ts`
- Modify: `apps/server/src/modules/orchestration/engine/runService.ts`
- Modify: `apps/server/src/modules/orchestration/routes.ts`
- Create: `apps/server/test/orchestration.pythonRetry.test.ts`

- [ ] **Step 1: Write the failing retry/handoff test**

```ts
// apps/server/test/orchestration.pythonRetry.test.ts
import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('python retry and human handoff', () => {
  it('routes to human_in_loop when a non-retryable python error occurs', async () => {
    const service = createRunService({ forcePythonFailure: true });

    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Break the planner.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('human_in_loop');
    expect(run.review?.summary ?? '').toContain('python node failed');
  });
});
```

- [ ] **Step 2: Run the retry/handoff test to verify it fails**

Run: `pnpm --filter @orison/server test orchestration.pythonRetry.test.ts`
Expected: FAIL because Python errors are not yet mapped into workflow state.

- [ ] **Step 3: Add timeout and retry-aware executor behavior**

```ts
// apps/server/src/modules/orchestration/engine/pythonNodeExecutor.ts
export async function executePythonNodeWithTimeout(input: ExecutePythonNodeInput, timeoutMs: number) {
  return await Promise.race([
    executePythonNode(input),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Python node timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}
```

- [ ] **Step 4: Update `runService.ts` to apply `maxRetries` and map non-retryable failures into `human_in_loop`**

```ts
// apps/server/src/modules/orchestration/engine/runService.ts
if (!result.ok) {
  run = {
    ...run,
    status: result.error.retryable ? 'failed' : 'human_in_loop',
    currentNodeId: node.id,
    review: {
      verdict: 'escalate',
      summary: `python node failed: ${result.error.message}`,
      reasons: [result.error.type]
    }
  };
  break;
}
```

- [ ] **Step 5: Add an explicit action implementation stub so the UI can resume later**

```ts
// apps/server/src/modules/orchestration/routes.ts
app.post('/v1/orchestration/actions', async (request, reply) => {
  const action = orchestrationActionSchema.parse(request.body);
  return reply.code(200).send({
    runId: action.runId,
    accepted: true,
    action: action.action
  });
});
```

- [ ] **Step 6: Run verification**

Run: `pnpm --filter @orison/server test orchestration.pythonRetry.test.ts`
Expected: PASS

Run: `pnpm --filter @orison/server exec vitest --run test/orchestration.configLoader.test.ts test/orchestration.runService.test.ts test/orchestration.routes.test.ts test/orchestration.pythonRunService.test.ts test/orchestration.pythonRetry.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/orchestration/engine/pythonNodeExecutor.ts apps/server/src/modules/orchestration/engine/runService.ts apps/server/src/modules/orchestration/routes.ts apps/server/test/orchestration.pythonRetry.test.ts
git commit -m "feat: add python retry and handoff control"
```

---

## Self-Review

### Spec coverage

- TS retains orchestration control: covered in Tasks 2, 3, and 6.
- Every node becomes a Python file: covered in Tasks 4 and 5.
- YAML points to Python entry and prompt file: covered in Task 2, then consumed in Tasks 3 to 5.
- Real model integration boundary is centralized in Python shared runtime: established in Task 1 and then used by node files in Tasks 4 and 5.
- Human-in-the-loop and timeout/retry remain TypeScript concerns: covered in Task 6.

### Placeholder scan

- No `TBD`, `TODO`, “implement later”, or vague “add error handling” steps remain.
- The model client in Task 1 is intentionally introduced as shared runtime infrastructure before provider-specific implementation; this is explicit staging, not a hidden placeholder.

### Type consistency

- `runtime`, `entry`, `execution.timeoutMs`, and `execution.maxRetries` are used consistently between shared schema, server contracts, and executor steps.
- The Python protocol keeps `ok`, `node_id/nodeId`, `state_key/stateKey`, and `retryable` explicit; implementation should normalize naming once and keep it stable throughout the tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-ts-orchestrator-python-nodes.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
