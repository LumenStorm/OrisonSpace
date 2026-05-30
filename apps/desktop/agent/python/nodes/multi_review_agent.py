import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success, failure
from python_agent.shared.template import render_template
from python_agent.shared.truncate import smart_truncate


REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["pass", "revise", "escalate"],
            "description": "审核判定",
        },
        "summary": {"type": "string", "description": "审核总结"},
        "dimensions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "score": {"type": "integer", "minimum": 1, "maximum": 10},
                    "comment": {"type": "string"},
                },
                "required": ["name", "score", "comment"],
            },
            "description": "多维度评分",
        },
        "reasons": {
            "type": "array",
            "items": {"type": "string"},
            "description": "问题原因列表（verdict 非 pass 时）",
        },
    },
    "required": ["verdict", "summary", "dimensions", "reasons"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "multi-review-agent")
    input_data = context.get("input", {})
    artifacts = input_data.get("artifacts", {})

    # 测试兼容：如果指定了 reviewMode 且不是 "pass"，直接返回对应 verdict
    review_mode = input_data.get("reviewMode", "pass")
    if review_mode and review_mode != "pass":
        verdict = "revise" if review_mode == "revise" else "escalate"
        review_result = {
            "verdict": verdict,
            "summary": f"Forced {verdict} by reviewMode",
            "dimensions": [],
            "reasons": [f"reviewMode={review_mode}"],
        }
        return success(
            node_id=node_id,
            state_key="review.latest",
            artifact=review_result,
            review={"verdict": verdict, "summary": review_result["summary"], "reasons": review_result["reasons"]},
        )

    draft = artifacts.get("draft.initial", artifacts.get("draft.revision", {}))
    story_plan = artifacts.get("planning.storyPlan", {})
    continuity = artifacts.get("memory.continuity", {})

    draft_text = draft.get("text", "") if isinstance(draft, dict) else str(draft)

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个多维度内容审核专家。")
    user_template = prompt.get("user", "请审核初稿：{{draftText}} {{storyPlan}} {{continuityMemory}}")
    user_prompt = render_template(user_template, {
        "draftText": smart_truncate(draft_text, max_tokens=4000),
        "storyPlan": smart_truncate(json.dumps(story_plan, ensure_ascii=False), max_tokens=1500),
        "continuityMemory": smart_truncate(json.dumps(continuity, ensure_ascii=False), max_tokens=800),
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=REVIEW_SCHEMA,
    )

    verdict = result.get("verdict", "pass")
    review_payload = {
        "verdict": verdict,
        "summary": result.get("summary", ""),
        "reasons": result.get("reasons", []),
    }

    return success(
        node_id=node_id,
        state_key="review.latest",
        artifact=result,
        review=review_payload if verdict != "pass" else None,
    )
