import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success, failure
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
    node_id = context.get("node_id") or context.get("nodeId", "draft-writer-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    story_plan = artifacts.get("planning.storyPlan", {})
    chapter_tasks = artifacts.get("planning.chapterTasks", [])
    project_context = artifacts.get("assets.projectContext", {})

    if not story_plan:
        return failure(node_id=node_id, error_type="InputError", message="planning.storyPlan is missing", retryable=False)

    chapter_task = chapter_tasks[0] if isinstance(chapter_tasks, list) and chapter_tasks else {"id": "chapter_1", "title": "第一章", "goal": "开篇"}

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个专业的故事写作者。")
    user_template = prompt.get("user", "请撰写初稿：{{chapterTask}} {{storyPlan}} {{projectContext}}")
    user_prompt = render_template(user_template, {
        "chapterTask": json.dumps(chapter_task, ensure_ascii=False),
        "storyPlan": json.dumps(story_plan, ensure_ascii=False),
        "projectContext": json.dumps(project_context, ensure_ascii=False),
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=DRAFT_SCHEMA,
    )

    return success(node_id=node_id, state_key="draft.initial", artifact=result)
