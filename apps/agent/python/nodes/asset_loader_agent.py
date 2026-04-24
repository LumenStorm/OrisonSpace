import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


ASSET_SCHEMA = {
    "type": "object",
    "properties": {
        "styleGuide": {"type": "string", "description": "风格指南描述"},
        "references": {
            "type": "array",
            "items": {"type": "string"},
            "description": "参考作品列表",
        },
        "worldRules": {
            "type": "array",
            "items": {"type": "string"},
            "description": "世界观规则",
        },
        "characterTemplates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "role": {"type": "string"},
                    "archetype": {"type": "string"},
                    "traits": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["role", "archetype", "traits"],
            },
            "description": "角色模板",
        },
    },
    "required": ["styleGuide", "references", "worldRules", "characterTemplates"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "asset-loader-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    intake = artifacts.get("intake.requirement", {})

    genre = intake.get("genre", "未知")
    tone = intake.get("tone", "未知")
    setting = intake.get("setting", "未知")
    premise = intake.get("premise", "未知")

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个创意项目资产规划师。")
    user_template = prompt.get("user", "根据需求推荐资产配置：{{genre}} {{tone}} {{setting}} {{premise}}")
    user_prompt = render_template(user_template, {
        "genre": genre,
        "tone": tone,
        "setting": setting,
        "premise": premise,
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=ASSET_SCHEMA,
    )

    return success(node_id=node_id, state_key="assets.projectContext", artifact=result)
