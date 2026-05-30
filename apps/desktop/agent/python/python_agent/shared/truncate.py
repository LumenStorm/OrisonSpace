def smart_truncate(text: str, max_tokens: int = 4000) -> str:
    """Token-aware truncation for Chinese text (~1.5 chars/token)."""
    max_chars = int(max_tokens * 1.5)
    if len(text) <= max_chars:
        return text
    head = int(max_chars * 0.6)
    tail = max_chars - head
    return text[:head] + "\n\n[...中间省略...]\n\n" + text[-tail:]
