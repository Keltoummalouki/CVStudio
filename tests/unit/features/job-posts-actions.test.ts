import { beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYSIS_INSTRUCTIONS, analysisAnswerSchema } from "@/features/job-posts/analysis";
import type { JobPostValues } from "@/features/job-posts/schemas";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  refresh: vi.fn(),
  runAiRequest: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/ai/run", () => ({ runAiRequest: mocks.runAiRequest }));

const { analyzeJobPost, deleteJobPost, restoreJobPost, saveJobPost } =
  await import("@/features/job-posts/server/actions");

const JOB_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const UPDATED_AT = "2026-10-23T09:00:00.123456+00:00";
const SAVED_AT = "2026-10-23T09:05:00.654321+00:00";
const POST = "We are hiring a frontend developer with React, TypeScript and fluent English.";

function values(overrides: Partial<JobPostValues> = {}): JobPostValues {
  return {
    id: null,
    expectedUpdatedAt: null,
    title: "  Frontend developer ",
    company: "Acme",
    language: "en",
    description: POST,
    requirements: {
      schemaVersion: 1,
      titleAliases: ["Développeur front-end"],
      items: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          label: "React",
          kind: "skill",
          importance: "required",
          aliases: ["React.js"],
          note: "",
        },
      ],
    },
    analyzed: false,
    ...overrides,
  };
}

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.getOwnerContext.mockReset();
  mocks.refresh.mockReset();
  mocks.runAiRequest.mockReset();
});

describe("job post actions require the owner", () => {
  it.each([
    ["saveJobPost", () => saveJobPost(values())],
    ["deleteJobPost", () => deleteJobPost(JOB_ID)],
    ["restoreJobPost", () => restoreJobPost(JOB_ID)],
    ["analyzeJobPost", () => analyzeJobPost({ description: POST })],
  ])("%s answers unauthorized without a session", async (_name, action) => {
    mocks.getOwnerContext.mockResolvedValue(null);
    expect(await action()).toEqual({ ok: false, error: "unauthorized" });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
  });
});

describe("saveJobPost", () => {
  it("creates a job post for the owner", async () => {
    const fake = signIn({ tables: { job_posts: { data: { id: JOB_ID, updated_at: SAVED_AT } } } });

    expect(await saveJobPost(values())).toEqual({
      ok: true,
      data: { id: JOB_ID, updatedAt: SAVED_AT },
    });

    const [row] = callsOf(fake.queriesOn("job_posts")[0], "insert")[0] as [Record<string, unknown>];
    expect(row).toEqual({
      owner_id: "5f0c2b1e-8d4a-4c3b-9e2f-1a0b9c8d7e6f",
      title: "Frontend developer",
      company: "Acme",
      language: "en",
      description: POST,
      requirements: values().requirements,
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("stamps requirements that come from a reviewed analysis", async () => {
    const fake = signIn({ tables: { job_posts: { data: { id: JOB_ID, updated_at: SAVED_AT } } } });
    await saveJobPost(values({ analyzed: true }));
    const [row] = callsOf(fake.queriesOn("job_posts")[0], "insert")[0] as [Record<string, unknown>];
    expect(row.analyzed_at).toEqual(expect.any(String));
  });

  it("refuses invalid values with field issues, before any write", async () => {
    const fake = signIn();
    const duplicate = values();
    duplicate.requirements.items.push({
      ...duplicate.requirements.items[0]!,
      id: "00000000-0000-4000-8000-000000000002",
      label: "ReactJS",
      aliases: [],
    });

    expect(await saveJobPost({ ...values(), title: " " })).toMatchObject({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "title", message: "required" }],
    });
    expect(await saveJobPost(duplicate)).toMatchObject({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "requirements.items.1.label", message: "duplicateTerm" }],
    });
    expect(await saveJobPost({ ...values(), owner_id: "someone else" })).toMatchObject({
      error: "invalid_input",
    });
    expect(fake.queries).toHaveLength(0);
  });

  it("reports database refusals without their details", async () => {
    signIn({ tables: { job_posts: { error: { code: "23514", message: "check violation" } } } });
    expect(await saveJobPost(values())).toEqual({ ok: false, error: "invalid_input" });
  });

  it("updates only the version the editor loaded, scoped to the owner", async () => {
    const fake = signIn({ tables: { job_posts: { data: { id: JOB_ID, updated_at: SAVED_AT } } } });

    expect(await saveJobPost(values({ id: JOB_ID, expectedUpdatedAt: UPDATED_AT }))).toEqual({
      ok: true,
      data: { id: JOB_ID, updatedAt: SAVED_AT },
    });

    const update = fake.queriesOn("job_posts")[0];
    expect(isOwnerScoped(update)).toBe(true);
    expect(callsOf(update, "eq")).toContainEqual(["id", JOB_ID]);
    expect(callsOf(update, "eq")).toContainEqual(["updated_at", UPDATED_AT]);
    expect(callsOf(update, "is")).toContainEqual(["deleted_at", null]);
    expect(callsOf(update, "update")[0]?.[0]).not.toHaveProperty("analyzed_at");
    expect(callsOf(update, "update")[0]?.[0]).not.toHaveProperty("owner_id");
  });

  it("needs the loaded version to update", async () => {
    signIn();
    expect(await saveJobPost(values({ id: JOB_ID }))).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });

  it.each([
    [{ data: { id: JOB_ID } }, "stale"],
    [{ data: null }, "not_found"],
    [{ error: { message: "network" } }, "unavailable"],
  ])("explains why nothing was updated: %o → %s", async (check, error) => {
    signIn({ tables: { job_posts: [{ data: null }, check] } });
    expect(await saveJobPost(values({ id: JOB_ID, expectedUpdatedAt: UPDATED_AT }))).toEqual({
      ok: false,
      error,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("maps a failed update", async () => {
    signIn({ tables: { job_posts: { error: { code: "42501", message: "denied" } } } });
    expect(await saveJobPost(values({ id: JOB_ID, expectedUpdatedAt: UPDATED_AT }))).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });
});

describe("deleteJobPost and restoreJobPost", () => {
  it("moves a job post out of the list and back, scoped to the owner", async () => {
    const fake = signIn({ tables: { job_posts: { data: { id: JOB_ID } } } });

    expect(await deleteJobPost(JOB_ID)).toEqual({ ok: true, data: undefined });
    expect(await restoreJobPost(JOB_ID)).toEqual({ ok: true, data: undefined });

    const [removal, restore] = fake.queriesOn("job_posts");
    expect(isOwnerScoped(removal)).toBe(true);
    expect(callsOf(removal, "update")[0]?.[0]).toEqual({ deleted_at: expect.any(String) });
    expect(callsOf(removal, "is")).toContainEqual(["deleted_at", null]);
    expect(callsOf(restore, "update")[0]?.[0]).toEqual({ deleted_at: null });
    expect(callsOf(restore, "not")).toContainEqual(["deleted_at", "is", null]);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("refuses ids that are not UUIDs and reports missing or failed rows", async () => {
    signIn({ tables: { job_posts: [{ data: null }, { error: { code: "08006" } }] } });
    expect(await deleteJobPost("../etc")).toEqual({ ok: false, error: "invalid_input" });
    expect(await deleteJobPost(JOB_ID)).toEqual({ ok: false, error: "not_found" });
    expect(await restoreJobPost(JOB_ID)).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("analyzeJobPost", () => {
  it("sends only the job post, and returns a draft without saving anything", async () => {
    const fake = signIn();
    mocks.runAiRequest.mockResolvedValue({
      ok: true,
      data: {
        title: "Frontend developer",
        company: "",
        language: "en",
        titleAliases: [],
        requirements: [
          {
            label: "React",
            kind: "skill",
            importance: "required",
            aliases: ["React.js"],
            note: "",
          },
        ],
      },
    });

    const result = await analyzeJobPost({ description: `  ${POST}  ` });

    expect(result).toMatchObject({
      ok: true,
      data: {
        title: "Frontend developer",
        description: POST,
        analyzed: true,
        requirements: { items: [{ label: "React", aliases: ["React.js"] }] },
      },
    });
    const [request] = mocks.runAiRequest.mock.calls[0] as [Record<string, unknown>];
    expect(request).toMatchObject({
      feature: "job_post_analysis",
      instructions: ANALYSIS_INSTRUCTIONS,
      input: `<job_post>\n${POST}\n</job_post>`,
      schema: analysisAnswerSchema,
      maxOutputTokens: 8192,
    });
    expect(request.context).toEqual(ownerContext(fake));
    expect(fake.queries).toHaveLength(0);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("refuses a text too short to be a job post, before any AI request", async () => {
    signIn();
    expect(await analyzeJobPost({ description: "React" })).toMatchObject({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "description", message: "tooShort" }],
    });
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
  });

  it("passes AI refusals through", async () => {
    signIn();
    mocks.runAiRequest.mockResolvedValue({ ok: false, error: "ai_limit_reached" });
    expect(await analyzeJobPost({ description: POST })).toEqual({
      ok: false,
      error: "ai_limit_reached",
    });
  });

  it("passes on which provider failed, for the message to name it", async () => {
    signIn();
    mocks.runAiRequest.mockResolvedValue({ ok: false, error: "ai_key_rejected", provider: "groq" });
    expect(await analyzeJobPost({ description: POST })).toEqual({
      ok: false,
      error: "ai_key_rejected",
      provider: "groq",
    });
  });
});
