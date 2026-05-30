import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


CONTINUITY_SCHEMA = {
    "type": "object",
    "properties": {
        "memories": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "memoryType": {
                        "type": "string",
                        "enum": ["character_state", "timeline", "foreshadow", "tone_rule"],
                    },
                    "title": {"type": "string"},
                    "content": {"type": "string"},
                    "importance": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"],
                    },
                    "structuredTags": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "category": {
                                    "type": "string",
                                    "enum": [
                                        "character", "event", "foreshadow",
                                        "setting", "location", "item", "emotion", "power",
                                    ],
                                },
                                "value": {"type": "string"},
                                "role": {
                                    "type": "string",
                                    "enum": ["subject", "object", "context"],
                                },
                            },
                            "required": ["category", "value", "role"],
                        },
                    },
                    "isForeshadow": {"type": "boolean"},
                },
                "required": ["memoryType", "title", "content", "importance", "structuredTags", "isForeshadow"],
            },
        },
    },
    "required": ["memories"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "continuity-memory-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    draft = artifacts.get("draft.initial", {})
    story_plan = artifacts.get("planning.storyPlan", {})

    draft_text = draft.get("text", "") if isinstance(draft, dict) else str(draft)

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个连续性审查专家。")
    user_template = prompt.get("user", "请提取连续性记忆：{{draftText}} {{storyPlan}}")
    user_prompt = render_template(user_template, {
        "draftText": draft_text[:3000],
        "storyPlan": json.dumps(story_plan, ensure_ascii=False)[:2000],
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=CONTINUITY_SCHEMA,
    )

    return success(node_id=node_id, state_key="memory.continuity", artifact=result)
