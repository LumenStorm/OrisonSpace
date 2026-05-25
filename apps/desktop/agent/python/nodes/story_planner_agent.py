from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template

STORY_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "logline": {"type": "string"},
        "theme": {"type": "string"},
        "genre": {"type": "string"},
        "central_conflict": {"type": "string"},
        "acts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "goal": {"type": "string"},
                    "conflict": {"type": "string"},
                    "turning_point": {"type": "string"},
                    "cost": {"type": "string"},
                    "end_state": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["id", "title"],
                "additionalProperties": False,
            },
        },
        "major_turning_points": {"type": "array", "items": {"type": "string"}},
        "ending_direction": {"type": "string"},
        "constraints": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title"],
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
