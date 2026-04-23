from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "chapter-task-agent"),
        state_key="planning.chapterTasks",
        artifact=[{"id": "chapter_1", "goal": "Open the story with a Python chapter task."}],
    )
