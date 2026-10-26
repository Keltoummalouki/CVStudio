import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_MASTER_DATA } from "@/features/cv-builder/master-data";
import type { TailorCvValues } from "@/features/cv-tailoring/schemas";
import { tailoringAnswerSchema } from "@/features/cv-tailoring/tailoring";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";
import { PROJECTS, SKILLS, TAILORING_JOB, tailoringCareer } from "../../fixtures/tailoring";

const mocks = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  loadMasterData: vi.fn(),
  runAiRequest: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("@/features/cv-builder/server/load-master-data", () => ({
  loadMasterData: mocks.loadMasterData,
}));
vi.mock("@/lib/ai/run", () => ({ runAiRequest: mocks.runAiRequest }));

const { tailorCv } = await import("@/features/cv-tailoring/server/actions");

const JOB_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";

const saved = (overrides: Partial<TailorCvValues> = {}): TailorCvValues => ({
  job: { kind: "saved", id: JOB_ID },
  cvLocale: "en",
  uiLocale: "en",
  mode: "ai",
  ...overrides,
});

const draft = {
  title: TAILORING_JOB.title,
  company: "Acme",
  language: "fr" as const,
  description: "Développeur Full Stack. React, Node.js, Kubernetes. PostgreSQL est un plus.",
  requirements: TAILORING_JOB.requirements,
  analyzed: true,
};

const JOB_ROW = {
  title: TAILORING_JOB.title,
  language: "fr",
  requirements: TAILORING_JOB.requirements,
};

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase({ tables: { job_posts: { data: JOB_ROW } }, ...options });
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

const AI_ANSWER = {
  projects: [
    { id: "P1", reason: "Uses React and Node.js." },
    { id: "P2", reason: "Uses PostgreSQL." },
  ],
  skills: ["S1"],
  title: "Full Stack Developer",
};

beforeEach(() => {
  mocks.getOwnerContext.mockReset();
  mocks.loadMasterData.mockReset().mockResolvedValue(tailoringCareer());
  mocks.runAiRequest.mockReset().mockResolvedValue({ ok: true, data: AI_ANSWER });
});

describe("tailorCv", () => {
  it("answers unauthorized without a session, before anything else", async () => {
    mocks.getOwnerContext.mockResolvedValue(null);
    expect(await tailorCv(saved())).toEqual({ ok: false, error: "unauthorized" });
    expect(mocks.loadMasterData).not.toHaveBeenCalled();
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
  });

  it("refuses invalid input, including a pasted post (the page reads it first)", async () => {
    const fake = signIn();
    for (const input of [
      { ...saved(), cvLocale: "de" },
      { ...saved(), mode: "magic" },
      { ...saved(), job: { kind: "saved", id: "../etc" } },
      { ...saved(), job: { kind: "pasted", description: "x".repeat(100) } },
      { ...saved(), job: { kind: "draft", draft: { ...draft, title: " " } } },
      { ...saved(), owner_id: "someone else" },
    ]) {
      expect(await tailorCv(input)).toMatchObject({ ok: false, error: "invalid_input" });
    }
    expect(fake.queries).toHaveLength(0);
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
  });

  it("reads only the owner's own live job post", async () => {
    const fake = signIn();
    expect(await tailorCv(saved())).toMatchObject({ ok: true });

    const query = fake.queriesOn("job_posts")[0];
    expect(isOwnerScoped(query)).toBe(true);
    expect(callsOf(query, "eq")).toContainEqual(["id", JOB_ID]);
    expect(callsOf(query, "is")).toContainEqual(["deleted_at", null]);
  });

  it.each([
    [{ data: null }, "not_found"],
    [{ error: { message: "network" } }, "unavailable"],
    [{ data: { ...JOB_ROW, requirements: { schemaVersion: 9 } } }, "unavailable"],
  ])("explains a job post it cannot use: %o → %s", async (answer, error) => {
    signIn({ tables: { job_posts: answer } });
    expect(await tailorCv(saved())).toEqual({ ok: false, error });
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
  });

  it("needs requirements to tailor anything, and spends no request without them", async () => {
    signIn({
      tables: {
        job_posts: {
          data: { ...JOB_ROW, requirements: { schemaVersion: 1, titleAliases: [], items: [] } },
        },
      },
    });
    expect(await tailorCv(saved())).toEqual({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "job", message: "noRequirements" }],
    });
    expect(mocks.loadMasterData).not.toHaveBeenCalled();
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
  });

  it("reports career data it cannot read", async () => {
    signIn();
    mocks.loadMasterData.mockRejectedValue(new Error("down"));
    expect(await tailorCv(saved())).toEqual({ ok: false, error: "unavailable" });
  });

  it("asks the AI with the job and the career text, and returns picks to review", async () => {
    signIn();
    const result = await tailorCv(saved({ uiLocale: "fr" }));

    expect(mocks.runAiRequest).toHaveBeenCalledTimes(1);
    const request = mocks.runAiRequest.mock.calls[0]![0] as {
      feature: string;
      instructions: string;
      input: string;
      jsonSchema: unknown;
      schema: unknown;
      maxOutputTokens: number;
      fakeAnswer: (input: string) => unknown;
    };
    expect(request.feature).toBe("cv_tailoring");
    expect(request.schema).toBe(tailoringAnswerSchema);
    expect(request.instructions).toContain("Write it in French, even when");
    expect(request.instructions).toContain("for this application, in English");
    expect(JSON.stringify(request.jsonSchema)).toContain("One short sentence in French");
    expect(request.input).toContain("title: Développeur Full Stack (H/F)");
    expect(request.input).toContain("<candidate_title>Full stack web developer</candidate_title>");
    expect(request.input).toContain("P1: Online shop");
    for (const secret of ["Alex Example", "alex@example.com", "+00 123 456 789", "github.com"]) {
      expect(request.input).not.toContain(secret);
    }
    // The stand-in provider answers this very request in local runs and e2e tests.
    expect(tailoringAnswerSchema.safeParse(request.fakeAnswer(request.input)).success).toBe(true);

    expect(result).toMatchObject({
      ok: true,
      data: {
        mode: "ai",
        picks: {
          projectIds: [PROJECTS.shop, PROJECTS.booking],
          skillIds: [SKILLS.redux, SKILLS.react, SKILLS.node],
          title: "Full Stack Developer",
        },
        review: {
          projectTotal: 3,
          title: { suggested: "Full Stack Developer", profile: "Full stack web developer" },
          score: 71,
        },
      },
    });
    if (!result.ok) throw new Error("expected a proposal");
    expect(result.data.picks).not.toHaveProperty("reasons");
    expect(result.data.review.projects[0]?.reason).toBe("Uses React and Node.js.");
  });

  it("tailors to a post the page read but has not saved, without reading the database", async () => {
    const fake = signIn();
    const result = await tailorCv(saved({ job: { kind: "draft", draft }, cvLocale: "fr" }));
    expect(result).toMatchObject({ ok: true, data: { mode: "ai" } });
    expect(fake.queriesOn("job_posts")).toHaveLength(0);
  });

  it("chooses by keywords without any AI request", async () => {
    signIn();
    const result = await tailorCv(saved({ mode: "keywords", cvLocale: "fr" }));
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      data: {
        mode: "keywords",
        picks: {
          projectIds: [PROJECTS.shop, PROJECTS.booking],
          title: "Développeur Full Stack",
        },
      },
    });
  });

  it("spends no request when there is nothing to choose from", async () => {
    signIn();
    mocks.loadMasterData.mockResolvedValue(EMPTY_MASTER_DATA);
    const result = await tailorCv(saved());
    expect(mocks.runAiRequest).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      data: { mode: "keywords", picks: { projectIds: [], skillIds: [] } },
    });
  });

  it("passes on why the AI could not answer, naming the provider when one failed", async () => {
    signIn();
    mocks.runAiRequest.mockResolvedValueOnce({
      ok: false,
      error: "ai_timeout",
      provider: "groq",
    });
    expect(await tailorCv(saved())).toEqual({ ok: false, error: "ai_timeout", provider: "groq" });

    mocks.runAiRequest.mockResolvedValueOnce({ ok: false, error: "ai_limit_reached" });
    expect(await tailorCv(saved())).toEqual({ ok: false, error: "ai_limit_reached" });
  });
});
