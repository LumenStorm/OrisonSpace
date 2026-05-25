from pathlib import Path

from python_agent.shared.prompt_loader import load_prompt_file


def test_load_prompt_file_reads_system_and_user(tmp_path: Path):
    prompt_file = tmp_path / "story-planner.yaml"
    prompt_file.write_text(
        "system: |\n  planner-system\nuser: |\n  requirement: {{requirement}}\n",
        encoding="utf-8",
    )

    prompt = load_prompt_file(
        file_path=str(prompt_file),
        system_key="system",
        user_key="user",
    )

    assert prompt["system"] == "planner-system\n"
    assert "{{requirement}}" in prompt["user"]
