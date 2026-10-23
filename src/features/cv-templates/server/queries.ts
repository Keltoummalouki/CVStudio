import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { definitionSchema, type CvDefinition } from "@/features/cv-builder/definition";
import { resolveCv, type ResolvedCv } from "@/features/cv-builder/resolve";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { designSchema, type Design } from "@/features/cv-design/design";
import { trimForThumbnail } from "@/features/cv-renderer/thumbnail";
import { requireOwner, type OwnerContext } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { isLocale, type Locale } from "@/lib/i18n/config";

const LIST_LIMIT = 200;

/**
 * Templates are free-form designs (canvas-v1). Rows saved from a CV's setup
 * before 2026-10-23 ("Save as template", Classic, no design) are kept in the
 * database but no longer offered anywhere: they are CV setups, not designs.
 */
const DESIGN_RENDERER = "canvas-v1";

export type TemplateChoice = { id: string; name: string; description: string };

export type TemplateListItem = TemplateChoice & {
  updatedAt: string;
  /** CVs started from this template that still exist (provenance, not a link). */
  cvCount: number;
};

function readDesign(value: unknown, context: string): Design {
  const parsed = designSchema.safeParse(value);
  if (!parsed.success) throw new DataAccessError(context, { cause: parsed.error });
  return parsed.data;
}

/** The owner's designs, newest first: what "New CV" offers. */
export async function readTemplateChoices(context: OwnerContext): Promise<TemplateChoice[]> {
  const { data, error } = await context.supabase
    .from("cv_templates")
    .select("id, name, description")
    .eq("owner_id", context.owner.id)
    .eq("visual_template_key", DESIGN_RENDERER)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new DataAccessError("list template choices", { cause: error });
  return data;
}

export async function listTemplateChoices(): Promise<TemplateChoice[]> {
  return readTemplateChoices(await requireOwner());
}

export type TemplateGalleryItem = TemplateListItem & { design: Design };

export type TemplateGallery = {
  templates: TemplateGalleryItem[];
  /**
   * The CV every template shows in its thumbnail: all active career entries
   * in the reference order, in `locale`, with the composition it came from.
   */
  preview: { definition: CvDefinition; cv: ResolvedCv };
  /** The built-in Classic's first page, trimmed for a thumbnail. */
  classic: ResolvedCv;
};

/** The owner's designs, newest first, with what their thumbnails show. */
export async function getTemplateGallery(locale: Locale): Promise<TemplateGallery> {
  const context = await requireOwner();
  const { supabase, owner } = context;
  const [templates, cvs, master, labels] = await Promise.all([
    supabase
      .from("cv_templates")
      .select("id, name, description, design, updated_at")
      .eq("owner_id", owner.id)
      .eq("visual_template_key", DESIGN_RENDERER)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("cv_documents")
      .select("created_from_template_id")
      .eq("owner_id", owner.id)
      .is("deleted_at", null)
      .not("created_from_template_id", "is", null),
    loadMasterData(context),
    getCvLabels(),
  ]);
  if (templates.error) throw new DataAccessError("list templates", { cause: templates.error });
  if (cvs.error) throw new DataAccessError("count CVs per template", { cause: cvs.error });

  const cvCounts = new Map<string, number>();
  for (const { created_from_template_id: id } of cvs.data) {
    if (id) cvCounts.set(id, (cvCounts.get(id) ?? 0) + 1);
  }

  // Node ids only key the rendered sections here: a counter keeps the render deterministic.
  let node = 0;
  const definition = createDefaultDefinition(master, () => `preview-${(node += 1)}`);
  const cv = trimForThumbnail(resolveCv(definition, master, locale, labels[locale]).cv);

  return {
    templates: templates.data.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      updatedAt: row.updated_at,
      cvCount: cvCounts.get(row.id) ?? 0,
      design: readDesign(row.design, "read template design"),
    })),
    preview: { definition, cv },
    classic: cv,
  };
}

export type CvTemplate = {
  id: string;
  name: string;
  /** The language the designer previews it in. */
  locale: Locale;
  revision: number;
  updatedAt: string;
  /** Unused by designs; kept so the editor's draft has the shape autosave expects. */
  definition: CvDefinition;
  design: Design;
};

/**
 * A design, cached per request (metadata and the page read the same row
 * once). A retired CV setup, like another owner's row, is not found.
 */
export const getTemplate = cache(async (id: string): Promise<CvTemplate> => {
  const { supabase, owner } = await requireOwner();
  const { data, error } = await supabase
    .from("cv_templates")
    .select("id, name, locale, revision, updated_at, definition, design")
    .eq("owner_id", owner.id)
    .eq("id", id)
    .eq("visual_template_key", DESIGN_RENDERER)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new DataAccessError("read template", { cause: error });
  if (!data || !isLocale(data.locale)) notFound();

  const definition = definitionSchema.safeParse(data.definition);
  if (!definition.success) {
    throw new DataAccessError("read template definition", { cause: definition.error });
  }

  return {
    id: data.id,
    name: data.name,
    locale: data.locale,
    revision: data.revision,
    updatedAt: data.updated_at,
    definition: definition.data,
    design: readDesign(data.design, "read template design"),
  };
});
