import type { AiProviderId } from "@/config/ai";
import { AiProviderError, type AiProvider } from "./types";

export const fakeModel = (id: AiProviderId) => `fake-${id}`;

/**
 * Failures a test can ask for by putting a marker in the input:
 * "[[fake:rate_limited]]" fails every fake, "[[fake:groq:timeout]]" only the
 * one standing in for Groq (so the fallback answers).
 */
const FAILURES: Record<string, () => AiProviderError> = {
  timeout: () => new AiProviderError("timeout"),
  rate_limited: () => new AiProviderError("rate_limited", { retryable: true, status: 429 }),
  overloaded: () => new AiProviderError("overloaded", { retryable: true, status: 503 }),
  rejected: () => new AiProviderError("rejected", { status: 400 }),
  auth: () => new AiProviderError("auth", { status: 401 }),
};
const INVALID_MARKER = "[[fake:invalid]]";

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/**
 * A deterministic stand-in for a provider, used locally and by the e2e suite
 * when AI_FAKE_PROVIDER=1 (refused on Vercel). It never calls the network:
 * each feature supplies the answer it would expect. "[[fake:invalid]]" in the
 * input returns text that is not JSON.
 */
export function createFakeProvider(id: AiProviderId): AiProvider {
  return {
    id,
    model: fakeModel(id),
    async generateJson({ instructions, input, fakeAnswer, signal }) {
      if (signal.aborted) throw new AiProviderError("timeout");
      for (const [name, failure] of Object.entries(FAILURES)) {
        if (input.includes(`[[fake:${name}]]`) || input.includes(`[[fake:${id}:${name}]]`)) {
          throw failure();
        }
      }
      const text = input.includes(INVALID_MARKER)
        ? "This is not JSON."
        : JSON.stringify(fakeAnswer(input));
      return {
        text,
        usage: {
          inputTokens: estimateTokens(instructions + input),
          outputTokens: estimateTokens(text),
          thoughtTokens: 0,
        },
      };
    },
  };
}
