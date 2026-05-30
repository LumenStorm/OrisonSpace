import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


ADHERENCE_SCHEMA = {
    "type": "object",
    "properties": {
        "adherence_score": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
            "description": "大纲遵从度评分",
        },
        "covered_items": {
            "type": "array",
            "items": {"type": "string"},
            "description": "已覆盖的大纲要素",
        },
        "missing_items": {
            "type": "array",
            "items": {"type": "string"},
            "description": "未覆盖的大纲要素",
        },
        "foreshadow_planted": {
            "type": "array",
            "items": {"type": "string"},
            "description": "已植入的伏笔",
        },
        "foreshadow_missing": {
            "type": "array",
            "items": {"type": "string"},
            "description": "应植入但未植入的伏笔",
        },
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "改进建议",
        },
    },
    "required": ["adherence_score", "covered_items", "missing_items", "suggestions"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "outline-adherence-agent")
    artifacts = context.get("input", {}).get("artifacts", {})

    draft = artifacts.get("draft.initial", {})
    episode_outline = artifacts.get("context.episodeOutline", {})
    foreshadow_guidance = artifacts.get("context.foreshadowGuidance", "")

    draft_text = draft.get("text", "") if isinstance(draft, dict) else str(draft)

    if not draft_text or not episode_outline:
        return success(
            node_id=node_id,
            state_key="adherence.result",
            artifact={"adherence_score": 0, "covered_items": [], "missing_items": [], "suggestions": ["缺少正文或大纲"]},
        )

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个大纲遵从度检查专家。对比正文与章节大纲，判断正文是否覆盖了大纲中的核心事件、情绪节拍、伏笔要求。")

    user_template = prompt.get("user", """请检查以下正文是否遵从章节大纲：

## 章节大纲
{{episodeOutline}}

## 伏笔要求
{{foreshadowGuidance}}

## 正文
{{draftText}}""")

    max_chars = 6000
    user_prompt = render_template(user_template, {
        "draftText": draft_text[:max_chars],
        "episodeOutline": json.dumps(episode_outline, ensure_ascii=False)[:2000],
        "foreshadowGuidance": str(foreshadow_guidance)[:1000],
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=ADHERENCE_SCHEMA,
    )

    return success(node_id=node_id, state_key="adherence.result", artifact=result)
