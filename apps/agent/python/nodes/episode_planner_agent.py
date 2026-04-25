import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


EPISODE_OUTLINE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "index": {"type": "integer"},
            "title": {"type": "string"},
            "purpose": {"type": "string"},
            "summary": {"type": "string"},
            "core_event": {"type": "string"},
            "character_progressions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "characterId": {"type": "string"},
                        "from": {"type": "string"},
                        "to": {"type": "string"},
                    },
                    "required": ["characterId", "from", "to"],
                },
            },
            "emotional_beats": {"type": "array", "items": {"type": "string"}},
            "pacing_beats": {"type": "array", "items": {"type": "string"}},
            "foreshadowing": {"type": "array", "items": {"type": "string"}},
            "payoffs": {"type": "array", "items": {"type": "string"}},
            "hook": {"type": "string"},
            "dependsOn": {"type": "array", "items": {"type": "string"}},
            "status": {
                "type": "string",
                "enum": ["planned", "drafted", "revised", "locked"],
            },
        },
        "required": ["id", "index", "title"],
    },
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "episode-planner-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    story_plan = artifacts.get("planning.storyPlan", {})
    curves = artifacts.get("curves", {})
    asset_context = artifacts.get("assets.projectContext", {})

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个分集/分章节规划师。")
    user_template = prompt.get(
        "user",
        "请根据以下信息生成集纲：{{requirement}} {{outline}} {{growth_curve}} {{pacing_curve}} {{emotion_curve}} {{asset_cards}} {{relationship_graph}}",
    )
    user_prompt = render_template(user_template, {
        "requirement": context.get("input", {}).get("requirement", ""),
        "outline": json.dumps(story_plan, ensure_ascii=False)[:3000],
        "growth_curve": json.dumps(curves.get("growth_curve", {}), ensure_ascii=False)[:1000],
        "pacing_curve": json.dumps(curves.get("pacing_curve", {}), ensure_ascii=False)[:1000],
        "emotion_curve": json.dumps(curves.get("emotion_curve", {}), ensure_ascii=False)[:1000],
        "asset_cards": json.dumps(asset_context, ensure_ascii=False)[:2000],
        "relationship_graph": "{}",
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=EPISODE_OUTLINE_SCHEMA,
    )

    return success(node_id=node_id, state_key="episode_outlines", artifact=result)
