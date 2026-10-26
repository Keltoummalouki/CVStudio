/**
 * The AI phase's providers, models, limits and prices in one place (CLAUDE.md
 * §16). Groq answers first and Gemini takes over when Groq is unavailable;
 * AI_PRIMARY_PROVIDER=gemini swaps them. Models and prices were checked on
 * console.groq.com (2026-10-23) and ai.google.dev (2026-10-22); the costs
 * shown to the owner are estimates computed from these numbers.
 */
export const AI_PROVIDERS = ["groq", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const DEFAULT_PRIMARY_PROVIDER: AiProviderId = "groq";

/** The server variable holding each provider's key, named in Settings when it is missing. */
export const AI_PROVIDER_KEY_VARS: Readonly<Record<AiProviderId, string>> = {
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/** GROQ_MODEL overrides it; the model must support strict structured outputs. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const GEMINI_MODEL = "gemini-3.8-flash";

/** Reading a job post's requirements; choosing what a CV shows for a job (step 2). */
export const AI_FEATURES = ["job_post_analysis", "cv_tailoring"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Requests per owner per UTC day. Postgres enforces it in begin_ai_request(). */
export const AI_DAILY_LIMIT = { default: 10, min: 1, max: 50 } as const;

/** Total time one AI request may take, retries and fallback included. */
export const AI_REQUEST_BUDGET_MS = 30_000;
/**
 * The most a provider may use while another one waits behind it, so that the
 * fallback still has time to answer. Groq usually answers in a few seconds.
 */
export const AI_PROVIDER_BUDGET_MS: Readonly<Record<AiProviderId, number>> = {
  groq: 12_000,
  gemini: 20_000,
};
/** The fallback is not started with less time left: it could not finish. */
export const AI_FALLBACK_MIN_MS = 8_000;
/** Per provider: the first try plus up to two retries of rate-limit and server errors. */
export const AI_MAX_ATTEMPTS = 3;
export const AI_RETRY_BASE_DELAY_MS = 1_000;

/**
 * Groq's free plan gives openai/gpt-oss-20b 8,000 tokens per minute per
 * organization, and a request appears to count its prompt plus
 * max_completion_tokens against it (a refused request reports that sum). Live
 * checks on 2026-10-23: a 15,000-character post (the most a job post holds)
 * took 3,900 prompt tokens, and analyses used under 600 tokens of output and
 * reasoning. This cap leaves room for denser posts; Groq refuses one that
 * does not fit with 413, and the fallback answers instead.
 */
export const GROQ_MAX_COMPLETION_TOKENS = 3_072;

type Price = {
  /** First day (UTC, YYYY-MM-DD) the price applies; null for the earliest known price. */
  from: string | null;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

/**
 * List prices in USD per million tokens, oldest first. Reasoning tokens bill
 * as output. A key on Groq's free plan is not billed at all.
 */
export const AI_PRICES: Readonly<Record<string, readonly Price[]>> = {
  "openai/gpt-oss-20b": [{ from: null, inputPerMillionUsd: 0.075, outputPerMillionUsd: 0.3 }],
  "gemini-3.8-flash": [
    { from: null, inputPerMillionUsd: 0.75, outputPerMillionUsd: 3.75 },
    { from: "2027-01-01", inputPerMillionUsd: 1.5, outputPerMillionUsd: 7.5 },
  ],
};
