class NodeExecutionError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class PromptConfigError(NodeExecutionError):
    pass


class ModelCallError(NodeExecutionError):
    pass
