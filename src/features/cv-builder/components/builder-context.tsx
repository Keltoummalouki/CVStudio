"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { displayLocalizedText, type LocalizedTextValue } from "@/lib/i18n/localized-text";
import type { CvDefinition } from "../definition";
import type { CvLabels } from "../labels";
import type { MasterData } from "../master-data";
import type { CvIssue } from "../resolve";

type BuilderContextValue = {
  definition: CvDefinition;
  master: MasterData;
  /** The CV's language: what the document prints, not the dashboard language. */
  cvLocale: Locale;
  /** Words printed on the CV, in its language (default headings…). */
  cvLabels: CvLabels;
  issues: CvIssue[];
  update: (change: (definition: CvDefinition) => CvDefinition) => void;
  select: (target: string) => void;
  undo: () => void;
};

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({
  value,
  children,
}: {
  value: BuilderContextValue;
  children: React.ReactNode;
}) {
  return <BuilderContext value={value}>{children}</BuilderContext>;
}

export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) throw new Error("useBuilder must be used inside BuilderProvider");
  return context;
}

export type DisplayText = { text: string; missing: boolean } | null;

/** Master text as it would print in the CV language; borrowed text is flagged as missing. */
export function useCvText() {
  const { cvLocale } = useBuilder();
  return useMemo(
    () =>
      (value: LocalizedTextValue | undefined): DisplayText => {
        if (!value) return null;
        const shown = displayLocalizedText(value, cvLocale);
        return shown ? { text: shown.text, missing: shown.locale !== null } : null;
      },
    [cvLocale],
  );
}

/** Blocking issues for a section, optionally narrowed to one record or group. */
export function countMissing(
  issues: readonly CvIssue[],
  sectionNodeId: string | null,
  refId?: string,
) {
  return issues.filter(
    (issue) =>
      issue.kind === "missing_translation" &&
      issue.sectionNodeId === sectionNodeId &&
      (refId === undefined || issue.refId === refId),
  ).length;
}
