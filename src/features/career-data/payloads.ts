import { normalizeLocalizedText, type LocalizedTextValue } from "@/lib/i18n/localized-text";
import type {
  CertificationValues,
  CustomSectionValues,
  DetailValues,
  EducationValues,
  ExperienceValues,
  PeriodValues,
  ProfileValues,
  ProjectValues,
  SkillGroupsValues,
  SoftSkillsValues,
  SpokenLanguagesValues,
} from "./schemas";

/**
 * Pure mappers from validated form values to the save functions' JSON
 * contracts. Empty strings become absent keys or nulls so the database never
 * stores blanks that look like content.
 */

const text = (value: LocalizedTextValue) => normalizeLocalizedText(value);
const nullable = (value: string) => (value.trim() === "" ? null : value.trim());

function period(value: PeriodValues) {
  return {
    start_year: value.startYear,
    start_month: value.startYear === null ? null : value.startMonth,
    end_year: value.isCurrent ? null : value.endYear,
    end_month: value.isCurrent || value.endYear === null ? null : value.endMonth,
    is_current: value.isCurrent,
  };
}

function details(values: DetailValues[]) {
  return values.map((detail) => ({
    id: detail.id,
    kind: detail.kind,
    text_i18n: text(detail.text),
  }));
}

export function toProfilePayload(values: ProfileValues) {
  return {
    expectedUpdatedAt: values.expectedUpdatedAt,
    full_name: values.fullName.trim(),
    title_i18n: text(values.title),
    summary_i18n: text(values.summary),
    location_i18n: text(values.location),
    email: nullable(values.email),
    phone: nullable(values.phone),
    links: values.links.map((link) => ({
      id: link.id,
      kind: link.kind,
      label_i18n: text(link.label),
      display_text: link.displayText.trim(),
      url: link.url.trim(),
    })),
  };
}

export function toExperiencePayload(values: ExperienceValues) {
  return {
    id: values.id,
    expectedUpdatedAt: values.expectedUpdatedAt,
    organization: values.organization.trim(),
    role_i18n: text(values.role),
    location_i18n: text(values.location),
    ...period(values.period),
    details: details(values.details),
  };
}

export function toProjectPayload(values: ProjectValues) {
  return {
    id: values.id,
    expectedUpdatedAt: values.expectedUpdatedAt,
    title_i18n: text(values.title),
    description_i18n: text(values.description),
    project_url: nullable(values.projectUrl),
    source_url: nullable(values.sourceUrl),
    ...period(values.period),
    details: details(values.details),
  };
}

export function toEducationPayload(values: EducationValues) {
  return {
    id: values.id,
    expectedUpdatedAt: values.expectedUpdatedAt,
    credential_i18n: text(values.credential),
    institution_i18n: text(values.institution),
    location_i18n: text(values.location),
    description_i18n: text(values.description),
    ...period(values.period),
  };
}

export function toCertificationPayload(values: CertificationValues) {
  return {
    id: values.id,
    expectedUpdatedAt: values.expectedUpdatedAt,
    title_i18n: text(values.title),
    issuer_i18n: text(values.issuer),
    issued_year: values.issuedYear,
    issued_month: values.issuedYear === null ? null : values.issuedMonth,
    credential_url: nullable(values.credentialUrl),
  };
}

export function toSoftSkillsPayload(values: SoftSkillsValues) {
  return {
    expectedStamp: values.expectedStamp,
    items: values.items.map((item) => ({ id: item.id, label_i18n: text(item.label) })),
  };
}

export function toSpokenLanguagesPayload(values: SpokenLanguagesValues) {
  return {
    expectedStamp: values.expectedStamp,
    items: values.items.map((item) => ({
      id: item.id,
      name_i18n: text(item.name),
      proficiency_i18n: text(item.proficiency),
    })),
  };
}

export function toSkillGroupsPayload(values: SkillGroupsValues) {
  return {
    expectedStamp: values.expectedStamp,
    groups: values.groups.map((group) => ({
      id: group.id,
      title_i18n: text(group.title),
      skills: group.skills.map((skill) => ({ id: skill.id, label_i18n: text(skill.label) })),
    })),
  };
}

export function toCustomSectionPayload(values: CustomSectionValues) {
  return {
    id: values.id,
    expectedUpdatedAt: values.expectedUpdatedAt,
    title_i18n: text(values.title),
    subsections: values.subsections.map((subsection) => ({
      id: subsection.id,
      title_i18n: text(subsection.title),
      items: subsection.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        label_i18n: item.kind === "key_value" ? text(item.label) : {},
        text_i18n: text(item.text),
      })),
    })),
  };
}
