import json
import os

from openai import OpenAI

from .errors import ConfigurationError, ModelCallError, ModelOutputError

# 当前执行的 node_id，由 runner 设置
_current_node_id: str | None = None


def set_current_node_id(node_id: str) -> None:
    global _current_node_id
    _current_node_id = node_id


def generate_structured(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_schema: dict,
    timeout_seconds: int = 30,
) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ConfigurationError("OPENAI_API_KEY is not set", retryable=False)

    mock_payload = os.getenv("OPENAI_RESPONSES_MOCK_JSON")
    if mock_payload:
        parsed = json.loads(mock_payload)
        # 支持按 node_id 返回不同 mock: {"__mock_by_node__": {"intake-agent": {...}, ...}}
        if isinstance(parsed, dict) and "__mock_by_node__" in parsed:
            node_mocks = parsed["__mock_by_node__"]
            if _current_node_id and _current_node_id in node_mocks:
                return node_mocks[_current_node_id]
            # fallback: 返回第一个值
            return next(iter(node_mocks.values()))
        return parsed

    base_url = os.getenv("OPENAI_BASE_URL") or None
    client = OpenAI(api_key=api_key, base_url=base_url)

    try:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "story_plan",
                    "schema": response_schema,
                }
            },
            timeout=timeout_seconds,
        )
    except Exception as error:
        raise ModelCallError(f"OpenAI request failed: {error}", retryable=True) from error

    try:
        return json.loads(response.output_text)
    except Exception as error:
        raise ModelOutputError(f"OpenAI returned invalid JSON: {error}", retryable=False) from error
