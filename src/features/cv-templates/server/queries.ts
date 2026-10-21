import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { definitionSchema, type CvDefinition } from "@/features/cv-builder/definition";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { summarizeIssues } from "@/features/cv-documents/server/queries";
import { requireOwner, type OwnerContext } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { isLocale, type Locale } from "@/lib/i18n/config";

const LIST_LIMIT = 200;

export type TemplateChoice = {
  id: string;
  name: string;
  description: string;
  locale: Locale;
};

export type TemplateListItem = TemplateChoice & {
  updatedAt: string;
  /** CVs started from this template that still exist (provenance, not a link). */
  cvCount: number;
  /** Texts missing in the template's language; null when the layout could not be read. */
  missingTranslations: number | null;
  warnings: number;
};

/** The owner's templates, newest first: what "Start from" and "Replace" offer. */
export async function readTemplateChoices(context: OwnerContext): Promise<TemplateChoice[]> {
  const { data, error } = await context.supabase
    .from("cv_templates")
    .select("id, name, description, locale")
    .eq("owner_id", context.owner.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new DataAccessError("list template choices", { cause: error });
  return data.flatMap((row) => (isLocale(row.locale) ? [{ ...row, locale: row.locale }] : []));
}

export async function listTemplateChoices(): Promise<TemplateChoice[]> {
  return readTemplateChoices(await requireOwner());
}

export async function listTemplates(): Promise<TemplateListItem[]> {
  const context = await requireOwner();
  const { supabase, owner } = context;
  const [templates, cvs, master, labels] = await Promise.all([
    supabase
      .from("cv_templates")
      .select("id, name, description, locale, definition, updated_at")
      .eq("owner_id", owner.id)
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

  return templates.data.flatMap((row) =>
    isLocale(row.locale)
      ? [
          {
            id: row.id,
            name: row.name,
            description: row.description,
            locale: row.locale,
            updatedAt: row.updated_at,
            cvCount: cvCounts.get(row.id) ?? 0,
            ...summarizeIssues(row.definition, master, row.locale, labels),
          },
        ]
      : [],
  );
}

export type CvTemplate = {
  id: string;
  name: string;
  description: string;
  locale: Locale;
  revision: number;
  updatedAt: string;
  definition: CvDefinition;
};

/** Cached per request: metadata and the page read the same row once. */
export const getTemplate = cache(async (id: string): Promise<CvTemplate> => {
  const { supabase, owner } = await requireOwner();
  const { data, error } = await supabase
    .from("cv_templates")
    .select("id, name, description, locale, revision, updated_at, definition")
    .eq("owner_id", owner.id)
    .eq("id", id)
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
    description: data.description,
    locale: data.locale,
    revision: data.revision,
    updatedAt: data.updated_at,
    definition: definition.data,
  };
});
