import type { MasterData } from "@/features/cv-builder/master-data";
import type {
  CvText,
  EntrySectionKind,
  ResolvedCv,
  ResolvedEntry,
} from "@/features/cv-builder/resolve";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText, type LocalizedTextValue } from "@/lib/i18n/localized-text";
import type { CareerRecordKind, CvTextField, TextFragment } from "./matching";

/**
 * The text a reader of the CV sees, as the renderer prints it: hidden
 * sections, entries and bullets are already gone and per-CV wording applies
 * (resolveCv). Contacts, links, dates and the built-in headings are left out:
 * they are not skills.
 */
export function visibleCvTexts(cv: ResolvedCv): TextFragment[] {
  const fragments: TextFragment[] = [];
  const push = (
    value: CvText | null | undefined,
    field: CvTextField,
    section: string | null,
    item: string | null,
  ) => {
    const text = value?.text.trim();
    if (text) fragments.push({ text, where: { scope: "cv", field, section, item } });
  };
  const pushEntry = (entry: ResolvedEntry, kind: EntrySectionKind, section: string | null) => {
    const name = entry.title?.text ?? entry.subtitle?.text ?? null;
    push(entry.title, kind === "experience" ? "role" : "entryTitle", section, null);
    push(entry.subtitle, "organization", section, name);
    push(entry.place, "place", section, name);
    for (const block of entry.body) push(block.text, block.kind, section, name);
    for (const technology of entry.technologies) push(technology, "technology", section, name);
  };

  push(cv.header.title, "headerTitle", null, null);
  for (const section of cv.sections) {
    const heading = section.title.text.trim() || null;
    switch (section.kind) {
      case "summary":
        push(section.text, "summary", heading, null);
        break;
      case "technical_skills":
        for (const group of section.groups) {
          push(group.title, "skillGroup", heading, null);
          for (const skill of group.skills)
            push(skill, "skill", heading, group.title?.text ?? null);
        }
        break;
      case "experience":
      case "education":
      case "projects":
      case "certifications":
        for (const entry of section.entries) pushEntry(entry, section.kind, heading);
        break;
      case "soft_skills":
      case "languages":
        for (const item of section.items) {
          push(item.text, "listItem", heading, null);
          push(item.detail, "listDetail", heading, item.text.text);
        }
        break;
      case "custom":
        // An owner-written heading, unlike the built-in ones.
        push(section.title, "sectionTitle", heading, null);
        for (const subsection of section.subsections) {
          const name = subsection.title?.text ?? null;
          push(subsection.title, "subsectionTitle", heading, null);
          for (const item of subsection.items) {
            push(item.label, "customLabel", heading, name);
            push(item.text, "customText", heading, name);
          }
        }
        break;
    }
  }
  return fragments;
}

/**
 * Every active text of the career data in every language, whether a CV shows
 * it or not: where a missing requirement may already be written. Archived
 * records are left out.
 */
export function careerTexts(master: MasterData, locale: Locale): TextFragment[] {
  const fragments: TextFragment[] = [];
  const name = (value: LocalizedTextValue) => displayLocalizedText(value, locale)?.text ?? null;
  const push = (
    value: LocalizedTextValue | string,
    record: CareerRecordKind,
    item: string | null,
  ) => {
    const texts = typeof value === "string" ? [value] : [value.shared, value.en, value.fr];
    const distinct = new Set(texts.flatMap((text) => text?.trim() || []));
    for (const text of distinct) fragments.push({ text, where: { scope: "career", record, item } });
  };

  push(master.profile.title, "profile", null);
  push(master.profile.summary, "profile", null);

  for (const group of master.skillGroups) {
    if (group.archived) continue;
    push(group.title, "skills", null);
    for (const skill of group.skills) {
      if (!skill.archived) push(skill.label, "skills", name(group.title));
    }
  }
  for (const experience of master.experiences) {
    if (experience.archived) continue;
    const item = name(experience.role) ?? experience.organization;
    push(experience.role, "experience", item);
    push(experience.organization, "experience", item);
    for (const detail of experience.details) {
      if (!detail.archived) push(detail.text, "experience", item);
    }
  }
  for (const education of master.educations) {
    if (education.archived) continue;
    const item = name(education.credential);
    push(education.credential, "education", item);
    push(education.institution, "education", item);
    push(education.description, "education", item);
  }
  for (const project of master.projects) {
    if (project.archived) continue;
    const item = name(project.title);
    push(project.title, "projects", item);
    push(project.description, "projects", item);
    for (const detail of project.details) {
      if (!detail.archived) push(detail.text, "projects", item);
    }
  }
  for (const certification of master.certifications) {
    if (certification.archived) continue;
    const item = name(certification.title);
    push(certification.title, "certifications", item);
    push(certification.issuer, "certifications", item);
  }
  for (const softSkill of master.softSkills) {
    if (!softSkill.archived) push(softSkill.label, "soft_skills", null);
  }
  for (const language of master.languages) {
    if (language.archived) continue;
    push(language.name, "languages", null);
    push(language.proficiency, "languages", name(language.name));
  }
  for (const section of master.customSections) {
    if (section.archived) continue;
    const item = name(section.title);
    push(section.title, "custom", null);
    for (const subsection of section.subsections) {
      if (subsection.archived) continue;
      push(subsection.title, "custom", item);
      for (const entry of subsection.items) {
        if (entry.archived) continue;
        push(entry.label, "custom", item);
        push(entry.text, "custom", item);
      }
    }
  }
  return fragments;
}
