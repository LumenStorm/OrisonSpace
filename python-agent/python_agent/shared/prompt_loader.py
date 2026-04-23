from pathlib import Path

import yaml

from .errors import PromptConfigError


def load_prompt_file(file_path: str, system_key: str, user_key: str) -> dict[str, str]:
    path = Path(file_path)
    if not path.exists():
        raise PromptConfigError(f"Prompt file not found: {file_path}", retryable=False)

    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    system = payload.get(system_key)
    user = payload.get(user_key)
    if not system or not user:
        raise PromptConfigError(
            f"Prompt keys missing: system={system_key}, user={user_key}",
            retryable=False,
        )

    return {"system": system, "user": user}
