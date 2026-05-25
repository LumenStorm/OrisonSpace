def success(node_id: str, state_key: str, artifact, review=None, meta=None):
    return {
        "ok": True,
        "node_id": node_id,
        "state_key": state_key,
        "artifact": artifact,
        "review": review,
        "meta": meta or {},
    }


def failure(node_id: str, error_type: str, message: str, retryable: bool):
    return {
        "ok": False,
        "node_id": node_id,
        "error": {
            "type": error_type,
            "message": message,
            "retryable": retryable,
        },
    }
