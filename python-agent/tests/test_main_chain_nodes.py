import importlib.util
from pathlib import Path

import pytest


def _load_node_run(node_name: str):
    node_file = Path(__file__).resolve().parents[1] / "nodes" / f"{node_name}.py"
    spec = importlib.util.spec_from_file_location(node_name, node_file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run


@pytest.mark.parametrize(
    ("node_name", "expected_state_key"),
    [
        ("intake_agent", "intake.requirement"),
        ("asset_loader_agent", "assets.projectContext"),
        ("chapter_task_agent", "planning.chapterTasks"),
        ("draft_writer_agent", "draft.initial"),
        ("continuity_memory_agent", "memory.continuity"),
        ("multi_review_agent", "review.latest"),
        ("targeted_revision_agent", "draft.revision"),
    ],
)
def test_python_main_chain_nodes_return_structured_artifacts(node_name: str, expected_state_key: str):
    run = _load_node_run(node_name)

    payload = run({
        "node_id": node_name.replace("_", "-"),
        "config": {"agent": {"model": "mock-model"}},
        "prompt": {"system": "system", "user": "requirement: {{requirement}}"},
        "input": {"requirement": "Write a dark opening.", "artifacts": {}, "reviewMode": "pass"},
    })

    assert payload["state_key"] == expected_state_key
    assert payload["artifact"]
