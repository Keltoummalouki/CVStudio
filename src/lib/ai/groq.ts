import "server-only";
import Groq, { APIConnectionTimeoutError, APIUserAbortError } from "groq-sdk";
import { AI_REQUEST_BUDGET_MS, GROQ_MAX_COMPLETION_TOKENS } from "@/config/ai";
import { statusOf, toProviderError } from "./provider-errors";
import { AiProviderError, tokenCount, type AiProvider, type TokenUsage } from "./types";

const GROQ_BASE_URL = "https://api.groq.com";

type ChatRequest = {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  response_format: {
    type: "json_schema";
    json_schema: { name: string; strict: true; schema: Record<string, unknown> };
  };
  max_completion_tokens: number;
  reasoning_effort?: "low";
  include_reasoning?: false;
  stream: false;
};

type ChatUsage = {
  prompt_tokens?: number | undefined;
  completion_tokens?: number | undefined;
  completion_tokens_details?: { reasoning_tokens?: number | undefined } | null | undefined;
};

type ChatAnswer = {
  choices: { finish_reason: string | null; message: { content?: string | null | undefined } }[];
  usage?: ChatUsage | undefined;
};

/** The slice of the SDK this module relies on, so tests can stand in for it. */
export type ChatClient = {
  chat: {
    completions: {
      create(
        request: ChatRequest,
        options: { signal: AbortSignal; maxRetries: 0 },
      ): PromiseLike<ChatAnswer>;
    };
  };
};

export function createGroqClient(apiKey: string): ChatClient {
  const client = new Groq({
    apiKey,
    // Pinned, so a stray GROQ_BASE_URL can never send the key elsewhere.
    baseURL: GROQ_BASE_URL,
    // lib/ai/retry.ts owns retries and the time budget.
    maxRetries: 0,
    timeout: AI_REQUEST_BUDGET_MS,
    // At "debug" (GROQ_LOG=debug) the SDK logs request bodies, job posts included.
    logLevel: "off",
  });
  return {
    chat: {
      completions: {
        create: (request, options) => client.chat.completions.create(request, options),
      },
    },
  };
}

function strictNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictNode);
  if (!node || typeof node !== "object") return node;
  const copy = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, strictNode(value)]),
  );
  return copy.type === "object" ? { ...copy, additionalProperties: false } : copy;
}

/**
 * Groq's strict structured outputs constrain decoding to the schema, but only
 * accept objects that close with `additionalProperties: false` (and list every
 * property as required, which the feature schemas already do).
 */
export function strictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return strictNode(schema) as Record<string, unknown>;
}

/**
 * gpt-oss reasons at "medium" unless told otherwise; "low" is enough to list
 * requirements and keeps the answer quick and under the token cap. Other
 * models may refuse these fields, so they only go to gpt-oss.
 */
function reasoningOptions(
  model: string,
): Pick<ChatRequest, "reasoning_effort" | "include_reasoning"> {
  return model.startsWith("openai/gpt-oss-")
    ? { reasoning_effort: "low", include_reasoning: false }
    : {};
}

/** completion_tokens includes the reasoning, which TokenUsage counts apart. */
function readUsage(usage: ChatUsage | undefined): TokenUsage {
  const completion = tokenCount(usage?.completion_tokens);
  const reasoning = tokenCount(usage?.completion_tokens_details?.reasoning_tokens);
  return {
    inputTokens: tokenCount(usage?.prompt_tokens),
    outputTokens: completion === null ? null : Math.max(0, completion - (reasoning ?? 0)),
    thoughtTokens: reasoning,
  };
}

export function toGroqError(error: unknown): AiProviderError {
  // The SDK's errors all keep the name "Error", so these are told apart by class.
  if (error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError) {
    return new AiProviderError("timeout");
  }
  const status = statusOf(error);
  // Groq answers 413 when one request (its prompt plus max_completion_tokens)
  // is more than the plan's tokens per minute: waiting does not help, but a
  // shorter text or another provider can.
  if (status === 413) return new AiProviderError("too_large", { status });
  // 498: the flex tier is at capacity.
  if (status === 498) return new AiProviderError("overloaded", { retryable: true, status });
  return toProviderError(error);
}

/**
 * Groq chat completions with strict structured outputs, no reasoning text in
 * the answer, and no SDK retries. Groq keeps no inference data by default,
 * apart from logs it may hold up to 30 days unless Zero Data Retention is on.
 */
export function createGroqProvider(client: ChatClient, model: string): AiProvider {
  return {
    id: "groq",
    model,
    async generateJson({ feature, instructions, input, schema, maxOutputTokens, signal }) {
      let answer: ChatAnswer;
      try {
        answer = await client.chat.completions.create(
          {
            model,
            messages: [
              { role: "system", content: instructions },
              { role: "user", content: input },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: feature, strict: true, schema: strictSchema(schema) },
            },
            max_completion_tokens: Math.min(maxOutputTokens, GROQ_MAX_COMPLETION_TOKENS),
            ...reasoningOptions(model),
            stream: false,
          },
          { signal, maxRetries: 0 },
        );
      } catch (error) {
        throw toGroqError(error);
      }

      const usage = readUsage(answer.usage);
      const choice = answer.choices[0];
      // "length": cut off at max_completion_tokens, so the JSON is incomplete.
      if (choice?.finish_reason !== "stop")
        throw new AiProviderError("invalid_response", { usage });
      const text = choice.message.content?.trim();
      if (!text) throw new AiProviderError("invalid_response", { usage });
      return { text, usage };
    },
  };
}
