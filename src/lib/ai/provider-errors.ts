import { AiProviderError } from "./types";

/**
 * Maps SDK errors to the few cases the app handles. The Gemini and Groq SDKs
 * both throw errors that carry the HTTP status and response headers, with
 * class names for the failures that have none (timeouts, aborts, no
 * connection).
 */

const MAX_RETRY_AFTER_MS = 30_000;

/** The HTTP status of an SDK error, if the provider answered at all. */
export function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

function retryAfterMs(error: unknown): number | null {
  const headers = (error as { headers?: { get?: (name: string) => string | null } }).headers;
  const value = typeof headers?.get === "function" ? headers.get("retry-after") : null;
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
    : null;
}

export function toProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const status = statusOf(error);
  const name = error instanceof Error ? error.name : "";

  if (["APIConnectionTimeoutError", "RequestTimeoutError"].includes(name)) {
    return new AiProviderError("timeout");
  }
  // Our own deadline aborts the request.
  if (["APIUserAbortError", "RequestAbortedError", "AbortError"].includes(name)) {
    return new AiProviderError("timeout");
  }
  if (status === 429) {
    return new AiProviderError("rate_limited", {
      retryable: true,
      status,
      retryAfterMs: retryAfterMs(error),
    });
  }
  if (status === 401 || status === 403) return new AiProviderError("auth", { status });
  // Both providers answer 503 when the model is busy: worth a retry.
  if (status !== null && status >= 500) {
    return new AiProviderError("overloaded", { retryable: true, status });
  }
  if (status !== null && status >= 400) return new AiProviderError("rejected", { status });
  // No answer at all: DNS, TLS or a reset connection.
  return new AiProviderError("unavailable", { retryable: true });
}
