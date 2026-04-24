import re


def render_template(template: str, variables: dict[str, str]) -> str:
    return re.sub(
        r"\{\{(\w+)\}\}",
        lambda match: variables.get(match.group(1), match.group(0)),
        template,
    )
