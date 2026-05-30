import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template
from python_agent.shared.truncate import smart_truncate


SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "章节摘要（200-300字）"},
        "characterUpdates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "state": {"type": "string", "description": "角色在本章结束时的状态（位置、情绪、关键变化）"},
                },
                "required": ["name", "state"],
            },
            "description": "角色状态更新",
        },
        "keyEvents": {
            "type": "array",
            "items": {"type": "string"},
            "description": "本章关键事件列表（3-5项）",
        },
    },
    "required": ["summary", "characterUpdates", "keyEvents"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "chapter-summary-agent")
    artifacts = context.get("input", {}).get("artifacts", {})

    draft = artifacts.get("draft.initial", artifacts.get("chapter.candidate", {}))
    draft_text = draft.get("text", draft.get("content", "")) if isinstance(draft, dict) else str(draft)
    chapter_title = draft.get("title", "") if isinstance(draft, dict) else ""

    if not draft_text:
        return success(node_id=node_id, state_key="chapter.summary", artifact={
            "summary": "", "characterUpdates": [], "keyEvents": [],
        })

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个小说摘要生成专家。生成精炼的章节摘要，提取角色状态变化和关键事件。摘要要求200-300字，重点是叙事进展和因果关系。")
    user_template = prompt.get("user", "请为以下章节生成摘要：\n\n## 标题\n{{title}}\n\n## 正文\n{{text}}")
    user_prompt = render_template(user_template, {
        "title": chapter_title,
        "text": smart_truncate(draft_text, max_tokens=5000),
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=SUMMARY_SCHEMA,
    )

    return success(node_id=node_id, state_key="chapter.summary", artifact=result)
