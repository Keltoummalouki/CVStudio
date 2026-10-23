import { describe, expect, it } from "vitest";
import { createCvSchema } from "@/features/cv-documents/schemas";
import { createBlankDesign } from "@/features/cv-design/design";
import { newCvFromTemplateHref, templateHref } from "@/features/cv-templates/routes";
import {
  createDesignTemplateSchema,
  saveTemplateDesignSchema,
} from "@/features/cv-templates/schemas";

const TEMPLATE_ID = "88888888-8888-4888-8888-888888888888";

describe("template schemas", () => {
  it("creates a blank design with a trimmed name and a language", () => {
    expect(createDesignTemplateSchema.parse({ name: "  Sidebar  ", locale: "fr" })).toEqual({
      name: "Sidebar",
      locale: "fr",
    });
    expect(createDesignTemplateSchema.safeParse({ name: " ", locale: "en" }).success).toBe(false);
    expect(createDesignTemplateSchema.safeParse({ name: "X", locale: "de" }).success).toBe(false);
  });

  it("autosaves a validated design, ignoring the composition the draft carries", () => {
    const draft = {
      id: TEMPLATE_ID,
      expectedRevision: 3,
      name: "Sidebar",
      locale: "en",
      definition: { schemaVersion: 1 },
      design: createBlankDesign(),
    };
    const parsed = saveTemplateDesignSchema.parse(draft);
    expect(parsed).not.toHaveProperty("definition");
    expect(parsed.design).toEqual(createBlankDesign());
    expect(
      saveTemplateDesignSchema.safeParse({ ...draft, design: { ...draft.design, pages: 9 } })
        .success,
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

  it("links to the designer and to a new CV with the template preselected", () => {
    expect(templateHref(TEMPLATE_ID)).toBe(`/dashboard/templates/${TEMPLATE_ID}`);
    expect(newCvFromTemplateHref(TEMPLATE_ID)).toBe(`/dashboard/cvs/new?template=${TEMPLATE_ID}`);
  });
});
