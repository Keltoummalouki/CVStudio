import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "groq-sdk";
import type * as GroqSdk from "groq-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYSIS_JSON_SCHEMA } from "@/features/job-posts/analysis";
import { AiProviderError, NO_USAGE, type JsonRequest } from "@/lib/ai/types";

const sdk = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }));

// The real client refuses to start in a browser-like environment such as jsdom;
// the SDK's error classes stay real, since the provider recognizes them by class.
vi.mock("groq-sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof GroqSdk>()),
  default: class {
    chat = { completions: { create: sdk.create } };
    constructor(options: unknown) {
      sdk.options(options);
    }
  },
}));

const { createGroqClient, createGroqProvider, strictSchema, toGroqError } =
  await import("@/lib/ai/groq");

const KEY = "gsk_ExampleExampleExampleExampleExample1234567890abcd";
const MODEL = "openai/gpt-oss-20b";

function request(overrides: Partial<JsonRequest> = {}): JsonRequest {
  return {
    feature: "job_post_analysis",
    instructions: "Extract the requirements.",
    input: "<job_post>React developer</job_post>",
    schema: { type: "object", properties: {}, required: [] },
    maxOutputTokens: 8192,
    signal: new AbortController().signal,
    fakeAnswer: () => ({ ok: true }),
    ...overrides,
  };
}

const completion = (overrides: Record<string, unknown> = {}) => ({
  choices: [{ finish_reason: "stop", message: { content: ' {"ok": true} ' } }],
  usage: {
    prompt_tokens: 900,
    completion_tokens: 500,
    completion_tokens_details: { reasoning_tokens: 120 },
  },
  ...overrides,
});

const provider = (model = MODEL) => createGroqProvider(createGroqClient(KEY), model);

/** An SDK error as the client builds it from an HTTP response. */
const httpError = (status: number, headers: Record<string, string> = {}) =>
  APIError.generate(
    status,
    { error: { message: "details that quote <the job post>", type: "tokens" } },
    undefined,
    new Headers(headers),
  );

beforeEach(() => {
  sdk.create.mockReset();
  sdk.options.mockReset();
});

describe("Groq client", () => {
  it("keeps the key on Groq's own endpoint, with SDK retries and logging off", () => {
    createGroqClient(KEY);
    expect(sdk.options).toHaveBeenCalledWith({
      apiKey: KEY,
      baseURL: "https://api.groq.com",
      maxRetries: 0,
      timeout: 30_000,
      logLevel: "off",
    });
  });
});

describe("Groq provider", () => {
  it("asks for strict schema-bound JSON with low reasoning, within the free plan's token cap", async () => {
    sdk.create.mockResolvedValue(completion());
    const signal = new AbortController().signal;

    const answer = await provider().generateJson(
      request({ signal, schema: ANALYSIS_JSON_SCHEMA as Record<string, unknown> }),
    );

    expect(answer).toEqual({
      text: '{"ok": true}',
      usage: { inputTokens: 900, outputTokens: 380, thoughtTokens: 120 },
    });
    const [body, options] = sdk.create.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(body).toEqual({
      model: MODEL,
      messages: [
        { role: "system", content: "Extract the requirements." },
        { role: "user", content: "<job_post>React developer</job_post>" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "job_post_analysis",
          strict: true,
          schema: strictSchema(ANALYSIS_JSON_SCHEMA as Record<string, unknown>),
        },
      },
      // 8,192 asked by the feature, capped for Groq's 8,000 tokens per minute.
      max_completion_tokens: 3072,
      reasoning_effort: "low",
      include_reasoning: false,
      stream: false,
    });
    expect(options).toEqual({ signal, maxRetries: 0 });
  });

  it("sends reasoning settings only to gpt-oss models, and smaller caps unchanged", async () => {
    sdk.create.mockResolvedValue(completion());
    await provider("qwen/qwen3.8-27b").generateJson(request({ maxOutputTokens: 1024 }));
    const [body] = sdk.create.mock.calls[0] as [Record<string, unknown>];
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("include_reasoning");
    expect(body).toMatchObject({ model: "qwen/qwen3.8-27b", max_completion_tokens: 1024 });
  });

  it("reads usage without reasoning details or with none at all", async () => {
    sdk.create.mockResolvedValue(
      completion({ usage: { prompt_tokens: 10, completion_tokens: 4 } }),
    );
    expect((await provider().generateJson(request())).usage).toEqual({
      inputTokens: 10,
      outputTokens: 4,
      thoughtTokens: null,
    });

    sdk.create.mockResolvedValue(completion({ usage: undefined }));
    expect((await provider().generateJson(request())).usage).toEqual(NO_USAGE);
  });

  it.each([
    ["cut off at the token cap", [{ finish_reason: "length", message: { content: '{"ti' } }]],
    ["empty", [{ finish_reason: "stop", message: { content: "  " } }]],
    ["missing", []],
    ["a tool call", [{ finish_reason: "tool_calls", message: { content: null } }]],
  ])("refuses an answer that is %s, keeping its usage", async (_case, choices) => {
    sdk.create.mockResolvedValue(completion({ choices }));
    await expect(provider().generateJson(request())).rejects.toMatchObject({
      code: "invalid_response",
      retryable: false,
      usage: { inputTokens: 900, outputTokens: 380, thoughtTokens: 120 },
    });
  });

  it("maps SDK errors without keeping their messages", async () => {
    sdk.create.mockRejectedValue(httpError(429, { "retry-after": "7" }));
    const failure = await provider()
      .generateJson(request())
      .catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(AiProviderError);
    expect(failure).toMatchObject({ code: "rate_limited", retryable: true, retryAfterMs: 7_000 });
    expect((failure as Error).message).toBe("AI provider error: rate_limited");
  });
});

describe("toGroqError", () => {
  it.each([
    // The key or the request is wrong: never retried, never handed to the fallback.
    [401, { code: "auth", retryable: false }],
    [403, { code: "auth", retryable: false }],
    [400, { code: "rejected", retryable: false }],
    [404, { code: "rejected", retryable: false }],
    [422, { code: "rejected", retryable: false }],
    // Over the plan's tokens per minute in one request: no wait helps, the fallback can.
    [413, { code: "too_large", retryable: false, status: 413 }],
    [429, { code: "rate_limited", retryable: true, retryAfterMs: null }],
    [498, { code: "overloaded", retryable: true }],
    [500, { code: "overloaded", retryable: true }],
    [502, { code: "overloaded", retryable: true }],
    [503, { code: "overloaded", retryable: true }],
  ])("maps HTTP %i", (status, expected) => {
    expect(toGroqError(httpError(status))).toMatchObject(expected);
  });

  it("tells timeouts and aborts from lost connections by class, since none sets a name", () => {
    expect(toGroqError(new APIConnectionTimeoutError())).toMatchObject({
      code: "timeout",
      retryable: false,
    });
    expect(toGroqError(new APIUserAbortError())).toMatchObject({ code: "timeout" });
    expect(toGroqError(new APIConnectionError({ message: "fetch failed" }))).toMatchObject({
      code: "unavailable",
      retryable: true,
    });
  });
});

describe("strictSchema", () => {
  it("closes every object of the analysis schema, and every property stays required", () => {
    const strict = strictSchema(ANALYSIS_JSON_SCHEMA as Record<string, unknown>);
    const objects: Record<string, unknown>[] = [];
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (record.type === "object") objects.push(record);
      Object.values(record).forEach(visit);
    };
    visit(strict);

    // The answer, and one requirement.
    expect(objects).toHaveLength(2);
    for (const object of objects) {
      expect(object.additionalProperties).toBe(false);
      expect(object.required).toEqual(Object.keys(object.properties as object));
    }
    // The shared schema is left as Gemini receives it.
    expect(ANALYSIS_JSON_SCHEMA).not.toHaveProperty("additionalProperties");
  });
});
