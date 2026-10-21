/**
 * Raised when a data read fails. Its message is generic on purpose: database
 * details stay in server logs and never reach the browser.
 */
export class DataAccessError extends Error {
  constructor(operation: string, options?: { cause?: unknown }) {
    super(`Data access failed: ${operation}`, options);
    this.name = "DataAccessError";
  }
}
