/**
 * Errors raised by the model-protocols layer. Callers (desktop main IPC) map
 * these to renderer-friendly messages; agent maps them to run warnings.
 */

export class ProtocolHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt?: string;
  constructor(message: string, status: number, bodyExcerpt?: string) {
    super(message);
    this.name = 'ProtocolHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

export class ProtocolSchemaError extends Error {
  readonly issues: unknown;
  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = 'ProtocolSchemaError';
    this.issues = issues;
  }
}

export class ProtocolCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolCapabilityError';
  }
}

export class ProtocolNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolNotImplementedError';
  }
}
