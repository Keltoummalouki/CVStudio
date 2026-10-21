import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { buildMasterData, sequentialIds } from "../../fixtures/master-data";
import {
  callsOf,
  createFakeSupabase,
  isOwnerScoped,
  ownerContext,
  type FakeSupabaseOptions,
} from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({ getOwnerContext: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));

const {
  deleteTemplate,
  duplicateTemplate,
  getTemplateChoices,
  getTemplateRevision,
  restoreTemplate,
  saveCvAsTemplate,
  saveTemplate,
} = await import("@/features/cv-templates/server/actions");

const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";
const TEMPLATE_ID = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const definition = createDefaultDefinition(buildMasterData(), sequentialIds());

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
    ["getTemplateChoices", () => getTemplateChoices()],
    ["saveCvAsTemplate", () => saveCvAsTemplate({})],
    ["saveTemplate", () => saveTemplate({})],
    ["getTemplateRevision", () => getTemplateRevision(TEMPLATE_ID)],
    ["duplicateTemplate", () => duplicateTemplate(TEMPLATE_ID, "Copy")],
    ["deleteTemplate", () => deleteTemplate(TEMPLATE_ID)],
    ["restoreTemplate", () => restoreTemplate(TEMPLATE_ID)],
  ])("%s answers unauthorized without a session", async (_name, action) => {
    mocks.getOwnerContext.mockResolvedValue(null);

    expect(await action()).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("getTemplateChoices", () => {
  it("lists the owner's templates in a supported language only", async () => {
    const fake = signIn({
      tables: {
        cv_templates: {
          data: [
            { id: "a", name: "Engineering", description: "", locale: "en" },
            { id: "b", name: "Legacy", description: "", locale: "de" },
          ],
        },
      },
    });

    expect(await getTemplateChoices()).toEqual({
      ok: true,
      data: [{ id: "a", name: "Engineering", description: "", locale: "en" }],
    });
    expect(isOwnerScoped(fake.queriesOn("cv_templates")[0])).toBe(true);
  });

  it("reports a failed read as unavailable", async () => {
    signIn({ tables: { cv_templates: { error: { code: "08006" } } } });

    expect(await getTemplateChoices()).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("saveCvAsTemplate", () => {
  const source = { data: { locale: "fr", definition } };

  it("copies a CV's setup into a new template", async () => {
    const fake = signIn({
      tables: { cv_documents: source, cv_templates: { data: { id: TEMPLATE_ID, name: "Design" } } },
    });

    const result = await saveCvAsTemplate({
      mode: "new",
      cvId: CV_ID,
      name: " Design ",
      description: "For studios",
    });

    expect(result).toEqual({ ok: true, data: { id: TEMPLATE_ID, name: "Design" } });
    expect(isOwnerScoped(fake.queriesOn("cv_documents")[0])).toBe(true);
    expect(callsOf(fake.queriesOn("cv_templates")[0], "insert")[0]?.[0]).toEqual({
      locale: "fr",
      schema_version: 1,
      definition: JSON.parse(JSON.stringify(definition)),
      owner_id: ownerContext(fake).owner.id,
      name: "Design",
      description: "For studios",
    });
    // The builder keeps its undo history: no refresh.
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("replaces only the setup of an existing template, keeping its name", async () => {
    const fake = signIn({
      tables: { cv_documents: source, cv_templates: { data: { id: TEMPLATE_ID, name: "Kept" } } },
    });

    expect(
      await saveCvAsTemplate({ mode: "replace", cvId: CV_ID, templateId: TEMPLATE_ID }),
    ).toEqual({ ok: true, data: { id: TEMPLATE_ID, name: "Kept" } });
    const update = fake.queriesOn("cv_templates")[0];
    expect(isOwnerScoped(update)).toBe(true);
    expect(Object.keys(callsOf(update, "update")[0]?.[0] as object).sort()).toEqual([
      "definition",
      "locale",
      "schema_version",
    ]);
  });

  it("reports a missing CV or template as not found", async () => {
    signIn({ tables: { cv_documents: { data: null } } });
    expect(
      await saveCvAsTemplate({ mode: "new", cvId: CV_ID, name: "X", description: "" }),
    ).toEqual({ ok: false, error: "not_found" });

    signIn({ tables: { cv_documents: source, cv_templates: { data: null } } });
    expect(
      await saveCvAsTemplate({ mode: "replace", cvId: CV_ID, templateId: TEMPLATE_ID }),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses unreadable layouts and invalid input", async () => {
    signIn({ tables: { cv_documents: { data: { locale: "en", definition: {} } } } });
    expect(
      await saveCvAsTemplate({ mode: "new", cvId: CV_ID, name: "X", description: "" }),
    ).toEqual({ ok: false, error: "invalid_input" });
    expect(await saveCvAsTemplate({ mode: "merge", cvId: CV_ID })).toMatchObject({
      ok: false,
      error: "invalid_input",
    });
  });
});

describe("saveTemplate", () => {
  const input = {
    id: TEMPLATE_ID,
    expectedRevision: 2,
    name: "Engineering",
    description: "",
    locale: "en",
    definition,
  };

  it("saves over the expected revision only", async () => {
    const fake = signIn({
      tables: { cv_templates: { data: { revision: 3, updated_at: "2026-10-21T10:00:00Z" } } },
    });

    expect(await saveTemplate(input)).toEqual({
      ok: true,
      data: { revision: 3, updatedAt: "2026-10-21T10:00:00Z" },
    });
    expect(callsOf(fake.queriesOn("cv_templates")[0], "eq")).toContainEqual(["revision", 2]);
  });

  it("tells a conflict from a deleted template", async () => {
    signIn({ tables: { cv_templates: [{ data: null }, { data: { id: TEMPLATE_ID } }] } });
    expect(await saveTemplate(input)).toEqual({ ok: false, error: "stale" });

    signIn({ tables: { cv_templates: [{ data: null }, { data: null }] } });
    expect(await saveTemplate(input)).toEqual({ ok: false, error: "not_found" });

    signIn({ tables: { cv_templates: { error: { message: "stale_record" } } } });
    expect(await saveTemplate(input)).toEqual({ ok: false, error: "stale" });
  });

  it("limits the description length", async () => {
    signIn();
    const result = await saveTemplate({ ...input, description: "x".repeat(501) });
    expect(result.ok ? [] : result.fieldIssues).toEqual([
      { path: "description", message: "tooLong" },
    ]);
  });
});

describe("template revisions, copies and deletion", () => {
  it("reads the latest revision", async () => {
    signIn({ tables: { cv_templates: { data: { revision: 9 } } } });
    expect(await getTemplateRevision(TEMPLATE_ID)).toEqual({ ok: true, data: { revision: 9 } });
    expect(await getTemplateRevision("x")).toEqual({ ok: false, error: "invalid_input" });
  });

  it("duplicates a template as an independent copy", async () => {
    const source = { description: "d", locale: "en", schema_version: 1, definition };
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

  it("soft-deletes and restores without touching CVs made from the template", async () => {
    const fake = signIn({ tables: { cv_templates: { data: { id: TEMPLATE_ID } } } });

    expect(await deleteTemplate(TEMPLATE_ID)).toEqual({ ok: true, data: undefined });
    expect(await restoreTemplate(TEMPLATE_ID)).toEqual({ ok: true, data: undefined });

    expect(fake.queries.map((query) => query.table)).toEqual(["cv_templates", "cv_templates"]);
    expect(fake.queries.every((query) => isOwnerScoped(query))).toBe(true);
    expect(fake.queries.flatMap((query) => callsOf(query, "delete"))).toHaveLength(0);
  });

  it("reports templates that are already gone", async () => {
    signIn({ tables: { cv_templates: { data: null } } });

    expect(await deleteTemplate(TEMPLATE_ID)).toEqual({ ok: false, error: "not_found" });
    expect(await duplicateTemplate(TEMPLATE_ID, "Copy")).toEqual({ ok: false, error: "not_found" });
  });
});
