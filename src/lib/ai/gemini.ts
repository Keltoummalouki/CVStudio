import "server-only";
import { GoogleGenAI } from "@google/genai";
import { toProviderError } from "./provider-errors";
import { AiProviderError, tokenCount, type AiProvider, type TokenUsage } from "./types";

type InteractionRequest = {
  model: string;
  input: string;
  system_instruction: string;
  store: false;
  generation_config: { thinking_level: "low"; max_output_tokens: number };
  response_format: {
    type: "text";
    mime_type: "application/json";
    schema: Record<string, unknown>;
  };
};

type InteractionUsage = {
  total_input_tokens?: number | undefined;
  total_output_tokens?: number | undefined;
  total_thought_tokens?: number | undefined;
};

type InteractionAnswer = {
  status: string;
  output_text?: string | undefined;
  usage?: InteractionUsage | undefined;
};

/** The slice of the SDK this module relies on, so tests can stand in for it. */
export type InteractionsClient = {
  interactions: {
    create(
      request: InteractionRequest,
      options: { signal: AbortSignal; retries: { strategy: "none" } },
    ): PromiseLike<InteractionAnswer>;
  };
};

export function createGeminiClient(apiKey: string): InteractionsClient {
  const client = new GoogleGenAI({ apiKey });
  return {
    interactions: { create: (request, options) => client.interactions.create(request, options) },
  };
}

function readUsage(usage: InteractionUsage | undefined): TokenUsage {
  return {
    inputTokens: tokenCount(usage?.total_input_tokens),
    outputTokens: tokenCount(usage?.total_output_tokens),
    thoughtTokens: tokenCount(usage?.total_thought_tokens),
  };
}

/**
 * Gemini through the Interactions API: JSON output constrained by a schema,
 * `store: false` (Google would otherwise keep each request for 55 days), and
 * no SDK retries, because lib/ai/retry.ts owns the time budget.
 */
export function createGeminiProvider(client: InteractionsClient, model: string): AiProvider {
  return {
    id: "gemini",
    model,
    async generateJson({ instructions, input, schema, maxOutputTokens, signal }) {
      let answer: InteractionAnswer;
      try {
        answer = await client.interactions.create(
          {
            model,
            input,
            system_instruction: instructions,
            store: false,
            generation_config: { thinking_level: "low", max_output_tokens: maxOutputTokens },
            response_format: { type: "text", mime_type: "application/json", schema },
          },
          { signal, retries: { strategy: "none" } },
        );
      } catch (error) {
        throw toProviderError(error);
      }

      const usage = readUsage(answer.usage);
      if (answer.status !== "completed") {
        // A failed interaction can be a passing server fault; a cut-off or
        // over-budget answer would only fail again.
        const failed = answer.status === "failed";
        throw new AiProviderError(failed ? "overloaded" : "invalid_response", {
          retryable: failed,
          usage,
        });
      }
      const text = answer.output_text?.trim();
      if (!text) throw new AiProviderError("invalid_response", { usage });
      return { text, usage };
    },
  };
}
