import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { definitionSchema } from "@/features/cv-builder/definition";
import { resolveCv } from "@/features/cv-builder/resolve";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { requireOwner, type OwnerContext } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/data/errors";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { careerTexts, visibleCvTexts } from "../cv-texts";
import {
  compileRequirements,
  indexTexts,
  matchCv,
  type CompiledRequirements,
  type MatchReport,
  type TextIndex,
} from "../matching";
import {
  storedRequirementsSchema,
  toJobPostLanguage,
  type JobPostLanguage,
  type JobPostValues,
  type RequirementsDocument,
} from "../schemas";

const LIST_LIMIT = 100;
/** CVs scored against a job, most recently edited first. */
const CV_LIMIT = 30;

export type CvMatch = {
  cvId: string;
  cvName: string;
  locale: Locale;
  updatedAt: string;
  /** Null when the CV's layout could not be read. */
  report: MatchReport | null;
};

export type JobPostSummary = {
  id: string;
  title: string;
  company: string;
  language: JobPostLanguage;
  updatedAt: string;
  analyzedAt: string | null;
  required: number;
  preferred: number;
  /** How much of the job the career data covers; null without requirements. */
  careerScore: number | null;
  /** The best-scoring CV, if any CV can be scored. */
  best: { cvId: string; cvName: string; score: number } | null;
};

export type JobPostPage = {
  values: JobPostValues;
  analyzedAt: string | null;
  /** The requirements looked for in all career data, whatever the CVs show. */
  career: MatchReport;
  matches: CvMatch[];
};

/** What a new CV needs to know about the job it is made for. */
export type JobPostChoice = {
  id: string;
  title: string;
  company: string;
  language: JobPostLanguage;
  /** A CV is tailored to these; a post without any cannot be used for that. */
  requirementCount: number;
};

function readRequirements(value: unknown): RequirementsDocument {
  const parsed = storedRequirementsSchema.safeParse(value);
  if (!parsed.success) throw new DataAccessError("read job requirements", { cause: parsed.error });
  return parsed.data;
}

type ScoringSources = {
  cvs: { id: string; name: string; locale: Locale; updatedAt: string; index: TextIndex | null }[];
  career: TextIndex;
};

/**
 * Each CV's visible text, resolved the way the renderer prints it, plus all
 * career data text (for requirements a CV hides). Indexed once, then scored
 * against any number of job posts.
 */
async function loadScoringSources(context: OwnerContext, locale: Locale): Promise<ScoringSources> {
  const [result, master, labels] = await Promise.all([
    context.supabase
      .from("cv_documents")
      .select("id, name, locale, definition, updated_at")
      .eq("owner_id", context.owner.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(CV_LIMIT),
    loadMasterData(context),
    getCvLabels(),
  ]);
  if (result.error) throw new DataAccessError("list CVs to match", { cause: result.error });

  return {
    cvs: result.data.flatMap((row) => {
      if (!isLocale(row.locale)) return [];
      const definition = definitionSchema.safeParse(row.definition);
      const index = definition.success
        ? indexTexts(
            visibleCvTexts(resolveCv(definition.data, master, row.locale, labels[row.locale]).cv),
          )
        : null;
      return [{ id: row.id, name: row.name, locale: row.locale, updatedAt: row.updated_at, index }];
    }),
    career: indexTexts(careerTexts(master, locale)),
  };
}

/** Best score first; CVs that cannot be scored last. */
function scoreCvs(sources: ScoringSources, compiled: CompiledRequirements): CvMatch[] {
  return sources.cvs
    .map((cv) => ({
      cvId: cv.id,
      cvName: cv.name,
      locale: cv.locale,
      updatedAt: cv.updatedAt,
      report: cv.index ? matchCv(compiled, cv.index, sources.career) : null,
    }))
    .sort((a, b) => (b.report?.score ?? -1) - (a.report?.score ?? -1));
}

export async function listJobPosts(): Promise<JobPostSummary[]> {
  const context = await requireOwner();
  const locale = (await getLocale()) as Locale;
  const [result, sources] = await Promise.all([
    context.supabase
      .from("job_posts")
      .select("id, title, company, language, requirements, updated_at, analyzed_at")
      .eq("owner_id", context.owner.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(LIST_LIMIT),
    loadScoringSources(context, locale),
  ]);
  if (result.error) throw new DataAccessError("list job posts", { cause: result.error });

  return result.data.map((row) => {
    const requirements = readRequirements(row.requirements);
    const compiled = compileRequirements(row.title, requirements);
    const top = scoreCvs(sources, compiled)[0];
    return {
      id: row.id,
      title: row.title,
      company: row.company,
      language: toJobPostLanguage(row.language),
      updatedAt: row.updated_at,
      analyzedAt: row.analyzed_at,
      required: requirements.items.filter((item) => item.importance === "required").length,
      preferred: requirements.items.filter((item) => item.importance === "preferred").length,
      careerScore: matchCv(compiled, sources.career, null).score,
      best:
        top?.report && top.report.score !== null
          ? { cvId: top.cvId, cvName: top.cvName, score: top.report.score }
          : null,
    };
  });
}

/** Cached per request: metadata and the page read the same row once. */
export const getJobPost = cache(async (id: string): Promise<JobPostPage> => {
  const context = await requireOwner();
  const { data, error } = await context.supabase
    .from("job_posts")
    .select("id, title, company, language, description, requirements, updated_at, analyzed_at")
    .eq("owner_id", context.owner.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new DataAccessError("read job post", { cause: error });
  if (!data) notFound();

  const values: JobPostValues = {
    id: data.id,
    expectedUpdatedAt: data.updated_at,
    title: data.title,
    company: data.company,
    language: toJobPostLanguage(data.language),
    description: data.description,
    requirements: readRequirements(data.requirements),
    analyzed: false,
  };
  const sources = await loadScoringSources(context, (await getLocale()) as Locale);
  const compiled = compileRequirements(values.title, values.requirements);
  return {
    values,
    analyzedAt: data.analyzed_at,
    // Everything is "visible" here: the career data is the whole text searched.
    career: matchCv(compiled, sources.career, null),
    matches: scoreCvs(sources, compiled),
  };
});

const CHOICE_COLUMNS = "id, title, company, language, requirements";

function toChoice(row: {
  id: string;
  title: string;
  company: string;
  language: string;
  requirements: unknown;
}): JobPostChoice {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    language: toJobPostLanguage(row.language),
    requirementCount: readRequirements(row.requirements).items.length,
  };
}

/**
 * The owner's job post a new CV is made for (New CV page, `?job=`), or null
 * when the id is not one of theirs.
 */
export async function findJobPostChoice(id: string): Promise<JobPostChoice | null> {
  const { supabase, owner } = await requireOwner();
  const { data, error } = await supabase
    .from("job_posts")
    .select(CHOICE_COLUMNS)
    .eq("owner_id", owner.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new DataAccessError("read job post choice", { cause: error });
  return data ? toChoice(data) : null;
}

/** The owner's job posts a new CV can be tailored to, most recently edited first. */
export async function listJobPostChoices(): Promise<JobPostChoice[]> {
  const { supabase, owner } = await requireOwner();
  const { data, error } = await supabase
    .from("job_posts")
    .select(CHOICE_COLUMNS)
    .eq("owner_id", owner.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new DataAccessError("list job post choices", { cause: error });
  return data.map(toChoice);
}
