import "server-only";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { summarizeIssues } from "@/features/cv-documents/server/queries";
import { requireOwner } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { isLocale } from "@/lib/i18n/config";
import { hasLocalizedText, type LocalizedTextValue } from "@/lib/i18n/localized-text";
import type { DashboardOverview, RecentCv } from "./overview";

/** Atomic records the owner maintains (groups and nested details are not counted). */
const CAREER_RECORD_TABLES = [
  "experiences",
  "educations",
  "projects",
  "certifications",
  "skills",
  "soft_skills",
  "spoken_languages",
] as const;

const RECENT_CV_LIMIT = 5;

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const context = await requireOwner();
  const { supabase, owner } = context;

  const countActive = async (
    table: (typeof CAREER_RECORD_TABLES)[number] | "cv_documents" | "cv_templates",
  ) => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner.id)
      .is("deleted_at", null);
    if (error) throw new DataAccessError(`count ${table}`, { cause: error });
    return count ?? 0;
  };

  const [recordCounts, cvs, templates, profile, recent] = await Promise.all([
    Promise.all(CAREER_RECORD_TABLES.map(countActive)),
    countActive("cv_documents"),
    countActive("cv_templates"),
    supabase
      .from("profiles")
      .select("full_name, title_i18n")
      .eq("owner_id", owner.id)
      .maybeSingle(),
    supabase
      .from("cv_documents")
      .select("id, name, locale, definition, updated_at")
      .eq("owner_id", owner.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(RECENT_CV_LIMIT),
  ]);

  if (profile.error) throw new DataAccessError("read profile", { cause: profile.error });
  if (recent.error) throw new DataAccessError("list recent CVs", { cause: recent.error });

  const careerRecords = recordCounts.reduce((total, count) => total + count, 0);
  const profileComplete =
    !!profile.data?.full_name.trim() &&
    hasLocalizedText(profile.data.title_i18n as LocalizedTextValue);

  // Career data is only needed to check the recent CVs for missing translations.
  const [master, labels] =
    recent.data.length > 0
      ? await Promise.all([loadMasterData(context), getCvLabels()])
      : [null, null];

  const recentCvs: RecentCv[] = recent.data.flatMap((row) =>
    isLocale(row.locale)
      ? [
          {
            id: row.id,
            name: row.name,
            locale: row.locale,
            updatedAt: row.updated_at,
            missingTranslations:
              master && labels
                ? summarizeIssues(row.definition, master, row.locale, labels).missingTranslations
                : null,
          },
        ]
      : [],
  );

  return {
    counts: { careerRecords, cvs, templates },
    setup: {
      profile: profileComplete,
      careerRecords: careerRecords > 0,
      cv: cvs > 0,
      template: templates > 0,
    },
    recentCvs,
  };
}
