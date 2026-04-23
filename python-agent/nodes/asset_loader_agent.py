from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "asset-loader-agent"),
        state_key="assets.projectContext",
        artifact={"styleGuide": "python-default"},
    )
