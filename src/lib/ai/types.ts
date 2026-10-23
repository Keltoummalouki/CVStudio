import type { AiFeature, AiProviderId } from "@/config/ai";

/** Token counts as the provider reported them; null when it did not. */
export type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  /** Reasoning ("thinking") tokens, billed as output. */
  thoughtTokens: number | null;
};

export const NO_USAGE: TokenUsage = { inputTokens: null, outputTokens: null, thoughtTokens: null };

/** A count the provider reported, or null when it is missing or not a count. */
export const tokenCount = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

export type JsonRequest = {
  feature: AiFeature;
  /** The task, its rules and the answer format. */
  instructions: string;
  /** Untrusted data the task works on, e.g. a pasted job post. */
  input: string;
  /** JSON Schema the answer must follow; every property required. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal: AbortSignal;
  /** What the fake provider answers for this input. Real providers ignore it. */
  fakeAnswer: (input: string) => unknown;
};

export type JsonResponse = { text: string; usage: TokenUsage };

export interface AiProvider {
  readonly id: AiProviderId;
  readonly model: string;
  generateJson(request: JsonRequest): Promise<JsonResponse>;
}

export type AiFailure =
  /** The time budget ran out. */
  | "timeout"
  /** The provider's own quota (HTTP 429). */
  | "rate_limited"
  /** One request over what the provider's plan takes at once (Groq's 413): shorter text fits. */
  | "too_large"
  /** The provider answered with a server error, typically high demand (HTTP 5xx). */
  | "overloaded"
  /** No answer at all: DNS, TLS or a dropped connection. */
  | "unavailable"
  /** The provider refused the request (bad request, unknown model, safety block). */
  | "rejected"
  /** The API key was refused. */
  | "auth"
  /** No answer, a cut-off answer, or one that does not match the schema. */
  | "invalid_response";

/**
 * Failures of the provider itself, which another provider does not share: the
 * next one in line is tried. A refused key or request is a setup problem to
 * fix, and an unusable answer is reported, not paid for twice (owner's rule,
 * 2026-10-23).
 */
export const FALLBACK_FAILURES: ReadonlySet<AiFailure> = new Set([
  "timeout",
  "rate_limited",
  "too_large",
  "overloaded",
  "unavailable",
]);

/**
 * A failure described by its kind only. The provider's message is dropped on
 * purpose: it can quote the request, and this error reaches logs.
 */
export class AiProviderError extends Error {
  readonly code: AiFailure;
  /** Worth another try with the same provider, after a wait. */
  readonly retryable: boolean;
  readonly status: number | null;
  readonly retryAfterMs: number | null;
  /** Usage of a request that was answered (and billed) but unusable. */
  readonly usage: TokenUsage;
  /** Attempts made before giving up; set by withRetries. */
  attempts = 1;

  constructor(
    code: AiFailure,
    options: {
      retryable?: boolean;
      status?: number | null;
      retryAfterMs?: number | null;
      usage?: TokenUsage;
    } = {},
  ) {
    super(`AI provider error: ${code}`);
    this.name = "AiProviderError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.usage = options.usage ?? NO_USAGE;
  }
}
