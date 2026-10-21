import { describe, expect, it } from "vitest";
import {
  NEW_CERTIFICATION,
  NEW_CUSTOM_SECTION,
  NEW_EDUCATION,
  NEW_EXPERIENCE,
  NEW_PROJECT,
} from "@/features/career-data/defaults";
import {
  toCertificationPayload,
  toCustomSectionPayload,
  toEducationPayload,
  toExperiencePayload,
  toProfilePayload,
  toProjectPayload,
  toSkillGroupsPayload,
  toSoftSkillsPayload,
  toSpokenLanguagesPayload,
} from "@/features/career-data/payloads";
import { isRecordKind, RECORD_KINDS, RECORD_TABLES } from "@/features/career-data/record-kinds";
import {
  certificationSchema,
  customSectionSchema,
  EMPTY_PERIOD,
  experienceSchema,
  periodSchema,
  profileSchema,
  projectSchema,
  skillGroupsSchema,
  softSkillsSchema,
  spokenLanguagesSchema,
  type PeriodValues,
  type ProfileValues,
} from "@/features/career-data/schemas";

const ID = "00000000-0000-4000-8000-000000000001";

const period = (overrides: Partial<PeriodValues>): PeriodValues => ({
  ...EMPTY_PERIOD,
  ...overrides,
});

/** Issue paths and messages, the shape forms translate into field errors. */
function issues(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return (result.error?.issues ?? []).map((issue) => `${issue.path.join(".")}:${issue.message}`);
}

const PROFILE: ProfileValues = {
  expectedUpdatedAt: null,
  fullName: "  Alex Example ",
  title: { en: "Developer", fr: "Développeur" },
  summary: {},
  location: { shared: "Springfield" },
  email: "alex@example.com",
  phone: "+00 (1) 23-45.67",
  links: [],
};

describe("period schema", () => {
  it("accepts an empty, an ongoing and a closed period", () => {
    expect(periodSchema.safeParse(EMPTY_PERIOD).success).toBe(true);
    expect(periodSchema.safeParse(period({ startYear: 2024, isCurrent: true })).success).toBe(true);
    expect(
      periodSchema.safeParse(period({ startYear: 2024, startMonth: 3, endYear: 2024, endMonth: 3 }))
        .success,
    ).toBe(true);
  });

  it("requires a year whenever a month is given", () => {
    expect(issues(periodSchema.safeParse(period({ startMonth: 4 })))).toEqual([
      "startYear:required",
    ]);
    expect(issues(periodSchema.safeParse(period({ endMonth: 4 })))).toEqual(["endYear:required"]);
  });

  it("rejects an end before the start, at year and at month precision", () => {
    expect(issues(periodSchema.safeParse(period({ startYear: 2025, endYear: 2024 })))).toEqual([
      "endYear:endBeforeStart",
    ]);
    expect(
      issues(
        periodSchema.safeParse(
          period({ startYear: 2025, startMonth: 6, endYear: 2025, endMonth: 5 }),
        ),
      ),
    ).toEqual(["endYear:endBeforeStart"]);
    // Without months the same year is a valid one-year period.
    expect(periodSchema.safeParse(period({ startYear: 2025, endYear: 2025 })).success).toBe(true);
  });

  it("ignores a stale end date while the period is ongoing", () => {
    expect(
      periodSchema.safeParse(period({ startYear: 2025, endYear: 2020, isCurrent: true })).success,
    ).toBe(true);
  });

  it("bounds years and months like the database does", () => {
    expect(periodSchema.safeParse(period({ startYear: 1899 })).success).toBe(false);
    expect(periodSchema.safeParse(period({ startYear: 2101 })).success).toBe(false);
    expect(periodSchema.safeParse(period({ startYear: 2020, startMonth: 13 })).success).toBe(false);
    expect(periodSchema.safeParse(period({ startYear: 2020.5 })).success).toBe(false);
  });
});

describe("profile schema", () => {
  it("accepts a valid profile and an empty email or phone", () => {
    expect(profileSchema.safeParse(PROFILE).success).toBe(true);
    expect(profileSchema.safeParse({ ...PROFILE, email: "", phone: "" }).success).toBe(true);
  });

  it("reports message keys for malformed contact details", () => {
    expect(issues(profileSchema.safeParse({ ...PROFILE, email: "alex@" }))).toEqual([
      "email:invalidEmail",
    ]);
    expect(issues(profileSchema.safeParse({ ...PROFILE, phone: "call me" }))).toEqual([
      "phone:invalidPhone",
    ]);
    expect(issues(profileSchema.safeParse({ ...PROFILE, fullName: "x".repeat(121) }))).toEqual([
      "fullName:tooLong",
    ]);
  });

  it("only accepts http(s) links, never javascript: or other schemes", () => {
    const link = { id: null, kind: "github", label: {}, displayText: "", url: "" };
    const withUrl = (url: string) =>
      profileSchema.safeParse({ ...PROFILE, links: [{ ...link, url }] });

    expect(withUrl("https://github.com/example").success).toBe(true);
    expect(issues(withUrl("javascript:alert(1)"))).toEqual(["links.0.url:invalidUrl"]);
    expect(issues(withUrl("ftp://files.example.com"))).toEqual(["links.0.url:invalidUrl"]);
    expect(issues(withUrl(""))).toContain("links.0.url:required");
    expect(withUrl("https://example.com/with space").success).toBe(false);
  });

  it("caps the number of links", () => {
    const link = { id: null, kind: "website", label: {}, displayText: "", url: "https://a.b" };
    expect(issues(profileSchema.safeParse({ ...PROFILE, links: Array(21).fill(link) }))).toEqual([
      "links:tooMany",
    ]);
  });
});

describe("record schemas", () => {
  it("accept the starting values of every new-record page once required text exists", () => {
    expect(
      experienceSchema.safeParse({ ...NEW_EXPERIENCE, organization: "Acme", role: { en: "Dev" } })
        .success,
    ).toBe(true);
    expect(projectSchema.safeParse({ ...NEW_PROJECT, title: { shared: "CVStudio" } }).success).toBe(
      true,
    );
    expect(
      certificationSchema.safeParse({ ...NEW_CERTIFICATION, title: { fr: "Cert" } }).success,
    ).toBe(true);
    expect(
      customSectionSchema.safeParse({
        ...NEW_CUSTOM_SECTION,
        title: { en: "Volunteering" },
      }).success,
    ).toBe(true);
  });

  it("requires text in at least one language, not in both", () => {
    expect(issues(experienceSchema.safeParse({ ...NEW_EXPERIENCE, organization: "Acme" }))).toEqual(
      ["role:requiredOneLanguage"],
    );
    expect(
      issues(
        experienceSchema.safeParse({ ...NEW_EXPERIENCE, organization: " ", role: { fr: "Dev" } }),
      ),
    ).toEqual(["organization:required"]);
    expect(
      experienceSchema.safeParse({ ...NEW_EXPERIENCE, organization: "Acme", role: { fr: "Dév" } })
        .success,
    ).toBe(true);
  });

  it("validates nested achievements and technologies", () => {
    const base = { ...NEW_EXPERIENCE, organization: "Acme", role: { en: "Dev" } };
    expect(
      issues(
        experienceSchema.safeParse({
          ...base,
          details: [{ id: null, kind: "bullet", text: { en: "  " } }],
        }),
      ),
    ).toEqual(["details.0.text:requiredOneLanguage"]);
    expect(
      experienceSchema.safeParse({
        ...base,
        details: [{ id: null, kind: "quote", text: { en: "x" } }],
      }).success,
    ).toBe(false);
  });

  it("rejects ids that are not UUIDs so a form cannot target arbitrary rows", () => {
    expect(
      experienceSchema.safeParse({
        ...NEW_EXPERIENCE,
        id: "1 or 1=1",
        organization: "Acme",
        role: { en: "Dev" },
      }).success,
    ).toBe(false);
    expect(
      experienceSchema.safeParse({
        ...NEW_EXPERIENCE,
        id: ID,
        organization: "A",
        role: { en: "D" },
      }).success,
    ).toBe(true);
  });

  it("checks optional project and credential links", () => {
    const project = { ...NEW_PROJECT, title: { en: "App" } };
    expect(issues(projectSchema.safeParse({ ...project, sourceUrl: "github.com/x" }))).toEqual([
      "sourceUrl:invalidUrl",
    ]);
    expect(
      issues(
        certificationSchema.safeParse({
          ...NEW_CERTIFICATION,
          title: { en: "Cert" },
          credentialUrl: "data:text/html,hi",
        }),
      ),
    ).toEqual(["credentialUrl:invalidUrl"]);
  });

  it("keeps at least one subsection in a custom section", () => {
    expect(
      issues(
        customSectionSchema.safeParse({
          ...NEW_CUSTOM_SECTION,
          title: { en: "X" },
          subsections: [],
        }),
      ),
    ).toEqual(["subsections:required"]);
  });
});

describe("collection schemas", () => {
  it("validate every item and cap the list sizes", () => {
    const skill = { id: null, label: { shared: "Teamwork" } };
    expect(softSkillsSchema.safeParse({ expectedStamp: null, items: [skill] }).success).toBe(true);
    expect(
      issues(softSkillsSchema.safeParse({ expectedStamp: null, items: Array(101).fill(skill) })),
    ).toEqual(["items:tooMany"]);
    expect(
      issues(
        spokenLanguagesSchema.safeParse({
          expectedStamp: null,
          items: [{ id: null, name: {}, proficiency: { shared: "B2" } }],
        }),
      ),
    ).toEqual(["items.0.name:requiredOneLanguage"]);
    expect(
      issues(
        skillGroupsSchema.safeParse({
          expectedStamp: null,
          groups: [{ id: null, title: { en: "Languages" }, skills: Array(61).fill(skill) }],
        }),
      ),
    ).toEqual(["groups.0.skills:tooMany"]);
  });
});

describe("payload mappers", () => {
  it("trims profile text and stores blank contact details as null", () => {
    const payload = toProfilePayload({
      ...PROFILE,
      email: "  ",
      phone: "",
      title: { en: " Developer ", fr: "" },
      links: [
        {
          id: null,
          kind: "github",
          label: { en: " Code " },
          displayText: " example ",
          url: " https://github.com/example ",
        },
      ],
    });

    expect(payload).toEqual({
      expectedUpdatedAt: null,
      full_name: "Alex Example",
      title_i18n: { en: "Developer" },
      summary_i18n: {},
      location_i18n: { shared: "Springfield" },
      email: null,
      phone: null,
      links: [
        {
          id: null,
          kind: "github",
          label_i18n: { en: "Code" },
          display_text: "example",
          url: "https://github.com/example",
        },
      ],
    });
  });

  it("drops the end of an ongoing period and months without a year", () => {
    const ongoing = toExperiencePayload({
      ...NEW_EXPERIENCE,
      organization: " Acme ",
      role: { en: "Dev" },
      period: { startYear: 2024, startMonth: 2, endYear: 2025, endMonth: 6, isCurrent: true },
      details: [{ id: ID, kind: "technology", text: { shared: " TypeScript " } }],
    });
    expect(ongoing).toMatchObject({
      organization: "Acme",
      start_year: 2024,
      start_month: 2,
      end_year: null,
      end_month: null,
      is_current: true,
      details: [{ id: ID, kind: "technology", text_i18n: { shared: "TypeScript" } }],
    });

    const orphanMonths = toEducationPayload({
      ...NEW_EDUCATION,
      credential: { en: "BSc" },
      period: { startYear: null, startMonth: 9, endYear: null, endMonth: 6, isCurrent: false },
    });
    expect(orphanMonths).toMatchObject({
      start_year: null,
      start_month: null,
      end_year: null,
      end_month: null,
    });
  });

  it("maps projects and certifications, nulling empty links and orphan months", () => {
    expect(
      toProjectPayload({ ...NEW_PROJECT, title: { en: "App" }, projectUrl: " https://a.example " }),
    ).toMatchObject({ project_url: "https://a.example", source_url: null, details: [] });

    expect(
      toCertificationPayload({
        ...NEW_CERTIFICATION,
        title: { en: "Cert" },
        issuedYear: null,
        issuedMonth: 4,
      }),
    ).toEqual({
      id: null,
      expectedUpdatedAt: null,
      title_i18n: { en: "Cert" },
      issuer_i18n: {},
      issued_year: null,
      issued_month: null,
      credential_url: null,
    });
  });

  it("keeps labels only on key/value items of custom sections", () => {
    const payload = toCustomSectionPayload({
      id: ID,
      expectedUpdatedAt: "2026-10-20T10:00:00Z",
      title: { en: "Volunteering" },
      subsections: [
        {
          id: null,
          title: {},
          items: [
            { id: null, kind: "bullet", label: { en: "ignored" }, text: { en: "Mentor" } },
            { id: null, kind: "key_value", label: { en: "Role" }, text: { en: "Organizer" } },
          ],
        },
      ],
    });

    expect(payload.subsections[0]?.items).toEqual([
      { id: null, kind: "bullet", label_i18n: {}, text_i18n: { en: "Mentor" } },
      { id: null, kind: "key_value", label_i18n: { en: "Role" }, text_i18n: { en: "Organizer" } },
    ]);
  });

  it("maps collections with their concurrency stamp", () => {
    expect(
      toSoftSkillsPayload({ expectedStamp: "s1", items: [{ id: null, label: { en: " Calm " } }] }),
    ).toEqual({ expectedStamp: "s1", items: [{ id: null, label_i18n: { en: "Calm" } }] });
    expect(
      toSpokenLanguagesPayload({
        expectedStamp: null,
        items: [{ id: ID, name: { en: "French" }, proficiency: { shared: "C1" } }],
      }),
    ).toEqual({
      expectedStamp: null,
      items: [{ id: ID, name_i18n: { en: "French" }, proficiency_i18n: { shared: "C1" } }],
    });
    expect(
      toSkillGroupsPayload({
        expectedStamp: "s2",
        groups: [
          { id: null, title: { en: "Tools" }, skills: [{ id: null, label: { shared: "Git" } }] },
        ],
      }),
    ).toEqual({
      expectedStamp: "s2",
      groups: [
        {
          id: null,
          title_i18n: { en: "Tools" },
          skills: [{ id: null, label_i18n: { shared: "Git" } }],
        },
      ],
    });
  });
});

describe("record kinds", () => {
  it("maps every kind to its table and rejects anything else", () => {
    expect(RECORD_KINDS.map((kind) => RECORD_TABLES[kind])).toEqual([
      "experiences",
      "educations",
      "projects",
      "certifications",
      "custom_sections",
    ]);
    expect(isRecordKind("projects")).toBe(true);
    expect(isRecordKind("profiles")).toBe(false);
    expect(isRecordKind(undefined)).toBe(false);
  });
});
