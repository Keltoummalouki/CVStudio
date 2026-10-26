import type { CvDefinition } from "@/features/cv-builder/definition";
import type { CvLabels } from "@/features/cv-builder/labels";
import type { MasterData } from "@/features/cv-builder/master-data";
import { resolveCv } from "@/features/cv-builder/resolve";
import { visibleCvTexts } from "@/features/job-posts/cv-texts";
import {
  indexTexts,
  matchCv,
  type CompiledRequirements,
  type RequirementStatus,
  type TextIndex,
} from "@/features/job-posts/matching";
import type { RequirementImportance } from "@/features/job-posts/schemas";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import type { Catalog } from "./catalog";
import {
  isNamedSkill,
  type PromptCatalog,
  type TailoringMode,
  type TailoringPicks,
} from "./tailoring";

/** What the owner checks before a tailored CV is created. Nothing here is saved. */
export type TailoringReview = {
  /** The chosen projects, as the CV will print them. */
  projects: {
    id: string;
    title: string;
    technologies: string[];
    /** The AI's reason; null for a pick made by keyword matching. */
    reason: string | null;
    /** Its text isn't written in the CV's language yet: export waits for it. */
    missingTranslation: boolean;
  }[];
  /** Active projects in the career data. */
  projectTotal: number;
  /** Projects the AI could not consider, to keep the request small. */
  projectsNotSent: number;
  skills: {
    shown: { id: string; label: string; named: boolean }[];
    hidden: { id: string; label: string }[];
  };
  title: { suggested: string | null; profile: string | null };
  /** Estimated keyword coverage of the tailored CV, and of all career data. */
  score: number | null;
  careerScore: number | null;
  requirements: {
    id: string;
    label: string;
    importance: RequirementImportance;
    status: RequirementStatus;
  }[];
};

/** A proposal from tailorCv: the picks createCv applies, and their review. */
export type TailoringProposal = {
  /** How the picks were made: "keywords" also when there was nothing for the AI to choose. */
  mode: TailoringMode;
  picks: Omit<TailoringPicks, "reasons">;
  review: TailoringReview;
};

export function buildReview({
  definition,
  master,
  catalog,
  sent,
  picks,
  compiled,
  career,
  locale,
  labels,
}: {
  definition: CvDefinition;
  master: MasterData;
  catalog: Catalog;
  sent: PromptCatalog;
  picks: TailoringPicks;
  compiled: CompiledRequirements;
  /** All career data text, for requirements the CV leaves out. */
  career: TextIndex;
  locale: Locale;
  labels: CvLabels;
}): TailoringReview {
  const { cv } = resolveCv(definition, master, locale, labels);
  const report = matchCv(compiled, indexTexts(visibleCvTexts(cv)), career);
  const printed = new Map(
    cv.sections.flatMap((section) =>
      section.kind === "projects"
        ? section.entries.map((entry) => [entry.refId, entry] as const)
        : [],
    ),
  );
  const shown = new Set(picks.skillIds);

  return {
    projects: picks.projectIds.flatMap((id) => {
      const project = catalog.projects.find((candidate) => candidate.id === id);
      if (!project) return [];
      const entry = printed.get(id);
      return [
        {
          id,
          title: entry?.title?.text ?? project.title,
          technologies: entry
            ? entry.technologies.map((technology) => technology.text)
            : project.technologies,
          reason: picks.reasons[id] ?? null,
          missingTranslation: project.missingTranslation,
        },
      ];
    }),
    projectTotal: catalog.projects.length,
    projectsNotSent: catalog.projects.length - sent.projects.length,
    skills: {
      shown: catalog.skills
        .filter((skill) => shown.has(skill.id))
        .map((skill) => ({ id: skill.id, label: skill.label, named: isNamedSkill(skill) })),
      hidden: catalog.skills
        .filter((skill) => !shown.has(skill.id))
        .map((skill) => ({ id: skill.id, label: skill.label })),
    },
    title: {
      suggested: picks.title,
      profile: displayLocalizedText(master.profile.title, locale)?.text ?? null,
    },
    score: report.score,
    careerScore: matchCv(compiled, career, null).score,
    requirements: report.requirements.map(({ requirement, status }) => ({
      id: requirement.id,
      label: requirement.label,
      importance: requirement.importance,
      status,
    })),
  };
}
