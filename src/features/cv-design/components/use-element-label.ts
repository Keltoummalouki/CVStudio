"use client";

import { useCallback } from "react";
import {
  AtSignIcon,
  CircleUserRoundIcon,
  HeadingIcon,
  LinkIcon,
  MinusIcon,
  SquareIcon,
  TypeIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { MasterData } from "@/features/cv-builder/master-data";
import { getSectionMeta } from "@/features/cv-builder/components/section-meta";
import type { ElementContent } from "@/features/cv-design/design";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText } from "@/lib/i18n/localized-text";

const FIELD_ICONS = {
  name: UserRoundIcon,
  title: HeadingIcon,
  contacts: AtSignIcon,
  links: LinkIcon,
} as const;

/** The icon of what an element holds; render it with ElementIconView. */
export function elementIcon(content: ElementContent): LucideIcon {
  switch (content.type) {
    case "field":
      return FIELD_ICONS[content.field];
    case "section":
      return getSectionMeta(content.section).icon;
    case "custom":
      return getSectionMeta("custom").icon;
    case "text":
      return TypeIcon;
    case "photo":
      return CircleUserRoundIcon;
    case "line":
      return MinusIcon;
    case "shape":
      return SquareIcon;
  }
}

/** What an element holds, in the dashboard language: "Name", "Projects", "Text"… */
export function useElementLabel(master: MasterData, locale: Locale) {
  const t = useTranslations("designer.elements");
  const tBuilder = useTranslations("cvBuilder.sections");
  const tCareer = useTranslations("careerData.sections");

  return useCallback(
    (content: ElementContent): string => {
      switch (content.type) {
        case "field":
          return t(content.field);
        case "section": {
          if (content.section === "summary") return tBuilder("summary");
          const { messageKey } = getSectionMeta(content.section);
          return messageKey ? tCareer(`${messageKey}.title`) : content.section;
        }
        case "custom": {
          const record = master.customSections.find((section) => section.id === content.refId);
          return (
            (record && displayLocalizedText(record.title, locale)?.text) ||
            tBuilder("customFallback")
          );
        }
        case "text":
        case "photo":
        case "line":
        case "shape":
          return t(content.type);
      }
    },
    [t, tBuilder, tCareer, master.customSections, locale],
  );
}
