import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { definitionSchema, type CvDefinition } from "@/features/cv-builder/definition";
import { createBlankDesign } from "@/features/cv-design/design";
import { buildMasterData, sequentialIds } from "../../fixtures/master-data";
import { PROJECTS, SKILLS, TAILORING_JOB, tailoringCareer } from "../../fixtures/tailoring";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  loadMasterData: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("@/features/cv-builder/server/load-master-data", () => ({
  loadMasterData: mocks.loadMasterData,
}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));

const { createCv, deleteCv, duplicateCv, getCvRevision, restoreCv, saveCv } =
  await import("@/features/cv-documents/server/actions");

const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";
const TEMPLATE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const JOB_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const definition = createDefaultDefinition(buildMasterData(), sequentialIds());

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.getOwnerContext.mockReset();
  mocks.refresh.mockReset();
  mocks.loadMasterData.mockReset().mockResolvedValue(buildMasterData());
});

describe("CV document actions require the owner", () => {
  it.each([
    ["createCv", () => createCv({ name: "CV", locale: "en" })],
    ["saveCv", () => saveCv({})],
    ["getCvRevision", () => getCvRevision(CV_ID)],
    ["duplicateCv", () => duplicateCv(CV_ID, "Copy")],
    ["deleteCv", () => deleteCv(CV_ID)],
    ["restoreCv", () => restoreCv(CV_ID)],
  ])("%s answers unauthorized without a session", async (_name, action) => {
    mocks.getOwnerContext.mockResolvedValue(null);

    expect(await action()).toEqual({ ok: false, error: "unauthorized" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("createCv", () => {
  it("starts from all career data and stores it for the owner", async () => {
    const fake = signIn({ tables: { cv_documents: { data: { id: CV_ID } } } });

    expect(await createCv({ name: "  Frontend  ", locale: "fr" })).toEqual({
      ok: true,
      data: { id: CV_ID },
    });

    const [row] = callsOf(fake.queriesOn("cv_documents")[0], "insert")[0] as [
      Record<string, unknown>,
    ];
    expect(row).toMatchObject({
      owner_id: ownerContext(fake).owner.id,
      name: "Frontend",
      locale: "fr",
      schema_version: 1,
    });
    expect(row).not.toHaveProperty("created_from_template_id");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("copies a design, fills it with all career data and records where it came from", async () => {
    const design = createBlankDesign();
    const fake = signIn({
      tables: {
        cv_templates: { data: { id: TEMPLATE_ID, name: "Sidebar", design } },
        cv_documents: { data: { id: CV_ID } },
      },
    });

    expect(await createCv({ name: "CV", locale: "en", templateId: TEMPLATE_ID })).toMatchObject({
      ok: true,
    });

    // Only the owner's live designs: setups saved from CVs earlier are retired.
    const template = fake.queriesOn("cv_templates")[0];
    expect(isOwnerScoped(template)).toBe(true);
    expect(callsOf(template, "is")).toContainEqual(["deleted_at", null]);
    expect(callsOf(template, "eq")).toContainEqual(["visual_template_key", "canvas-v1"]);
    const [row] = callsOf(fake.queriesOn("cv_documents")[0], "insert")[0] as [
      Record<string, unknown>,
    ];
    expect(row).toMatchObject({
      visual_template_key: "canvas-v1",
      design,
      created_from_template_id: TEMPLATE_ID,
      created_from_template_name: "Sidebar",
    });
    // The content is the career data's, not the template's: the design only places it.
    const sections = (row.definition as typeof definition).sections.map((section) => section.kind);
    expect(sections).toEqual(definition.sections.map((section) => section.kind));
    expect(mocks.loadMasterData).toHaveBeenCalledTimes(1);
  });

  it("reports a template that is not the owner's as not found", async () => {
    const fake = signIn({ tables: { cv_templates: { data: null } } });

    expect(await createCv({ name: "CV", locale: "en", templateId: TEMPLATE_ID })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(fake.queriesOn("cv_documents")).toHaveLength(0);
  });

  it("refuses a template whose stored design is unreadable", async () => {
    signIn({
      tables: { cv_templates: { data: { id: TEMPLATE_ID, name: "Old", design: { v: 0 } } } },
    });

    expect(await createCv({ name: "CV", locale: "en", templateId: TEMPLATE_ID })).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });

  it("returns field issues for invalid input", async () => {
    signIn();

    const result = await createCv({ name: "  ", locale: "de" });
    expect(result).toMatchObject({ ok: false, error: "invalid_input" });
    expect(result.ok ? [] : result.fieldIssues?.map((issue) => issue.path)).toEqual([
      "name",
      "locale",
    ]);
  });

  it("explains failures without leaking database errors", async () => {
    signIn({ tables: { cv_templates: { error: { code: "08006" } } } });
    expect(await createCv({ name: "CV", locale: "en", templateId: TEMPLATE_ID })).toEqual({
      ok: false,
      error: "unavailable",
    });

    mocks.loadMasterData.mockRejectedValueOnce(new Error("read failed"));
    expect(await createCv({ name: "CV", locale: "en" })).toEqual({
      ok: false,
      error: "unavailable",
    });

    signIn({ tables: { cv_documents: { error: { code: "23514", message: "check violation" } } } });
    expect(await createCv({ name: "CV", locale: "en" })).toEqual({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("createCv for a job post", () => {
  const JOB_ROW = {
    id: JOB_ID,
    title: TAILORING_JOB.title,
    requirements: TAILORING_JOB.requirements,
  };
  const tailoring = {
    projectIds: [PROJECTS.shop, PROJECTS.booking],
    skillIds: [SKILLS.react, SKILLS.node],
    title: "  Full Stack Developer ",
  };

  function insertedRow(fake: ReturnType<typeof signIn>) {
    return callsOf(fake.queriesOn("cv_documents")[0], "insert")[0]?.[0] as Record<
      string,
      unknown
    > & { definition: CvDefinition };
  }

  beforeEach(() => {
    mocks.loadMasterData.mockResolvedValue(tailoringCareer());
  });

  it("links a CV with all career data to the owner's own job post", async () => {
    const fake = signIn({
      tables: { job_posts: { data: JOB_ROW }, cv_documents: { data: { id: CV_ID } } },
    });

    expect(await createCv({ name: "CV", locale: "en", jobPostId: JOB_ID })).toEqual({
      ok: true,
      data: { id: CV_ID },
    });
    const post = fake.queriesOn("job_posts")[0];
    expect(isOwnerScoped(post)).toBe(true);
    expect(callsOf(post, "eq")).toContainEqual(["id", JOB_ID]);
    expect(callsOf(post, "is")).toContainEqual(["deleted_at", null]);

    const row = insertedRow(fake);
    expect(row.job_post_id).toBe(JOB_ID);
    // Not tailored: every active project, and the profile's title.
    const projects = row.definition.sections.find((section) => section.kind === "projects");
    expect(projects?.kind === "projects" && projects.items.map((item) => item.refId)).toEqual([
      PROJECTS.booking,
      PROJECTS.shop,
      PROJECTS.blog,
    ]);
    expect(row.definition.header.title).toBeUndefined();
  });

  it("applies the projects, skills and title the owner accepted", async () => {
    const fake = signIn({
      tables: { job_posts: { data: JOB_ROW }, cv_documents: { data: { id: CV_ID } } },
    });

    expect(
      await createCv({ name: "CV", locale: "en", jobPostId: JOB_ID, tailoring }),
    ).toMatchObject({ ok: true });

    const { definition } = insertedRow(fake);
    expect(definitionSchema.safeParse(definition).success).toBe(true);
    expect(definition.header.title).toEqual({ en: "Full Stack Developer" });
    const projects = definition.sections.find((section) => section.kind === "projects");
    expect(projects?.kind === "projects" && projects.items.map((item) => item.refId)).toEqual([
      PROJECTS.shop,
      PROJECTS.booking,
    ]);
    const skills = definition.sections.find((section) => section.kind === "technical_skills");
    const shown =
      skills?.kind === "technical_skills"
        ? skills.groups.flatMap((group) =>
            group.skills.filter((skill) => skill.visible).map((skill) => skill.refId),
          )
        : [];
    expect(shown).toEqual([SKILLS.react, SKILLS.node]);
  });

  it("keeps the profile's title when the owner chose it", async () => {
    const fake = signIn({
      tables: { job_posts: { data: JOB_ROW }, cv_documents: { data: { id: CV_ID } } },
    });
    await createCv({
      name: "CV",
      locale: "fr",
      jobPostId: JOB_ID,
      tailoring: { ...tailoring, title: null },
    });
    expect(insertedRow(fake).definition.header.title).toBeUndefined();
  });

  it("refuses tailoring without a job post, and ids that are not ids", async () => {
    const fake = signIn();
    expect(await createCv({ name: "CV", locale: "en", tailoring })).toMatchObject({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "tailoring", message: "invalid" }],
    });
    expect(
      await createCv({
        name: "CV",
        locale: "en",
        jobPostId: JOB_ID,
        tailoring: { ...tailoring, projectIds: ["../secret"] },
      }),
    ).toMatchObject({ ok: false, error: "invalid_input" });
    expect(
      await createCv({
        name: "CV",
        locale: "en",
        jobPostId: JOB_ID,
        tailoring: { ...tailoring, projectIds: [PROJECTS.shop, PROJECTS.booking, PROJECTS.blog] },
      }),
    ).toMatchObject({ ok: false, error: "invalid_input" });
    expect(fake.queries).toHaveLength(0);
  });

  it("reports a job post that is not the owner's, or gone, before creating anything", async () => {
    const fake = signIn({ tables: { job_posts: { data: null } } });
    expect(await createCv({ name: "CV", locale: "en", jobPostId: JOB_ID, tailoring })).toEqual({
      ok: false,
      error: "not_found",
      fieldIssues: [{ path: "jobPostId", message: "notFound" }],
    });
    expect(fake.queriesOn("cv_documents")).toHaveLength(0);

    signIn({ tables: { job_posts: { error: { message: "network" } } } });
    expect(await createCv({ name: "CV", locale: "en", jobPostId: JOB_ID })).toEqual({
      ok: false,
      error: "unavailable",
    });

    signIn({ tables: { job_posts: { data: { ...JOB_ROW, requirements: { bad: true } } } } });
    expect(await createCv({ name: "CV", locale: "en", jobPostId: JOB_ID })).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});

describe("saveCv", () => {
  const input = { id: CV_ID, expectedRevision: 4, name: "CV", locale: "en", definition };

  it("writes only over the revision the editor started from", async () => {
    const fake = signIn({
      tables: { cv_documents: { data: { revision: 5, updated_at: "2026-10-21T10:00:00Z" } } },
    });

    expect(await saveCv(input)).toEqual({
      ok: true,
      data: { revision: 5, updatedAt: "2026-10-21T10:00:00Z" },
    });
    const update = fake.queriesOn("cv_documents")[0];
    expect(isOwnerScoped(update)).toBe(true);
    expect(callsOf(update, "eq")).toContainEqual(["revision", 4]);
    expect(callsOf(update, "is")).toContainEqual(["deleted_at", null]);
  });

  it("reports a newer save from elsewhere as stale", async () => {
    signIn({ tables: { cv_documents: [{ data: null }, { data: { id: CV_ID } }] } });

    expect(await saveCv(input)).toEqual({ ok: false, error: "stale" });
  });

  it("reports a deleted or foreign CV as not found", async () => {
    signIn({ tables: { cv_documents: [{ data: null }, { data: null }] } });

    expect(await saveCv(input)).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects a definition that does not match the schema", async () => {
    const fake = signIn();

    expect(
      await saveCv({ ...input, definition: { ...definition, schemaVersion: 99 } }),
    ).toMatchObject({ ok: false, error: "invalid_input" });
    expect(await saveCv({ ...input, expectedRevision: 0 })).toMatchObject({ ok: false });
    expect(fake.queries).toHaveLength(0);
  });
});

describe("getCvRevision", () => {
  it("reads the latest revision of the owner's CV", async () => {
    const fake = signIn({ tables: { cv_documents: { data: { revision: 7 } } } });

    expect(await getCvRevision(CV_ID)).toEqual({ ok: true, data: { revision: 7 } });
    expect(isOwnerScoped(fake.queriesOn("cv_documents")[0])).toBe(true);
  });

  it("validates the id and reports missing CVs", async () => {
    signIn({ tables: { cv_documents: { data: null } } });
    expect(await getCvRevision("nope")).toEqual({ ok: false, error: "invalid_input" });
    expect(await getCvRevision(CV_ID)).toEqual({ ok: false, error: "not_found" });

    signIn({ tables: { cv_documents: { error: { code: "08006" } } } });
    expect(await getCvRevision(CV_ID)).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("duplicateCv", () => {
  const source = {
    locale: "fr",
    schema_version: 1,
    definition,
    visual_template_key: "canvas-v1",
    design: createBlankDesign(),
    created_from_template_id: TEMPLATE_ID,
    created_from_template_name: "Engineering",
    job_post_id: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a",
  };

  it("inserts an independent copy for the same owner, its design and job post included", async () => {
    const fake = signIn({ tables: { cv_documents: [{ data: source }, { data: { id: "copy" } }] } });

    expect(await duplicateCv(CV_ID, "Copy of CV")).toEqual({ ok: true, data: { id: "copy" } });
    const [read, insert] = fake.queriesOn("cv_documents");
    expect(isOwnerScoped(read)).toBe(true);
    expect(callsOf(insert, "insert")[0]?.[0]).toEqual({
      ...source,
      owner_id: ownerContext(fake).owner.id,
      name: "Copy of CV",
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shortens a long localized copy name instead of failing", async () => {
    const fake = signIn({ tables: { cv_documents: [{ data: source }, { data: { id: "copy" } }] } });

    await duplicateCv(CV_ID, `Copie de ${"x".repeat(200)}`);
    const row = callsOf(fake.queriesOn("cv_documents")[1], "insert")[0]?.[0] as { name: string };
    expect(row.name).toHaveLength(120);
  });

  it("rejects bad input and reports a missing source", async () => {
    signIn({ tables: { cv_documents: { data: null } } });
    expect(await duplicateCv("nope", "Copy")).toEqual({ ok: false, error: "invalid_input" });
    expect(await duplicateCv(CV_ID, 42)).toEqual({ ok: false, error: "invalid_input" });
    expect(await duplicateCv(CV_ID, "Copy")).toEqual({ ok: false, error: "not_found" });
  });
});

describe("deleteCv and restoreCv", () => {
  it("soft-deletes the owner's CV so it can be restored", async () => {
    const fake = signIn({ tables: { cv_documents: { data: { id: CV_ID } } } });

    expect(await deleteCv(CV_ID)).toEqual({ ok: true, data: undefined });
    const query = fake.queriesOn("cv_documents")[0];
    expect(isOwnerScoped(query)).toBe(true);
    expect(callsOf(query, "delete")).toHaveLength(0);
    const [values] = callsOf(query, "update")[0] as [{ deleted_at: string }];
    expect(Date.parse(values.deleted_at)).not.toBeNaN();
    expect(callsOf(query, "is")).toContainEqual(["deleted_at", null]);
  });

  it("restores only a deleted CV", async () => {
    const fake = signIn({ tables: { cv_documents: { data: { id: CV_ID } } } });

    expect(await restoreCv(CV_ID)).toEqual({ ok: true, data: undefined });
    const query = fake.queriesOn("cv_documents")[0];
    expect(callsOf(query, "update")[0]).toEqual([{ deleted_at: null }]);
    expect(callsOf(query, "not")).toContainEqual(["deleted_at", "is", null]);
  });

  it("reports unknown CVs and invalid ids", async () => {
    signIn({ tables: { cv_documents: { data: null } } });

    expect(await deleteCv(CV_ID)).toEqual({ ok: false, error: "not_found" });
    expect(await restoreCv("../x")).toEqual({ ok: false, error: "invalid_input" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
