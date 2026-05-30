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


def _build_character_voice_block(chapter_context: dict) -> str:
    characters = chapter_context.get("characters", [])
    if not characters:
        return ""
    lines = ["## 角色语言风格参考"]
    for ch in characters:
        name = ch.get("name", "")
        voice = ch.get("voiceSample", "")
        if name and voice:
            lines.append(f"- {name}: {voice}")
    return "\n".join(lines) if len(lines) > 1 else ""


def _smart_truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    head = int(max_chars * 0.6)
    tail = max_chars - head
    return text[:head] + "\n\n[...中间省略...]\n\n" + text[-tail:]


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "novel-draft-writer-agent")
    artifacts = context.get("input", {}).get("artifacts", {})

    chapter_context = artifacts.get("context.chapterContext", {})
    bridge_guidance = artifacts.get("context.bridgeGuidance", {})
    recalled_memories = artifacts.get("context.recalledMemories", "")
    foreshadow_guidance = artifacts.get("context.foreshadowGuidance", "")
    existing_draft = artifacts.get("draft.initial", {})

    draft_text = ""
    if isinstance(existing_draft, dict):
        draft_text = existing_draft.get("text", "")
    elif isinstance(existing_draft, str):
        draft_text = existing_draft

    character_voice = _build_character_voice_block(chapter_context)

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一位专业小说作家。根据上下文撰写章节内容，注意保持角色语言风格一致性，植入要求的伏笔，遵循情绪节奏。")
    user_template = prompt.get(
        "user",
        """请根据以下信息撰写章节正文：

## 章节上下文
{{chapterContext}}

## 桥接指南
{{bridgeGuidance}}

{{characterVoice}}

## 需要植入的伏笔
{{foreshadowGuidance}}

## 前文记忆
{{recalledMemories}}

## 已有草稿
{{existingDraft}}""",
    )
    user_prompt = render_template(user_template, {
        "chapterContext": _smart_truncate(json.dumps(chapter_context, ensure_ascii=False), 4000),
        "bridgeGuidance": json.dumps(bridge_guidance, ensure_ascii=False)[:2000],
        "characterVoice": character_voice,
        "foreshadowGuidance": str(foreshadow_guidance)[:1500] if foreshadow_guidance else "（无特殊伏笔要求）",
        "recalledMemories": _smart_truncate(str(recalled_memories), 3000) if recalled_memories else "",
        "existingDraft": _smart_truncate(draft_text, 3000) if draft_text else "（新章节，无已有草稿）",
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=DRAFT_SCHEMA,
    )

    return success(node_id=node_id, state_key="draft.initial", artifact=result)
