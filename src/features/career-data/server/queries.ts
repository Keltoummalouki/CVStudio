import "server-only";
import { notFound } from "next/navigation";
import type { Period } from "@/lib/dates/period";
import { requireOwner } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import {
  getCombinedCoverage,
  parseLocalizedText,
  type LocaleCoverage,
  type LocalizedTextValue,
} from "@/lib/i18n/localized-text";
import type { Json } from "@/lib/supabase/database.types";
import type { RecordKind } from "../record-kinds";
import type {
  CertificationValues,
  CustomSectionValues,
  DetailValues,
  EducationValues,
  ExperienceValues,
  LinkKind,
  ProfileValues,
  ProjectValues,
  SkillGroupsValues,
  SoftSkillsValues,
  SpokenLanguagesValues,
} from "../schemas";

const L = (value: Json): LocalizedTextValue => parseLocalizedText(value);

type PeriodRow = {
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
};

function toPeriod(row: PeriodRow): Period {
  return {
    startYear: row.start_year,
    startMonth: row.start_month,
    endYear: row.end_year,
    endMonth: row.end_month,
    isCurrent: row.is_current,
  };
}

function check<T>(result: { data: T; error: unknown }, operation: string): NonNullable<T> {
  if (result.error) throw new DataAccessError(operation, { cause: result.error });
  if (result.data === null || result.data === undefined) notFound();
  return result.data as NonNullable<T>;
}

const active = <T extends { deleted_at: string | null }>(rows: readonly T[] | null | undefined) =>
  (rows ?? []).filter((row) => row.deleted_at === null);

const bySortOrder = <T extends { sort_order: number }>(rows: T[]) =>
  rows.sort((a, b) => a.sort_order - b.sort_order);

// ---------------------------------------------------------------------------
// Hub summary
// ---------------------------------------------------------------------------

export type CareerSummary = Record<
  | "technical_skills"
  | "experience"
  | "education"
  | "projects"
  | "certifications"
  | "soft_skills"
  | "languages"
  | "custom",
  number
> & { profileStarted: boolean };

export async function getCareerSummary(): Promise<CareerSummary> {
  const { supabase, owner } = await requireOwner();
  const count = async (
    table:
      | "skills"
      | "experiences"
      | "educations"
      | "projects"
      | "certifications"
      | "soft_skills"
      | "spoken_languages"
      | "custom_sections",
  ) => {
    const { count: total, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner.id)
      .is("deleted_at", null);
    if (error) throw new DataAccessError(`count ${table}`, { cause: error });
    return total ?? 0;
  };

  const [
    skills,
    experience,
    education,
    projects,
    certifications,
    softSkills,
    languages,
    custom,
    profile,
  ] = await Promise.all([
    count("skills"),
    count("experiences"),
    count("educations"),
    count("projects"),
    count("certifications"),
    count("soft_skills"),
    count("spoken_languages"),
    count("custom_sections"),
    supabase.from("profiles").select("full_name").eq("owner_id", owner.id).maybeSingle(),
  ]);

  return {
    technical_skills: skills,
    experience,
    education,
    projects,
    certifications,
    soft_skills: softSkills,
    languages,
    custom,
    profileStarted: !!profile.data?.full_name.trim(),
  };
}

// ---------------------------------------------------------------------------
// Record lists
// ---------------------------------------------------------------------------

export type RecordListItem = {
  id: string;
  title: LocalizedTextValue;
  /** Language-neutral context such as the organization. */
  context: string | null;
  /** Localized context such as an issuer or institution. */
  localizedContext: LocalizedTextValue | null;
  period: Period | null;
  coverage: LocaleCoverage;
  archived: boolean;
};

export async function listRecords(kind: RecordKind): Promise<RecordListItem[]> {
  const { supabase, owner } = await requireOwner();

  switch (kind) {
    case "experience": {
      const rows = check(
        await supabase
          .from("experiences")
          .select(
            "id, organization, role_i18n, location_i18n, start_year, start_month, end_year, end_month, is_current, deleted_at, experience_details(text_i18n, deleted_at)",
          )
          .eq("owner_id", owner.id)
          .order("sort_order")
          .order("created_at"),
        "list experiences",
      );
      return rows.map((row) => ({
        id: row.id,
        title: L(row.role_i18n),
        context: row.organization,
        localizedContext: L(row.location_i18n),
        period: toPeriod(row),
        coverage: getCombinedCoverage([
          L(row.role_i18n),
          L(row.location_i18n),
          ...active(row.experience_details).map((detail) => L(detail.text_i18n)),
        ]),
        archived: row.deleted_at !== null,
      }));
    }
    case "projects": {
      const rows = check(
        await supabase
          .from("projects")
          .select(
            "id, title_i18n, description_i18n, start_year, start_month, end_year, end_month, is_current, deleted_at, project_details(text_i18n, deleted_at)",
          )
          .eq("owner_id", owner.id)
          .order("sort_order")
          .order("created_at"),
        "list projects",
      );
      return rows.map((row) => ({
        id: row.id,
        title: L(row.title_i18n),
        context: null,
        localizedContext: null,
        period: toPeriod(row),
        coverage: getCombinedCoverage([
          L(row.title_i18n),
          L(row.description_i18n),
          ...active(row.project_details).map((detail) => L(detail.text_i18n)),
        ]),
        archived: row.deleted_at !== null,
      }));
    }
    case "education": {
      const rows = check(
        await supabase
          .from("educations")
          .select(
            "id, credential_i18n, institution_i18n, location_i18n, description_i18n, start_year, start_month, end_year, end_month, is_current, deleted_at",
          )
          .eq("owner_id", owner.id)
          .order("sort_order")
          .order("created_at"),
        "list educations",
      );
      return rows.map((row) => ({
        id: row.id,
        title: L(row.credential_i18n),
        context: null,
        localizedContext: L(row.institution_i18n),
        period: toPeriod(row),
        coverage: getCombinedCoverage([
          L(row.credential_i18n),
          L(row.institution_i18n),
          L(row.location_i18n),
          L(row.description_i18n),
        ]),
        archived: row.deleted_at !== null,
      }));
    }
    case "certifications": {
      const rows = check(
        await supabase
          .from("certifications")
          .select("id, title_i18n, issuer_i18n, issued_year, issued_month, deleted_at")
          .eq("owner_id", owner.id)
          .order("sort_order")
          .order("created_at"),
        "list certifications",
      );
      return rows.map((row) => ({
        id: row.id,
        title: L(row.title_i18n),
        context: null,
        localizedContext: L(row.issuer_i18n),
        period:
          row.issued_year === null
            ? null
            : {
                startYear: null,
                startMonth: null,
                endYear: row.issued_year,
                endMonth: row.issued_month,
                isCurrent: false,
              },
        coverage: getCombinedCoverage([L(row.title_i18n), L(row.issuer_i18n)]),
        archived: row.deleted_at !== null,
      }));
    }
    case "custom": {
      const rows = check(
        await supabase
          .from("custom_sections")
          .select(
            "id, title_i18n, deleted_at, custom_subsections(title_i18n, deleted_at, custom_items(label_i18n, text_i18n, deleted_at))",
          )
          .eq("owner_id", owner.id)
          .order("sort_order")
          .order("created_at"),
        "list custom sections",
      );
      return rows.map((row) => {
        const subsections = active(row.custom_subsections);
        const items = subsections.flatMap((subsection) => active(subsection.custom_items));
        return {
          id: row.id,
          title: L(row.title_i18n),
          context: null,
          localizedContext: null,
          period: null,
          coverage: getCombinedCoverage([
            L(row.title_i18n),
            ...subsections.map((subsection) => L(subsection.title_i18n)),
            ...items.flatMap((item) => [L(item.label_i18n), L(item.text_i18n)]),
          ]),
          archived: row.deleted_at !== null,
        };
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Record editors
// ---------------------------------------------------------------------------

type DetailRow = {
  id: string;
  kind: string;
  text_i18n: Json;
  sort_order: number;
  deleted_at: string | null;
};

function toDetails(rows: DetailRow[] | null | undefined): DetailValues[] {
  return bySortOrder(active(rows)).map((row) => ({
    id: row.id,
    kind: row.kind as DetailValues["kind"],
    text: L(row.text_i18n),
  }));
}

export async function getExperienceEditor(id: string): Promise<ExperienceValues> {
  const { supabase, owner } = await requireOwner();
  const row = check(
    await supabase
      .from("experiences")
      .select("*, experience_details(id, kind, text_i18n, sort_order, deleted_at)")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .maybeSingle(),
    "read experience",
  );
  return {
    id: row.id,
    expectedUpdatedAt: row.updated_at,
    organization: row.organization,
    role: L(row.role_i18n),
    location: L(row.location_i18n),
    period: toPeriod(row),
    details: toDetails(row.experience_details),
  };
}

export async function getProjectEditor(id: string): Promise<ProjectValues> {
  const { supabase, owner } = await requireOwner();
  const row = check(
    await supabase
      .from("projects")
      .select("*, project_details(id, kind, text_i18n, sort_order, deleted_at)")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .maybeSingle(),
    "read project",
  );
  return {
    id: row.id,
    expectedUpdatedAt: row.updated_at,
    title: L(row.title_i18n),
    description: L(row.description_i18n),
    projectUrl: row.project_url ?? "",
    sourceUrl: row.source_url ?? "",
    period: toPeriod(row),
    details: toDetails(row.project_details),
  };
}

export async function getEducationEditor(id: string): Promise<EducationValues> {
  const { supabase, owner } = await requireOwner();
  const row = check(
    await supabase
      .from("educations")
      .select("*")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .maybeSingle(),
    "read education",
  );
  return {
    id: row.id,
    expectedUpdatedAt: row.updated_at,
    credential: L(row.credential_i18n),
    institution: L(row.institution_i18n),
    location: L(row.location_i18n),
    description: L(row.description_i18n),
    period: toPeriod(row),
  };
}

export async function getCertificationEditor(id: string): Promise<CertificationValues> {
  const { supabase, owner } = await requireOwner();
  const row = check(
    await supabase
      .from("certifications")
      .select("*")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .maybeSingle(),
    "read certification",
  );
  return {
    id: row.id,
    expectedUpdatedAt: row.updated_at,
    title: L(row.title_i18n),
    issuer: L(row.issuer_i18n),
    issuedYear: row.issued_year,
    issuedMonth: row.issued_month,
    credentialUrl: row.credential_url ?? "",
  };
}

export async function getCustomSectionEditor(id: string): Promise<CustomSectionValues> {
  const { supabase, owner } = await requireOwner();
  const row = check(
    await supabase
      .from("custom_sections")
      .select(
        "*, custom_subsections(id, title_i18n, sort_order, deleted_at, custom_items(id, kind, label_i18n, text_i18n, sort_order, deleted_at))",
      )
      .eq("owner_id", owner.id)
      .eq("id", id)
      .maybeSingle(),
    "read custom section",
  );
  return {
    id: row.id,
    expectedUpdatedAt: row.updated_at,
    title: L(row.title_i18n),
    subsections: bySortOrder(active(row.custom_subsections)).map((subsection) => ({
      id: subsection.id,
      title: L(subsection.title_i18n),
      items: bySortOrder(active(subsection.custom_items)).map((item) => ({
        id: item.id,
        kind: item.kind as CustomSectionValues["subsections"][number]["items"][number]["kind"],
        label: L(item.label_i18n),
        text: L(item.text_i18n),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type ProfileEditor = {
  values: ProfileValues;
  photo: { path: string; url: string } | null;
};

const PHOTO_URL_TTL_SECONDS = 60 * 60;

export async function getProfileEditor(): Promise<ProfileEditor> {
  const { supabase, owner } = await requireOwner();
  const [profileResult, linksResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("owner_id", owner.id).maybeSingle(),
    supabase
      .from("profile_links")
      .select("id, kind, label_i18n, display_text, url, sort_order")
      .eq("owner_id", owner.id)
      .is("deleted_at", null)
      .order("sort_order"),
  ]);
  const profile = check(profileResult, "read profile");
  if (linksResult.error)
    throw new DataAccessError("list profile links", { cause: linksResult.error });

  let photo: ProfileEditor["photo"] = null;
  if (profile.photo_path) {
    const signed = await supabase.storage
      .from("cvstudio-assets")
      .createSignedUrl(profile.photo_path, PHOTO_URL_TTL_SECONDS);
    if (signed.data) photo = { path: profile.photo_path, url: signed.data.signedUrl };
  }

  return {
    values: {
      expectedUpdatedAt: profile.updated_at,
      fullName: profile.full_name,
      title: L(profile.title_i18n),
      summary: L(profile.summary_i18n),
      location: L(profile.location_i18n),
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      links: linksResult.data.map((link) => ({
        id: link.id,
        kind: link.kind as LinkKind,
        label: L(link.label_i18n),
        displayText: link.display_text,
        url: link.url,
      })),
    },
    photo,
  };
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/** Newest updated_at across a collection, archived rows included (matches the save functions). */
function stampOf(rows: { updated_at: string }[]): string | null {
  return rows.reduce<string | null>(
    (latest, row) => (latest === null || row.updated_at > latest ? row.updated_at : latest),
    null,
  );
}

export async function getSoftSkillsEditor(): Promise<SoftSkillsValues> {
  const { supabase, owner } = await requireOwner();
  const rows = check(
    await supabase
      .from("soft_skills")
      .select("id, label_i18n, sort_order, deleted_at, updated_at")
      .eq("owner_id", owner.id),
    "list soft skills",
  );
  return {
    expectedStamp: stampOf(rows),
    items: bySortOrder(active(rows)).map((row) => ({ id: row.id, label: L(row.label_i18n) })),
  };
}

export async function getSpokenLanguagesEditor(): Promise<SpokenLanguagesValues> {
  const { supabase, owner } = await requireOwner();
  const rows = check(
    await supabase
      .from("spoken_languages")
      .select("id, name_i18n, proficiency_i18n, sort_order, deleted_at, updated_at")
      .eq("owner_id", owner.id),
    "list spoken languages",
  );
  return {
    expectedStamp: stampOf(rows),
    items: bySortOrder(active(rows)).map((row) => ({
      id: row.id,
      name: L(row.name_i18n),
      proficiency: L(row.proficiency_i18n),
    })),
  };
}

export async function getSkillGroupsEditor(): Promise<SkillGroupsValues> {
  const { supabase, owner } = await requireOwner();
  const [groupsResult, skillsResult] = await Promise.all([
    supabase
      .from("skill_groups")
      .select("id, title_i18n, sort_order, deleted_at, updated_at")
      .eq("owner_id", owner.id),
    supabase
      .from("skills")
      .select("id, skill_group_id, label_i18n, sort_order, deleted_at, updated_at")
      .eq("owner_id", owner.id),
  ]);
  const groups = check(groupsResult, "list skill groups");
  const skills = check(skillsResult, "list skills");
  const activeSkills = bySortOrder(active(skills));

  return {
    expectedStamp: stampOf([...groups, ...skills]),
    groups: bySortOrder(active(groups)).map((group) => ({
      id: group.id,
      title: L(group.title_i18n),
      skills: activeSkills
        .filter((skill) => skill.skill_group_id === group.id)
        .map((skill) => ({ id: skill.id, label: L(skill.label_i18n) })),
    })),
  };
}
