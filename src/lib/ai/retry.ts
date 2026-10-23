import { AiProviderError } from "./types";

type RetryOptions = {
  budgetMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

/** Never start another attempt with less time than this left in the budget. */
const MIN_ATTEMPT_MS = 5_000;
const MAX_JITTER_MS = 250;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt` until it succeeds, inside one time budget. Only failures the
 * provider marks retryable (rate limits, server and network errors) are tried
 * again, after the provider's Retry-After or an exponential backoff. A
 * timeout is never retried: the budget is spent.
 */
export async function withRetries<T>(
  attempt: (signal: AbortSignal) => Promise<T>,
  {
    budgetMs,
    maxAttempts,
    baseDelayMs,
    now = Date.now,
    sleep = defaultSleep,
    random = Math.random,
  }: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  const deadline = now() + budgetMs;
  for (let attempts = 1; ; attempts += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now()));
    // Stop waiting at the deadline even if the attempt ignores the signal; a
    // late answer is dropped.
    const expired = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new AiProviderError("timeout")), {
        once: true,
      });
    });
    try {
      return { value: await Promise.race([attempt(controller.signal), expired]), attempts };
    } catch (cause) {
      const error = controller.signal.aborted
        ? new AiProviderError("timeout")
        : cause instanceof AiProviderError
          ? cause
          : new AiProviderError("unavailable");
      error.attempts = attempts;
      if (!error.retryable || attempts >= maxAttempts) throw error;
      const delay =
        error.retryAfterMs ??
        baseDelayMs * 2 ** (attempts - 1) + Math.floor(random() * MAX_JITTER_MS);
      if (now() + delay > deadline - MIN_ATTEMPT_MS) throw error;
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
}
