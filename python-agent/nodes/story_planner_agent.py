from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


def run(context: dict) -> dict:
    requirement = context["input"]["requirement"]
    prompt = render_template(context["prompt"]["user"], {"requirement": requirement})
    config = context.get("config", {})
    agent_config = config.get("agent", {})
    model = agent_config.get("model") or config.get("model") or "unknown-model"

    return success(
        node_id=context.get("node_id") or context.get("nodeId", "story-planner-agent"),
        state_key="planning.storyPlan",
        artifact={
            "summary": f"Python story plan for: {requirement}",
            "prompt": prompt
        },
        meta={
            "model": model
        }
    )
