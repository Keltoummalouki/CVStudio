import {
  AwardIcon,
  BriefcaseBusinessIcon,
  CodeXmlIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  HandshakeIcon,
  LanguagesIcon,
  SquarePlusIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Canonical list of career-data section kinds. The same identifiers are used by
 * the database, the CV composition schema, the builder and the renderer, so
 * section types are never spelled as ad-hoc strings elsewhere.
 */
export const CAREER_SECTION_KINDS = [
  "profile",
  "technical_skills",
  "experience",
  "education",
  "projects",
  "certifications",
  "soft_skills",
  "languages",
  "custom",
] as const;

export type CareerSectionKind = (typeof CAREER_SECTION_KINDS)[number];

/** Message keys under `careerData.sections`. */
export type CareerSectionMessageKey =
  | "profile"
  | "technicalSkills"
  | "experience"
  | "education"
  | "projects"
  | "certifications"
  | "softSkills"
  | "languages"
  | "custom";

/**
 * How a section is edited:
 * - "profile": the single owner profile;
 * - "records": a list of records, each edited on its own page;
 * - "collection": the whole list edited and saved at once.
 */
export type CareerSectionEditor = "profile" | "records" | "collection";

export type CareerSectionDefinition = {
  kind: CareerSectionKind;
  messageKey: CareerSectionMessageKey;
  href: string;
  icon: LucideIcon;
  builtIn: boolean;
  editor: CareerSectionEditor;
};

export const CAREER_SECTIONS: readonly CareerSectionDefinition[] = [
  {
    kind: "profile",
    editor: "profile",
    messageKey: "profile",
    href: "/dashboard/content/profile",
    icon: UserRoundIcon,
    builtIn: true,
  },
  {
    kind: "technical_skills",
    editor: "collection",
    messageKey: "technicalSkills",
    href: "/dashboard/content/skills",
    icon: CodeXmlIcon,
    builtIn: true,
  },
  {
    kind: "experience",
    editor: "records",
    messageKey: "experience",
    href: "/dashboard/content/experiences",
    icon: BriefcaseBusinessIcon,
    builtIn: true,
  },
  {
    kind: "education",
    editor: "records",
    messageKey: "education",
    href: "/dashboard/content/education",
    icon: GraduationCapIcon,
    builtIn: true,
  },
  {
    kind: "projects",
    editor: "records",
    messageKey: "projects",
    href: "/dashboard/content/projects",
    icon: FolderKanbanIcon,
    builtIn: true,
  },
  {
    kind: "certifications",
    editor: "records",
    messageKey: "certifications",
    href: "/dashboard/content/certifications",
    icon: AwardIcon,
    builtIn: true,
  },
  {
    kind: "soft_skills",
    editor: "collection",
    messageKey: "softSkills",
    href: "/dashboard/content/soft-skills",
    icon: HandshakeIcon,
    builtIn: true,
  },
  {
    kind: "languages",
    editor: "collection",
    messageKey: "languages",
    href: "/dashboard/content/languages",
    icon: LanguagesIcon,
    builtIn: true,
  },
  {
    kind: "custom",
    editor: "records",
    messageKey: "custom",
    href: "/dashboard/content/custom-sections",
    icon: SquarePlusIcon,
    builtIn: false,
  },
];

export const BUILT_IN_SECTION_COUNT = CAREER_SECTIONS.filter((section) => section.builtIn).length;

export function getCareerSection(kind: CareerSectionKind): CareerSectionDefinition {
  const section = CAREER_SECTIONS.find((candidate) => candidate.kind === kind);
  if (!section) throw new Error(`Unknown career section: ${kind}`);
  return section;
}
