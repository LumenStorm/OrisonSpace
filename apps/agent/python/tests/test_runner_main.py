import json
import os
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
        "input": {"requirement": "Write a dark opening."},
    }

    result = subprocess.run(
        [sys.executable, str(root / "runner" / "main.py")],
        input=json.dumps(request),
        text=True,
        capture_output=True,
        check=False,
        env={
            **os.environ,
            "OPENAI_API_KEY": "test-key",
            "OPENAI_RESPONSES_MOCK_JSON": json.dumps({
                "title": "Cold City",
                "premise": "A detective returns.",
                "tone": "noir",
                "acts": [],
                "characters": [],
            }),
        },
    )

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["ok"] is True
    assert payload["node_id"] == "story-planner-agent"
    assert payload["state_key"] == "planning.storyPlan"
