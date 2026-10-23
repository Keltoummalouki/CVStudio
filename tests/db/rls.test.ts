import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import {
  FOREIGN_KEY_VIOLATION,
  PERMISSION_DENIED,
  anonClient,
  createUser,
  type Client,
  type TestUser,
} from "./helpers";

type Table = keyof Database["public"]["Tables"];
// One row per owner (keyed by owner_id) or written only through functions: tests/db/ai.test.ts.
type OwnedTable = Exclude<
  Table,
  "app_owners" | "profiles" | "owner_settings" | "ai_requests" | "ai_request_attempts"
>;

/** One valid row per owned table, inserted in dependency order by the given client. */
async function seedEveryTable(client: Client): Promise<Record<OwnedTable, string>> {
  const one = async <T extends { id: string } | null>(
    query: PromiseLike<{ data: T; error: unknown }>,
  ) => {
    const { data, error } = await query;
    if (error || !data) throw error ?? new Error("insert returned no row");
    return data.id;
  };

  const experience = await one(
    client
      .from("experiences")
      .insert({ organization: "Example Co", role_i18n: { en: "Developer", fr: "Développeur" } })
      .select("id")
      .single(),
  );
  const skillGroup = await one(
    client
      .from("skill_groups")
      .insert({ title_i18n: { en: "Languages" } })
      .select("id")
      .single(),
  );
  const project = await one(
    client
      .from("projects")
      .insert({ title_i18n: { en: "Project" } })
      .select("id")
      .single(),
  );
  const customSection = await one(
    client
      .from("custom_sections")
      .insert({ title_i18n: { en: "Volunteering" } })
      .select("id")
      .single(),
  );
  const customSubsection = await one(
    client
      .from("custom_subsections")
      .insert({ custom_section_id: customSection })
      .select("id")
      .single(),
  );

  return {
    experiences: experience,
    skill_groups: skillGroup,
    projects: project,
    custom_sections: customSection,
    custom_subsections: customSubsection,
    experience_details: await one(
      client
        .from("experience_details")
        .insert({
          experience_id: experience,
          kind: "bullet",
          text_i18n: { en: "Shipped a feature" },
        })
        .select("id")
        .single(),
    ),
    skills: await one(
      client
        .from("skills")
        .insert({ skill_group_id: skillGroup, label_i18n: { shared: "TypeScript" } })
        .select("id")
        .single(),
    ),
    project_details: await one(
      client
        .from("project_details")
        .insert({ project_id: project, kind: "technology", text_i18n: { shared: "Next.js" } })
        .select("id")
        .single(),
    ),
    custom_items: await one(
      client
        .from("custom_items")
        .insert({
          custom_subsection_id: customSubsection,
          kind: "bullet",
          text_i18n: { en: "Item" },
        })
        .select("id")
        .single(),
    ),
    profile_links: await one(
      client
        .from("profile_links")
        .insert({ kind: "github", display_text: "example", url: "https://github.com/example" })
        .select("id")
        .single(),
    ),
    educations: await one(
      client
        .from("educations")
        .insert({ credential_i18n: { en: "BSc" } })
        .select("id")
        .single(),
    ),
    certifications: await one(
      client
        .from("certifications")
        .insert({ title_i18n: { en: "Cert" } })
        .select("id")
        .single(),
    ),
    soft_skills: await one(
      client
        .from("soft_skills")
        .insert({ label_i18n: { en: "Teamwork" } })
        .select("id")
        .single(),
    ),
    spoken_languages: await one(
      client
        .from("spoken_languages")
        .insert({ name_i18n: { en: "English", fr: "Anglais" }, proficiency_i18n: { shared: "B2" } })
        .select("id")
        .single(),
    ),
    cv_documents: await one(
      client
        .from("cv_documents")
        .insert({ name: "Frontend — EN", locale: "en" })
        .select("id")
        .single(),
    ),
    cv_templates: await one(
      client
        .from("cv_templates")
        .insert({ name: "Full stack", locale: "fr" })
        .select("id")
        .single(),
    ),
    job_posts: await one(
      client
        .from("job_posts")
        .insert({ title: "Frontend developer", description: "React and TypeScript." })
        .select("id")
        .single(),
    ),
  };
}

const OWNED_TABLES: OwnedTable[] = [
  "profile_links",
  "experiences",
  "experience_details",
  "educations",
  "skill_groups",
  "skills",
  "projects",
  "project_details",
  "certifications",
  "soft_skills",
  "spoken_languages",
  "custom_sections",
  "custom_subsections",
  "custom_items",
  "cv_documents",
  "cv_templates",
  "job_posts",
];

describe("row level security", () => {
  let ownerA: TestUser;
  let ownerB: TestUser;
  let intruder: TestUser;
  let anon: Client;
  let rowsA: Record<OwnedTable, string>;

  beforeAll(async () => {
    [ownerA, ownerB, intruder] = await Promise.all([
      createUser({ allowlisted: true }),
      createUser({ allowlisted: true }),
      createUser({ allowlisted: false }),
    ]);
    anon = anonClient();
    rowsA = await seedEveryTable(ownerA.client);
  });

  it("provisions an empty profile for each allowlisted owner", async () => {
    const { data, error } = await ownerA.client.from("profiles").select("owner_id, full_name");
    expect(error).toBeNull();
    expect(data).toEqual([{ owner_id: ownerA.id, full_name: "" }]);
  });

  it.each(OWNED_TABLES)("%s: the owner reads and updates their own row", async (table) => {
    const id = rowsA[table];
    const read = await ownerA.client.from(table).select("id").eq("id", id);
    expect(read.data).toEqual([{ id }]);

    const update = await ownerA.client
      .from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toHaveLength(1);
  });

  it.each(OWNED_TABLES)("%s: another owner can neither see nor change the row", async (table) => {
    const id = rowsA[table];
    const read = await ownerB.client.from(table).select("id").eq("id", id);
    expect(read.data).toEqual([]);

    const update = await ownerB.client
      .from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    expect(update.data ?? []).toEqual([]);

    const removal = await ownerB.client.from(table).delete().eq("id", id).select("id");
    expect(removal.data ?? []).toEqual([]);

    const stillThere = await ownerA.client.from(table).select("id").eq("id", id);
    expect(stillThere.data).toEqual([{ id }]);
  });

  it.each(OWNED_TABLES)("%s: a signed-in user who is not allowlisted is denied", async (table) => {
    const read = await intruder.client.from(table).select("id");
    expect(read.data).toEqual([]);
  });

  it("refuses inserts from a signed-in user who is not allowlisted", async () => {
    const { error } = await intruder.client.from("experiences").insert({ organization: "Nope" });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each([...OWNED_TABLES, "profiles", "app_owners"] as const)(
    "%s: anonymous requests are refused before RLS",
    async (table) => {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(data).toBeNull();
    },
  );

  it("never lets an owner assign a row to someone else", async () => {
    const { error } = await ownerA.client
      .from("experiences")
      .insert({ organization: "Spoof", owner_id: ownerB.id });
    expect(error?.code).toBe(PERMISSION_DENIED);

    const { data } = await ownerA.client
      .from("experiences")
      .update({ owner_id: ownerB.id })
      .eq("id", rowsA.experiences)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("never lets an owner attach a child to another owner's parent", async () => {
    const { error } = await ownerB.client
      .from("experience_details")
      .insert({ experience_id: rowsA.experiences, kind: "bullet", text_i18n: { en: "Injected" } });
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("keeps the allowlist read-only for signed-in users", async () => {
    const selfAdd = await intruder.client.from("app_owners").insert({ user_id: intruder.id });
    expect(selfAdd.error?.code).toBe(PERMISSION_DENIED);

    const visible = await ownerA.client.from("app_owners").select("user_id");
    expect(visible.data).toEqual([{ user_id: ownerA.id }]);
  });

  it("lets the owner archive and permanently delete their own rows", async () => {
    const archived = await ownerA.client
      .from("soft_skills")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", rowsA.soft_skills)
      .select("deleted_at")
      .single();
    expect(archived.data?.deleted_at).not.toBeNull();

    const removed = await ownerA.client
      .from("experiences")
      .delete()
      .eq("id", rowsA.experiences)
      .select("id");
    expect(removed.data).toEqual([{ id: rowsA.experiences }]);

    // Child details cascade with their parent.
    const orphans = await ownerA.client
      .from("experience_details")
      .select("id")
      .eq("id", rowsA.experience_details);
    expect(orphans.data).toEqual([]);
  });
});
