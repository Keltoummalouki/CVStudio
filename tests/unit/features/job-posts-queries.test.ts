import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { CvDefinition } from "@/features/cv-builder/definition";
import type { RequirementsDocument } from "@/features/job-posts/schemas";
import { DataAccessError } from "@/lib/data/errors";
import { buildMasterData, sequentialIds } from "../../fixtures/master-data";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  loadMasterData: vi.fn(),
  getLocale: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireOwner: mocks.requireOwner }));
vi.mock("@/features/cv-builder/server/load-master-data", () => ({
  loadMasterData: mocks.loadMasterData,
}));
vi.mock("next-intl/server", () => ({ getLocale: mocks.getLocale }));

const { findJobPostChoice, getJobPost, listJobPosts } =
  await import("@/features/job-posts/server/queries");

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const JOB_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const master = buildMasterData();
const fullCv = createDefaultDefinition(master, sequentialIds());
const withoutSkills: CvDefinition = {
  ...fullCv,
  sections: fullCv.sections.map((section) =>
    section.kind === "technical_skills" ? { ...section, visible: false } : section,
  ),
};

const requirement = (
  id: string,
  label: string,
  importance: "required" | "preferred" = "required",
) => ({
  id,
  label,
  kind: "skill",
  importance,
  aliases: [],
  note: "",
});

const REQUIREMENTS: RequirementsDocument = {
  schemaVersion: 1,
  titleAliases: [],
  items: [
    requirement("00000000-0000-4000-8000-000000000001", "TypeScript"),
    requirement("00000000-0000-4000-8000-000000000002", "Git"),
    requirement("00000000-0000-4000-8000-000000000003", "Kubernetes", "preferred"),
  ] as RequirementsDocument["items"],
};

const jobRow = (overrides: Record<string, unknown> = {}) => ({
  id: JOB_ID,
  title: "Full stack web developer",
  company: "Acme",
  language: "en",
  description: "The post",
  requirements: REQUIREMENTS,
  updated_at: "2026-10-23T09:00:00+00:00",
  analyzed_at: null,
  ...overrides,
});

const CV_ROWS = [
  {
    id: "cv-skills",
    name: "Without skills",
    locale: "en",
    definition: withoutSkills,
    updated_at: "2026-10-22",
  },
  { id: "cv-full", name: "Full", locale: "en", definition: fullCv, updated_at: "2026-10-21" },
  {
    id: "cv-broken",
    name: "Broken",
    locale: "fr",
    definition: { schemaVersion: 9 },
    updated_at: "2026-10-20",
  },
  { id: "cv-german", name: "German", locale: "de", definition: fullCv, updated_at: "2026-10-19" },
];

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.requireOwner.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.requireOwner.mockReset();
  mocks.loadMasterData.mockReset().mockResolvedValue(master);
  mocks.getLocale.mockReset().mockResolvedValue("en");
});

describe("listJobPosts", () => {
  it("lists the owner's job posts with their best-matching CV", async () => {
    const fake = signIn({
      tables: {
        job_posts: {
          data: [
            jobRow(),
            jobRow({
              id: "job-empty",
              title: "Empty",
              language: "de",
              requirements: { schemaVersion: 1, titleAliases: [], items: [] },
            }),
          ],
        },
        cv_documents: { data: CV_ROWS },
      },
    });

    const jobs = await listJobPosts();

    // Full CV: TypeScript (2) + Git (2) of 2 + 2 + 1 = 80.
    expect(jobs[0]).toEqual({
      id: JOB_ID,
      title: "Full stack web developer",
      company: "Acme",
      language: "en",
      updatedAt: "2026-10-23T09:00:00+00:00",
      analyzedAt: null,
      required: 2,
      preferred: 1,
      // The career data has TypeScript and Git, not Kubernetes: 4 of 5.
      careerScore: 80,
      best: { cvId: "cv-full", cvName: "Full", score: 80 },
    });
    expect(jobs[1]).toMatchObject({
      language: "other",
      required: 0,
      preferred: 0,
      careerScore: null,
      best: null,
    });

    const [list] = fake.queriesOn("job_posts");
    expect(isOwnerScoped(list)).toBe(true);
    expect(callsOf(list, "is")).toContainEqual(["deleted_at", null]);
    expect(callsOf(list, "limit")).toEqual([[100]]);
    const [cvs] = fake.queriesOn("cv_documents");
    expect(isOwnerScoped(cvs)).toBe(true);
    expect(callsOf(cvs, "limit")).toEqual([[30]]);
  });

  it.each([
    [{ job_posts: { error: { message: "down" } }, cv_documents: { data: [] } }],
    [{ job_posts: { data: [] }, cv_documents: { error: { message: "down" } } }],
    [
      {
        job_posts: { data: [jobRow({ requirements: { items: "nope" } })] },
        cv_documents: { data: [] },
      },
    ],
  ])("fails as a data access error: %o", async (tables) => {
    signIn({ tables });
    await expect(listJobPosts()).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("getJobPost", () => {
  it("returns the editor values and every CV scored, best first, unreadable last", async () => {
    const fake = signIn({
      tables: {
        job_posts: { data: jobRow({ analyzed_at: "2026-10-23T08:00:00+00:00" }) },
        cv_documents: { data: CV_ROWS },
      },
    });

    const page = await getJobPost(JOB_ID);

    expect(page.values).toEqual({
      id: JOB_ID,
      expectedUpdatedAt: "2026-10-23T09:00:00+00:00",
      title: "Full stack web developer",
      company: "Acme",
      language: "en",
      description: "The post",
      requirements: REQUIREMENTS,
      analyzed: false,
    });
    expect(page.analyzedAt).toBe("2026-10-23T08:00:00+00:00");
    expect(page.matches.map((match) => [match.cvId, match.report?.score ?? null])).toEqual([
      ["cv-full", 80],
      ["cv-skills", 40],
      ["cv-broken", null],
    ]);

    const withoutSkillsReport = page.matches[1]?.report;
    expect(withoutSkillsReport?.title.status).toBe("matched");
    expect(withoutSkillsReport?.requirements.map((result) => result.status)).toEqual([
      // TypeScript is also an experience technology; Git only lives in the hidden skills.
      "matched",
      "hidden",
      "missing",
    ]);

    // The career report searches all career data, whatever the CVs show.
    expect(page.career.score).toBe(80);
    expect(page.career.requirements.map((result) => result.status)).toEqual([
      "matched",
      "matched",
      "missing",
    ]);
    expect(page.career.hidden).toBe(0);
    const gitEvidence = page.career.requirements[1]?.evidence ?? [];
    expect(gitEvidence.length).toBeGreaterThan(0);
    expect(gitEvidence.every((evidence) => evidence.where.scope === "career")).toBe(true);

    const read = fake.queriesOn("job_posts")[0];
    expect(isOwnerScoped(read)).toBe(true);
    expect(callsOf(read, "eq")).toContainEqual(["id", JOB_ID]);
  });

  it("is a 404 when the job post does not exist for this owner", async () => {
    signIn({ tables: { job_posts: { data: null } } });
    await expect(getJobPost("1d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a")).rejects.toThrow(NOT_FOUND);
  });

  it("fails as a data access error", async () => {
    signIn({ tables: { job_posts: { error: { message: "down" } } } });
    await expect(getJobPost("2d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a")).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

describe("findJobPostChoice", () => {
  it("returns the owner's job post a new CV is made for", async () => {
    const fake = signIn({
      tables: {
        job_posts: { data: { id: JOB_ID, title: "Frontend", company: "Acme", language: "fr" } },
      },
    });

    expect(await findJobPostChoice(JOB_ID)).toEqual({
      id: JOB_ID,
      title: "Frontend",
      company: "Acme",
      language: "fr",
    });
    const read = fake.queriesOn("job_posts")[0];
    expect(isOwnerScoped(read)).toBe(true);
    expect(callsOf(read, "eq")).toContainEqual(["id", JOB_ID]);
    expect(callsOf(read, "is")).toContainEqual(["deleted_at", null]);
  });

  it("reads an unknown language as another language", async () => {
    signIn({
      tables: { job_posts: { data: { id: JOB_ID, title: "Dev", company: "", language: "de" } } },
    });
    expect(await findJobPostChoice(JOB_ID)).toMatchObject({ language: "other" });
  });

  it("is null for a post that is not the owner's, or deleted", async () => {
    signIn({ tables: { job_posts: { data: null } } });
    expect(await findJobPostChoice(JOB_ID)).toBeNull();
  });

  it("fails as a data access error", async () => {
    signIn({ tables: { job_posts: { error: { message: "down" } } } });
    await expect(findJobPostChoice(JOB_ID)).rejects.toBeInstanceOf(DataAccessError);
  });
});
