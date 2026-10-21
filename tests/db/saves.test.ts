import { beforeAll, describe, expect, it } from "vitest";
import { PERMISSION_DENIED, anonClient, createUser, type Client, type TestUser } from "./helpers";

type Saved = { id: string; updatedAt: string };

async function saveExperience(client: Client, payload: Record<string, unknown>) {
  return client.rpc("save_experience", { payload: payload as never });
}

async function activeDetails(client: Client, experienceId: string) {
  const { data } = await client
    .from("experience_details")
    .select("id, kind, text_i18n, sort_order")
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("sort_order");
  return data ?? [];
}

describe("atomic career-data saves", () => {
  let owner: TestUser;
  let other: TestUser;
  let intruder: TestUser;

  beforeAll(async () => {
    [owner, other, intruder] = await Promise.all([
      createUser({ allowlisted: true }),
      createUser({ allowlisted: true }),
      createUser({ allowlisted: false }),
    ]);
  });

  it("creates an experience with ordered details in one call", async () => {
    const { data, error } = await saveExperience(owner.client, {
      organization: "Example Co",
      role_i18n: { en: "Developer", fr: "Développeuse" },
      start_year: 2024,
      start_month: 2,
      is_current: true,
      details: [
        { kind: "bullet", text_i18n: { en: "Built features" } },
        { kind: "technology", text_i18n: { shared: "Ruby on Rails" } },
        { kind: "technology", text_i18n: { shared: "Angular" } },
      ],
    });
    expect(error).toBeNull();
    const saved = data as Saved;

    const details = await activeDetails(owner.client, saved.id);
    expect(details.map((detail) => [detail.kind, detail.sort_order])).toEqual([
      ["bullet", 0],
      ["technology", 1],
      ["technology", 2],
    ]);
  });

  it("updates, reorders, and archives details that were removed", async () => {
    const created = (
      await saveExperience(owner.client, {
        organization: "Reorder Co",
        details: [
          { kind: "bullet", text_i18n: { en: "First" } },
          { kind: "bullet", text_i18n: { en: "Second" } },
        ],
      })
    ).data as Saved;
    const [first, second] = await activeDetails(owner.client, created.id);

    const { data, error } = await saveExperience(owner.client, {
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      organization: "Reorder Co",
      details: [{ id: second!.id, kind: "bullet", text_i18n: { en: "Second, now first" } }],
    });
    expect(error).toBeNull();
    expect((data as Saved).updatedAt).not.toBe(created.updatedAt);

    const details = await activeDetails(owner.client, created.id);
    expect(details).toEqual([
      expect.objectContaining({
        id: second!.id,
        sort_order: 0,
        text_i18n: { en: "Second, now first" },
      }),
    ]);

    // The removed bullet is archived, not deleted: existing CVs can still resolve it.
    const archived = await owner.client
      .from("experience_details")
      .select("deleted_at")
      .eq("id", first!.id)
      .single();
    expect(archived.data?.deleted_at).not.toBeNull();
  });

  it("refuses to overwrite a record that changed since it was loaded", async () => {
    const created = (await saveExperience(owner.client, { organization: "Stale Co" }))
      .data as Saved;
    await saveExperience(owner.client, {
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      organization: "Saved in tab A",
    });

    const { error } = await saveExperience(owner.client, {
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      organization: "Saved in tab B",
    });
    expect(error?.message).toBe("stale_record");
  });

  it("rolls back the whole save when any child is invalid", async () => {
    const created = (await saveExperience(owner.client, { organization: "Atomic Co" }))
      .data as Saved;

    const { error } = await saveExperience(owner.client, {
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      organization: "Should not persist",
      details: [{ kind: "not-a-kind", text_i18n: { en: "Invalid" } }],
    });
    expect(error).not.toBeNull();

    const row = await owner.client
      .from("experiences")
      .select("organization, updated_at")
      .eq("id", created.id)
      .single();
    expect(row.data).toEqual({ organization: "Atomic Co", updated_at: created.updatedAt });
  });

  it("treats another owner's record as missing", async () => {
    const created = (await saveExperience(owner.client, { organization: "Mine" })).data as Saved;
    const { error } = await saveExperience(other.client, {
      id: created.id,
      organization: "Hijacked",
    });
    expect(error?.message).toBe("record_not_found");
  });

  it("refuses saves from accounts outside the allowlist and from anonymous callers", async () => {
    const asIntruder = await intruder.client.rpc("save_soft_skills", {
      payload: { items: [{ label_i18n: { en: "Nope" } }] },
    });
    expect(asIntruder.error?.code).toBe(PERMISSION_DENIED);

    const asAnon = await anonClient().rpc("save_soft_skills", { payload: { items: [] } });
    expect(asAnon.error?.code).toBe(PERMISSION_DENIED);
  });

  it("saves skill groups as one collection and moves skills between groups", async () => {
    const first = await owner.client.rpc("save_skill_groups", {
      payload: {
        expectedStamp: null,
        groups: [
          {
            title_i18n: { en: "Languages", fr: "Langages" },
            skills: [{ label_i18n: { shared: "TypeScript" } }],
          },
          { title_i18n: { en: "Databases" }, skills: [] },
        ],
      },
    });
    expect(first.error).toBeNull();

    const groups = (
      await owner.client
        .from("skill_groups")
        .select("id, sort_order")
        .is("deleted_at", null)
        .order("sort_order")
    ).data!;
    const skill = (await owner.client.from("skills").select("id").single()).data!;
    const stamp = (first.data as { stamp: string }).stamp;

    const moved = await owner.client.rpc("save_skill_groups", {
      payload: {
        expectedStamp: stamp,
        groups: [
          {
            id: groups[1]!.id,
            title_i18n: { en: "Databases" },
            skills: [{ id: skill.id, label_i18n: { shared: "TypeScript" } }],
          },
        ],
      },
    });
    expect(moved.error).toBeNull();

    const skillRow = (
      await owner.client.from("skills").select("skill_group_id").eq("id", skill.id).single()
    ).data;
    expect(skillRow?.skill_group_id).toBe(groups[1]!.id);
    const firstGroup = (
      await owner.client.from("skill_groups").select("deleted_at").eq("id", groups[0]!.id).single()
    ).data;
    expect(firstGroup?.deleted_at).not.toBeNull();

    // Re-using the old stamp is a stale write.
    const stale = await owner.client.rpc("save_skill_groups", {
      payload: { expectedStamp: stamp, groups: [] },
    });
    expect(stale.error?.message).toBe("stale_record");
  });

  it("reorders top-level records of the caller only", async () => {
    const a = (await saveExperience(owner.client, { organization: "Order A" })).data as Saved;
    const b = (await saveExperience(owner.client, { organization: "Order B" })).data as Saved;

    const { error } = await owner.client.rpc("reorder_records", {
      target: "experiences",
      ids: [b.id, a.id],
    });
    expect(error).toBeNull();
    const rows = (
      await owner.client
        .from("experiences")
        .select("id, sort_order")
        .in("id", [a.id, b.id])
        .order("sort_order")
    ).data;
    expect(rows?.map((row) => row.id)).toEqual([b.id, a.id]);

    const foreign = await other.client.rpc("reorder_records", {
      target: "experiences",
      ids: [a.id, b.id],
    });
    expect(foreign.error).toBeNull();
    const unchanged = (
      await owner.client.from("experiences").select("id").in("id", [a.id, b.id]).order("sort_order")
    ).data;
    expect(unchanged?.map((row) => row.id)).toEqual([b.id, a.id]);

    const invalid = await owner.client.rpc("reorder_records", { target: "app_owners", ids: [] });
    expect(invalid.error?.message).toBe("invalid_target");
  });

  it("counts the CVs and templates that reference a record", async () => {
    const created = (await saveExperience(owner.client, { organization: "Referenced Co" }))
      .data as Saved;
    await owner.client.from("cv_documents").insert([
      {
        name: "Uses it",
        definition: { schemaVersion: 1, sections: [{ items: [{ refId: created.id }] }] },
      },
      { name: "Does not", definition: { schemaVersion: 1, sections: [] } },
    ]);
    await owner.client
      .from("cv_templates")
      .insert({ name: "Preset", definition: { schemaVersion: 1, refs: [created.id] } });

    const { data, error } = await owner.client.rpc("count_record_references", {
      record_id: created.id,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ documents: 1, templates: 1 });

    const asOther = await other.client.rpc("count_record_references", { record_id: created.id });
    expect(asOther.data).toEqual({ documents: 0, templates: 0 });
  });
});
