import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template
from python_agent.shared.truncate import smart_truncate


COMPRESSOR_SCHEMA = {
    "type": "object",
    "properties": {
        "blockSummary": {"type": "string", "description": "多章压缩摘要（100-200字）"},
        "globalNarrative": {"type": "string", "description": "全局叙事摘要（400-600字）"},
        "characterStates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "currentState": {"type": "string"},
                    "lastSeenChapter": {"type": "string"},
                },
                "required": ["name", "currentState", "lastSeenChapter"],
            },
            "description": "截至当前的角色状态快照",
        },
    },
    "required": ["blockSummary", "globalNarrative", "characterStates"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "narrative-compressor-agent")
    artifacts = context.get("input", {}).get("artifacts", {})

    chapter_summaries = artifacts.get("chapterSummaries", [])
    previous_global = artifacts.get("previousGlobalNarrative", "")
    previous_states = artifacts.get("previousCharacterStates", [])

    if not chapter_summaries:
        return success(node_id=node_id, state_key="compression.result", artifact={
            "blockSummary": "", "globalNarrative": previous_global, "characterStates": previous_states,
        })

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个叙事压缩专家。将多个章节摘要压缩为更精炼的段落摘要，并更新全局叙事线和角色状态。保留因果关系、伏笔线索和角色成长弧线。")
    user_template = prompt.get("user", """请压缩以下章节摘要：

## 本组章节摘要
{{chapterSummaries}}

## 之前的全局叙事
{{previousGlobal}}

## 之前的角色状态
{{previousStates}}

要求：
1. blockSummary: 将本组章节摘要压缩为100-200字
2. globalNarrative: 结合之前的全局叙事和本组内容，重建完整的全局叙事线（400-600字）
3. characterStates: 更新所有活跃角色的当前状态""")

    summaries_text = "\n\n".join([
        f"[{s.get('chapterId', '')} {s.get('title', '')}] {s.get('summary', '')}"
        for s in chapter_summaries
    ])

    user_prompt = render_template(user_template, {
        "chapterSummaries": smart_truncate(summaries_text, max_tokens=3000),
        "previousGlobal": smart_truncate(str(previous_global), max_tokens=1500),
        "previousStates": smart_truncate(json.dumps(previous_states, ensure_ascii=False), max_tokens=1000),
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=COMPRESSOR_SCHEMA,
    )

    return success(node_id=node_id, state_key="compression.result", artifact=result)
