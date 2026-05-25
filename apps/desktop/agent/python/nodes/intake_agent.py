import json
import os

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success, failure
from python_agent.shared.template import render_template


INTAKE_SCHEMA = {
    "type": "object",
    "properties": {
        "genre": {"type": "string"},
        "theme": {"type": "string"},
        "tone": {"type": "string"},
        "audience": {"type": "string"},
        "length": {"type": "string"},
        "taboos": {"type": "array", "items": {"type": "string"}},
        "userConstraints": {"type": "array", "items": {"type": "string"}},
        "rawRequirement": {"type": "string"},
    },
    "required": ["rawRequirement"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "intake-agent")
    requirement = context.get("input", {}).get("requirement", "")
    if not requirement:
        return failure(node_id=node_id, error_type="InputError", message="requirement is empty", retryable=False)

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个需求分析专家。")
    user_template = prompt.get("user", "请将以下需求标准化：{{requirement}}")
    user_prompt = render_template(user_template, {"requirement": requirement})

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=INTAKE_SCHEMA,
    )

    return success(node_id=node_id, state_key="intake.requirement", artifact=result)
