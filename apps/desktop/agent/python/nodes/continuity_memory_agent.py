import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


CONTINUITY_SCHEMA = {
    "type": "object",
    "properties": {
        "characters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "status": {"type": "string"},
                    "lastAction": {"type": "string"},
                },
                "required": ["name", "status", "lastAction"],
            },
            "description": "角色当前状态",
        },
        "timeline": {
            "type": "array",
            "items": {"type": "string"},
            "description": "时间线事件",
        },
        "foreshadowing": {
            "type": "array",
            "items": {"type": "string"},
            "description": "伏笔线索",
        },
        "toneRules": {
            "type": "array",
            "items": {"type": "string"},
            "description": "语调规则",
        },
    },
    "required": ["characters", "timeline", "foreshadowing", "toneRules"],
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
        "draftText": draft_text[:3000],  # 截断避免 token 过长
        "storyPlan": json.dumps(story_plan, ensure_ascii=False)[:2000],
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=CONTINUITY_SCHEMA,
    )

    return success(node_id=node_id, state_key="memory.continuity", artifact=result)
