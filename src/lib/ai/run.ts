import "server-only";
import type { z } from "zod";
import {
  AI_FALLBACK_MIN_MS,
  AI_MAX_ATTEMPTS,
  AI_PROVIDER_BUDGET_MS,
  AI_REQUEST_BUDGET_MS,
  AI_RETRY_BASE_DELAY_MS,
  type AiFeature,
  type AiProviderId,
} from "@/config/ai";
import type { OwnerContext } from "@/lib/auth/session";
import { estimateCostUsd } from "./cost";
import type { AiErrorCode } from "./errors";
import { getAiAvailability, type AiAvailability } from "./provider";
import { withRetries } from "./retry";
import {
  AiProviderError,
  FALLBACK_FAILURES,
  NO_USAGE,
  type AiFailure,
  type AiProvider,
  type JsonRequest,
  type TokenUsage,
} from "./types";

export type AiRunResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: AiErrorCode | "unauthorized" | "unavailable";
      /** The provider whose failure ended the request, when one did. */
      provider?: AiProviderId;
    };

const FAILURE_CODES: Record<AiFailure, AiErrorCode> = {
  timeout: "ai_timeout",
  rate_limited: "ai_rate_limited",
  too_large: "ai_too_large",
  overloaded: "ai_overloaded",
  unavailable: "ai_unavailable",
  rejected: "ai_rejected",
  auth: "ai_key_rejected",
  invalid_response: "ai_invalid_response",
};

/** Messages raised by begin_ai_request(). */
const QUOTA_ERRORS: Record<string, AiErrorCode> = {
  ai_disabled: "ai_disabled",
  ai_daily_limit_reached: "ai_limit_reached",
  ai_request_in_progress: "ai_busy",
};

type RunOptions<T> = {
  context: OwnerContext;
  feature: AiFeature;
  instructions: string;
  input: string;
  jsonSchema: Record<string, unknown>;
  /** Validates the parsed answer; anything else counts as an invalid response. */
  schema: z.ZodType<T>;
  maxOutputTokens: number;
  fakeAnswer: (input: string) => unknown;
  /** Test seams. */
  availability?: AiAvailability;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** One provider's part in a request: how it ended after its retries, and what it used. */
type ProviderAttempt<T> = {
  provider: AiProvider;
  outcome: { ok: true; data: T } | { ok: false; failure: AiProviderError };
  tries: number;
  durationMs: number;
  usage: TokenUsage;
  cost: number | null;
};

function parseAnswer<T>(text: string, schema: z.ZodType<T>, usage: TokenUsage): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiProviderError("invalid_response", { usage });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiProviderError("invalid_response", { usage });
  return parsed.data;
}

/** Codes and counts only: prompts, job posts and answers never reach the logs. */
function logFailure(details: Record<string, string | number | null>) {
  console.error(JSON.stringify({ event: "ai_request_failed", ...details }));
}

/** Null when no attempt reported the value. */
function sum(values: (number | null)[]): number | null {
  if (values.every((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

/** Costs are kept to the database's six decimals. */
const roundUsd = (value: number | null) =>
  value === null ? null : Math.round(value * 1_000_000) / 1_000_000;

/** Leaves out a parameter the database should store as null. */
function optional<K extends string>(key: K, value: number | null): Partial<Record<K, number>> {
  return value === null ? {} : ({ [key]: value } as Record<K, number>);
}

/** What finish_ai_request() stores in ai_request_attempts, one entry per provider tried. */
function toAttemptRecord({
  provider,
  outcome,
  tries,
  durationMs,
  usage,
  cost,
}: ProviderAttempt<unknown>) {
  return {
    provider: provider.id,
    model: provider.model,
    succeeded: outcome.ok,
    error_code: outcome.ok ? null : outcome.failure.code,
    http_status: outcome.ok ? null : outcome.failure.status,
    attempts: tries,
    duration_ms: durationMs,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    thought_tokens: usage.thoughtTokens,
    estimated_cost_usd: cost,
  };
}

/** Asks one provider, retrying within its share of the budget, then validates the answer. */
async function tryProvider<T>(
  provider: AiProvider,
  budgetMs: number,
  request: Omit<JsonRequest, "signal">,
  schema: z.ZodType<T>,
  now: () => number,
  sleep: ((ms: number) => Promise<void>) | undefined,
): Promise<ProviderAttempt<T>> {
  const startedAt = now();
  let tries = 0;
  let usage = NO_USAGE;
  let outcome: ProviderAttempt<T>["outcome"];
  try {
    const answer = await withRetries((signal) => provider.generateJson({ ...request, signal }), {
      budgetMs,
      maxAttempts: AI_MAX_ATTEMPTS,
      baseDelayMs: AI_RETRY_BASE_DELAY_MS,
      now,
      sleep,
    });
    tries = answer.attempts;
    usage = answer.value.usage;
    outcome = { ok: true, data: parseAnswer(answer.value.text, schema, usage) };
  } catch (error) {
    const failure = error instanceof AiProviderError ? error : new AiProviderError("unavailable");
    tries = Math.max(tries, failure.attempts);
    if (failure.usage !== NO_USAGE) usage = failure.usage;
    outcome = { ok: false, failure };
  }
  const finishedAt = now();
  return {
    provider,
    outcome,
    tries,
    durationMs: Math.max(0, Math.round(finishedAt - startedAt)),
    usage,
    cost: estimateCostUsd(provider.model, usage, new Date(finishedAt)),
  };
}

const canFallBack = ({ outcome }: ProviderAttempt<unknown>) =>
  !outcome.ok && FALLBACK_FAILURES.has(outcome.failure.code);

/**
 * Runs one AI request for the signed-in owner: the quota check and request log
 * in Postgres (begin_ai_request / finish_ai_request), then the providers in
 * order, each with retries inside its share of one time budget, then
 * validation of the answer. The next provider is tried only when the previous
 * one was unavailable (FALLBACK_FAILURES). However many providers it tries, it
 * stays one request: one row in ai_requests, one unit of the daily quota.
 */
export async function runAiRequest<T>(options: RunOptions<T>): Promise<AiRunResult<T>> {
  const { context, feature, instructions, input, jsonSchema, maxOutputTokens, fakeAnswer } =
    options;
  const availability = options.availability ?? getAiAvailability();
  if (availability.status !== "ready") return { ok: false, error: "ai_not_configured" };
  const [primary, ...fallbacks] = availability.chain;
  const now = options.now ?? Date.now;

  const begun = await context.supabase.rpc("begin_ai_request", {
    p_feature: feature,
    p_model: primary.model,
  });
  if (begun.error || !begun.data) {
    if (begun.error?.code === "42501") return { ok: false, error: "unauthorized" };
    const quota = begun.error?.message ? QUOTA_ERRORS[begun.error.message] : undefined;
    return { ok: false, error: quota ?? "unavailable" };
  }

  const startedAt = now();
  const deadline = startedAt + AI_REQUEST_BUDGET_MS;
  const request = { feature, instructions, input, schema: jsonSchema, maxOutputTokens, fakeAnswer };
  // A provider with another one behind it gets its share; the last one, what is left.
  const ask = (provider: AiProvider, isLast: boolean) => {
    const remaining = deadline - now();
    const budgetMs = isLast ? remaining : Math.min(remaining, AI_PROVIDER_BUDGET_MS[provider.id]);
    return tryProvider(provider, budgetMs, request, options.schema, now, options.sleep);
  };

  let last = await ask(primary, fallbacks.length === 0);
  const attempts = [last];
  for (const [index, provider] of fallbacks.entries()) {
    if (!canFallBack(last) || deadline - now() < AI_FALLBACK_MIN_MS) break;
    last = await ask(provider, index === fallbacks.length - 1);
    attempts.push(last);
  }

  const outcome = last.outcome;
  const usage = attempts.map((attempt) => attempt.usage);
  const finished = await context.supabase.rpc("finish_ai_request", {
    p_request_id: begun.data,
    p_succeeded: outcome.ok,
    p_attempts: attempts.reduce((total, attempt) => total + attempt.tries, 0),
    p_duration_ms: Math.max(0, Math.round(now() - startedAt)),
    ...(outcome.ok ? {} : { p_error_code: outcome.failure.code }),
    ...optional("p_input_tokens", sum(usage.map((entry) => entry.inputTokens))),
    ...optional("p_output_tokens", sum(usage.map((entry) => entry.outputTokens))),
    ...optional("p_thought_tokens", sum(usage.map((entry) => entry.thoughtTokens))),
    ...optional("p_estimated_cost_usd", roundUsd(sum(attempts.map((attempt) => attempt.cost)))),
    p_provider_attempts: attempts.map(toAttemptRecord),
  });
  if (finished.error) {
    logFailure({
      stage: "record",
      feature,
      model: last.provider.model,
      reason: finished.error.code ?? null,
    });
  }

  attempts.forEach((attempt, index) => {
    if (attempt.outcome.ok) return;
    logFailure({
      stage: "provider",
      feature,
      provider: attempt.provider.id,
      model: attempt.provider.model,
      code: attempt.outcome.failure.code,
      status: attempt.outcome.failure.status,
      attempts: attempt.tries,
      durationMs: attempt.durationMs,
      fallback: attempts[index + 1]?.provider.id ?? null,
    });
  });

  if (outcome.ok) return { ok: true, data: outcome.data };
  if (attempts.length > 1 && canFallBack(last)) {
    return { ok: false, error: "ai_providers_unavailable" };
  }
  return { ok: false, error: FAILURE_CODES[outcome.failure.code], provider: last.provider.id };
}
