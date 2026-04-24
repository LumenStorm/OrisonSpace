from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template

STORY_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "premise": {"type": "string"},
        "tone": {"type": "string"},
        "acts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "goal": {"type": "string"},
                    "conflict": {"type": "string"},
                    "turn": {"type": "string"},
                },
                "required": ["id", "title", "goal", "conflict", "turn"],
                "additionalProperties": False,
            },
        },
        "characters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "goal": {"type": "string"},
                    "risk": {"type": "string"},
                },
                "required": ["id", "name", "role", "goal", "risk"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "premise", "tone", "acts", "characters"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    requirement = context["input"]["requirement"]
    prompt = render_template(context["prompt"]["user"], {"requirement": requirement})
    config = context.get("config", {})
    agent_config = config.get("agent", {})
    model = agent_config.get("model") or config.get("model") or "gpt-5.4"
    story_plan = generate_structured(
        model=model,
        system_prompt=context["prompt"]["system"],
        user_prompt=prompt,
        response_schema=STORY_PLAN_SCHEMA,
        timeout_seconds=30,
    )

    return success(
        node_id=context.get("node_id") or context.get("nodeId", "story-planner-agent"),
        state_key="planning.storyPlan",
        artifact=story_plan,
        meta={
            "model": model
        }
    )
