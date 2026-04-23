from python_agent.shared.result_schema import success


def run(context: dict) -> dict:
    verdict = context["input"].get("reviewMode", "pass")
    return success(
        node_id=context.get("node_id") or context.get("nodeId", "multi-review-agent"),
        state_key="review.latest",
        artifact={"mode": verdict},
        review={
            "verdict": verdict,
            "summary": f"Python review {verdict}",
            "reasons": [] if verdict == "pass" else ["python review requested changes"],
        },
    )
