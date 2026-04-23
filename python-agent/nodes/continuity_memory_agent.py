from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "continuity-memory-agent"),
        state_key="memory.continuity",
        artifact={"rules": ["keep python tone consistent"]},
    )
