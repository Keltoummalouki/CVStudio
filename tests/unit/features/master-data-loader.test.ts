import { describe, expect, it } from "vitest";
import { EMPTY_MASTER_DATA } from "@/features/cv-builder/master-data";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { DataAccessError } from "@/lib/data/errors";
import { createFakeSupabase, isOwnerScoped, ownerContext } from "../../utils/fake-supabase";

const row = (
  id: string,
  sortOrder: number,
  createdAt: string,
  deletedAt: string | null = null,
) => ({
  id,
  sort_order: sortOrder,
  created_at: createdAt,
  deleted_at: deletedAt,
});

const PERIOD = {
  start_year: 2025,
  start_month: 1,
  end_year: null,
  end_month: null,
  is_current: true,
};

describe("loadMasterData", () => {
  it("reads every table for the owner only, archived rows included", async () => {
    const fake = createFakeSupabase();

    await loadMasterData(ownerContext(fake));

    expect(fake.queries.map((query) => query.table).sort()).toEqual([
      "certifications",
      "custom_sections",
      "educations",
      "experiences",
      "profile_links",
      "profiles",
      "projects",
      "skill_groups",
      "skills",
      "soft_skills",
      "spoken_languages",
    ]);
    expect(fake.queries.every((query) => isOwnerScoped(query))).toBe(true);
    // Archived rows stay readable so CVs that use them can explain why.
    expect(fake.queries.flatMap((query) => query.calls).some((call) => call.method === "is")).toBe(
      false,
    );
  });

  it("returns an empty workspace when nothing exists yet", async () => {
    expect(await loadMasterData(ownerContext(createFakeSupabase()))).toEqual(EMPTY_MASTER_DATA);
  });

  it("orders rows by position, then creation, and flags archived ones", async () => {
    const fake = createFakeSupabase({
      tables: {
        profiles: {
          data: {
            full_name: "Alex Example",
            title_i18n: { en: "Developer" },
            summary_i18n: { en: 42 },
            location_i18n: { shared: "Springfield" },
            email: "alex@example.com",
            phone: null,
            photo_path: "owner/portraits/a.png",
          },
        },
        soft_skills: {
          data: [
            { ...row("late", 0, "2026-02-01"), label_i18n: { en: "Late" } },
            { ...row("second", 1, "2026-01-01"), label_i18n: { en: "Second" } },
            { ...row("early", 0, "2026-01-01", "2026-03-01"), label_i18n: { en: "Early" } },
          ],
        },
        skill_groups: { data: [{ ...row("g", 0, "2026-01-01"), title_i18n: { en: "Tools" } }] },
        skills: {
          data: [
            { ...row("git", 1, "2026-01-01"), skill_group_id: "g", label_i18n: { shared: "Git" } },
            { ...row("orphan", 0, "2026-01-01"), skill_group_id: "other", label_i18n: {} },
            { ...row("sql", 0, "2026-01-01"), skill_group_id: "g", label_i18n: { shared: "SQL" } },
          ],
        },
      },
    });

    const master = await loadMasterData(ownerContext(fake));

    expect(master.profile).toEqual({
      fullName: "Alex Example",
      title: { en: "Developer" },
      // Malformed stored text reads as empty rather than crashing the CV.
      summary: {},
      location: { shared: "Springfield" },
      email: "alex@example.com",
      phone: null,
      hasPhoto: true,
    });
    expect(master.softSkills).toEqual([
      { id: "early", label: { en: "Early" }, archived: true },
      { id: "late", label: { en: "Late" }, archived: false },
      { id: "second", label: { en: "Second" }, archived: false },
    ]);
    expect(master.skillGroups[0]?.skills.map((skill) => skill.id)).toEqual(["sql", "git"]);
  });

  it("maps nested details, links, periods and custom sections", async () => {
    const detail = (id: string, order: number, deletedAt: string | null = null) => ({
      ...row(id, order, "2026-01-01", deletedAt),
      kind: "bullet",
      text_i18n: { en: id },
    });
    const fake = createFakeSupabase({
      tables: {
        profile_links: {
          data: [
            {
              ...row("l", 0, "2026-01-01"),
              kind: "github",
              label_i18n: {},
              display_text: "example",
              url: "https://github.com/example",
            },
          ],
        },
        experiences: {
          data: [
            {
              ...row("e", 0, "2026-01-01"),
              ...PERIOD,
              organization: "Acme",
              role_i18n: { en: "Dev" },
              location_i18n: {},
              experience_details: [detail("b", 1), detail("a", 0, "2026-02-01")],
            },
          ],
        },
        projects: {
          data: [
            {
              ...row("p", 0, "2026-01-01"),
              ...PERIOD,
              title_i18n: { en: "App" },
              description_i18n: {},
              project_url: null,
              source_url: "https://src.example",
              project_details: [],
            },
          ],
        },
        educations: {
          data: [
            {
              ...row("ed", 0, "2026-01-01"),
              ...PERIOD,
              credential_i18n: { en: "BSc" },
              institution_i18n: {},
              location_i18n: {},
              description_i18n: {},
            },
          ],
        },
        certifications: {
          data: [
            {
              ...row("c", 0, "2026-01-01"),
              title_i18n: { en: "Cert" },
              issuer_i18n: {},
              issued_year: 2025,
              issued_month: 4,
              credential_url: null,
            },
          ],
        },
        spoken_languages: {
          data: [
            { ...row("fr", 0, "2026-01-01"), name_i18n: { en: "French" }, proficiency_i18n: {} },
          ],
        },
        custom_sections: {
          data: [
            {
              ...row("s", 0, "2026-01-01"),
              title_i18n: { en: "Awards" },
              custom_subsections: [
                {
                  ...row("sub", 0, "2026-01-01"),
                  title_i18n: {},
                  custom_items: [
                    {
                      ...row("i", 0, "2026-01-01"),
                      kind: "key_value",
                      label_i18n: { en: "Year" },
                      text_i18n: { en: "2025" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    const master = await loadMasterData(ownerContext(fake));

    expect(master.links).toEqual([
      {
        id: "l",
        kind: "github",
        label: {},
        displayText: "example",
        url: "https://github.com/example",
        archived: false,
      },
    ]);
    expect(master.experiences[0]).toMatchObject({
      organization: "Acme",
      period: { startYear: 2025, startMonth: 1, endYear: null, endMonth: null, isCurrent: true },
      details: [
        { id: "a", archived: true },
        { id: "b", archived: false },
      ],
    });
    expect(master.projects[0]).toMatchObject({
      projectUrl: null,
      sourceUrl: "https://src.example",
    });
    expect(master.educations[0]?.credential).toEqual({ en: "BSc" });
    expect(master.certifications[0]).toMatchObject({ issuedYear: 2025, issuedMonth: 4 });
    expect(master.languages[0]).toEqual({
      id: "fr",
      name: { en: "French" },
      proficiency: {},
      archived: false,
    });
    expect(master.customSections[0]?.subsections[0]?.items[0]).toEqual({
      id: "i",
      kind: "key_value",
      label: { en: "Year" },
      text: { en: "2025" },
      archived: false,
    });
  });

  it("refuses to build a CV from partially read data", async () => {
    const failing = (table: string) =>
      loadMasterData(
        ownerContext(createFakeSupabase({ tables: { [table]: { error: { code: "08006" } } } })),
      );

    await expect(failing("profiles")).rejects.toThrow("Data access failed: read profile");
    await expect(failing("projects")).rejects.toBeInstanceOf(DataAccessError);
    await expect(failing("skills")).rejects.toThrow("list skills");
  });
});
