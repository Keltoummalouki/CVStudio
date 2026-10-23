import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AiProviderId } from "@/config/ai";
import { createFakeProvider } from "@/lib/ai/fake";
import type { AiAvailability } from "@/lib/ai/provider";
import { runAiRequest } from "@/lib/ai/run";
import {
  AiProviderError,
  type AiFailure,
  type AiProvider,
  type JsonResponse,
} from "@/lib/ai/types";
import {
  createFakeSupabase,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const REQUEST_ID = "7b1f0c2e-3d4a-4b5c-8d6e-9f0a1b2c3d4e";
const POST = "Confidential job post: React developer at Example Corp";
const schema = z.object({ found: z.number() });

let clock = 0;
const now = () => {
  clock += 250;
  return clock;
};

const answer = (found: number, usage: Partial<JsonResponse["usage"]> = {}): JsonResponse => ({
  text: JSON.stringify({ found }),
  usage: { inputTokens: 5, outputTokens: 5, thoughtTokens: 0, ...usage },
});

function stub(
  id: AiProviderId,
  generateJson: AiProvider["generateJson"],
  model = id === "groq" ? "openai/gpt-oss-20b" : "gemini-3.8-flash",
): AiProvider {
  return { id, model, generateJson };
}

const ready = (...chain: [AiProvider, ...AiProvider[]]): AiAvailability => ({
  status: "ready",
  mode: "live",
  chain,
  providers: [],
});

const fakes: AiAvailability = {
  status: "ready",
  mode: "fake",
  chain: [createFakeProvider("groq"), createFakeProvider("gemini")],
  providers: [],
};

const failing = (code: AiFailure, options: ConstructorParameters<typeof AiProviderError>[1] = {}) =>
  vi.fn(async (): Promise<JsonResponse> => {
    throw new AiProviderError(code, options);
  });

function signIn(rpc: FakeSupabaseOptions["rpc"] = {}) {
  return createFakeSupabase({ rpc: { begin_ai_request: { data: REQUEST_ID }, ...rpc } });
}

function run(
  fake: ReturnType<typeof createFakeSupabase>,
  overrides: Partial<Parameters<typeof runAiRequest<{ found: number }>>[0]> = {},
) {
  return runAiRequest({
    context: ownerContext(fake),
    feature: "job_post_analysis",
    instructions: "Extract the requirements.",
    input: POST,
    jsonSchema: { type: "object" },
    schema,
    maxOutputTokens: 100,
    fakeAnswer: () => ({ found: 3 }),
    availability: fakes,
    now,
    sleep: async () => {},
    ...overrides,
  });
}

const rpcCalls = (fake: ReturnType<typeof createFakeSupabase>, fn: string) =>
  fake.client.rpc.mock.calls.filter(([name]) => name === fn);

const rpcCall = (fake: ReturnType<typeof createFakeSupabase>, fn: string) =>
  rpcCalls(fake, fn)[0]?.[1] as Record<string, unknown> | undefined;

const loggedLines = () => errors.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])));

let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clock = 0;
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runAiRequest", () => {
  it("checks the quota, calls the primary provider and records how the request ended", async () => {
    const fake = signIn();

    expect(await run(fake)).toEqual({ ok: true, data: { found: 3 } });

    expect(rpcCall(fake, "begin_ai_request")).toEqual({
      p_feature: "job_post_analysis",
      p_model: "fake-groq",
    });
    expect(rpcCall(fake, "finish_ai_request")).toEqual({
      p_request_id: REQUEST_ID,
      p_succeeded: true,
      p_attempts: 1,
      p_duration_ms: expect.any(Number),
      p_input_tokens: expect.any(Number),
      p_output_tokens: expect.any(Number),
      p_thought_tokens: 0,
      p_provider_attempts: [
        {
          provider: "groq",
          model: "fake-groq",
          succeeded: true,
          error_code: null,
          http_status: null,
          attempts: 1,
          duration_ms: expect.any(Number),
          input_tokens: expect.any(Number),
          output_tokens: expect.any(Number),
          thought_tokens: 0,
          estimated_cost_usd: null,
        },
      ],
    });
    expect(errors).not.toHaveBeenCalled();
  });

  it("records the estimated cost of priced models", async () => {
    const fake = signIn();
    const groq = stub("groq", async () =>
      answer(1, { inputTokens: 1_000, outputTokens: 500, thoughtTokens: null }),
    );

    await run(fake, { availability: ready(groq) });

    // 1,000 × $0.075 + 500 × $0.30, per million tokens.
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_input_tokens: 1_000,
      p_output_tokens: 500,
      p_estimated_cost_usd: 0.000225,
    });
    expect(rpcCall(fake, "finish_ai_request")).not.toHaveProperty("p_thought_tokens");
  });

  it("does nothing when AI is not set up", async () => {
    const fake = signIn();
    expect(
      await run(fake, {
        availability: { status: "unavailable", reason: "no_provider", providers: [] },
      }),
    ).toEqual({ ok: false, error: "ai_not_configured" });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ error: { code: "P0001", message: "ai_disabled" } }, "ai_disabled"],
    [{ error: { code: "P0001", message: "ai_daily_limit_reached" } }, "ai_limit_reached"],
    [{ error: { code: "P0001", message: "ai_request_in_progress" } }, "ai_busy"],
    [{ error: { code: "42501", message: "not_authorized" } }, "unauthorized"],
    [{ error: { code: "08006", message: "connection failure" } }, "unavailable"],
    [{ data: null }, "unavailable"],
  ])("refuses before calling any provider when Postgres says %o", async (begin, error) => {
    const fake = signIn({ begin_ai_request: begin });
    const groq = vi.fn();
    const gemini = vi.fn();
    expect(
      await run(fake, { availability: ready(stub("groq", groq), stub("gemini", gemini)) }),
    ).toEqual({ ok: false, error });
    expect(groq).not.toHaveBeenCalled();
    expect(gemini).not.toHaveBeenCalled();
    expect(rpcCall(fake, "finish_ai_request")).toBeUndefined();
  });

  it("records a provider failure and logs codes only, never the request content", async () => {
    const fake = signIn();

    expect(await run(fake, { input: `${POST} [[fake:rejected]]` })).toEqual({
      ok: false,
      error: "ai_rejected",
      provider: "groq",
    });

    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_succeeded: false,
      p_error_code: "rejected",
      p_attempts: 1,
      p_provider_attempts: [
        { provider: "groq", succeeded: false, error_code: "rejected", http_status: 400 },
      ],
    });
    expect(errors).toHaveBeenCalledTimes(1);
    const line = String(errors.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      event: "ai_request_failed",
      stage: "provider",
      feature: "job_post_analysis",
      provider: "groq",
      model: "fake-groq",
      code: "rejected",
      status: 400,
      attempts: 1,
      durationMs: expect.any(Number),
      fallback: null,
    });
    expect(line).not.toContain("Confidential");
    expect(line).not.toContain("Extract the requirements");
  });

  it("counts the retries it made", async () => {
    const fake = signIn();
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new AiProviderError("unavailable", { retryable: true, status: 503 }))
      .mockResolvedValueOnce(answer(2));

    expect(await run(fake, { availability: ready(stub("groq", generate)) })).toEqual({
      ok: true,
      data: { found: 2 },
    });
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({ p_succeeded: true, p_attempts: 2 });
  });

  it("refuses answers that are not JSON or not the expected shape, keeping their usage", async () => {
    const notJson = signIn();
    expect(await run(notJson, { input: `${POST} [[fake:invalid]]` })).toEqual({
      ok: false,
      error: "ai_invalid_response",
      provider: "groq",
    });
    expect(rpcCall(notJson, "finish_ai_request")).toMatchObject({
      p_succeeded: false,
      p_error_code: "invalid_response",
      p_output_tokens: expect.any(Number),
    });

    const wrongShape = signIn();
    expect(await run(wrongShape, { fakeAnswer: () => ({ found: "three" }) })).toEqual({
      ok: false,
      error: "ai_invalid_response",
      provider: "groq",
    });
  });

  it("treats unexpected provider errors as unavailable", async () => {
    const fake = signIn();
    const generate = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await run(fake, { availability: ready(stub("gemini", generate)) })).toEqual({
      ok: false,
      error: "ai_unavailable",
      provider: "gemini",
    });
  });

  it("still returns the answer when the request log cannot be updated", async () => {
    const fake = signIn({
      finish_ai_request: { error: { code: "P0001", message: "record_not_found" } },
    });

    expect(await run(fake)).toEqual({ ok: true, data: { found: 3 } });
    expect(loggedLines()[0]).toMatchObject({
      event: "ai_request_failed",
      stage: "record",
      reason: "P0001",
    });
  });

  it("reads the configured providers when none are given", async () => {
    vi.stubEnv("AI_FAKE_PROVIDER", "1");
    vi.stubEnv("VERCEL", "");
    const fake = signIn();
    expect(await run(fake, { availability: undefined })).toEqual({ ok: true, data: { found: 3 } });
  });
});

type FallbackCase = { code: AiFailure; tries: number; retryable?: boolean; status?: number | null };

describe("fallback", () => {
  it.each<[string, FallbackCase]>([
    ["timeout", { code: "timeout", tries: 1 }],
    ["rate_limited", { code: "rate_limited", tries: 3, retryable: true, status: 429 }],
    // Groq's 413: one request over the plan's tokens per minute.
    ["too_large", { code: "too_large", tries: 1, status: 413 }],
    ["overloaded", { code: "overloaded", tries: 3, retryable: true, status: 503 }],
    ["unavailable", { code: "unavailable", tries: 3, retryable: true }],
  ])(
    "hands the request to Gemini when Groq fails with %s, as one request",
    async (_name, { code, tries, retryable = false, status = null }) => {
      const fake = signIn();
      const groq = failing(code, { retryable, status });
      const gemini = vi.fn(async () => answer(4));

      expect(
        await run(fake, { availability: ready(stub("groq", groq), stub("gemini", gemini)) }),
      ).toEqual({ ok: true, data: { found: 4 } });

      expect(groq).toHaveBeenCalledTimes(tries);
      expect(gemini).toHaveBeenCalledTimes(1);
      // One request, one unit of the daily quota.
      expect(rpcCalls(fake, "begin_ai_request")).toHaveLength(1);
      expect(rpcCalls(fake, "finish_ai_request")).toHaveLength(1);
      expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
        p_succeeded: true,
        p_attempts: tries + 1,
        p_provider_attempts: [
          {
            provider: "groq",
            model: "openai/gpt-oss-20b",
            succeeded: false,
            error_code: code,
            http_status: status,
            attempts: tries,
          },
          { provider: "gemini", model: "gemini-3.8-flash", succeeded: true, attempts: 1 },
        ],
      });
      expect(rpcCall(fake, "finish_ai_request")).not.toHaveProperty("p_error_code");
      expect(loggedLines()).toEqual([
        expect.objectContaining({ provider: "groq", code, fallback: "gemini" }),
      ]);
    },
  );

  it.each([
    ["auth", "ai_key_rejected", { status: 401 }],
    ["rejected", "ai_rejected", { status: 400 }],
  ] as const)("never hides a %s failure behind the fallback", async (code, error, options) => {
    const fake = signIn();
    const gemini = vi.fn(async () => answer(4));

    expect(
      await run(fake, {
        availability: ready(stub("groq", failing(code, options)), stub("gemini", gemini)),
      }),
    ).toEqual({ ok: false, error, provider: "groq" });
    expect(gemini).not.toHaveBeenCalled();
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_succeeded: false,
      p_error_code: code,
      p_provider_attempts: [{ provider: "groq", succeeded: false }],
    });
  });

  it("reports an unusable answer rather than paying for a second one", async () => {
    const fake = signIn();
    const gemini = vi.fn(async () => answer(4));
    const groq = vi.fn(async () => ({ ...answer(1), text: '{"found":' }));

    expect(
      await run(fake, { availability: ready(stub("groq", groq), stub("gemini", gemini)) }),
    ).toEqual({ ok: false, error: "ai_invalid_response", provider: "groq" });
    expect(gemini).not.toHaveBeenCalled();
  });

  it("says when both providers were unavailable, and records both", async () => {
    const fake = signIn();

    expect(
      await run(fake, {
        availability: ready(
          stub("groq", failing("timeout")),
          stub("gemini", failing("overloaded", { status: 503 })),
        ),
      }),
    ).toEqual({ ok: false, error: "ai_providers_unavailable" });

    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_succeeded: false,
      p_error_code: "overloaded",
      p_provider_attempts: [
        { provider: "groq", error_code: "timeout" },
        { provider: "gemini", error_code: "overloaded", http_status: 503 },
      ],
    });
    expect(loggedLines()).toEqual([
      expect.objectContaining({ provider: "groq", code: "timeout", fallback: "gemini" }),
      expect.objectContaining({ provider: "gemini", code: "overloaded", fallback: null }),
    ]);
  });

  it("names the fallback when it fails for a reason of its own", async () => {
    const fake = signIn();
    expect(
      await run(fake, {
        availability: ready(
          stub("groq", failing("timeout")),
          stub("gemini", failing("auth", { status: 403 })),
        ),
      }),
    ).toEqual({ ok: false, error: "ai_key_rejected", provider: "gemini" });
  });

  it("says a post is too long for Groq when no fallback can take it", async () => {
    const fake = signIn();
    expect(
      await run(fake, {
        availability: ready(stub("groq", failing("too_large", { status: 413 }))),
      }),
    ).toEqual({ ok: false, error: "ai_too_large", provider: "groq" });
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_error_code: "too_large",
      p_provider_attempts: [{ provider: "groq", error_code: "too_large", http_status: 413 }],
    });
  });

  it("adds up the usage and cost of every provider tried", async () => {
    const fake = signIn();
    const usage = { inputTokens: 10, outputTokens: 5, thoughtTokens: 0 };
    await run(fake, {
      availability: ready(
        stub("groq", failing("overloaded", { usage })),
        stub("gemini", async () =>
          answer(4, { inputTokens: 100, outputTokens: 50, thoughtTokens: 10 }),
        ),
      ),
    });

    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_input_tokens: 110,
      p_output_tokens: 55,
      p_thought_tokens: 10,
      // Groq: 10 × $0.075 + 5 × $0.30 = $0.000002 (rounded); Gemini: 100 × $0.75 + 60 × $3.75.
      p_estimated_cost_usd: 0.000302,
      p_provider_attempts: [
        { provider: "groq", input_tokens: 10, estimated_cost_usd: 0.000002 },
        { provider: "gemini", input_tokens: 100, estimated_cost_usd: 0.0003 },
      ],
    });
  });

  it("gives Groq at most 12 seconds while Gemini waits, and Gemini the rest", async () => {
    vi.useFakeTimers();
    const fake = signIn();
    // Never answers and ignores the abort: only the deadline ends it.
    const groq = vi.fn(() => new Promise<JsonResponse>(() => {}));
    const gemini = vi.fn(async () => answer(4));

    const outcome = run(fake, {
      availability: ready(stub("groq", groq), stub("gemini", gemini)),
      now: Date.now,
    });
    await vi.advanceTimersByTimeAsync(11_999);
    expect(gemini).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(await outcome).toEqual({ ok: true, data: { found: 4 } });
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_provider_attempts: [
        { provider: "groq", error_code: "timeout", duration_ms: 12_000 },
        { provider: "gemini", succeeded: true },
      ],
    });
  });

  it("lets the only provider use the whole budget", async () => {
    vi.useFakeTimers();
    const fake = signIn();
    const groq = vi.fn(() => new Promise<JsonResponse>(() => {}));

    const outcome = run(fake, { availability: ready(stub("groq", groq)), now: Date.now });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(rpcCall(fake, "finish_ai_request")).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(await outcome).toEqual({ ok: false, error: "ai_timeout", provider: "groq" });
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({ p_duration_ms: 30_000 });
  });

  it("does not start the fallback without the time to finish it", async () => {
    const fake = signIn();
    // Groq gives up after 25 of the 30 seconds.
    const groq = vi.fn(async (): Promise<JsonResponse> => {
      clock = 25_000;
      throw new AiProviderError("overloaded", { status: 503 });
    });
    const gemini = vi.fn(async () => answer(4));

    expect(
      await run(fake, { availability: ready(stub("groq", groq), stub("gemini", gemini)) }),
    ).toEqual({ ok: false, error: "ai_overloaded", provider: "groq" });
    expect(gemini).not.toHaveBeenCalled();
  });

  it("can put Gemini first, with Groq as its fallback", async () => {
    const fake = signIn();
    const groq = vi.fn(async () => answer(5));

    expect(
      await run(fake, {
        availability: ready(
          stub("gemini", failing("rate_limited", { status: 429 })),
          stub("groq", groq),
        ),
      }),
    ).toEqual({ ok: true, data: { found: 5 } });
    expect(rpcCall(fake, "begin_ai_request")).toMatchObject({ p_model: "gemini-3.8-flash" });
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_provider_attempts: [{ provider: "gemini" }, { provider: "groq", succeeded: true }],
    });
  });

  it("walks the fake providers the same way, for local runs and e2e", async () => {
    const fake = signIn();
    expect(await run(fake, { input: `${POST} [[fake:groq:timeout]]` })).toEqual({
      ok: true,
      data: { found: 3 },
    });
    expect(rpcCall(fake, "finish_ai_request")).toMatchObject({
      p_provider_attempts: [
        { provider: "groq", model: "fake-groq", error_code: "timeout" },
        { provider: "gemini", model: "fake-gemini", succeeded: true },
      ],
    });
  });
});
