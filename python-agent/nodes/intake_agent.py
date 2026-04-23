from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    requirement = context["input"]["requirement"]
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "intake-agent"),
        state_key="intake.requirement",
        artifact={"requirement": requirement},
    )
