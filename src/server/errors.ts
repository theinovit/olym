// Shared server-side errors.

export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`Not implemented: ${operation} (scheduled for F2)`);
    this.name = "NotImplementedError";
  }
}
