import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success, failure
from python_agent.shared.template import render_template


CHAPTER_TASKS_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "章节编号，如 chapter_1"},
            "title": {"type": "string", "description": "章节标题"},
            "goal": {"type": "string", "description": "本章叙事目标"},
            "scenes": {
                "type": "array",
                "items": {"type": "string"},
                "description": "场景列表",
            },
            "characters": {
                "type": "array",
                "items": {"type": "string"},
                "description": "涉及角色",
            },
            "wordTarget": {"type": "integer", "description": "预期字数"},
        },
        "required": ["id", "title", "goal", "scenes", "characters", "wordTarget"],
    },
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "chapter-task-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    story_plan = artifacts.get("planning.storyPlan", {})

    if not story_plan:
        return failure(node_id=node_id, error_type="InputError", message="planning.storyPlan is missing", retryable=False)

    title = story_plan.get("title", "未知")
    premise = story_plan.get("premise", "未知")
    tone = story_plan.get("tone", "未知")
    acts = json.dumps(story_plan.get("acts", []), ensure_ascii=False)
    characters = json.dumps(story_plan.get("characters", []), ensure_ascii=False)

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个故事结构规划师。")
    user_template = prompt.get("user", "请拆解章节任务卡：{{title}} {{premise}} {{tone}} {{acts}} {{characters}}")
    user_prompt = render_template(user_template, {
        "title": title,
        "premise": premise,
        "tone": tone,
        "acts": acts,
        "characters": characters,
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=CHAPTER_TASKS_SCHEMA,
    )

    return success(node_id=node_id, state_key="planning.chapterTasks", artifact=result)
