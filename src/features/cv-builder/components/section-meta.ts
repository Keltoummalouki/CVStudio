"use client";

import { useCallback } from "react";
import { TextIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getCareerSection, type CareerSectionMessageKey } from "@/config/career-sections";
import { displayLocalizedText } from "@/lib/i18n/localized-text";
import type { SectionDefinition, SectionKind } from "../definition";
import { useBuilder } from "./builder-context";

type SectionMeta = {
  icon: LucideIcon;
  /** Where the section's master data is edited. */
  href: string;
  messageKey: CareerSectionMessageKey | null;
};

export function getSectionMeta(kind: SectionKind): SectionMeta {
  if (kind === "summary") {
    return { icon: TextIcon, href: "/dashboard/content/profile", messageKey: null };
  }
  const career = getCareerSection(kind);
  return { icon: career.icon, href: career.href, messageKey: career.messageKey };
}

/** Where one record of a section is edited in career data. */
export function getRecordHref(kind: SectionKind, refId: string): string {
  const { href } = getSectionMeta(kind);
  return kind === "experience" ||
    kind === "education" ||
    kind === "projects" ||
    kind === "certifications" ||
    kind === "custom"
    ? `${href}/${refId}`
    : href;
}

/** A section's name in the dashboard language (custom sections use their own title). */
export function useSectionName() {
  const t = useTranslations("cvBuilder");
  const tCareer = useTranslations("careerData.sections");
  const { master, cvLocale } = useBuilder();

  return useCallback(
    (section: SectionDefinition): string => {
      if (section.kind === "summary") return t("sections.summary");
      if (section.kind === "custom") {
        const record = master.customSections.find((candidate) => candidate.id === section.refId);
        return (
          (record && displayLocalizedText(record.title, cvLocale)?.text) ||
          t("sections.customFallback")
        );
      }
      const { messageKey } = getSectionMeta(section.kind);
      return messageKey ? tCareer(`${messageKey}.title`) : section.kind;
    },
    [t, tCareer, master.customSections, cvLocale],
  );
}
