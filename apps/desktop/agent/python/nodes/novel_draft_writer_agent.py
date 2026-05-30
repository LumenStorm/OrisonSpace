import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "章节标题"},
        "text": {"type": "string", "description": "完整的章节正文"},
        "wordCount": {"type": "integer", "description": "字数"},
        "chapterId": {"type": "string", "description": "章节编号"},
    },
    "required": ["title", "text", "wordCount", "chapterId"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "novel-draft-writer-agent")
    artifacts = context.get("input", {}).get("artifacts", {})

    # 小说流水线上下文（替代 creative 流水线的 story_plan / chapter_tasks）
    chapter_context = artifacts.get("context.chapterContext", {})
    bridge_guidance = artifacts.get("context.bridgeGuidance", {})
    recalled_memories = artifacts.get("context.recalledMemories", "")
    existing_draft = artifacts.get("draft.initial", {})

    # continue 模式：已有草稿
    draft_text = ""
    if isinstance(existing_draft, dict):
        draft_text = existing_draft.get("text", "")
    elif isinstance(existing_draft, str):
        draft_text = existing_draft

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一位小说作家，根据上下文撰写章节内容。")
    user_template = prompt.get(
        "user",
        "请根据提供的上下文和桥接指南，撰写章节内容。{{chapterContext}} {{bridgeGuidance}} {{recalledMemories}} {{existingDraft}}",
    )
    user_prompt = render_template(user_template, {
        "chapterContext": json.dumps(chapter_context, ensure_ascii=False)[:4000],
        "bridgeGuidance": json.dumps(bridge_guidance, ensure_ascii=False)[:2000],
        "recalledMemories": str(recalled_memories)[:2500] if recalled_memories else "",
        "existingDraft": draft_text[:3000] if draft_text else "（新章节，无已有草稿）",
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=DRAFT_SCHEMA,
    )

    return success(node_id=node_id, state_key="draft.initial", artifact=result)
