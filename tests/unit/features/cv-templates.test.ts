import { describe, expect, it } from "vitest";
import { createCvSchema } from "@/features/cv-documents/schemas";
import { newCvFromTemplateHref, templateHref } from "@/features/cv-templates/routes";
import {
  TEMPLATE_DESCRIPTION_MAX,
  saveCvAsTemplateSchema,
  saveTemplateSchema,
} from "@/features/cv-templates/schemas";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { buildMasterData } from "../../fixtures/master-data";

const CV_ID = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_ID = "88888888-8888-4888-8888-888888888888";

describe("template schemas", () => {
  it("saves a CV as a new template with a trimmed, optional description", () => {
    const parsed = saveCvAsTemplateSchema.parse({
      mode: "new",
      cvId: CV_ID,
      name: "  Frontend roles ",
      description: "  ",
    });
    expect(parsed).toEqual({ mode: "new", cvId: CV_ID, name: "Frontend roles", description: "" });
  });

  it("replacing needs only the template: its name and description stay", () => {
    expect(
      saveCvAsTemplateSchema.parse({ mode: "replace", cvId: CV_ID, templateId: TEMPLATE_ID }),
    ).toEqual({ mode: "replace", cvId: CV_ID, templateId: TEMPLATE_ID });
    expect(
      saveCvAsTemplateSchema.safeParse({ mode: "replace", cvId: CV_ID, templateId: "nope" })
        .success,
    ).toBe(false);
  });

  it("rejects empty names and descriptions over the limit", () => {
    expect(
      saveCvAsTemplateSchema.safeParse({ mode: "new", cvId: CV_ID, name: " ", description: "" })
        .success,
    ).toBe(false);
    const tooLong = saveCvAsTemplateSchema.safeParse({
      mode: "new",
      cvId: CV_ID,
      name: "Valid",
      description: "x".repeat(TEMPLATE_DESCRIPTION_MAX + 1),
    });
    expect(tooLong.success).toBe(false);
  });

  it("autosaves a full, validated template draft", () => {
    const draft = {
      id: TEMPLATE_ID,
      expectedRevision: 3,
      name: "Frontend roles",
      description: "",
      locale: "fr",
      definition: createDefaultDefinition(buildMasterData()),
    };
    expect(saveTemplateSchema.safeParse(draft).success).toBe(true);
    expect(
      saveTemplateSchema.safeParse({ ...draft, definition: { schemaVersion: 2 } }).success,
    ).toBe(false);
  });

  it("creates a CV from a template only through a well-formed id", () => {
    expect(createCvSchema.parse({ name: "CV", locale: "en" }).templateId).toBeUndefined();
    expect(
      createCvSchema.parse({ name: "CV", locale: "en", templateId: TEMPLATE_ID }).templateId,
    ).toBe(TEMPLATE_ID);
    expect(
      createCvSchema.safeParse({ name: "CV", locale: "en", templateId: "../cv" }).success,
    ).toBe(false);
  });

  it("links to the editor and to a new CV with the template preselected", () => {
    expect(templateHref(TEMPLATE_ID)).toBe(`/dashboard/templates/${TEMPLATE_ID}`);
    expect(newCvFromTemplateHref(TEMPLATE_ID)).toBe(`/dashboard/cvs/new?template=${TEMPLATE_ID}`);
  });
});
