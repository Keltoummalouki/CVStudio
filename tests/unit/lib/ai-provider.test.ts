import type * as GroqSdk from "groq-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateCostUsd } from "@/lib/ai/cost";
import { isAiErrorCode, isProviderErrorCode } from "@/lib/ai/errors";
import { createFakeProvider, fakeModel } from "@/lib/ai/fake";
import { toProviderError } from "@/lib/ai/provider-errors";
import { withRetries } from "@/lib/ai/retry";
import { AiProviderError, NO_USAGE, type JsonRequest } from "@/lib/ai/types";
import { getAiProviderConfig } from "@/lib/env/ai";

const sdk = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn(), groqOptions: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: sdk.create };
    constructor(options: unknown) {
      sdk.options(options);
    }
  },
}));
// The real client refuses to start in a browser-like environment such as jsdom.
vi.mock("groq-sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof GroqSdk>()),
  default: class {
    chat = { completions: { create: vi.fn() } };
    constructor(options: unknown) {
      sdk.groqOptions(options);
    }
  },
}));

const { createGeminiClient, createGeminiProvider } = await import("@/lib/ai/gemini");
const { getAiAvailability } = await import("@/lib/ai/provider");

const KEY = "AIzaSyExampleExampleExampleExample123";
const GROQ_KEY = "gsk_ExampleExampleExampleExampleExample1234567890abcd";

function request(overrides: Partial<JsonRequest> = {}): JsonRequest {
  return {
    feature: "job_post_analysis",
    instructions: "Extract the requirements.",
    input: "<job_post>React developer</job_post>",
    schema: { type: "object" },
    maxOutputTokens: 1024,
    signal: new AbortController().signal,
    fakeAnswer: () => ({ ok: true }),
    ...overrides,
  };
}

beforeEach(() => {
  sdk.create.mockReset();
  sdk.options.mockReset();
  sdk.groqOptions.mockReset();
});

describe("AI configuration", () => {
  it("puts Groq first and Gemini behind it, each with its key and model", () => {
    expect(getAiProviderConfig({ GROQ_API_KEY: ` ${GROQ_KEY} `, GEMINI_API_KEY: KEY })).toEqual({
      kind: "live",
      providers: [
        { id: "groq", status: "ready", apiKey: GROQ_KEY, model: "openai/gpt-oss-20b" },
        { id: "gemini", status: "ready", apiKey: KEY, model: "gemini-3.8-flash" },
      ],
    });
  });

  it("follows AI_PRIMARY_PROVIDER and GROQ_MODEL", () => {
    const config = getAiProviderConfig({
      AI_PRIMARY_PROVIDER: " Gemini ",
      GROQ_API_KEY: GROQ_KEY,
      GROQ_MODEL: "openai/gpt-oss-120b",
      GEMINI_API_KEY: KEY,
    });
    expect(config).toMatchObject({
      kind: "live",
      providers: [
        { id: "gemini", status: "ready" },
        { id: "groq", status: "ready", model: "openai/gpt-oss-120b" },
      ],
    });
    expect(getAiProviderConfig({ AI_PRIMARY_PROVIDER: "groq" })).toMatchObject({
      providers: [{ id: "groq" }, { id: "gemini" }],
    });
  });

  it("refuses a primary provider it does not know", () => {
    expect(getAiProviderConfig({ AI_PRIMARY_PROVIDER: "openai", GROQ_API_KEY: GROQ_KEY })).toEqual({
      kind: "invalid_primary",
    });
  });

  it("accepts Google's newer key format, which contains dots", () => {
    // Built from parts so secret scanners do not mistake this fake key for a real one.
    const dotted = ["AQ", "Ab8RN6" + "Example".repeat(3) + "-Example_Example1234567"].join(".");
    expect(getAiProviderConfig({ GEMINI_API_KEY: dotted })).toMatchObject({
      providers: [{ id: "groq" }, { id: "gemini", status: "ready", apiKey: dotted }],
    });
  });

  it("explains what each provider is missing, never echoing a key", () => {
    expect(getAiProviderConfig({})).toEqual({
      kind: "live",
      providers: [
        { id: "groq", status: "unavailable", reason: "missing_key", model: "openai/gpt-oss-20b" },
        { id: "gemini", status: "unavailable", reason: "missing_key", model: "gemini-3.8-flash" },
      ],
    });
    for (const pasted of ["short", `"${KEY}"`, `${KEY} ${KEY}`, `${KEY}\n${KEY}`]) {
      const config = getAiProviderConfig({ GROQ_API_KEY: pasted, GEMINI_API_KEY: pasted });
      expect(config).toMatchObject({
        providers: [
          { id: "groq", status: "unavailable", reason: "invalid_key" },
          { id: "gemini", status: "unavailable", reason: "invalid_key" },
        ],
      });
      expect(JSON.stringify(config)).not.toContain(pasted);
    }
  });

  it("refuses a Groq model name that cannot be one", () => {
    for (const model of ["gpt oss", "x".repeat(81), "/leading-slash"]) {
      expect(getAiProviderConfig({ GROQ_API_KEY: GROQ_KEY, GROQ_MODEL: model })).toMatchObject({
        providers: [
          { id: "groq", status: "unavailable", reason: "invalid_model", model: null },
          { id: "gemini" },
        ],
      });
    }
  });

  it("refuses to run Gemini while its SDK would log requests", () => {
    expect(
      getAiProviderConfig({ GROQ_API_KEY: GROQ_KEY, GEMINI_API_KEY: KEY, GOOGLE_GENAI_DEBUG: "1" }),
    ).toMatchObject({
      providers: [
        { id: "groq", status: "ready" },
        { id: "gemini", status: "unavailable", reason: "debug_logging" },
      ],
    });
  });

  it("only allows the fake providers outside Vercel", () => {
    expect(getAiProviderConfig({ AI_FAKE_PROVIDER: "1", GROQ_API_KEY: GROQ_KEY })).toEqual({
      kind: "fake",
      order: ["groq", "gemini"],
    });
    expect(getAiProviderConfig({ AI_FAKE_PROVIDER: "1", VERCEL: "1" })).toMatchObject({
      kind: "live",
      providers: [{ status: "unavailable" }, { status: "unavailable" }],
    });
    expect(
      getAiProviderConfig({ AI_FAKE_PROVIDER: "1", VERCEL: "1", GEMINI_API_KEY: KEY }),
    ).toMatchObject({
      kind: "live",
      providers: [{ id: "groq" }, { id: "gemini", status: "ready" }],
    });
  });

  it("reads the real environment by default", () => {
    vi.stubEnv("AI_FAKE_PROVIDER", "1");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AI_PRIMARY_PROVIDER", "gemini");
    expect(getAiProviderConfig()).toEqual({ kind: "fake", order: ["gemini", "groq"] });
  });
});

describe("provider selection", () => {
  const ready = (id: "groq" | "gemini", apiKey: string, model: string) =>
    ({ id, status: "ready", apiKey, model }) as const;

  it("chains the providers that can answer, primary first, one client per key and model", () => {
    const config = {
      kind: "live" as const,
      providers: [
        ready("groq", GROQ_KEY, "openai/gpt-oss-20b"),
        ready("gemini", KEY, "gemini-3.8-flash"),
      ],
    };
    const first = getAiAvailability(config);
    const again = getAiAvailability(config);
    const otherModel = getAiAvailability({
      kind: "live",
      providers: [ready("groq", GROQ_KEY, "openai/gpt-oss-120b")],
    });

    expect(first).toMatchObject({ status: "ready", mode: "live" });
    if (first.status !== "ready" || again.status !== "ready" || otherModel.status !== "ready") {
      throw new Error("expected ready providers");
    }
    expect(first.chain.map((provider) => [provider.id, provider.model])).toEqual([
      ["groq", "openai/gpt-oss-20b"],
      ["gemini", "gemini-3.8-flash"],
    ]);
    expect(again.chain[0]).toBe(first.chain[0]);
    expect(again.chain[1]).toBe(first.chain[1]);
    expect(otherModel.chain[0]).not.toBe(first.chain[0]);
    expect(sdk.options).toHaveBeenCalledTimes(1);
    expect(sdk.options).toHaveBeenCalledWith({ apiKey: KEY });
    expect(sdk.groqOptions).toHaveBeenCalledTimes(2);
  });

  it("leaves out providers that are not set up, and says why", () => {
    const groqOnly = getAiAvailability({
      kind: "live",
      providers: [
        ready("groq", GROQ_KEY, "openai/gpt-oss-20b"),
        { id: "gemini", status: "unavailable", reason: "missing_key", model: "gemini-3.8-flash" },
      ],
    });
    expect(groqOnly).toMatchObject({
      status: "ready",
      providers: [
        { id: "groq", state: "ready", model: "openai/gpt-oss-20b", reason: null },
        { id: "gemini", state: "unavailable", reason: "missing_key" },
      ],
    });
    expect(groqOnly.status === "ready" && groqOnly.chain.map((provider) => provider.id)).toEqual([
      "groq",
    ]);

    expect(
      getAiAvailability({
        kind: "live",
        providers: [
          { id: "groq", status: "unavailable", reason: "invalid_key", model: "openai/gpt-oss-20b" },
          { id: "gemini", status: "unavailable", reason: "missing_key", model: "gemini-3.8-flash" },
        ],
      }),
    ).toMatchObject({ status: "unavailable", reason: "no_provider" });
    expect(getAiAvailability({ kind: "invalid_primary" })).toEqual({
      status: "unavailable",
      reason: "invalid_primary",
      providers: [],
    });
  });

  it("uses one fake per provider, in the configured order", () => {
    const fake = getAiAvailability({ kind: "fake", order: ["groq", "gemini"] });
    expect(fake).toMatchObject({
      status: "ready",
      mode: "fake",
      providers: [
        { id: "groq", state: "fake", model: "fake-groq" },
        { id: "gemini", state: "fake", model: "fake-gemini" },
      ],
    });
    expect(fake.status === "ready" && fake.chain.map((provider) => provider.model)).toEqual([
      "fake-groq",
      "fake-gemini",
    ]);
    expect(sdk.groqOptions).not.toHaveBeenCalled();
  });
});

describe("Gemini", () => {
  it("asks for schema-bound JSON, never stored, with retries left to the app", async () => {
    sdk.create.mockResolvedValue({
      status: "completed",
      output_text: ' {"ok": true} ',
      usage: { total_input_tokens: 120, total_output_tokens: 40, total_thought_tokens: 12 },
    });
    const signal = new AbortController().signal;
    const provider = createGeminiProvider(createGeminiClient(KEY), "gemini-3.8-flash");

    const answer = await provider.generateJson(request({ signal }));

    expect(provider.id).toBe("gemini");
    expect(answer).toEqual({
      text: '{"ok": true}',
      usage: { inputTokens: 120, outputTokens: 40, thoughtTokens: 12 },
    });
    expect(sdk.create).toHaveBeenCalledWith(
      {
        model: "gemini-3.8-flash",
        input: "<job_post>React developer</job_post>",
        system_instruction: "Extract the requirements.",
        store: false,
        generation_config: { thinking_level: "low", max_output_tokens: 1024 },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: { type: "object" },
        },
      },
      { signal, retries: { strategy: "none" } },
    );
  });

  it("treats a missing usage report as unknown counts", async () => {
    sdk.create.mockResolvedValue({ status: "completed", output_text: "{}" });
    const provider = createGeminiProvider(createGeminiClient(KEY), "gemini-3.8-flash");
    expect((await provider.generateJson(request())).usage).toEqual(NO_USAGE);
  });

  it.each([
    ["failed", "overloaded", true],
    ["incomplete", "invalid_response", false],
    ["budget_exceeded", "invalid_response", false],
  ])("turns a %s interaction into %s (retryable: %s)", async (status, code, retryable) => {
    sdk.create.mockResolvedValue({
      status,
      usage: { total_input_tokens: 10, total_output_tokens: 5 },
    });
    const provider = createGeminiProvider(createGeminiClient(KEY), "gemini-3.8-flash");
    await expect(provider.generateJson(request())).rejects.toMatchObject({
      code,
      retryable,
      usage: { inputTokens: 10, outputTokens: 5, thoughtTokens: null },
    });
  });

  it("treats an empty answer as invalid", async () => {
    sdk.create.mockResolvedValue({ status: "completed", output_text: "   " });
    const provider = createGeminiProvider(createGeminiClient(KEY), "gemini-3.8-flash");
    await expect(provider.generateJson(request())).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("maps SDK errors without keeping their messages", async () => {
    const error = Object.assign(new Error("quota for project 123 exceeded: <prompt text>"), {
      status: 429,
      headers: new Headers({ "retry-after": "2" }),
    });
    sdk.create.mockRejectedValue(error);
    const provider = createGeminiProvider(createGeminiClient(KEY), "gemini-3.8-flash");

    const failure = await provider.generateJson(request()).catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(AiProviderError);
    expect(failure).toMatchObject({ code: "rate_limited", retryable: true, retryAfterMs: 2000 });
    expect((failure as Error).message).toBe("AI provider error: rate_limited");
  });
});

describe("SDK error mapping", () => {
  it.each([
    [{ status: 401 }, { code: "auth", retryable: false }],
    [{ status: 403 }, { code: "auth", retryable: false }],
    [{ status: 400 }, { code: "rejected", retryable: false }],
    [{ status: 404 }, { code: "rejected", retryable: false }],
    [{ status: 503 }, { code: "overloaded", retryable: true }],
    [{ status: 429, headers: new Headers({ "retry-after": "soon" }) }, { retryAfterMs: null }],
    [{ status: 429, headers: new Headers({ "retry-after": "120" }) }, { retryAfterMs: 30_000 }],
    [{ name: "APIConnectionTimeoutError" }, { code: "timeout", retryable: false }],
    [{ name: "APIUserAbortError" }, { code: "timeout", retryable: false }],
    [{ name: "APIConnectionError" }, { code: "unavailable", retryable: true }],
  ])("maps %o", (shape, expected) => {
    const error = Object.assign(new Error("details"), shape);
    if ("name" in shape) error.name = shape.name;
    expect(toProviderError(error)).toMatchObject(expected);
  });

  it("passes provider errors through and maps non-errors to unavailable", () => {
    const own = new AiProviderError("rejected");
    expect(toProviderError(own)).toBe(own);
    expect(toProviderError("boom")).toMatchObject({ code: "unavailable", retryable: true });
    expect(toProviderError(null)).toMatchObject({ code: "unavailable" });
  });
});

describe("fake providers", () => {
  it("answer with the feature's fake answer and estimated usage", async () => {
    const provider = createFakeProvider("groq");
    expect(provider).toMatchObject({ id: "groq", model: fakeModel("groq") });
    const answer = await provider.generateJson(request({ fakeAnswer: () => ({ found: 2 }) }));
    expect(JSON.parse(answer.text)).toEqual({ found: 2 });
    expect(answer.usage.inputTokens).toBeGreaterThan(0);
    expect(answer.usage.thoughtTokens).toBe(0);
  });

  it.each([
    ["[[fake:rate_limited]]", { code: "rate_limited", retryable: true }],
    ["[[fake:overloaded]]", { code: "overloaded", retryable: true }],
    ["[[fake:timeout]]", { code: "timeout", retryable: false }],
    ["[[fake:rejected]]", { code: "rejected", retryable: false }],
    ["[[fake:auth]]", { code: "auth", retryable: false }],
  ])("simulate %s for every provider", async (marker, expected) => {
    for (const id of ["groq", "gemini"] as const) {
      await expect(
        createFakeProvider(id).generateJson(request({ input: `Post ${marker}` })),
      ).rejects.toMatchObject(expected);
    }
  });

  it("simulate a failure of one provider only, so the other can answer", async () => {
    const input = "Post [[fake:groq:timeout]]";
    await expect(createFakeProvider("groq").generateJson(request({ input }))).rejects.toMatchObject(
      { code: "timeout" },
    );
    await expect(
      createFakeProvider("gemini").generateJson(request({ input })),
    ).resolves.toMatchObject({ text: '{"ok":true}' });
  });

  it("return text that is not JSON on request, and stop when aborted", async () => {
    const provider = createFakeProvider("gemini");
    const answer = await provider.generateJson(request({ input: "[[fake:invalid]]" }));
    expect(() => JSON.parse(answer.text)).toThrow();

    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.generateJson(request({ signal: controller.signal })),
    ).rejects.toMatchObject({
      code: "timeout",
    });
  });
});

describe("withRetries", () => {
  let clock = 0;
  const now = () => clock;
  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const options = {
    budgetMs: 30_000,
    maxAttempts: 3,
    baseDelayMs: 1_000,
    now,
    sleep,
    random: () => 0,
  };

  beforeEach(() => {
    clock = 0;
    sleep.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first success with the attempts it took", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new AiProviderError("unavailable", { retryable: true }))
      .mockResolvedValueOnce("answer");
    expect(await withRetries(attempt, options)).toEqual({ value: "answer", attempts: 2 });
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("backs off exponentially and gives up after the last attempt", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValue(new AiProviderError("unavailable", { retryable: true }));
    await expect(withRetries(attempt, options)).rejects.toMatchObject({
      code: "unavailable",
      attempts: 3,
    });
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
  });

  it("waits as long as the provider asks", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(
        new AiProviderError("rate_limited", { retryable: true, retryAfterMs: 4_000 }),
      )
      .mockResolvedValueOnce("answer");
    await withRetries(attempt, options);
    expect(sleep).toHaveBeenCalledWith(4_000);
  });

  it("never retries a refusal, and stops when no time is left for another attempt", async () => {
    const refused = vi.fn().mockRejectedValue(new AiProviderError("rejected"));
    await expect(withRetries(refused, options)).rejects.toMatchObject({
      code: "rejected",
      attempts: 1,
    });
    expect(refused).toHaveBeenCalledTimes(1);

    const slow = vi
      .fn()
      .mockRejectedValue(
        new AiProviderError("rate_limited", { retryable: true, retryAfterMs: 28_000 }),
      );
    await expect(withRetries(slow, options)).rejects.toMatchObject({
      code: "rate_limited",
      attempts: 1,
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("treats unknown errors as an unavailable provider", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("socket hang up"));
    await expect(withRetries(attempt, { ...options, maxAttempts: 1 })).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("stops waiting at the deadline even when an attempt ignores the signal", async () => {
    vi.useFakeTimers();
    const attempt = vi.fn(() => new Promise<never>(() => {}));
    const outcome = withRetries(attempt, { budgetMs: 1_000, maxAttempts: 3, baseDelayMs: 10 });
    vi.advanceTimersByTime(1_000);
    await expect(outcome).rejects.toMatchObject({ code: "timeout", attempts: 1 });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("aborts the attempt when the budget runs out, without retrying", async () => {
    vi.useFakeTimers();
    const attempt = vi.fn(
      (signal: AbortSignal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const outcome = withRetries(attempt, { budgetMs: 1_000, maxAttempts: 3, baseDelayMs: 10 });
    vi.advanceTimersByTime(1_000);
    await expect(outcome).rejects.toMatchObject({ code: "timeout", attempts: 1 });
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

describe("estimateCostUsd", () => {
  const usage = { inputTokens: 1_000_000, outputTokens: 200_000, thoughtTokens: 100_000 };

  it("bills thinking as output at the price of the day", () => {
    // 1M × $0.75 + 0.3M × $3.75
    expect(estimateCostUsd("gemini-3.8-flash", usage, new Date("2026-10-23T10:00:00Z"))).toBe(
      1.875,
    );
    // Prices double on 2027-01-01.
    expect(estimateCostUsd("gemini-3.8-flash", usage, new Date("2027-01-01T00:00:00Z"))).toBe(3.75);
  });

  it("prices Groq's gpt-oss-20b at its list price", () => {
    // 1M × $0.075 + 0.3M × $0.30
    expect(estimateCostUsd("openai/gpt-oss-20b", usage, new Date("2026-10-23"))).toBe(0.165);
  });

  it("knows nothing about other models or missing counts", () => {
    expect(estimateCostUsd(fakeModel("groq"), usage, new Date())).toBeNull();
    expect(estimateCostUsd("gemini-3.8-flash", NO_USAGE, new Date())).toBeNull();
    expect(
      estimateCostUsd(
        "gemini-3.8-flash",
        { ...usage, thoughtTokens: null },
        new Date("2026-10-23"),
      ),
    ).toBe(1.5);
  });
});

describe("AI error codes", () => {
  it("recognizes its own codes only, and which ones a provider caused", () => {
    expect(isAiErrorCode("ai_busy")).toBe(true);
    expect(isAiErrorCode("ai_providers_unavailable")).toBe(true);
    expect(isAiErrorCode("unavailable")).toBe(false);
    expect(isProviderErrorCode("ai_key_rejected")).toBe(true);
    expect(isProviderErrorCode("ai_providers_unavailable")).toBe(false);
    expect(isProviderErrorCode("ai_limit_reached")).toBe(false);
  });
});
