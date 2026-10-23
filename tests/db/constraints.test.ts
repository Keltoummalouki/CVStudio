import { beforeAll, describe, expect, it } from "vitest";
import { CHECK_VIOLATION, createUser, type TestUser } from "./helpers";

describe("data integrity constraints", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createUser({ allowlisted: true });
  });

  it("accepts translated or language-neutral text", async () => {
    const translated = await owner.client
      .from("soft_skills")
      .insert({ label_i18n: { en: "Teamwork", fr: "Travail en équipe" } });
    const shared = await owner.client
      .from("soft_skills")
      .insert({ label_i18n: { shared: "Scrum" } });
    const drafting = await owner.client
      .from("soft_skills")
      .insert({ label_i18n: { en: "Only EN" } });
    expect([translated.error, shared.error, drafting.error]).toEqual([null, null, null]);
  });

  it.each([
    ["an unknown language key", { de: "Teamarbeit" }],
    ["shared mixed with a translation", { shared: "Scrum", en: "Scrum" }],
    ["a non-string value", { en: 42 }],
    ["text over the column limit", { en: "x".repeat(121) }],
  ])("rejects localized text with %s", async (_label, value) => {
    const { error } = await owner.client.from("soft_skills").insert({ label_i18n: value });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it.each([
    ["an end before the start", { start_year: 2025, start_month: 6, end_year: 2025, end_month: 2 }],
    ["a month without a year", { start_month: 4 }],
    ["an out-of-range month", { start_year: 2024, start_month: 13 }],
    ["a current role with an end date", { start_year: 2024, end_year: 2025, is_current: true }],
  ])("rejects an experience period with %s", async (_label, period) => {
    const { error } = await owner.client
      .from("experiences")
      .insert({ organization: "Example", ...period });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("accepts year-only precision and same-year month ranges", async () => {
    const { error } = await owner.client.from("experiences").insert(
      [
        { organization: "Year only", start_year: 2023, end_year: 2024 },
        {
          organization: "Same year",
          start_year: 2025,
          start_month: 6,
          end_year: 2025,
          end_month: 8,
        },
        { organization: "Current", start_year: 2026, start_month: 2, is_current: true },
        // Rows have different columns; keep database defaults for the omitted ones.
      ],
      { defaultToNull: false },
    );
    expect(error).toBeNull();
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "https://exa mple.com"])(
    "rejects the unsafe or malformed link %s",
    async (url) => {
      const { error } = await owner.client.from("profile_links").insert({ kind: "website", url });
      expect(error?.code).toBe(CHECK_VIOLATION);
    },
  );

  it("bumps the CV revision on every update so stale writers can be detected", async () => {
    const created = await owner.client
      .from("cv_documents")
      .insert({ name: "Concurrency", locale: "en" })
      .select("id, revision")
      .single();
    expect(created.data?.revision).toBe(1);
    const id = created.data!.id;

    const first = await owner.client
      .from("cv_documents")
      .update({ name: "Renamed in tab A" })
      .eq("id", id)
      .eq("revision", 1)
      .select("revision");
    expect(first.data).toEqual([{ revision: 2 }]);

    // Tab B still believes the revision is 1: its write matches nothing.
    const stale = await owner.client
      .from("cv_documents")
      .update({ name: "Renamed in tab B" })
      .eq("id", id)
      .eq("revision", 1)
      .select("revision");
    expect(stale.data).toEqual([]);
  });

  it("requires the definition's schemaVersion to match its column", async () => {
    const { error } = await owner.client
      .from("cv_templates")
      .insert({ name: "Mismatch", definition: { schemaVersion: 2 } });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  describe("free-form designs", () => {
    const definition = { schemaVersion: 1 };
    const design = { schemaVersion: 1, pages: 1, background: "#ffffff", elements: [] };

    it.each(["cv_templates", "cv_documents"] as const)(
      "%s stores a design exactly when the canvas renderer draws it",
      async (table) => {
        const canvas = await owner.client
          .from(table)
          .insert({ name: "Canvas", definition, visual_template_key: "canvas-v1", design });
        const classic = await owner.client.from(table).insert({ name: "Classic", definition });
        expect([canvas.error, classic.error]).toEqual([null, null]);

        for (const row of [
          { visual_template_key: "canvas-v1" },
          { design },
          { visual_template_key: "canvas-v1", design: { ...design, schemaVersion: 2 } },
          { visual_template_key: "canvas-v1", design: [design] },
          { visual_template_key: "magazine-v9", design },
        ]) {
          const { error } = await owner.client
            .from(table)
            .insert({ name: "Invalid", definition, ...row });
          expect(error?.code, JSON.stringify(row)).toBe(CHECK_VIOLATION);
        }
      },
    );

    it("caps the size of a design", async () => {
      const { error } = await owner.client.from("cv_templates").insert({
        name: "Huge",
        definition,
        visual_template_key: "canvas-v1",
        design: { ...design, note: "x".repeat(262_144) },
      });
      expect(error?.code).toBe(CHECK_VIOLATION);
    });
  });
});
