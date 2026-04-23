import importlib.util
from pathlib import Path
from unittest.mock import patch


def _load_story_planner_module():
    node_file = Path(__file__).resolve().parents[1] / "nodes" / "story_planner_agent.py"
    spec = importlib.util.spec_from_file_location("story_planner_agent", node_file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_story_planner_node_calls_model_client_and_returns_story_plan():
    module = _load_story_planner_module()

    with patch.object(module, "generate_structured") as mock_generate:
        mock_generate.return_value = {
            "title": "Cold City",
            "premise": "A detective returns.",
            "tone": "noir",
            "acts": [],
            "characters": [],
        }

        payload = module.run({
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
