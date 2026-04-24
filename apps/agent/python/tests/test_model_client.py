from unittest.mock import MagicMock, patch

import pytest

from python_agent.shared.errors import ConfigurationError, ModelCallError
from python_agent.shared.model_client import generate_structured


def test_generate_structured_raises_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(ConfigurationError):
        generate_structured(
            model="gpt-5.4",
            system_prompt="system",
            user_prompt="user",
            response_schema={"type": "object"},
        )


@patch("python_agent.shared.model_client.OpenAI")
def test_generate_structured_returns_parsed_json(mock_openai, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    client = MagicMock()
    mock_openai.return_value = client
    client.responses.create.return_value.output_text = '{"title":"Cold City","premise":"A detective returns.","tone":"noir","acts":[],"characters":[]}'

    result = generate_structured(
        model="gpt-5.4",
        system_prompt="system",
        user_prompt="user",
        response_schema={"type": "object"},
    )

    assert result["title"] == "Cold City"
    client.responses.create.assert_called_once()
