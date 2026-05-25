import importlib.util
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Windows 上 stdin 默认可能用 cp936/ANSI 解码，会破坏中文与反斜杠转义。
# 强制以 UTF-8 解码 stdin、UTF-8 编码 stdout/stderr。
if hasattr(sys.stdin, "buffer"):
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="strict")
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="strict")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="strict")

from python_agent.shared.errors import NodeExecutionError
from python_agent.shared.model_client import set_current_node_id
from python_agent.shared.result_schema import failure


def _load_module(node_file: str):
    path = Path(node_file)
    if not path.exists():
        raise NodeExecutionError(f"Cannot load node file: {node_file}", retryable=False)

    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise NodeExecutionError(f"Cannot load node file: {node_file}", retryable=False)

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _request_value(request: dict, snake_key: str, camel_key: str):
    if snake_key in request:
        return request[snake_key]
    if camel_key in request:
        return request[camel_key]
    raise NodeExecutionError(f"Missing request field: '{snake_key}'", retryable=False)


def main():
    request = {}
    try:
        request = json.loads(sys.stdin.read())
        node_file = _request_value(request, "node_file", "nodeFile")
        node_id = _request_value(request, "node_id", "nodeId")
        set_current_node_id(node_id)
        module = _load_module(node_file)
        result = module.run(request)
        sys.stdout.write(json.dumps({"ok": True, "node_id": node_id, **result}))
    except NodeExecutionError as error:
        sys.stdout.write(
            json.dumps(
                failure(
                    request.get("node_id") or request.get("nodeId", "unknown"),
                    error.__class__.__name__,
                    str(error),
                    error.retryable,
                )
            )
        )
    except Exception as error:
        sys.stdout.write(
            json.dumps(
                failure(
                    request.get("node_id") or request.get("nodeId", "unknown"),
                    "NodeExecutionError",
                    str(error),
                    False,
                )
            )
        )


if __name__ == "__main__":
    main()
