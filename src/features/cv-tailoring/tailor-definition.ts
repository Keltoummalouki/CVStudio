import { newProjectItem } from "@/features/cv-builder/defaults";
import type { CvDefinition, DetailRef, SectionDefinition } from "@/features/cv-builder/definition";
import type { MasterData, MasterProject } from "@/features/cv-builder/master-data";
import type { CompiledRequirements } from "@/features/job-posts/matching";
import type { Locale } from "@/lib/i18n/config";
import type { LocalizedTextValue } from "@/lib/i18n/localized-text";
import { allTexts, namedInTitle, requirementsFoundIn } from "./catalog";

/** What the owner accepted for a tailored CV. */
export type TailoringChoice = {
  projectIds: readonly string[];
  skillIds: readonly string[];
  /** The accepted title, or null to keep the profile's. */
  title: string | null;
};

type Named = (texts: readonly string[]) => boolean;

/** The project's whole technology list, the job's technologies first; [] keeps the owner's order. */
function technologiesFirst(project: MasterProject, named: Named): DetailRef[] {
  const technologies = project.details.filter(
    (detail) => !detail.archived && detail.kind === "technology",
  );
  const first = technologies.filter((detail) => named(allTexts(detail.text)));
  if (first.length === 0 || first.length === technologies.length) return [];
  return [...first, ...technologies.filter((detail) => !first.includes(detail))].map((detail) => ({
    refId: detail.id,
    visible: true,
  }));
}

function tailoredSkills(
  section: Extract<SectionDefinition, { kind: "technical_skills" }>,
  master: MasterData,
  shown: ReadonlySet<string>,
  named: Named,
): Extract<SectionDefinition, { kind: "technical_skills" }> {
  const groups = master.skillGroups
    .filter((group) => !group.archived)
    .map((group) => {
      const skills = group.skills.filter((skill) => !skill.archived);
      const kept = skills.filter((skill) => shown.has(skill.id));
      const first = kept.filter((skill) => named(allTexts(skill.label)));
      const ordered = [...first, ...kept.filter((skill) => !first.includes(skill))];
      return {
        refId: group.id,
        // A group with nothing left is hidden too, so the editor shows it as hidden.
        visible: kept.length > 0,
        skills: [
          ...ordered.map((skill) => ({ refId: skill.id, visible: true })),
          ...skills
            .filter((skill) => !shown.has(skill.id))
            .map((skill) => ({ refId: skill.id, visible: false })),
        ],
      };
    });
  return { ...section, groups };
}

/**
 * A CV definition made for a job post. Everything the base shows stays as it
 * is, except:
 * - the projects section lists the chosen projects, in order, each with its
 *   whole technology list, the job's technologies first;
 * - technical skills show the chosen skills, the job's first in each group;
 *   the others are hidden, never deleted;
 * - the header uses the accepted title, in the CV's language.
 * "The job's" means named by its requirements or its title. Ids that are not
 * active records of this owner are left out.
 */
export function tailorDefinition(
  base: CvDefinition,
  master: MasterData,
  choice: TailoringChoice,
  {
    compiled,
    locale,
    titles = [],
  }: { compiled: CompiledRequirements; locale: Locale; titles?: readonly string[] },
): CvDefinition {
  const projects = new Map(
    master.projects.filter((project) => !project.archived).map((project) => [project.id, project]),
  );
  const shown = new Set(choice.skillIds);
  const named: Named = (texts) =>
    requirementsFoundIn(compiled, texts).labels.length > 0 || namedInTitle(titles, texts);

  const titleText = choice.title?.trim();
  const title: LocalizedTextValue = {};
  if (titleText) title[locale] = titleText;

  return {
    ...base,
    header: titleText ? { ...base.header, title } : base.header,
    sections: base.sections.map((section) => {
      switch (section.kind) {
        case "projects":
          return {
            ...section,
            items: [...new Set(choice.projectIds)].flatMap((id) => {
              const project = projects.get(id);
              return project
                ? [{ ...newProjectItem(id), details: technologiesFirst(project, named) }]
                : [];
            }),
          };
        case "technical_skills":
          return tailoredSkills(section, master, shown, named);
        default:
          return section;
      }
    }),
  };
}
