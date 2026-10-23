import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { createBlankDesign, type Design } from "@/features/cv-design/design";
import { addElement, createElement } from "@/features/cv-design/operations";
import { buildMasterData, sequentialIds } from "../../fixtures/master-data";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  OWNER_ID,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({ getOwnerContext: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));

const {
  createDesignTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateRevision,
  restoreTemplate,
  saveTemplateDesign,
} = await import("@/features/cv-templates/server/actions");

const TEMPLATE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const definition = createDefaultDefinition(buildMasterData(), sequentialIds());

/** A design with one section on the page. */
function designWithProjects(): Design {
  const blank = createBlankDesign();
  const element = createElement(
    blank,
    { type: "section", section: "projects", showTitle: true, rule: true, columns: 1 },
    { newId: () => "7b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e" },
  );
  return addElement(blank, element);
}

function signIn(options: FakeSupabaseOptions = {}) {
  const fake = createFakeSupabase(options);
  mocks.getOwnerContext.mockResolvedValue(ownerContext(fake));
  return fake;
}

beforeEach(() => {
  mocks.getOwnerContext.mockReset();
  mocks.refresh.mockReset();
});

describe("template actions require the owner", () => {
  it.each([
    ["createDesignTemplate", () => createDesignTemplate({ name: "A", locale: "en" })],
    ["saveTemplateDesign", () => saveTemplateDesign({})],
    ["getTemplateRevision", () => getTemplateRevision(TEMPLATE_ID)],
    ["duplicateTemplate", () => duplicateTemplate(TEMPLATE_ID, "Copy")],
    ["deleteTemplate", () => deleteTemplate(TEMPLATE_ID)],
    ["restoreTemplate", () => restoreTemplate(TEMPLATE_ID)],
  ])("%s answers unauthorized without a session", async (_name, action) => {
    mocks.getOwnerContext.mockResolvedValue(null);

    expect(await action()).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("createDesignTemplate", () => {
  it("creates a blank A4 design, drawn by the canvas renderer", async () => {
    const fake = signIn({ tables: { cv_templates: { data: { id: TEMPLATE_ID } } } });

    expect(await createDesignTemplate({ name: " Untitled template ", locale: "fr" })).toEqual({
      ok: true,
      data: { id: TEMPLATE_ID },
    });
    const row = callsOf(fake.queriesOn("cv_templates")[0]!, "insert")[0]?.[0];
    expect(row).toMatchObject({
      owner_id: OWNER_ID,
      name: "Untitled template",
      locale: "fr",
      schema_version: 1,
      visual_template_key: "canvas-v1",
      design: createBlankDesign(),
    });
    // A design places career content, it does not choose any.
    expect(row).toMatchObject({ definition: { schemaVersion: 1, sections: [] } });
  });

  it("refuses invalid input, and reports a failed write", async () => {
    signIn();
    expect(await createDesignTemplate({ name: " ", locale: "en" })).toMatchObject({
      ok: false,
      error: "invalid_input",
    });

    signIn({ tables: { cv_templates: { error: { code: "08006" } } } });
    expect(await createDesignTemplate({ name: "A", locale: "en" })).toMatchObject({ ok: false });
  });
});

describe("saveTemplateDesign", () => {
  const draft = () => ({
    id: TEMPLATE_ID,
    expectedRevision: 2,
    name: "Sidebar",
    locale: "en",
    definition,
    design: designWithProjects(),
  });

  it("saves the name, preview language and design over the expected revision only", async () => {
    const fake = signIn({
      tables: { cv_templates: { data: { revision: 3, updated_at: "2026-10-23T10:00:00Z" } } },
    });

    expect(await saveTemplateDesign(draft())).toEqual({
      ok: true,
      data: { revision: 3, updatedAt: "2026-10-23T10:00:00Z" },
    });
    const write = fake.queriesOn("cv_templates")[0]!;
    expect(isOwnerScoped(write)).toBe(true);
    expect(callsOf(write, "eq")).toEqual(
      expect.arrayContaining([
        ["id", TEMPLATE_ID],
        ["revision", 2],
        ["visual_template_key", "canvas-v1"],
      ]),
    );
    // The composition the draft carries is never written.
    expect(callsOf(write, "update")[0]?.[0]).toEqual({
      name: "Sidebar",
      locale: "en",
      design: designWithProjects(),
    });
  });

  it("tells a conflict from a deleted template", async () => {
    signIn({ tables: { cv_templates: [{ data: null }, { data: { id: TEMPLATE_ID } }] } });
    expect(await saveTemplateDesign(draft())).toEqual({ ok: false, error: "stale" });

    signIn({ tables: { cv_templates: [{ data: null }, { data: null }] } });
    expect(await saveTemplateDesign(draft())).toEqual({ ok: false, error: "not_found" });

    signIn({ tables: { cv_templates: [{ data: null }, { error: { code: "08006" } }] } });
    expect(await saveTemplateDesign(draft())).toEqual({ ok: false, error: "unavailable" });

    signIn({ tables: { cv_templates: { error: { code: "08006" } } } });
    expect(await saveTemplateDesign(draft())).toMatchObject({ ok: false });
  });

  it("refuses an invalid design", async () => {
    signIn();
    const design = { ...designWithProjects(), pages: 4 };
    expect(await saveTemplateDesign({ ...draft(), design })).toMatchObject({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("template revisions, copies and deletion", () => {
  it("reads the latest revision", async () => {
    signIn({ tables: { cv_templates: { data: { revision: 9 } } } });
    expect(await getTemplateRevision(TEMPLATE_ID)).toEqual({ ok: true, data: { revision: 9 } });
    expect(await getTemplateRevision("x")).toEqual({ ok: false, error: "invalid_input" });

    signIn({ tables: { cv_templates: { data: null } } });
    expect(await getTemplateRevision(TEMPLATE_ID)).toEqual({ ok: false, error: "not_found" });

    signIn({ tables: { cv_templates: { error: { code: "08006" } } } });
    expect(await getTemplateRevision(TEMPLATE_ID)).toEqual({ ok: false, error: "unavailable" });
  });

  it("duplicates a design as an independent copy", async () => {
    const source = {
      description: "d",
      locale: "en",
      schema_version: 1,
      definition,
      visual_template_key: "canvas-v1",
      design: designWithProjects(),
    };
    const fake = signIn({ tables: { cv_templates: [{ data: source }, { data: { id: "copy" } }] } });

    expect(await duplicateTemplate(TEMPLATE_ID, "Copy")).toEqual({
      ok: true,
      data: { id: "copy" },
    });
    expect(callsOf(fake.queriesOn("cv_templates")[1], "insert")[0]?.[0]).toEqual({
      ...source,
      owner_id: ownerContext(fake).owner.id,
      name: "Copy",
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shortens a long copy name and refuses a malformed id", async () => {
    const fake = signIn({
      tables: { cv_templates: [{ data: { definition } }, { data: { id: "copy" } }] },
    });
    expect(await duplicateTemplate(TEMPLATE_ID, "x".repeat(200))).toMatchObject({ ok: true });
    const row = callsOf(fake.queriesOn("cv_templates")[1], "insert")[0]?.[0] as { name: string };
    expect(row.name).toHaveLength(120);

    expect(await duplicateTemplate("x", "Copy")).toEqual({ ok: false, error: "invalid_input" });
  });

  it("soft-deletes and restores without touching CVs made from the template", async () => {
    const fake = signIn({ tables: { cv_templates: { data: { id: TEMPLATE_ID } } } });

    expect(await deleteTemplate(TEMPLATE_ID)).toEqual({ ok: true, data: undefined });
    expect(await restoreTemplate(TEMPLATE_ID)).toEqual({ ok: true, data: undefined });

    expect(fake.queries.map((query) => query.table)).toEqual(["cv_templates", "cv_templates"]);
    expect(fake.queries.every((query) => isOwnerScoped(query))).toBe(true);
    expect(fake.queries.flatMap((query) => callsOf(query, "delete"))).toHaveLength(0);
  });

  it("reports templates that are already gone, and failed reads", async () => {
    signIn({ tables: { cv_templates: { data: null } } });

    expect(await deleteTemplate(TEMPLATE_ID)).toEqual({ ok: false, error: "not_found" });
    expect(await duplicateTemplate(TEMPLATE_ID, "Copy")).toEqual({ ok: false, error: "not_found" });
    expect(await deleteTemplate("x")).toEqual({ ok: false, error: "invalid_input" });

    signIn({ tables: { cv_templates: { error: { code: "08006" } } } });
    expect(await duplicateTemplate(TEMPLATE_ID, "Copy")).toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(await deleteTemplate(TEMPLATE_ID)).toMatchObject({ ok: false });
  });
});
