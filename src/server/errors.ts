// Shared server-side errors.

export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`Not implemented: ${operation} (scheduled for F2)`);
    this.name = "NotImplementedError";
  }
}

export class DomainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class BadRequestError extends DomainError {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}
