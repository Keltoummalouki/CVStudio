import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { isBlockingIssue, resolveCv } from "@/features/cv-builder/resolve";
import { buildMasterData, LABELS, sequentialIds } from "../../fixtures/master-data";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({ requireOwner: vi.fn(), loadMasterData: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireOwner: mocks.requireOwner }));
vi.mock("@/features/cv-builder/server/load-master-data", () => ({
  loadMasterData: mocks.loadMasterData,
}));

const { getCvDocument, getPortraitUrl, listCvDocuments, summarizeIssues } =
  await import("@/features/cv-documents/server/queries");
const { getTemplate, listTemplateChoices, listTemplates } =
  await import("@/features/cv-templates/server/queries");
const { loadExportableCv } = await import("@/features/cv-export/server/load-export");
const { getDashboardOverview } = await import("@/features/dashboard/get-dashboard-overview");

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";
const master = buildMasterData();
const definition = createDefaultDefinition(master, sequentialIds());
/** Blocking issues of the fixture CV in French, computed the way the builder does. */
const missingInFrench = resolveCv(definition, master, "fr", LABELS.fr).issues.filter(
  isBlockingIssue,
).length;

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.requireOwner.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.requireOwner.mockReset();
  mocks.loadMasterData.mockReset().mockResolvedValue(master);
});

describe("summarizeIssues", () => {
  it("counts blocking issues and warnings like the builder", () => {
    expect(missingInFrench).toBeGreaterThan(0);
    expect(summarizeIssues(definition, master, "fr", LABELS)).toMatchObject({
      missingTranslations: missingInFrench,
    });
  });

  it("flags unreadable layouts instead of guessing", () => {
    expect(summarizeIssues({ schemaVersion: 0 }, master, "en", LABELS)).toEqual({
      missingTranslations: null,
      warnings: 0,
    });
  });
});

describe("CV document queries", () => {
  it("lists the owner's live CVs newest first, skipping unsupported languages", async () => {
    const fake = signIn({
      tables: {
        cv_documents: {
          data: [
            {
              id: CV_ID,
              name: "Développeuse",
              locale: "fr",
              definition,
              updated_at: "2026-10-21T09:00:00Z",
              created_from_template_name: "Engineering",
            },
            {
              id: "x",
              name: "Legacy",
              locale: "de",
              definition,
              updated_at: "t",
              created_from_template_name: null,
            },
          ],
        },
      },
    });

    expect(await listCvDocuments()).toEqual({
      items: [
        {
          id: CV_ID,
          name: "Développeuse",
          locale: "fr",
          updatedAt: "2026-10-21T09:00:00Z",
          createdFromTemplateName: "Engineering",
          missingTranslations: missingInFrench,
          warnings: expect.any(Number),
        },
      ],
      total: 1,
    });
    const query = fake.queriesOn("cv_documents")[0];
    expect(isOwnerScoped(query)).toBe(true);
    expect(callsOf(query, "is")).toContainEqual(["deleted_at", null]);
    expect(callsOf(query, "order")).toContainEqual(["updated_at", { ascending: false }]);
    expect(callsOf(query, "limit")).toEqual([[200]]);
  });

  it("reports how many CVs exist beyond the ones listed", async () => {
    const fake = signIn({
      tables: {
        cv_documents: {
          data: [
            {
              id: CV_ID,
              name: "Recent",
              locale: "en",
              definition,
              updated_at: "2026-10-21T09:00:00Z",
              created_from_template_name: null,
            },
          ],
          count: 240,
        },
      },
    });

    const library = await listCvDocuments();
    expect(library.items).toHaveLength(1);
    expect(library.total).toBe(240);
    expect(callsOf(fake.queriesOn("cv_documents")[0], "select")[0]?.[1]).toEqual({
      count: "exact",
    });
  });

  it("raises a DataAccessError when the list cannot be read", async () => {
    signIn({ tables: { cv_documents: { error: { code: "08006" } } } });

    await expect(listCvDocuments()).rejects.toThrow("Data access failed: list CVs");
  });

  it("reads one CV with its validated layout", async () => {
    signIn({
      tables: {
        cv_documents: {
          data: {
            id: CV_ID,
            name: "CV",
            locale: "en",
            revision: 3,
            updated_at: "t",
            created_from_template_name: null,
            definition,
          },
        },
      },
    });

    expect(await getCvDocument(CV_ID)).toEqual({
      id: CV_ID,
      name: "CV",
      locale: "en",
      revision: 3,
      updatedAt: "t",
      createdFromTemplateName: null,
      definition,
    });
  });

  it("answers 404 for another owner's or a deleted CV, and refuses corrupt layouts", async () => {
    signIn({ tables: { cv_documents: { data: null } } });
    await expect(getCvDocument(CV_ID)).rejects.toThrow(NOT_FOUND);

    signIn({ tables: { cv_documents: { data: { id: CV_ID, locale: "en", definition: [] } } } });
    await expect(getCvDocument(CV_ID)).rejects.toThrow("read CV definition");
  });

  it("signs the portrait for a short time, and only when there is one", async () => {
    const fake = signIn({
      tables: { profiles: { data: { photo_path: "owner/portraits/p.png" } } },
    });
    expect(await getPortraitUrl()).toBe("https://storage.test/signed/owner/portraits/p.png");
    expect(fake.bucket.createSignedUrl).toHaveBeenCalledWith("owner/portraits/p.png", 3600);

    signIn({ tables: { profiles: { data: { photo_path: null } } } });
    expect(await getPortraitUrl()).toBeNull();
  });
});

describe("template queries", () => {
  it("counts the live CVs made from each template", async () => {
    const fake = signIn({
      tables: {
        cv_templates: {
          data: [
            { id: "t1", name: "A", description: "", locale: "en", definition, updated_at: "t" },
            {
              id: "t2",
              name: "B",
              description: "d",
              locale: "fr",
              definition: {},
              updated_at: "t",
            },
          ],
        },
        cv_documents: {
          data: [
            { created_from_template_id: "t1" },
            { created_from_template_id: "t1" },
            { created_from_template_id: null },
          ],
        },
      },
    });

    const templates = await listTemplates();

    expect(
      templates.map(({ id, cvCount, missingTranslations }) => ({
        id,
        cvCount,
        missingTranslations,
      })),
    ).toEqual([
      { id: "t1", cvCount: 2, missingTranslations: 0 },
      { id: "t2", cvCount: 0, missingTranslations: null },
    ]);
    const counts = fake.queriesOn("cv_documents")[0];
    expect(isOwnerScoped(counts)).toBe(true);
    expect(callsOf(counts, "is")).toContainEqual(["deleted_at", null]);
  });

  it("fails when templates or their CV counts cannot be read", async () => {
    signIn({ tables: { cv_templates: { error: { code: "x" } } } });
    await expect(listTemplates()).rejects.toThrow("list templates");

    signIn({ tables: { cv_templates: { data: [] }, cv_documents: { error: { code: "x" } } } });
    await expect(listTemplates()).rejects.toThrow("count CVs per template");
  });

  it("offers the owner's templates as choices", async () => {
    signIn({
      tables: { cv_templates: { data: [{ id: "t1", name: "A", description: "", locale: "fr" }] } },
    });

    expect(await listTemplateChoices()).toEqual([
      { id: "t1", name: "A", description: "", locale: "fr" },
    ]);
  });

  it("reads one template, or answers 404", async () => {
    signIn({
      tables: {
        cv_templates: {
          data: {
            id: "t1",
            name: "A",
            description: "",
            locale: "en",
            revision: 1,
            updated_at: "t",
            definition,
          },
        },
      },
    });
    expect(await getTemplate("t1")).toMatchObject({ id: "t1", revision: 1, definition });

    signIn({ tables: { cv_templates: { data: null } } });
    await expect(getTemplate("t1")).rejects.toThrow(NOT_FOUND);

    signIn({ tables: { cv_templates: { data: { id: "t1", locale: "en", definition: null } } } });
    await expect(getTemplate("t1")).rejects.toThrow("read template definition");
  });
});

describe("loadExportableCv", () => {
  const document = { id: CV_ID, name: "CV", locale: "fr", definition };

  it("resolves the CV like the preview and counts what blocks export", async () => {
    const fake = createFakeSupabase({
      tables: { cv_documents: { data: document }, profiles: { data: { photo_path: "p.png" } } },
    });

    const exportable = await loadExportableCv(ownerContext(fake), CV_ID);

    expect(exportable).toMatchObject({
      id: CV_ID,
      locale: "fr",
      labels: LABELS.fr,
      missingTranslations: missingInFrench,
      photoUrl: "https://storage.test/signed/p.png",
    });
    expect(fake.bucket.createSignedUrl).toHaveBeenCalledWith("p.png", 600);
    const read = fake.queriesOn("cv_documents")[0];
    expect(isOwnerScoped(read)).toBe(true);
    expect(callsOf(read, "eq")).toContainEqual(["id", CV_ID]);
    expect(callsOf(read, "is")).toContainEqual(["deleted_at", null]);
  });

  it("does not sign the portrait when the CV hides it", async () => {
    const hidden = { ...definition, header: { ...definition.header, showPhoto: false } };
    const fake = createFakeSupabase({
      tables: {
        cv_documents: { data: { ...document, definition: hidden } },
        profiles: { data: { photo_path: "p.png" } },
      },
    });

    expect((await loadExportableCv(ownerContext(fake), CV_ID))?.photoUrl).toBeNull();
    expect(fake.bucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null for a CV that is not the owner's", async () => {
    const fake = createFakeSupabase({ tables: { cv_documents: { data: null } } });

    expect(await loadExportableCv(ownerContext(fake), CV_ID)).toBeNull();
  });

  it("raises DataAccessError on read failures and corrupt layouts", async () => {
    const failing = createFakeSupabase({ tables: { cv_documents: { error: { code: "x" } } } });
    await expect(loadExportableCv(ownerContext(failing), CV_ID)).rejects.toThrow("read CV");

    const corrupt = createFakeSupabase({
      tables: { cv_documents: { data: { ...document, definition: { sections: "?" } } } },
    });
    await expect(loadExportableCv(ownerContext(corrupt), CV_ID)).rejects.toThrow(
      "read CV definition",
    );
  });
});

describe("getDashboardOverview", () => {
  const counts = (count: number) => ({ count });

  it("summarizes setup progress and recent CVs", async () => {
    const fake = signIn({
      tables: {
        experiences: counts(2),
        educations: counts(1),
        projects: counts(0),
        certifications: counts(0),
        skills: counts(5),
        soft_skills: counts(0),
        spoken_languages: counts(0),
        cv_templates: counts(0),
        cv_documents: [
          counts(1),
          {
            data: [{ id: CV_ID, name: "CV", locale: "fr", definition, updated_at: "t" }],
          },
        ],
        profiles: { data: { full_name: "Alex", title_i18n: { fr: "Développeur" } } },
      },
    });

    expect(await getDashboardOverview()).toEqual({
      counts: { careerRecords: 8, cvs: 1, templates: 0 },
      setup: { profile: true, careerRecords: true, cv: true, template: false },
      recentCvs: [
        {
          id: CV_ID,
          name: "CV",
          locale: "fr",
          updatedAt: "t",
          missingTranslations: missingInFrench,
        },
      ],
    });
    expect(fake.queries.every((query) => isOwnerScoped(query))).toBe(true);
  });

  it("skips loading career data when there are no CVs", async () => {
    signIn({ tables: { cv_documents: [counts(0), { data: [] }], profiles: { data: null } } });

    const overview = await getDashboardOverview();

    expect(overview.setup.profile).toBe(false);
    expect(overview.recentCvs).toEqual([]);
    expect(mocks.loadMasterData).not.toHaveBeenCalled();
  });

  it("fails rather than showing wrong numbers", async () => {
    signIn({ tables: { skills: { error: { code: "x" } } } });
    await expect(getDashboardOverview()).rejects.toThrow("count skills");

    signIn({ tables: { profiles: { error: { code: "x" } } } });
    await expect(getDashboardOverview()).rejects.toThrow("read profile");
  });
});
