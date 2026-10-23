import "server-only";
import { definitionSchema, type CvDefinition } from "@/features/cv-builder/definition";
import { designSchema, type Design } from "@/features/cv-design/design";
import type { CvLabels } from "@/features/cv-builder/labels";
import {
  isBlockingIssue,
  resolveCv,
  type CvIssue,
  type ResolvedCv,
} from "@/features/cv-builder/resolve";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import type { OwnerContext } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { isLocale, type Locale } from "@/lib/i18n/config";

export type ExportableCv = {
  id: string;
  name: string;
  locale: Locale;
  /** The composition `cv` was resolved from: binds sections to a design's elements. */
  definition: CvDefinition;
  /** The CV's own free-form design; null when Classic draws it. */
  design: Design | null;
  cv: ResolvedCv;
  labels: CvLabels;
  issues: CvIssue[];
  /** Texts not written in the CV's language: export is blocked while this is above zero. */
  missingTranslations: number;
  photoUrl: string | null;
};

// Long enough for the PDF engine to fetch the portrait, short enough not to linger.
const EXPORT_PHOTO_TTL_SECONDS = 10 * 60;

/**
 * Everything needed to print or export one CV, resolved exactly like the
 * builder's preview. Returns null when this owner has no such CV (another
 * owner's id included): callers answer "not found" without revealing more.
 */
export async function loadExportableCv(
  context: OwnerContext,
  id: string,
): Promise<ExportableCv | null> {
  const { supabase, owner } = context;
  const [documentResult, profileResult, master, labels] = await Promise.all([
    supabase
      .from("cv_documents")
      .select("id, name, locale, definition, design")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("profiles").select("photo_path").eq("owner_id", owner.id).maybeSingle(),
    loadMasterData(context),
    getCvLabels(),
  ]);
  if (documentResult.error) throw new DataAccessError("read CV", { cause: documentResult.error });
  const row = documentResult.data;
  if (!row || !isLocale(row.locale)) return null;

  const definition = definitionSchema.safeParse(row.definition);
  if (!definition.success) {
    throw new DataAccessError("read CV definition", { cause: definition.error });
  }
  const design = row.design === null ? null : designSchema.safeParse(row.design);
  if (design && !design.success) {
    throw new DataAccessError("read CV design", { cause: design.error });
  }

  const { cv, issues } = resolveCv(definition.data, master, row.locale, labels[row.locale]);

  let photoUrl: string | null = null;
  const photoPath = profileResult.data?.photo_path;
  if (cv.header.showPhoto && photoPath) {
    const signed = await supabase.storage
      .from("cvstudio-assets")
      .createSignedUrl(photoPath, EXPORT_PHOTO_TTL_SECONDS);
    photoUrl = signed.data?.signedUrl ?? null;
  }

  return {
    id: row.id,
    name: row.name,
    locale: row.locale,
    definition: definition.data,
    design: design ? design.data : null,
    cv,
    labels: labels[row.locale],
    issues,
    missingTranslations: issues.filter(isBlockingIssue).length,
    photoUrl,
  };
}
