import json

from python_agent.shared.model_client import generate_structured
from python_agent.shared.result_schema import success
from python_agent.shared.template import render_template


ASSET_CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "type": {
            "type": "string",
            "enum": ["character", "location", "prop", "organization", "rule", "visual_motif", "lore"],
        },
        "name": {"type": "string"},
        "summary": {"type": "string"},
        "details": {"type": "object"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "relationships": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "targetId": {"type": "string"},
                    "relationType": {"type": "string"},
                    "label": {"type": "string"},
                },
                "required": ["targetId", "relationType"],
            },
        },
        "firstAppearance": {"type": "string"},
        "sourceRefs": {"type": "array", "items": {"type": "string"}},
        "status": {
            "type": "string",
            "enum": ["draft", "active", "deprecated", "locked"],
        },
        "locked": {"type": "boolean"},
    },
    "required": ["id", "type", "name"],
    "additionalProperties": False,
}

WORLD_SETTING_SCHEMA = {
    "type": "object",
    "properties": {
        "premise": {"type": "string"},
        "era": {"type": "string"},
        "locations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["id", "name"],
            },
        },
        "rules": {"type": "array", "items": {"type": "string"}},
        "power_structures": {"type": "array", "items": {"type": "string"}},
        "taboos": {"type": "array", "items": {"type": "string"}},
        "visual_language": {"type": "array", "items": {"type": "string"}},
        "tone_rules": {"type": "array", "items": {"type": "string"}},
        "open_questions": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": False,
}

RELATIONSHIP_GRAPH_SCHEMA = {
    "type": "object",
    "properties": {
        "nodes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "assetCardId": {"type": "string"},
                    "label": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["character", "location", "prop", "organization", "rule", "visual_motif", "lore"],
                    },
                    "locked": {"type": "boolean"},
                },
                "required": ["id", "assetCardId", "label", "type"],
            },
        },
        "edges": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "from": {"type": "string"},
                    "to": {"type": "string"},
                    "relationType": {
                        "type": "string",
                        "enum": ["family", "alliance", "romance", "rivalry", "mentor", "secret", "debt", "organization", "custom"],
                    },
                    "label": {"type": "string"},
                    "strength": {"type": "number"},
                    "polarity": {
                        "type": "string",
                        "enum": ["positive", "negative", "neutral", "ambivalent"],
                    },
                    "visibility": {
                        "type": "string",
                        "enum": ["public", "secret", "one_sided"],
                    },
                    "sourceRefs": {"type": "array", "items": {"type": "string"}},
                    "locked": {"type": "boolean"},
                },
                "required": ["id", "from", "to", "relationType"],
            },
        },
        "version": {"type": "integer"},
        "updatedBy": {"type": "string", "enum": ["user", "agent", "sync"]},
    },
    "additionalProperties": False,
}

ASSET_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "world_setting": WORLD_SETTING_SCHEMA,
        "asset_cards": {"type": "array", "items": ASSET_CARD_SCHEMA},
        "relationship_graph": RELATIONSHIP_GRAPH_SCHEMA,
    },
    "required": ["world_setting", "asset_cards", "relationship_graph"],
    "additionalProperties": False,
}


def run(context: dict) -> dict:
    node_id = context.get("node_id") or context.get("nodeId", "asset-loader-agent")
    artifacts = context.get("input", {}).get("artifacts", {})
    creative_brief = artifacts.get("creative_brief", {})

    genre = creative_brief.get("genre", "未知")
    tone = creative_brief.get("tone", "未知")
    theme = creative_brief.get("theme", "未知")
    raw_req = creative_brief.get("rawRequirement", "")

    config = context.get("config", {})
    model = config.get("model", "gpt-4o-mini")
    prompt = context.get("prompt", {})
    system_prompt = prompt.get("system", "你是一个创意项目资产规划师。")
    user_template = prompt.get("user", "根据需求生成世设、资产卡和关系网：{{genre}} {{tone}} {{theme}} {{rawRequirement}}")
    user_prompt = render_template(user_template, {
        "genre": genre,
        "tone": tone,
        "theme": theme,
        "rawRequirement": raw_req,
    })

    result = generate_structured(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=ASSET_OUTPUT_SCHEMA,
    )

    return success(node_id=node_id, state_key="assets.projectContext", artifact=result)
