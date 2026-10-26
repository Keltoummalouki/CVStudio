import type { MasterData, MasterProject } from "@/features/cv-builder/master-data";
import {
  compileTerm,
  containsTerm,
  indexTexts,
  matchCv,
  REQUIREMENT_WEIGHTS,
  type CompiledRequirements,
  type TextFragment,
} from "@/features/job-posts/matching";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText, type LocalizedTextValue } from "@/lib/i18n/localized-text";

/**
 * What a tailored CV can choose from: the owner's active projects and skills,
 * each with a short handle (P1, S1…) that the AI answers with, and the job
 * requirements its own text already names, found by the same deterministic
 * matching as the score. Only career text goes in: never the name, contacts,
 * photo, links or dates (CLAUDE.md §16).
 */

export type CatalogProject = {
  handle: string;
  id: string;
  /** In the CV's language when written, otherwise in the other one. */
  title: string;
  description: string;
  technologies: string[];
  bullets: string[];
  /** Requirements its text names, required ones first. */
  matches: string[];
  /** Weight of those requirements: 2 for a required one, 1 for a nice-to-have. */
  weight: number;
  /** Its title or description is not written in the CV's language yet. */
  missingTranslation: boolean;
};

export type CatalogSkill = {
  handle: string;
  id: string;
  groupId: string;
  group: string;
  label: string;
  matches: string[];
  /** The job's title names it: "JavaScript" in "Full Stack JavaScript developer". */
  inTitle: boolean;
};

export type Catalog = {
  /** Every active project, the best keyword coverage first; the owner's order breaks ties. */
  projects: CatalogProject[];
  /** Every active skill of an active group, in the owner's order. */
  skills: CatalogSkill[];
};

type Found = { labels: string[]; weight: number };
const NOTHING_FOUND: Found = { labels: [], weight: 0 };

/** Every written version of a text: requirements may be named in either language. */
export function allTexts(...values: readonly (LocalizedTextValue | string)[]): string[] {
  const texts = values.flatMap((value) =>
    typeof value === "string" ? [value] : [value.shared, value.en, value.fr],
  );
  return [...new Set(texts.flatMap((text) => text?.trim() || []))];
}

/** The job requirements these texts name, by the rules of the match score. */
export function requirementsFoundIn(
  compiled: CompiledRequirements,
  texts: readonly string[],
): Found {
  if (texts.length === 0 || compiled.items.length === 0) return NOTHING_FOUND;
  const index = indexTexts(
    texts.map((text): TextFragment => ({
      text,
      where: { scope: "career", record: "projects", item: null },
    })),
  );
  const found = matchCv(compiled, index, null)
    .requirements.filter((result) => result.status === "matched")
    .map((result) => result.requirement);
  found.sort((a, b) => REQUIREMENT_WEIGHTS[b.importance] - REQUIREMENT_WEIGHTS[a.importance]);
  return {
    labels: found.map((requirement) => requirement.label),
    weight: found.reduce(
      (sum, requirement) => sum + REQUIREMENT_WEIGHTS[requirement.importance],
      0,
    ),
  };
}

/** Whether one of the job's titles names any of these texts, by the rules of the match score. */
export function namedInTitle(titles: readonly string[], texts: readonly string[]): boolean {
  const terms = texts.flatMap((text) => compileTerm(text) ?? []);
  return terms.some((term) => titles.some((title) => containsTerm(title, term)));
}

const display = (value: LocalizedTextValue, locale: Locale) =>
  displayLocalizedText(value, locale)?.text ?? "";

const writtenElsewhere = (value: LocalizedTextValue, locale: Locale) =>
  displayLocalizedText(value, locale)?.locale != null;

function catalogProject(
  project: MasterProject,
  compiled: CompiledRequirements,
  locale: Locale,
): Omit<CatalogProject, "handle"> {
  const details = project.details.filter((detail) => !detail.archived);
  const found = requirementsFoundIn(
    compiled,
    allTexts(project.title, project.description, ...details.map((detail) => detail.text)),
  );
  return {
    id: project.id,
    title: display(project.title, locale),
    description: display(project.description, locale),
    technologies: details
      .filter((detail) => detail.kind === "technology")
      .flatMap((detail) => display(detail.text, locale) || []),
    bullets: details
      .filter((detail) => detail.kind !== "technology")
      .flatMap((detail) => display(detail.text, locale) || []),
    matches: found.labels,
    weight: found.weight,
    missingTranslation:
      writtenElsewhere(project.title, locale) || writtenElsewhere(project.description, locale),
  };
}

export function buildCatalog(
  master: MasterData,
  compiled: CompiledRequirements,
  locale: Locale,
  /** The job title and its other names. */
  titles: readonly string[] = [],
): Catalog {
  const projects = master.projects
    .filter((project) => !project.archived)
    .map((project, order) => ({ order, ...catalogProject(project, compiled, locale) }))
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .map(({ order: _order, ...project }, index) => ({ handle: `P${index + 1}`, ...project }));

  const skills = master.skillGroups
    .filter((group) => !group.archived)
    .flatMap((group) =>
      group.skills
        .filter((skill) => !skill.archived)
        .map((skill) => ({
          id: skill.id,
          groupId: group.id,
          group: display(group.title, locale),
          label: display(skill.label, locale),
          matches: requirementsFoundIn(compiled, allTexts(skill.label)).labels,
          inTitle: namedInTitle(titles, allTexts(skill.label)),
        })),
    )
    .map((skill, index) => ({ handle: `S${index + 1}`, ...skill }));

  return { projects, skills };
}
