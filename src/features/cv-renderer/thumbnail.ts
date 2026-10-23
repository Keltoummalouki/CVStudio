import type { ResolvedCv, ResolvedSection } from "@/features/cv-builder/resolve";

/**
 * A thumbnail shows the first page only, a few centimetres wide. Each section
 * keeps its first entries, items and bullets, so the page looks like the real
 * one (same sections, order and layout) without pages of markup nobody sees.
 */
export const THUMBNAIL_LIMITS = {
  entries: 3,
  bullets: 3,
  groups: 8,
  items: 8,
  subsections: 2,
} as const;

function trimSection(section: ResolvedSection): ResolvedSection {
  const limits = THUMBNAIL_LIMITS;
  switch (section.kind) {
    case "summary":
      return section;
    case "technical_skills":
      return { ...section, groups: section.groups.slice(0, limits.groups) };
    case "experience":
    case "education":
    case "projects":
    case "certifications":
      return {
        ...section,
        entries: section.entries
          .slice(0, limits.entries)
          .map((entry) => ({ ...entry, body: entry.body.slice(0, limits.bullets) })),
      };
    case "soft_skills":
    case "languages":
      return { ...section, items: section.items.slice(0, limits.items) };
    case "custom":
      return {
        ...section,
        subsections: section.subsections.slice(0, limits.subsections).map((subsection) => ({
          ...subsection,
          items: subsection.items.slice(0, limits.bullets),
        })),
      };
  }
}

export function trimForThumbnail(cv: ResolvedCv): ResolvedCv {
  return { ...cv, sections: cv.sections.map(trimSection) };
}
