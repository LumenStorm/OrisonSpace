import json
import os

from openai import OpenAI

from .errors import ConfigurationError, ModelCallError, ModelOutputError


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
        return json.loads(mock_payload)

    client = OpenAI(api_key=api_key)

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
