import type { CustomItemKind, DetailKind, LinkKind } from "@/features/career-data/schemas";
import type { Period } from "@/lib/dates/period";
import type { LocalizedTextValue } from "@/lib/i18n/localized-text";

/**
 * Read-only snapshot of the owner's career data, as the CV builder and
 * renderer see it. Lists are in the owner's master order and include archived
 * rows (`archived: true`), so CVs that still reference them can explain why.
 */

type L = LocalizedTextValue;

export type MasterProfile = {
  fullName: string;
  title: L;
  summary: L;
  location: L;
  email: string | null;
  phone: string | null;
  hasPhoto: boolean;
};

export type MasterLink = {
  id: string;
  kind: LinkKind;
  label: L;
  displayText: string;
  url: string;
  archived: boolean;
};

export type MasterDetail = { id: string; kind: DetailKind; text: L; archived: boolean };

export type MasterSkill = { id: string; label: L; archived: boolean };
export type MasterSkillGroup = { id: string; title: L; skills: MasterSkill[]; archived: boolean };

export type MasterExperience = {
  id: string;
  organization: string;
  role: L;
  location: L;
  period: Period;
  details: MasterDetail[];
  archived: boolean;
};

export type MasterEducation = {
  id: string;
  credential: L;
  institution: L;
  location: L;
  description: L;
  period: Period;
  archived: boolean;
};

export type MasterProject = {
  id: string;
  title: L;
  description: L;
  projectUrl: string | null;
  sourceUrl: string | null;
  period: Period;
  details: MasterDetail[];
  archived: boolean;
};

export type MasterCertification = {
  id: string;
  title: L;
  issuer: L;
  issuedYear: number | null;
  issuedMonth: number | null;
  credentialUrl: string | null;
  archived: boolean;
};

export type MasterSoftSkill = { id: string; label: L; archived: boolean };

export type MasterLanguage = { id: string; name: L; proficiency: L; archived: boolean };

export type MasterCustomItem = {
  id: string;
  kind: CustomItemKind;
  label: L;
  text: L;
  archived: boolean;
};
export type MasterCustomSubsection = {
  id: string;
  title: L;
  items: MasterCustomItem[];
  archived: boolean;
};
export type MasterCustomSection = {
  id: string;
  title: L;
  subsections: MasterCustomSubsection[];
  archived: boolean;
};

export type MasterData = {
  profile: MasterProfile;
  links: MasterLink[];
  skillGroups: MasterSkillGroup[];
  experiences: MasterExperience[];
  educations: MasterEducation[];
  projects: MasterProject[];
  certifications: MasterCertification[];
  softSkills: MasterSoftSkill[];
  languages: MasterLanguage[];
  customSections: MasterCustomSection[];
};

export const EMPTY_MASTER_DATA: MasterData = {
  profile: {
    fullName: "",
    title: {},
    summary: {},
    location: {},
    email: null,
    phone: null,
    hasPhoto: false,
  },
  links: [],
  skillGroups: [],
  experiences: [],
  educations: [],
  projects: [],
  certifications: [],
  softSkills: [],
  languages: [],
  customSections: [],
};
