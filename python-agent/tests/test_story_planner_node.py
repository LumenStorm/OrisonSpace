import importlib.util
from pathlib import Path


def _load_story_planner_run():
    node_file = Path(__file__).resolve().parents[1] / "nodes" / "story_planner_agent.py"
    spec = importlib.util.spec_from_file_location("story_planner_agent", node_file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run


def test_story_planner_node_returns_story_plan_artifact():
    run = _load_story_planner_run()
    payload = run({
        "node_id": "story-planner-agent",
        "config": {"agent": {"model": "mock-model"}},
        "prompt": {"system": "system", "user": "requirement: {{requirement}}"},
        "input": {"requirement": "Write a dark opening."},
    })

    assert payload["state_key"] == "planning.storyPlan"
    assert "summary" in payload["artifact"]
