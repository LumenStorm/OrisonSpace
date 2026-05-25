import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


GROWTH_CURVE_SCHEMA = {
    "type": "object",
    "properties": {
        "character_id": {"type": "string"},
        "start_state": {"type": "string"},
        "wound_or_lack": {"type": "string"},
        "desire": {"type": "string"},
        "need": {"type": "string"},
        "turning_points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "turning_point": {"type": "string"},
                    "linked_episode_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["turning_point", "linked_episode_ids"],
            },
        },
        "regressions": {"type": "array", "items": {"type": "string"}},
        "end_state": {"type": "string"},
        "linked_episode_ids": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["character_id", "start_state", "turning_points", "end_state"],
    "additionalProperties": False,
}

PACING_CURVE_SCHEMA = {
    "type": "object",
    "properties": {
        "unit": {"type": "string", "enum": ["act", "episode", "chapter", "scene"]},
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "refId": {"type": "string"},
                    "intensity": {"type": "number", "minimum": 0, "maximum": 10},
                    "informationDensity": {"type": "number"},
                    "actionLevel": {"type": "number"},
                    "recoveryLevel": {"type": "number"},
                    "note": {"type": "string"},
                },
                "required": ["refId", "intensity"],
            },
        },
        "target_shape": {"type": "string"},
        "risks": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["unit", "points"],
    "additionalProperties": False,
}

EMOTION_CURVE_SCHEMA = {
    "type": "object",
    "properties": {
        "unit": {"type": "string", "enum": ["act", "episode", "chapter", "scene"]},
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "refId": {"type": "string"},
                    "primaryEmotion": {"type": "string"},
                    "secondaryEmotion": {"type": "string"},
                    "valence": {"type": "number"},
                    "arousal": {"type": "number"},
                    "transition": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["refId", "primaryEmotion"],
            },
        },
        "emotional_promises": {"type": "array", "items": {"type": "string"}},
        "catharsis_points": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["unit", "points"],
    "additionalProperties": False,
}

CURVES_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "growth_curve": GROWTH_CURVE_SCHEMA,
        "pacing_curve": PACING_CURVE_SCHEMA,
        "emotion_curve": EMOTION_CURVE_SCHEMA,
    },
    "required": ["growth_curve", "pacing_curve", "emotion_curve"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "curve-planner-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    story_plan = artifacts.get("planning.storyPlan", {})
    asset_context = artifacts.get("assets.projectContext", {})

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个叙事曲线规划师。")
    user_template = prompt.get(
        "user",
        "请根据以下信息生成三类叙事曲线：{{requirement}} {{outline}} {{asset_cards}}",
    )
    user_prompt = render_template(user_template, {
        "requirement": context.get("input", {}).get("requirement", ""),
        "outline": json.dumps(story_plan, ensure_ascii=False)[:3000],
        "asset_cards": json.dumps(asset_context, ensure_ascii=False)[:2000],
        "relationship_graph": "{}",
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=CURVES_OUTPUT_SCHEMA,
    )

    return success(node_id=node_id, state_key="curves", artifact=result)
