from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "targeted-revision-agent"),
        state_key="draft.revision",
        artifact={"text": "Python revised draft output."},
    )
