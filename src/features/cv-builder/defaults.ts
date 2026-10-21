import {
  DEFINITION_SCHEMA_VERSION,
  type CertificationItem,
  type CvDefinition,
  type EducationItem,
  type ExperienceItem,
  type HeaderDefinition,
  type ProjectItem,
  type SectionDefinition,
  type SectionKind,
} from "./definition";
import type { MasterData } from "./master-data";

export type IdFactory = () => string;

const randomId: IdFactory = () => crypto.randomUUID();

/** Built-in sections in the order of the reference CV, which new CVs start from. */
export const BUILT_IN_SECTION_ORDER = [
  "summary",
  "technical_skills",
  "experience",
  "education",
  "projects",
  "certifications",
  "soft_skills",
  "languages",
] as const satisfies readonly Exclude<SectionKind, "custom">[];

export type BuiltInSectionKind = (typeof BUILT_IN_SECTION_ORDER)[number];

/** Sections whose records are chosen one by one for each CV. */
export const RECORD_SECTION_KINDS = [
  "experience",
  "education",
  "projects",
  "certifications",
] as const satisfies readonly SectionKind[];
export type RecordSectionKind = (typeof RECORD_SECTION_KINDS)[number];

export function isRecordSection(
  section: SectionDefinition,
): section is Extract<SectionDefinition, { kind: RecordSectionKind }> {
  return (RECORD_SECTION_KINDS as readonly string[]).includes(section.kind);
}

export const DEFAULT_HEADER: HeaderDefinition = {
  showTitle: true,
  showName: true,
  showPhoto: true,
  showEmail: true,
  showPhone: true,
  showLocation: true,
  showLinks: true,
  links: [],
};

export function newExperienceItem(refId: string): ExperienceItem {
  return {
    refId,
    visible: true,
    showDates: true,
    showLocation: true,
    showTechnologies: true,
    details: [],
  };
}

export function newEducationItem(refId: string): EducationItem {
  return { refId, visible: true, showDates: true, showLocation: true, showDescription: true };
}

export function newProjectItem(refId: string): ProjectItem {
  return {
    refId,
    visible: true,
    showDates: true,
    showDescription: true,
    showTechnologies: true,
    showLinks: false,
    details: [],
  };
}

export function newCertificationItem(refId: string): CertificationItem {
  return { refId, visible: true, showIssuer: true, showDate: true, showLink: false };
}

const activeIds = (records: readonly { id: string; archived: boolean }[]) =>
  records.filter((record) => !record.archived).map((record) => record.id);

/**
 * A built-in section with every active record of its kind. Records are
 * opt-in per CV, so a new section starts complete and the owner removes
 * what does not fit this application.
 */
export function createBuiltInSection(
  kind: BuiltInSectionKind,
  master: MasterData,
  newId: IdFactory = randomId,
): SectionDefinition {
  const base = { nodeId: newId(), visible: true };
  switch (kind) {
    case "summary":
      return { ...base, kind };
    case "technical_skills":
      return { ...base, kind, columns: 2, groups: [] };
    case "experience":
      return { ...base, kind, items: activeIds(master.experiences).map(newExperienceItem) };
    case "education":
      return { ...base, kind, items: activeIds(master.educations).map(newEducationItem) };
    case "projects":
      return { ...base, kind, items: activeIds(master.projects).map(newProjectItem) };
    case "certifications":
      return { ...base, kind, items: activeIds(master.certifications).map(newCertificationItem) };
    case "soft_skills":
    case "languages":
      return { ...base, kind, items: [] };
  }
}

export function createCustomSection(refId: string, newId: IdFactory = randomId): SectionDefinition {
  return { nodeId: newId(), visible: true, kind: "custom", refId, subsections: [] };
}

export function createDefaultDefinition(
  master: MasterData,
  newId: IdFactory = randomId,
): CvDefinition {
  return {
    schemaVersion: DEFINITION_SCHEMA_VERSION,
    header: DEFAULT_HEADER,
    sections: [
      ...BUILT_IN_SECTION_ORDER.map((kind) => createBuiltInSection(kind, master, newId)),
      ...activeIds(master.customSections).map((refId) => createCustomSection(refId, newId)),
    ],
  };
}
