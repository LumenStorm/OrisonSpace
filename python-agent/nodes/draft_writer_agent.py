from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "draft-writer-agent"),
        state_key="draft.initial",
        artifact={"text": "Python initial draft output."},
    )
