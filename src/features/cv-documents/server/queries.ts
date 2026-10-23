import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { definitionSchema, type CvDefinition } from "@/features/cv-builder/definition";
import type { CvLabelSet } from "@/features/cv-builder/labels";
import type { MasterData } from "@/features/cv-builder/master-data";
import { isBlockingIssue, resolveCv } from "@/features/cv-builder/resolve";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { requireOwner } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getCvLabels } from "./labels";

const LIST_LIMIT = 200;

export type CvListItem = {
  id: string;
  name: string;
  locale: Locale;
  updatedAt: string;
  createdFromTemplateName: string | null;
  /** Blocking issues (missing translations); null when the layout could not be read. */
  missingTranslations: number | null;
  warnings: number;
};

/** Counts what stands in the way of exporting a CV, the same way the builder does. */
export function summarizeIssues(
  definition: unknown,
  master: MasterData,
  locale: Locale,
  labels: CvLabelSet,
): Pick<CvListItem, "missingTranslations" | "warnings"> {
  const parsed = definitionSchema.safeParse(definition);
  if (!parsed.success) return { missingTranslations: null, warnings: 0 };
  const { issues } = resolveCv(parsed.data, master, locale, labels[locale]);
  const blocking = issues.filter(isBlockingIssue).length;
  return { missingTranslations: blocking, warnings: issues.length - blocking };
}

export type CvLibrary = {
  /** The most recently edited CVs, at most LIST_LIMIT: each one's status needs its layout resolved. */
  items: CvListItem[];
  /** Every live CV of the owner, so the list can say when some are not shown. */
  total: number;
};

export async function listCvDocuments(): Promise<CvLibrary> {
  const context = await requireOwner();
  const { supabase, owner } = context;
  const [result, master, labels] = await Promise.all([
    supabase
      .from("cv_documents")
      .select("id, name, locale, definition, updated_at, created_from_template_name", {
        count: "exact",
      })
      .eq("owner_id", owner.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      // CVs saved in the same instant keep one order, so pages never swap them.
      .order("id")
      .limit(LIST_LIMIT),
    loadMasterData(context),
    getCvLabels(),
  ]);
  if (result.error) throw new DataAccessError("list CVs", { cause: result.error });

  const items = result.data.flatMap((row) =>
    isLocale(row.locale)
      ? [
          {
            id: row.id,
            name: row.name,
            locale: row.locale,
            updatedAt: row.updated_at,
            createdFromTemplateName: row.created_from_template_name,
            ...summarizeIssues(row.definition, master, row.locale, labels),
          },
        ]
      : [],
  );
  return { items, total: Math.max(result.count ?? 0, items.length) };
}

export type CvDocument = {
  id: string;
  name: string;
  locale: Locale;
  revision: number;
  updatedAt: string;
  createdFromTemplateName: string | null;
  definition: CvDefinition;
};

/** Cached per request: metadata and the page read the same row once. */
export const getCvDocument = cache(async (id: string): Promise<CvDocument> => {
  const { supabase, owner } = await requireOwner();
  const { data, error } = await supabase
    .from("cv_documents")
    .select("id, name, locale, revision, updated_at, created_from_template_name, definition")
    .eq("owner_id", owner.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new DataAccessError("read CV", { cause: error });
  if (!data || !isLocale(data.locale)) notFound();

  const definition = definitionSchema.safeParse(data.definition);
  if (!definition.success) {
    throw new DataAccessError("read CV definition", { cause: definition.error });
  }

  return {
    id: data.id,
    name: data.name,
    locale: data.locale,
    revision: data.revision,
    updatedAt: data.updated_at,
    createdFromTemplateName: data.created_from_template_name,
    definition: definition.data,
  };
});

const PHOTO_URL_TTL_SECONDS = 60 * 60;

/** Short-lived signed URL of the private portrait, or null when there is none. */
export async function getPortraitUrl(): Promise<string | null> {
  const { supabase, owner } = await requireOwner();
  const { data } = await supabase
    .from("profiles")
    .select("photo_path")
    .eq("owner_id", owner.id)
    .maybeSingle();
  if (!data?.photo_path) return null;
  const signed = await supabase.storage
    .from("cvstudio-assets")
    .createSignedUrl(data.photo_path, PHOTO_URL_TTL_SECONDS);
  return signed.data?.signedUrl ?? null;
}
