import "server-only";
import type { CustomItemKind, DetailKind, LinkKind } from "@/features/career-data/schemas";
import type { OwnerContext } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { parseLocalizedText } from "@/lib/i18n/localized-text";
import type { Json } from "@/lib/supabase/database.types";
import type { MasterData } from "../master-data";

const L = (value: Json) => parseLocalizedText(value);

type Sortable = { sort_order: number; created_at: string };
const ordered = <T extends Sortable>(rows: readonly T[] | null | undefined): T[] =>
  [...(rows ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );

type PeriodRow = {
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
};
const period = (row: PeriodRow) => ({
  startYear: row.start_year,
  startMonth: row.start_month,
  endYear: row.end_year,
  endMonth: row.end_month,
  isCurrent: row.is_current,
});

function rows<T>(result: { data: T[] | null; error: unknown }, operation: string): T[] {
  if (result.error) throw new DataAccessError(operation, { cause: result.error });
  return result.data ?? [];
}

const DETAIL_COLUMNS = "id, kind, text_i18n, sort_order, created_at, deleted_at";

/**
 * Everything a CV can show, archived rows included, read with the owner's own
 * session (RLS applies). A definition can only ever resolve against this
 * owner's records, so a foreign id in a definition shows as missing, never
 * as someone else's data.
 */
export async function loadMasterData({ supabase, owner }: OwnerContext): Promise<MasterData> {
  const [
    profileResult,
    links,
    groups,
    skills,
    experiences,
    educations,
    projects,
    certifications,
    softSkills,
    languages,
    customSections,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, title_i18n, summary_i18n, location_i18n, email, phone, photo_path")
      .eq("owner_id", owner.id)
      .maybeSingle(),
    supabase
      .from("profile_links")
      .select("id, kind, label_i18n, display_text, url, sort_order, created_at, deleted_at")
      .eq("owner_id", owner.id),
    supabase
      .from("skill_groups")
      .select("id, title_i18n, sort_order, created_at, deleted_at")
      .eq("owner_id", owner.id),
    supabase
      .from("skills")
      .select("id, skill_group_id, label_i18n, sort_order, created_at, deleted_at")
      .eq("owner_id", owner.id),
    supabase
      .from("experiences")
      .select(
        `id, organization, role_i18n, location_i18n, start_year, start_month, end_year, end_month, is_current, sort_order, created_at, deleted_at, experience_details(${DETAIL_COLUMNS})`,
      )
      .eq("owner_id", owner.id),
    supabase
      .from("educations")
      .select(
        "id, credential_i18n, institution_i18n, location_i18n, description_i18n, start_year, start_month, end_year, end_month, is_current, sort_order, created_at, deleted_at",
      )
      .eq("owner_id", owner.id),
    supabase
      .from("projects")
      .select(
        `id, title_i18n, description_i18n, project_url, source_url, start_year, start_month, end_year, end_month, is_current, sort_order, created_at, deleted_at, project_details(${DETAIL_COLUMNS})`,
      )
      .eq("owner_id", owner.id),
    supabase
      .from("certifications")
      .select(
        "id, title_i18n, issuer_i18n, issued_year, issued_month, credential_url, sort_order, created_at, deleted_at",
      )
      .eq("owner_id", owner.id),
    supabase
      .from("soft_skills")
      .select("id, label_i18n, sort_order, created_at, deleted_at")
      .eq("owner_id", owner.id),
    supabase
      .from("spoken_languages")
      .select("id, name_i18n, proficiency_i18n, sort_order, created_at, deleted_at")
      .eq("owner_id", owner.id),
    supabase
      .from("custom_sections")
      .select(
        "id, title_i18n, sort_order, created_at, deleted_at, custom_subsections(id, title_i18n, sort_order, created_at, deleted_at, custom_items(id, kind, label_i18n, text_i18n, sort_order, created_at, deleted_at))",
      )
      .eq("owner_id", owner.id),
  ]);

  if (profileResult.error)
    throw new DataAccessError("read profile", { cause: profileResult.error });
  const profile = profileResult.data;
  const allSkills = ordered(rows(skills, "list skills"));

  const toDetails = (
    details: {
      id: string;
      kind: string;
      text_i18n: Json;
      sort_order: number;
      created_at: string;
      deleted_at: string | null;
    }[],
  ) =>
    ordered(details).map((detail) => ({
      id: detail.id,
      kind: detail.kind as DetailKind,
      text: L(detail.text_i18n),
      archived: detail.deleted_at !== null,
    }));

  return {
    profile: {
      fullName: profile?.full_name ?? "",
      title: L(profile?.title_i18n ?? {}),
      summary: L(profile?.summary_i18n ?? {}),
      location: L(profile?.location_i18n ?? {}),
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      hasPhoto: !!profile?.photo_path,
    },
    links: ordered(rows(links, "list profile links")).map((link) => ({
      id: link.id,
      kind: link.kind as LinkKind,
      label: L(link.label_i18n),
      displayText: link.display_text,
      url: link.url,
      archived: link.deleted_at !== null,
    })),
    skillGroups: ordered(rows(groups, "list skill groups")).map((group) => ({
      id: group.id,
      title: L(group.title_i18n),
      archived: group.deleted_at !== null,
      skills: allSkills
        .filter((skill) => skill.skill_group_id === group.id)
        .map((skill) => ({
          id: skill.id,
          label: L(skill.label_i18n),
          archived: skill.deleted_at !== null,
        })),
    })),
    experiences: ordered(rows(experiences, "list experiences")).map((row) => ({
      id: row.id,
      organization: row.organization,
      role: L(row.role_i18n),
      location: L(row.location_i18n),
      period: period(row),
      details: toDetails(row.experience_details),
      archived: row.deleted_at !== null,
    })),
    educations: ordered(rows(educations, "list educations")).map((row) => ({
      id: row.id,
      credential: L(row.credential_i18n),
      institution: L(row.institution_i18n),
      location: L(row.location_i18n),
      description: L(row.description_i18n),
      period: period(row),
      archived: row.deleted_at !== null,
    })),
    projects: ordered(rows(projects, "list projects")).map((row) => ({
      id: row.id,
      title: L(row.title_i18n),
      description: L(row.description_i18n),
      projectUrl: row.project_url,
      sourceUrl: row.source_url,
      period: period(row),
      details: toDetails(row.project_details),
      archived: row.deleted_at !== null,
    })),
    certifications: ordered(rows(certifications, "list certifications")).map((row) => ({
      id: row.id,
      title: L(row.title_i18n),
      issuer: L(row.issuer_i18n),
      issuedYear: row.issued_year,
      issuedMonth: row.issued_month,
      credentialUrl: row.credential_url,
      archived: row.deleted_at !== null,
    })),
    softSkills: ordered(rows(softSkills, "list soft skills")).map((row) => ({
      id: row.id,
      label: L(row.label_i18n),
      archived: row.deleted_at !== null,
    })),
    languages: ordered(rows(languages, "list spoken languages")).map((row) => ({
      id: row.id,
      name: L(row.name_i18n),
      proficiency: L(row.proficiency_i18n),
      archived: row.deleted_at !== null,
    })),
    customSections: ordered(rows(customSections, "list custom sections")).map((row) => ({
      id: row.id,
      title: L(row.title_i18n),
      archived: row.deleted_at !== null,
      subsections: ordered(row.custom_subsections).map((subsection) => ({
        id: subsection.id,
        title: L(subsection.title_i18n),
        archived: subsection.deleted_at !== null,
        items: ordered(subsection.custom_items).map((item) => ({
          id: item.id,
          kind: item.kind as CustomItemKind,
          label: L(item.label_i18n),
          text: L(item.text_i18n),
          archived: item.deleted_at !== null,
        })),
      })),
    })),
  };
}
