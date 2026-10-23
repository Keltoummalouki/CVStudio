import { beforeEach, describe, expect, it, vi } from "vitest";
import { toAiAccess } from "@/features/ai-settings/access";
import type { AiStatus } from "@/features/ai-settings/server/queries";
import { createFakeProvider } from "@/lib/ai/fake";
import type { AiProviderStatus } from "@/lib/ai/provider";
import { DataAccessError } from "@/lib/data/errors";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  OWNER_ID,
  ownerContext,
  type FakeSupabaseOptions,
  type QueryResult,
  type RecordedQuery,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  getOwnerContext: vi.fn(),
  getAiAvailability: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireOwner: mocks.requireOwner,
  getOwnerContext: mocks.getOwnerContext,
}));
vi.mock("@/lib/ai/provider", () => ({ getAiAvailability: mocks.getAiAvailability }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));

const { getAiOverview, getAiStatus } = await import("@/features/ai-settings/server/queries");
const { saveAiSettings } = await import("@/features/ai-settings/server/actions");

const NOW = new Date("2026-10-23T15:30:00Z");

const PROVIDERS: AiProviderStatus[] = [
  { id: "groq", model: "openai/gpt-oss-20b", state: "ready", reason: null },
  { id: "gemini", model: "gemini-3.8-flash", state: "unavailable", reason: "missing_key" },
];

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.requireOwner.mockResolvedValue(ownerContext(fake));
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

const requestRow = (overrides: Record<string, unknown> = {}) => ({
  id: "r1",
  feature: "job_post_analysis",
  status: "succeeded",
  error_code: null,
  started_at: "2026-10-23T15:00:00Z",
  duration_ms: 2400,
  input_tokens: 900,
  output_tokens: 300,
  thought_tokens: 50,
  estimated_cost_usd: 0.002,
  provider: "groq",
  model: "openai/gpt-oss-20b",
  ai_request_attempts: [{ position: 1, provider: "groq", status: "succeeded", error_code: null }],
  ...overrides,
});

beforeEach(() => {
  mocks.requireOwner.mockReset();
  mocks.getOwnerContext.mockReset();
  mocks.refresh.mockReset();
  mocks.getAiAvailability.mockReset().mockReturnValue({
    status: "ready",
    mode: "live",
    chain: [createFakeProvider("groq")],
    providers: PROVIDERS,
  });
});

describe("getAiStatus", () => {
  it("defaults to AI off and counts today's requests from midnight UTC", async () => {
    const fake = signIn({ tables: { owner_settings: { data: null }, ai_requests: { count: 3 } } });

    expect(await getAiStatus(NOW)).toEqual({
      mode: "live",
      reason: null,
      providers: PROVIDERS,
      settings: { enabled: false, dailyLimit: 10 },
      usedToday: 3,
      resetsAt: "2026-10-24T00:00:00.000Z",
    });

    expect(isOwnerScoped(fake.queriesOn("owner_settings")[0])).toBe(true);
    const count = fake.queriesOn("ai_requests")[0];
    expect(isOwnerScoped(count)).toBe(true);
    expect(callsOf(count, "gte")).toEqual([["started_at", "2026-10-23T00:00:00.000Z"]]);
  });

  it("reads saved settings and why AI is unavailable", async () => {
    signIn({
      tables: {
        owner_settings: { data: { ai_enabled: true, ai_daily_limit: 25 } },
        ai_requests: { count: null },
      },
    });
    mocks.getAiAvailability.mockReturnValue({
      status: "unavailable",
      reason: "no_provider",
      providers: [{ ...PROVIDERS[0], state: "unavailable", reason: "invalid_key" }, PROVIDERS[1]],
    });

    expect(await getAiStatus(NOW)).toMatchObject({
      mode: "unavailable",
      reason: "no_provider",
      providers: [
        { id: "groq", reason: "invalid_key" },
        { id: "gemini", reason: "missing_key" },
      ],
      settings: { enabled: true, dailyLimit: 25 },
      usedToday: 0,
    });
  });

  it("flags the test providers", async () => {
    signIn({ tables: { owner_settings: { data: null }, ai_requests: { count: 0 } } });
    mocks.getAiAvailability.mockReturnValue({
      status: "ready",
      mode: "fake",
      chain: [createFakeProvider("groq")],
      providers: [{ id: "groq", model: "fake-groq", state: "fake", reason: null }],
    });
    expect(await getAiStatus(NOW)).toMatchObject({ mode: "fake", reason: null });
  });

  it.each([
    [{ owner_settings: { error: { message: "down" } }, ai_requests: { count: 0 } }],
    [{ owner_settings: { data: null }, ai_requests: { error: { message: "down" } } }],
  ])("fails as a data access error: %o", async (tables) => {
    signIn({ tables });
    await expect(getAiStatus(NOW)).rejects.toBeInstanceOf(DataAccessError);
  });
});

/** Answers the four request-log reads by what they select. */
function requestLog(answers: {
  count?: QueryResult;
  month?: QueryResult;
  recent?: QueryResult;
  last?: QueryResult;
}) {
  return (query: RecordedQuery): QueryResult => {
    const columns = String(callsOf(query, "select")[0]?.[0]);
    if (columns === "id") return answers.count ?? { count: 0 };
    if (columns === "estimated_cost_usd") return answers.month ?? { data: [] };
    if (columns.startsWith("provider, model")) return answers.last ?? { data: null };
    return answers.recent ?? { data: [] };
  };
}

const selecting = (fake: ReturnType<typeof signIn>, columns: string) =>
  fake
    .queriesOn("ai_requests")
    .find((query) => String(callsOf(query, "select")[0]?.[0]).startsWith(columns));

describe("getAiOverview", () => {
  it("adds the month's estimated cost and the latest requests with their providers, metadata only", async () => {
    const fake = signIn({
      tables: {
        owner_settings: { data: { ai_enabled: true, ai_daily_limit: 10 } },
        ai_requests: requestLog({
          count: { count: 1 },
          recent: {
            data: [
              requestRow(),
              requestRow({
                id: "r2",
                status: "succeeded",
                provider: "gemini",
                model: "gemini-3.8-flash",
                // Out of order, as PostgREST may return embedded rows.
                ai_request_attempts: [
                  { position: 2, provider: "gemini", status: "succeeded", error_code: null },
                  { position: 1, provider: "groq", status: "failed", error_code: "timeout" },
                ],
              }),
              requestRow({
                id: "r3",
                status: "failed",
                error_code: "abandoned",
                provider: null,
                ai_request_attempts: [],
                estimated_cost_usd: null,
              }),
              requestRow({ id: "r4", feature: "something_else" }),
              requestRow({ id: "r5", status: "weird" }),
              requestRow({
                id: "r6",
                provider: "openai",
                ai_request_attempts: [
                  { position: 1, provider: "openai", status: "succeeded", error_code: null },
                ],
              }),
            ],
          },
          month: {
            data: [
              { estimated_cost_usd: 0.0021 },
              { estimated_cost_usd: null },
              { estimated_cost_usd: 0.0004 },
            ],
          },
          last: {
            data: {
              provider: "gemini",
              model: "gemini-3.8-flash",
              started_at: "2026-10-23T14:00:00Z",
              ai_request_attempts: [{ position: 1 }, { position: 2 }],
            },
          },
        }),
      },
    });

    const overview = await getAiOverview(NOW);

    expect(overview.month).toEqual({ requests: 3, estimatedCostUsd: 0.0025 });
    expect(overview.lastSuccess).toEqual({
      provider: "gemini",
      model: "gemini-3.8-flash",
      startedAt: "2026-10-23T14:00:00Z",
      fallback: true,
    });
    expect(overview.recent).toEqual([
      {
        id: "r1",
        feature: "job_post_analysis",
        status: "succeeded",
        errorCode: null,
        startedAt: "2026-10-23T15:00:00Z",
        durationMs: 2400,
        inputTokens: 900,
        outputTokens: 300,
        thoughtTokens: 50,
        estimatedCostUsd: 0.002,
        provider: "groq",
        model: "openai/gpt-oss-20b",
        attempts: [{ provider: "groq", status: "succeeded", errorCode: null }],
      },
      expect.objectContaining({
        id: "r2",
        provider: "gemini",
        attempts: [
          { provider: "groq", status: "failed", errorCode: "timeout" },
          { provider: "gemini", status: "succeeded", errorCode: null },
        ],
      }),
      expect.objectContaining({ id: "r3", provider: null, attempts: [] }),
      // A provider this version does not know is shown without a name.
      expect.objectContaining({ id: "r6", provider: null, attempts: [] }),
    ]);
    const month = selecting(fake, "estimated_cost_usd");
    expect(isOwnerScoped(month)).toBe(true);
    expect(callsOf(month, "gte")).toEqual([["started_at", "2026-10-01T00:00:00.000Z"]]);
    const recent = selecting(fake, "id, feature");
    expect(isOwnerScoped(recent)).toBe(true);
    expect(callsOf(recent, "limit")).toEqual([[10]]);
    const last = selecting(fake, "provider, model");
    expect(isOwnerScoped(last)).toBe(true);
    expect(callsOf(last, "eq")).toContainEqual(["status", "succeeded"]);
    expect(callsOf(last, "limit")).toEqual([[1]]);
    // Only metadata columns exist and are read.
    for (const query of [recent, last]) {
      expect(String(callsOf(query, "select")[0]?.[0])).not.toMatch(/prompt|input_text|answer/);
    }
  });

  it("has no last analysis before the first success, and no fallback without a second attempt", async () => {
    signIn({ tables: { owner_settings: { data: null }, ai_requests: requestLog({}) } });
    expect((await getAiOverview(NOW)).lastSuccess).toBeNull();

    signIn({
      tables: {
        owner_settings: { data: null },
        ai_requests: requestLog({
          last: {
            data: {
              provider: "groq",
              model: "openai/gpt-oss-20b",
              started_at: "2026-10-23T14:00:00Z",
              ai_request_attempts: [{ position: 1 }],
            },
          },
        }),
      },
    });
    expect((await getAiOverview(NOW)).lastSuccess).toMatchObject({
      provider: "groq",
      fallback: false,
    });
  });

  it.each([
    [{ recent: { error: { message: "down" } } }],
    [{ month: { error: { message: "down" } } }],
    [{ last: { error: { message: "down" } } }],
  ])("fails as a data access error: %o", async (answers) => {
    signIn({ tables: { owner_settings: { data: null }, ai_requests: requestLog(answers) } });
    await expect(getAiOverview(NOW)).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("saveAiSettings", () => {
  it("requires the owner", async () => {
    mocks.getOwnerContext.mockResolvedValue(null);
    expect(await saveAiSettings({ enabled: true, dailyLimit: 10 })).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("stores the owner's choice and returns what was saved", async () => {
    const fake = signIn({
      tables: { owner_settings: { data: { ai_enabled: true, ai_daily_limit: 50 } } },
    });

    expect(await saveAiSettings({ enabled: true, dailyLimit: 50 })).toEqual({
      ok: true,
      data: { enabled: true, dailyLimit: 50 },
    });
    expect(callsOf(fake.queriesOn("owner_settings")[0], "upsert")[0]).toEqual([
      { owner_id: OWNER_ID, ai_enabled: true, ai_daily_limit: 50 },
      { onConflict: "owner_id" },
    ]);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([0, 51, 2.5, "10", null])("refuses a daily limit of %o", async (dailyLimit) => {
    const fake = signIn();
    expect(await saveAiSettings({ enabled: true, dailyLimit })).toMatchObject({
      ok: false,
      error: "invalid_input",
    });
    expect(fake.queries).toHaveLength(0);
  });

  it("maps database refusals", async () => {
    signIn({ tables: { owner_settings: { error: { code: "23514", message: "check" } } } });
    expect(await saveAiSettings({ enabled: false, dailyLimit: 5 })).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("toAiAccess", () => {
  const status = (overrides: Partial<AiStatus> = {}): AiStatus => ({
    mode: "live",
    reason: null,
    providers: [
      { id: "groq", model: "openai/gpt-oss-20b", state: "ready", reason: null },
      { id: "gemini", model: "gemini-3.8-flash", state: "ready", reason: null },
    ],
    settings: { enabled: true, dailyLimit: 10 },
    usedToday: 4,
    resetsAt: "2026-10-24T00:00:00.000Z",
    ...overrides,
  });

  it("is ready with requests left, and lists who may receive the post, in order", () => {
    expect(toAiAccess(status())).toEqual({
      state: "ready",
      fake: false,
      providers: ["groq", "gemini"],
      remaining: 6,
      resetsAt: "2026-10-24T00:00:00.000Z",
    });
    expect(toAiAccess(status({ providers: PROVIDERS })).providers).toEqual(["groq"]);
  });

  it.each([
    [{ mode: "unavailable" as const, reason: "no_provider" as const }, "unavailable"],
    [{ settings: { enabled: false, dailyLimit: 10 } }, "off"],
    [{ usedToday: 12 }, "limit"],
  ])("explains why it cannot run: %o", (overrides, state) => {
    expect(toAiAccess(status(overrides))).toMatchObject({ state, remaining: expect.any(Number) });
  });

  it("flags the test providers", () => {
    expect(toAiAccess(status({ mode: "fake" }))).toMatchObject({ state: "ready", fake: true });
  });
});
