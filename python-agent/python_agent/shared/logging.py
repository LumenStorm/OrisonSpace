import json
import sys


def log_stderr(event: str, **fields):
    sys.stderr.write(json.dumps({"event": event, **fields}, ensure_ascii=False) + "\n")
    sys.stderr.flush()
