import { beforeAll, describe, expect, it } from "vitest";
import type { Json } from "@/lib/supabase/database.types";
import {
  CHECK_VIOLATION,
  PERMISSION_DENIED,
  adminClient,
  anonClient,
  createUser,
  type TestUser,
} from "./helpers";

const FEATURE = { p_feature: "job_post_analysis", p_model: "gemini-3.8-flash" } as const;

async function enableAi(user: TestUser, dailyLimit: number) {
  const { error } = await user.client
    .from("owner_settings")
    .upsert({ owner_id: user.id, ai_enabled: true, ai_daily_limit: dailyLimit });
  if (error) throw error;
}

async function begin(user: TestUser) {
  return user.client.rpc("begin_ai_request", FEATURE);
}

async function finish(user: TestUser, id: string, succeeded = true) {
  return user.client.rpc("finish_ai_request", {
    p_request_id: id,
    p_succeeded: succeeded,
    p_attempts: 1,
    p_duration_ms: 1200,
    ...(succeeded
      ? {
          p_input_tokens: 800,
          p_output_tokens: 200,
          p_thought_tokens: 40,
          p_estimated_cost_usd: 0.00165,
        }
      : { p_error_code: "timeout" }),
  });
}

async function startedRequest(user: TestUser): Promise<string> {
  const { data, error } = await begin(user);
  if (error || !data) throw error ?? new Error("no request id");
  return data;
}

describe("owner settings", () => {
  let ownerA: TestUser;
  let ownerB: TestUser;
  let intruder: TestUser;

  beforeAll(async () => {
    [ownerA, ownerB, intruder] = await Promise.all([
      createUser({ allowlisted: true }),
      createUser({ allowlisted: true }),
      createUser({ allowlisted: false }),
    ]);
  });

  it("defaults to AI off with ten requests a day, for the owner only", async () => {
    const created = await ownerA.client
      .from("owner_settings")
      .insert({ owner_id: ownerA.id })
      .select("ai_enabled, ai_daily_limit")
      .single();
    expect(created.data).toEqual({ ai_enabled: false, ai_daily_limit: 10 });

    expect((await ownerB.client.from("owner_settings").select("owner_id")).data).toEqual([]);
    const update = await ownerB.client
      .from("owner_settings")
      .update({ ai_enabled: true })
      .eq("owner_id", ownerA.id)
      .select("owner_id");
    expect(update.data ?? []).toEqual([]);
    expect((await intruder.client.from("owner_settings").select("owner_id")).data).toEqual([]);
  });

  it("keeps the daily limit between 1 and 50", async () => {
    for (const limit of [0, 51]) {
      const { error } = await ownerA.client
        .from("owner_settings")
        .update({ ai_daily_limit: limit })
        .eq("owner_id", ownerA.id);
      expect(error?.code, String(limit)).toBe(CHECK_VIOLATION);
    }
  });

  it("never lets an owner write settings for someone else", async () => {
    const { error } = await ownerA.client.from("owner_settings").insert({ owner_id: ownerB.id });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["owner_settings", "ai_requests", "ai_request_attempts", "job_posts"] as const)(
    "%s: anonymous requests are refused",
    async (table) => {
      const { error } = await anonClient().from(table).select("*").limit(1);
      expect(error?.code).toBe(PERMISSION_DENIED);
    },
  );
});

describe("AI request log and quota", () => {
  it("is read-only for owners: rows are written by the quota functions only", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);

    const insert = await owner.client
      .from("ai_requests")
      .insert({ owner_id: owner.id, feature: "job_post_analysis", model: "m" });
    expect(insert.error?.code).toBe(PERMISSION_DENIED);
    const update = await owner.client.from("ai_requests").update({ status: "failed" }).eq("id", id);
    expect(update.error?.code).toBe(PERMISSION_DENIED);
    const removal = await owner.client.from("ai_requests").delete().eq("id", id);
    expect(removal.error?.code).toBe(PERMISSION_DENIED);
  });

  it("refuses requests while AI is off, and from anyone but an allowlisted owner", async () => {
    const owner = await createUser({ allowlisted: true });
    expect((await begin(owner)).error).toMatchObject({ code: "P0001", message: "ai_disabled" });

    const intruder = await createUser({ allowlisted: false });
    expect((await begin(intruder)).error?.code).toBe(PERMISSION_DENIED);
    expect((await anonClient().rpc("begin_ai_request", FEATURE)).error?.code).toBe(
      PERMISSION_DENIED,
    );
  });

  it("logs metadata the owner can read and nobody else can see or change", async () => {
    const owner = await createUser({ allowlisted: true });
    const other = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);

    expect((await finish(other, id)).error).toMatchObject({ message: "record_not_found" });
    expect((await finish(owner, id)).error).toBeNull();
    expect((await finish(owner, id)).error).toMatchObject({ message: "record_not_found" });

    const { data } = await owner.client
      .from("ai_requests")
      .select(
        "feature, model, status, error_code, attempts, input_tokens, output_tokens, thought_tokens, estimated_cost_usd, finished_at",
      )
      .eq("id", id)
      .single();
    expect(data).toEqual({
      feature: "job_post_analysis",
      model: "gemini-3.8-flash",
      status: "succeeded",
      error_code: null,
      attempts: 1,
      input_tokens: 800,
      output_tokens: 200,
      thought_tokens: 40,
      estimated_cost_usd: 0.00165,
      finished_at: expect.any(String),
    });
    expect((await other.client.from("ai_requests").select("id").eq("id", id)).data).toEqual([]);
  });

  it("allows one request at a time and stops at the daily limit, failed requests included", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 2);

    const first = await startedRequest(owner);
    expect((await begin(owner)).error).toMatchObject({ message: "ai_request_in_progress" });
    await finish(owner, first, false);

    const second = await startedRequest(owner);
    await finish(owner, second);

    expect((await begin(owner)).error).toMatchObject({ message: "ai_daily_limit_reached" });

    const failed = await owner.client
      .from("ai_requests")
      .select("status, error_code")
      .eq("id", first)
      .single();
    expect(failed.data).toEqual({ status: "failed", error_code: "timeout" });
  });

  it("cannot be raced: of simultaneous requests, exactly one starts", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 50);

    const results = await Promise.all(Array.from({ length: 8 }, () => begin(owner)));

    const started = results.filter((result) => result.data && !result.error);
    expect(started).toHaveLength(1);
    expect(
      results.filter((result) => result.error?.message === "ai_request_in_progress"),
    ).toHaveLength(7);
    const { count } = await owner.client
      .from("ai_requests")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("stops counting a request as running after two minutes without an answer", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const stuck = await startedRequest(owner);
    const { error } = await adminClient()
      .from("ai_requests")
      .update({ started_at: new Date(Date.now() - 3 * 60_000).toISOString() })
      .eq("id", stuck);
    if (error) throw error;

    await startedRequest(owner);

    const { data } = await owner.client
      .from("ai_requests")
      .select("status, error_code")
      .eq("id", stuck)
      .single();
    expect(data).toEqual({ status: "failed", error_code: "abandoned" });
  });

  it("only records error codes in the expected format", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);
    const { error } = await owner.client.rpc("finish_ai_request", {
      p_request_id: id,
      p_succeeded: false,
      p_attempts: 1,
      p_duration_ms: 10,
      p_error_code: "Contains the prompt: Senior React…",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("provider attempts", () => {
  const GROQ_TIMEOUT = {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    succeeded: false,
    error_code: "timeout",
    http_status: null,
    attempts: 1,
    duration_ms: 12_000,
    input_tokens: null,
    output_tokens: null,
    thought_tokens: null,
    estimated_cost_usd: null,
  };
  const GEMINI_ANSWER = {
    provider: "gemini",
    model: "gemini-3.8-flash",
    succeeded: true,
    error_code: null,
    http_status: null,
    attempts: 2,
    duration_ms: 4_000,
    input_tokens: 800,
    output_tokens: 200,
    thought_tokens: 40,
    estimated_cost_usd: 0.00165,
  };

  async function finishWith(user: TestUser, id: string, attempts: unknown, succeeded = true) {
    return user.client.rpc("finish_ai_request", {
      p_request_id: id,
      p_succeeded: succeeded,
      p_attempts: 3,
      p_duration_ms: 16_000,
      ...(succeeded ? {} : { p_error_code: "timeout" }),
      p_provider_attempts: attempts as Json,
    });
  }

  it("records each provider tried, in order, and the one that answered: one request", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);

    expect((await finishWith(owner, id, [GROQ_TIMEOUT, GEMINI_ANSWER])).error).toBeNull();

    const request = await owner.client
      .from("ai_requests")
      .select("status, provider, model, attempts")
      .eq("id", id)
      .single();
    expect(request.data).toEqual({
      status: "succeeded",
      provider: "gemini",
      model: "gemini-3.8-flash",
      attempts: 3,
    });
    const attempts = await owner.client
      .from("ai_request_attempts")
      .select(
        "owner_id, position, provider, model, status, error_code, http_status, attempts, duration_ms, input_tokens, estimated_cost_usd",
      )
      .eq("request_id", id)
      .order("position");
    expect(attempts.data).toEqual([
      {
        owner_id: owner.id,
        position: 1,
        provider: "groq",
        model: "openai/gpt-oss-20b",
        status: "failed",
        error_code: "timeout",
        http_status: null,
        attempts: 1,
        duration_ms: 12_000,
        input_tokens: null,
        estimated_cost_usd: null,
      },
      {
        owner_id: owner.id,
        position: 2,
        provider: "gemini",
        model: "gemini-3.8-flash",
        status: "succeeded",
        error_code: null,
        http_status: null,
        attempts: 2,
        duration_ms: 4_000,
        input_tokens: 800,
        estimated_cost_usd: 0.00165,
      },
    ]);
    // The fallback did not take another unit of the quota.
    const { count } = await owner.client
      .from("ai_requests")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("keeps attempts readable by their owner only, and written by finish_ai_request only", async () => {
    const owner = await createUser({ allowlisted: true });
    const other = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);
    await finishWith(owner, id, [GEMINI_ANSWER]);

    expect(
      (await other.client.from("ai_request_attempts").select("id").eq("request_id", id)).data,
    ).toEqual([]);
    const insert = await owner.client.from("ai_request_attempts").insert({
      owner_id: owner.id,
      request_id: id,
      position: 2,
      provider: "groq",
      model: "m",
      status: "succeeded",
      attempts: 1,
      duration_ms: 1,
    });
    expect(insert.error?.code).toBe(PERMISSION_DENIED);
    const update = await owner.client
      .from("ai_request_attempts")
      .update({ estimated_cost_usd: 0 })
      .eq("request_id", id);
    expect(update.error?.code).toBe(PERMISSION_DENIED);
    const removal = await owner.client.from("ai_request_attempts").delete().eq("request_id", id);
    expect(removal.error?.code).toBe(PERMISSION_DENIED);
  });

  it.each([
    ["an unknown provider", [{ ...GEMINI_ANSWER, provider: "openai" }], CHECK_VIOLATION],
    [
      "an error code with free text",
      [{ ...GROQ_TIMEOUT, error_code: "Senior React…" }],
      CHECK_VIOLATION,
    ],
    ["a value of the wrong type", [{ ...GEMINI_ANSWER, attempts: "two" }], "22P02"],
    ["no list", { provider: "groq" }, "22023"],
    ["more than four providers", Array.from({ length: 5 }, () => GEMINI_ANSWER), "22023"],
  ])("refuses %s as a whole, leaving the request open", async (_case, attempts, code) => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);

    expect((await finishWith(owner, id, attempts)).error?.code).toBe(code);

    const request = await owner.client.from("ai_requests").select("status").eq("id", id).single();
    expect(request.data).toEqual({ status: "pending" });
    const rows = await owner.client.from("ai_request_attempts").select("id").eq("request_id", id);
    expect(rows.data).toEqual([]);
  });

  it("still finishes a request without attempts, as before", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);
    expect((await finish(owner, id)).error).toBeNull();

    const { data } = await owner.client
      .from("ai_requests")
      .select("status, provider, model")
      .eq("id", id)
      .single();
    expect(data).toEqual({ status: "succeeded", provider: null, model: "gemini-3.8-flash" });
  });

  it("goes when its request goes", async () => {
    const owner = await createUser({ allowlisted: true });
    await enableAi(owner, 5);
    const id = await startedRequest(owner);
    await finishWith(owner, id, [GROQ_TIMEOUT, GEMINI_ANSWER]);

    const { error } = await adminClient().from("ai_requests").delete().eq("id", id);
    if (error) throw error;
    const { count } = await adminClient()
      .from("ai_request_attempts")
      .select("id", { count: "exact", head: true })
      .eq("request_id", id);
    expect(count).toBe(0);
  });
});

describe("job posts", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createUser({ allowlisted: true });
  });

  const insert = (row: Record<string, unknown>) =>
    owner.client
      .from("job_posts")
      .insert({ title: "Frontend developer", ...row })
      .select("id");

  it("stores a versioned requirements document by default", async () => {
    const { data } = await owner.client
      .from("job_posts")
      .insert({ title: "QA engineer" })
      .select("language, company, description, requirements, analyzed_at, deleted_at")
      .single();
    expect(data).toEqual({
      language: "other",
      company: "",
      description: "",
      requirements: { schemaVersion: 1, titleAliases: [], items: [] },
      analyzed_at: null,
      deleted_at: null,
    });
  });

  it.each([
    ["a blank title", { title: "  " }],
    ["an unknown language", { language: "de" }],
    ["a post over 15,000 characters", { description: "x".repeat(15_001) }],
    [
      "requirements of another version",
      { requirements: { schemaVersion: 2, titleAliases: [], items: [] } },
    ],
    ["requirements without items", { requirements: { schemaVersion: 1, titleAliases: [] } }],
    ["requirements without a version", { requirements: { titleAliases: [], items: [] } }],
    [
      "items that are not a list",
      { requirements: { schemaVersion: 1, titleAliases: [], items: {} } },
    ],
    ["requirements that are not an object", { requirements: [] }],
    [
      "more than 60 requirements",
      {
        requirements: {
          schemaVersion: 1,
          titleAliases: [],
          items: Array.from({ length: 61 }, () => ({})),
        },
      },
    ],
  ])("refuses %s", async (_case, row) => {
    const { error } = await insert(row);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});
