import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success, failure
from python_agent.shared.template import render_template
from python_agent.shared.truncate import smart_truncate


REVISION_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "章节标题"},
        "text": {"type": "string", "description": "修订后的完整正文"},
        "wordCount": {"type": "integer", "description": "字数"},
        "chapterId": {"type": "string", "description": "章节编号"},
        "revisionNotes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "修订说明",
        },
    },
    "required": ["title", "text", "wordCount", "chapterId", "revisionNotes"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "targeted-revision-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    draft = artifacts.get("draft.initial", {})
    review = artifacts.get("review.latest", {})

    draft_text = draft.get("text", "") if isinstance(draft, dict) else str(draft)

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个专业的故事修订编辑。")
    user_template = prompt.get("user", "请修订初稿：{{draftText}} {{reviewResult}}")
    user_prompt = render_template(user_template, {
        "draftText": smart_truncate(draft_text, max_tokens=4000),
        "reviewResult": smart_truncate(json.dumps(review, ensure_ascii=False), max_tokens=2000),
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=REVISION_SCHEMA,
    )

    return success(node_id=node_id, state_key="draft.revision", artifact=result)
