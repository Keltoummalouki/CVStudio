import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataAccessError } from "@/lib/data/errors";
import {
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireOwner: mocks.requireOwner }));

const queries = await import("@/features/career-data/server/queries");

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const ID = "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
const PERIOD_ROW = {
  start_year: 2024,
  start_month: 2,
  end_year: null,
  end_month: null,
  is_current: true,
};

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.requireOwner.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.requireOwner.mockReset();
});

describe("getCareerSummary", () => {
  it("counts the owner's active records per section", async () => {
    const fake = signIn({
      tables: {
        skills: { count: 12 },
        experiences: { count: 3 },
        educations: { count: 1 },
        projects: { count: null },
        certifications: { count: 2 },
        soft_skills: { count: 4 },
        spoken_languages: { count: 2 },
        custom_sections: { count: 0 },
        profiles: { data: { full_name: "  " } },
      },
    });

    expect(await queries.getCareerSummary()).toEqual({
      technical_skills: 12,
      experience: 3,
      education: 1,
      projects: 0,
      certifications: 2,
      soft_skills: 4,
      languages: 2,
      custom: 0,
      profileStarted: false,
    });
    expect(fake.queries.every((query) => isOwnerScoped(query))).toBe(true);
  });

  it("fails loudly when a count cannot be read", async () => {
    signIn({ tables: { projects: { error: { code: "08006" } } } });

    await expect(queries.getCareerSummary()).rejects.toThrow("Data access failed: count projects");
  });
});

describe("listRecords", () => {
  it("lists experiences with their translation coverage, ignoring archived details", async () => {
    const fake = signIn({
      tables: {
        experiences: {
          data: [
            {
              id: ID,
              organization: "Acme",
              role_i18n: { en: "Developer", fr: "Développeur" },
              location_i18n: { shared: "Paris" },
              ...PERIOD_ROW,
              deleted_at: null,
              experience_details: [
                { text_i18n: { en: "Shipped" }, deleted_at: "2026-01-01T00:00:00Z" },
                { text_i18n: { en: "Built", fr: "Construit" }, deleted_at: null },
              ],
            },
          ],
        },
      },
    });

    expect(await queries.listRecords("experience")).toEqual([
      {
        id: ID,
        title: { en: "Developer", fr: "Développeur" },
        context: "Acme",
        localizedContext: { shared: "Paris" },
        period: {
          startYear: 2024,
          startMonth: 2,
          endYear: null,
          endMonth: null,
          isCurrent: true,
        },
        coverage: { en: true, fr: true },
        archived: false,
      },
    ]);
    expect(isOwnerScoped(fake.queriesOn("experiences")[0])).toBe(true);
  });

  it("marks a language incomplete when an active detail lacks it", async () => {
    signIn({
      tables: {
        projects: {
          data: [
            {
              id: ID,
              title_i18n: { en: "App", fr: "Appli" },
              description_i18n: {},
              ...PERIOD_ROW,
              deleted_at: "2026-02-02T00:00:00Z",
              project_details: [{ text_i18n: { en: "Only English" }, deleted_at: null }],
            },
          ],
        },
      },
    });

    const [project] = await queries.listRecords("projects");
    expect(project).toMatchObject({ coverage: { en: true, fr: false }, archived: true });
  });

  it("lists education, certifications and custom sections", async () => {
    signIn({
      tables: {
        educations: {
          data: [
            {
              id: ID,
              credential_i18n: { en: "BSc" },
              institution_i18n: { shared: "School" },
              location_i18n: {},
              description_i18n: {},
              ...PERIOD_ROW,
              deleted_at: null,
            },
          ],
        },
        certifications: {
          data: [
            {
              id: "c1",
              title_i18n: { en: "A" },
              issuer_i18n: {},
              issued_year: 2025,
              issued_month: 3,
              deleted_at: null,
            },
            {
              id: "c2",
              title_i18n: { en: "B" },
              issuer_i18n: {},
              issued_year: null,
              issued_month: null,
              deleted_at: null,
            },
          ],
        },
        custom_sections: {
          data: [
            {
              id: "s1",
              title_i18n: { en: "Volunteering", fr: "Bénévolat" },
              deleted_at: null,
              custom_subsections: [
                {
                  title_i18n: {},
                  deleted_at: null,
                  custom_items: [
                    { label_i18n: {}, text_i18n: { en: "Mentor", fr: "Mentor" }, deleted_at: null },
                    {
                      label_i18n: {},
                      text_i18n: { en: "Old" },
                      deleted_at: "2026-01-01T00:00:00Z",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    expect(await queries.listRecords("education")).toMatchObject([
      {
        title: { en: "BSc" },
        localizedContext: { shared: "School" },
        coverage: { en: true, fr: false },
      },
    ]);

    const certifications = await queries.listRecords("certifications");
    expect(certifications.map((item) => item.period)).toEqual([
      { startYear: null, startMonth: null, endYear: 2025, endMonth: 3, isCurrent: false },
      null,
    ]);

    expect(await queries.listRecords("custom")).toMatchObject([
      { id: "s1", period: null, coverage: { en: true, fr: true } },
    ]);
  });

  it("raises a DataAccessError instead of returning a partial list", async () => {
    signIn({ tables: { educations: { error: { code: "08006" } } } });

    await expect(queries.listRecords("education")).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("record editors", () => {
  it("loads an experience with its active details in order", async () => {
    const fake = signIn({
      tables: {
        experiences: {
          data: {
            id: ID,
            updated_at: "2026-10-20T10:00:00Z",
            organization: "Acme",
            role_i18n: { en: "Dev" },
            location_i18n: { fr: "Paris" },
            ...PERIOD_ROW,
            experience_details: [
              {
                id: "d2",
                kind: "technology",
                text_i18n: { shared: "Go" },
                sort_order: 2,
                deleted_at: null,
              },
              {
                id: "d0",
                kind: "bullet",
                text_i18n: { en: "Gone" },
                sort_order: 0,
                deleted_at: "2026-01-01",
              },
              {
                id: "d1",
                kind: "bullet",
                text_i18n: { en: "Built" },
                sort_order: 1,
                deleted_at: null,
              },
            ],
          },
        },
      },
    });

    const editor = await queries.getExperienceEditor(ID);

    expect(editor).toMatchObject({
      id: ID,
      expectedUpdatedAt: "2026-10-20T10:00:00Z",
      organization: "Acme",
      location: { fr: "Paris" },
    });
    expect(editor.details.map((detail) => detail.id)).toEqual(["d1", "d2"]);
    const query = fake.queriesOn("experiences")[0];
    expect(isOwnerScoped(query)).toBe(true);
    expect(query?.calls).toContainEqual({ method: "eq", args: ["id", ID] });
  });

  it("answers 404 for a record that is not the owner's", async () => {
    signIn({ tables: { experiences: { data: null }, projects: { data: null } } });

    await expect(queries.getExperienceEditor(ID)).rejects.toThrow(NOT_FOUND);
    await expect(queries.getProjectEditor(ID)).rejects.toThrow(NOT_FOUND);
  });

  it("turns missing links into empty fields for the forms", async () => {
    signIn({
      tables: {
        projects: {
          data: {
            id: ID,
            updated_at: "t",
            title_i18n: { en: "App" },
            description_i18n: {},
            project_url: null,
            source_url: "https://github.com/example/app",
            ...PERIOD_ROW,
            project_details: null,
          },
        },
        certifications: {
          data: {
            id: ID,
            updated_at: "t",
            title_i18n: { en: "Cert" },
            issuer_i18n: {},
            issued_year: 2025,
            issued_month: null,
            credential_url: null,
          },
        },
        educations: {
          data: {
            id: ID,
            updated_at: "t",
            credential_i18n: { en: "BSc" },
            institution_i18n: {},
            location_i18n: {},
            description_i18n: {},
            ...PERIOD_ROW,
          },
        },
      },
    });

    expect(await queries.getProjectEditor(ID)).toMatchObject({
      projectUrl: "",
      sourceUrl: "https://github.com/example/app",
      details: [],
    });
    expect(await queries.getCertificationEditor(ID)).toMatchObject({
      credentialUrl: "",
      issuedYear: 2025,
    });
    expect(await queries.getEducationEditor(ID)).toMatchObject({ credential: { en: "BSc" } });
  });

  it("loads a custom section without archived subsections or items", async () => {
    signIn({
      tables: {
        custom_sections: {
          data: {
            id: ID,
            updated_at: "t",
            title_i18n: { en: "Awards" },
            custom_subsections: [
              {
                id: "old",
                title_i18n: {},
                sort_order: 0,
                deleted_at: "2026-01-01",
                custom_items: [],
              },
              {
                id: "sub",
                title_i18n: { en: "2025" },
                sort_order: 1,
                deleted_at: null,
                custom_items: [
                  {
                    id: "b",
                    kind: "bullet",
                    label_i18n: {},
                    text_i18n: { en: "B" },
                    sort_order: 2,
                    deleted_at: null,
                  },
                  {
                    id: "a",
                    kind: "key_value",
                    label_i18n: { en: "K" },
                    text_i18n: { en: "A" },
                    sort_order: 1,
                    deleted_at: null,
                  },
                  {
                    id: "x",
                    kind: "bullet",
                    label_i18n: {},
                    text_i18n: { en: "X" },
                    sort_order: 0,
                    deleted_at: "2026-01-01",
                  },
                ],
              },
            ],
          },
        },
      },
    });

    const editor = await queries.getCustomSectionEditor(ID);
    expect(editor.subsections.map((subsection) => subsection.id)).toEqual(["sub"]);
    expect(editor.subsections[0]?.items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("getProfileEditor", () => {
  const profile = {
    updated_at: "2026-10-20T10:00:00Z",
    full_name: "Alex Example",
    title_i18n: { en: "Developer" },
    summary_i18n: {},
    location_i18n: {},
    email: null,
    phone: "+00 1",
    photo_path: "owner/portraits/a.png",
  };

  it("loads the profile, its active links and a short-lived photo URL", async () => {
    const fake = signIn({
      tables: {
        profiles: { data: profile },
        profile_links: {
          data: [
            { id: "l1", kind: "github", label_i18n: {}, display_text: "x", url: "https://x.y" },
          ],
        },
      },
    });

    const editor = await queries.getProfileEditor();

    expect(editor.values).toMatchObject({ fullName: "Alex Example", email: "", phone: "+00 1" });
    expect(editor.values.links).toEqual([
      { id: "l1", kind: "github", label: {}, displayText: "x", url: "https://x.y" },
    ]);
    expect(editor.photo).toEqual({
      path: "owner/portraits/a.png",
      url: "https://storage.test/signed/owner/portraits/a.png",
    });
    expect(fake.bucket.createSignedUrl).toHaveBeenCalledWith("owner/portraits/a.png", 3600);
    expect(fake.queriesOn("profile_links")[0]?.calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });
  });

  it("shows no photo when signing fails, and fails when links cannot be read", async () => {
    const fake = signIn({ tables: { profiles: { data: profile }, profile_links: { data: [] } } });
    fake.bucket.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "gone" } });
    expect((await queries.getProfileEditor()).photo).toBeNull();

    signIn({ tables: { profiles: { data: profile }, profile_links: { error: { code: "x" } } } });
    await expect(queries.getProfileEditor()).rejects.toThrow("list profile links");
  });
});

describe("collection editors", () => {
  it("returns active items in order with the newest stamp, archived rows included", async () => {
    signIn({
      tables: {
        soft_skills: {
          data: [
            {
              id: "b",
              label_i18n: { en: "B" },
              sort_order: 1,
              deleted_at: null,
              updated_at: "2026-01-02",
            },
            {
              id: "z",
              label_i18n: { en: "Z" },
              sort_order: 0,
              deleted_at: "x",
              updated_at: "2026-03-01",
            },
            {
              id: "a",
              label_i18n: { en: "A" },
              sort_order: 0,
              deleted_at: null,
              updated_at: "2026-01-01",
            },
          ],
        },
      },
    });

    expect(await queries.getSoftSkillsEditor()).toEqual({
      expectedStamp: "2026-03-01",
      items: [
        { id: "a", label: { en: "A" } },
        { id: "b", label: { en: "B" } },
      ],
    });
  });

  it("returns a null stamp for an empty collection", async () => {
    signIn({ tables: { spoken_languages: { data: [] } } });

    expect(await queries.getSpokenLanguagesEditor()).toEqual({ expectedStamp: null, items: [] });
  });

  it("groups active skills under their active groups", async () => {
    signIn({
      tables: {
        skill_groups: {
          data: [
            {
              id: "g1",
              title_i18n: { en: "Languages" },
              sort_order: 0,
              deleted_at: null,
              updated_at: "2026-01-01",
            },
            {
              id: "g2",
              title_i18n: { en: "Old" },
              sort_order: 1,
              deleted_at: "x",
              updated_at: "2026-01-01",
            },
          ],
        },
        skills: {
          data: [
            {
              id: "s2",
              skill_group_id: "g1",
              label_i18n: { shared: "SQL" },
              sort_order: 1,
              deleted_at: null,
              updated_at: "2026-02-01",
            },
            {
              id: "s1",
              skill_group_id: "g1",
              label_i18n: { shared: "TS" },
              sort_order: 0,
              deleted_at: null,
              updated_at: "2026-01-01",
            },
            {
              id: "s3",
              skill_group_id: "g1",
              label_i18n: { shared: "Perl" },
              sort_order: 2,
              deleted_at: "x",
              updated_at: "2026-01-01",
            },
          ],
        },
      },
    });

    expect(await queries.getSkillGroupsEditor()).toEqual({
      expectedStamp: "2026-02-01",
      groups: [
        {
          id: "g1",
          title: { en: "Languages" },
          skills: [
            { id: "s1", label: { shared: "TS" } },
            { id: "s2", label: { shared: "SQL" } },
          ],
        },
      ],
    });
  });

  it("reads spoken languages with their proficiency", async () => {
    signIn({
      tables: {
        spoken_languages: {
          data: [
            {
              id: "l",
              name_i18n: { en: "French" },
              proficiency_i18n: { shared: "C1" },
              sort_order: 0,
              deleted_at: null,
              updated_at: "t",
            },
          ],
        },
      },
    });

    expect((await queries.getSpokenLanguagesEditor()).items).toEqual([
      { id: "l", name: { en: "French" }, proficiency: { shared: "C1" } },
    ]);
  });
});
