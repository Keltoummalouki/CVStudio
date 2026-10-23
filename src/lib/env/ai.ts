import "server-only";
import {
  AI_PROVIDERS,
  DEFAULT_GROQ_MODEL,
  DEFAULT_PRIMARY_PROVIDER,
  GEMINI_MODEL,
  type AiProviderId,
} from "@/config/ai";

/**
 * Server-only AI configuration. GROQ_API_KEY and GEMINI_API_KEY never carry a
 * NEXT_PUBLIC_ prefix, and their values are never logged or returned: callers
 * only learn which providers can run and, for the others, why not.
 */
export type AiUnavailableReason = "missing_key" | "invalid_key" | "invalid_model" | "debug_logging";

export type ProviderSetup =
  | { id: AiProviderId; status: "ready"; apiKey: string; model: string }
  | { id: AiProviderId; status: "unavailable"; reason: AiUnavailableReason; model: string | null };

export type AiProviderConfig =
  /** Every provider, in the order they are tried: the primary first. */
  | { kind: "live"; providers: ProviderSetup[] }
  /** Deterministic stand-ins answer instead, in the same order. */
  | { kind: "fake"; order: AiProviderId[] }
  /** AI_PRIMARY_PROVIDER names no known provider: nothing runs until it is fixed. */
  | { kind: "invalid_primary" };

type AiEnv = Partial<
  Record<
    | "AI_PRIMARY_PROVIDER"
    | "GROQ_API_KEY"
    | "GROQ_MODEL"
    | "GEMINI_API_KEY"
    | "AI_FAKE_PROVIDER"
    | "GOOGLE_GENAI_DEBUG"
    | "VERCEL",
    string
  >
>;

function readAiEnv(): AiEnv {
  return {
    AI_PRIMARY_PROVIDER: process.env.AI_PRIMARY_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    AI_FAKE_PROVIDER: process.env.AI_FAKE_PROVIDER,
    GOOGLE_GENAI_DEBUG: process.env.GOOGLE_GENAI_DEBUG,
    VERCEL: process.env.VERCEL,
  };
}

/**
 * API keys are URL-safe tokens ("gsk_…", "AIza…", or Google's newer keys,
 * which contain dots). No provider prefix is required, since key formats
 * change; spaces, quotes or line breaks mean a copy-paste mistake.
 */
const API_KEY = /^[A-Za-z0-9._~+/=-]{20,512}$/;
/** Model ids such as "openai/gpt-oss-20b"; ai_requests.model holds at most 80 characters. */
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

function keySetup(id: AiProviderId, value: string | undefined, model: string): ProviderSetup {
  const apiKey = value?.trim();
  if (!apiKey) return { id, status: "unavailable", reason: "missing_key", model };
  if (!API_KEY.test(apiKey)) return { id, status: "unavailable", reason: "invalid_key", model };
  return { id, status: "ready", apiKey, model };
}

const SETUPS: Record<AiProviderId, (env: AiEnv) => ProviderSetup> = {
  groq: (env) => {
    const model = env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    if (!MODEL.test(model)) {
      return { id: "groq", status: "unavailable", reason: "invalid_model", model: null };
    }
    return keySetup("groq", env.GROQ_API_KEY, model);
  },
  gemini: (env) =>
    // With this set, the Gemini SDK prints every request and response, job posts included.
    env.GOOGLE_GENAI_DEBUG
      ? { id: "gemini", status: "unavailable", reason: "debug_logging", model: GEMINI_MODEL }
      : keySetup("gemini", env.GEMINI_API_KEY, GEMINI_MODEL),
};

const isProvider = (value: string): value is AiProviderId =>
  (AI_PROVIDERS as readonly string[]).includes(value);

export function getAiProviderConfig(env: AiEnv = readAiEnv()): AiProviderConfig {
  const primary = env.AI_PRIMARY_PROVIDER?.trim().toLowerCase() || DEFAULT_PRIMARY_PROVIDER;
  if (!isProvider(primary)) return { kind: "invalid_primary" };
  const order = [primary, ...AI_PROVIDERS.filter((id) => id !== primary)];

  // The fakes answer without calling any provider, for local runs and the e2e
  // suite. Vercel always sets VERCEL=1, so a stray variable can never fake
  // production results.
  if (env.AI_FAKE_PROVIDER === "1" && !env.VERCEL) return { kind: "fake", order };
  return { kind: "live", providers: order.map((id) => SETUPS[id](env)) };
}
