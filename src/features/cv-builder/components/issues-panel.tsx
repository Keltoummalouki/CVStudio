"use client";

import { ArchiveIcon, CircleAlertIcon, CircleCheckIcon, LanguagesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isBlockingIssue, type CvIssue } from "../resolve";
import { useBuilder } from "./builder-context";
import { HEADER_TARGET } from "./section-outline";
import { useSectionName } from "./section-meta";

function IssueRow({ issue, onShow }: { issue: CvIssue; onShow: () => void }) {
  const t = useTranslations("cvBuilder.issues");
  const tLanguages = useTranslations("languages");
  const { definition, cvLocale } = useBuilder();
  const sectionName = useSectionName();
  const section = definition.sections.find((candidate) => candidate.nodeId === issue.sectionNodeId);
  const where = section ? sectionName(section) : t("header");

  let message: string;
  let Icon = LanguagesIcon;
  switch (issue.kind) {
    case "missing_translation":
      message = t("missing", { field: t(`fields.${issue.field}`), language: tLanguages(cvLocale) });
      break;
    case "archived_record":
      message = t("archived");
      Icon = ArchiveIcon;
      break;
    case "missing_record":
      message = t("deleted");
      Icon = CircleAlertIcon;
      break;
  }

  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-4">
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          isBlockingIssue(issue) ? "text-signal" : "text-warning",
        )}
      />
      <div className="min-w-0 flex-1 basis-36 space-y-1.5">
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {[where, issue.hint].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onShow}>
        {t("show")}
      </Button>
    </li>
  );
}

/**
 * Everything standing between this CV and a faithful export. Missing
 * translations block printing; archived or deleted records are warnings.
 */
export function IssuesPanel({
  purpose,
  open,
  onOpenChange,
  onShow,
}: {
  /** A template exports nothing itself: its issues are a heads-up for the CVs made from it. */
  purpose: "cv" | "template";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShow: (target: string) => void;
}) {
  const t = useTranslations("cvBuilder.issues");
  const tLanguages = useTranslations("languages");
  const { issues, cvLocale } = useBuilder();
  const blocking = issues.filter(isBlockingIssue);
  const warnings = issues.filter((issue) => !isBlockingIssue(issue));

  const trigger =
    blocking.length > 0 ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-signal/30 bg-signal-soft text-signal-hover"
      >
        <LanguagesIcon aria-hidden="true" />
        {t("toFix", { count: blocking.length })}
      </Button>
    ) : warnings.length > 0 ? (
      <Button type="button" variant="outline" size="sm" className="text-warning">
        <CircleAlertIcon aria-hidden="true" />
        {t("warnings", { count: warnings.length })}
      </Button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="bg-success-soft text-success hover:bg-success-soft"
      >
        <CircleCheckIcon aria-hidden="true" />
        {t("ready")}
      </Button>
    );

  const show = (issue: CvIssue) => {
    onOpenChange(false);
    onShow(issue.sectionNodeId ?? HEADER_TARGET);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="gap-3 border-b p-6 pr-12">
          <SheetTitle className="text-2xl tracking-[-0.03em]">
            {purpose === "cv" ? t("title") : t("templateTitle")}
          </SheetTitle>
          <SheetDescription>
            {blocking.length === 0
              ? t("clearDescription")
              : purpose === "cv"
                ? t("blockingDescription", { language: tLanguages(cvLocale) })
                : t("templateBlockingDescription", { language: tLanguages(cvLocale) })}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-success-soft">
                <CircleCheckIcon aria-hidden="true" className="size-8 text-success" />
              </span>
              <h3 className="text-xl font-semibold tracking-[-0.02em]">{t("allSet")}</h3>
              <p className="max-w-64 text-sm leading-relaxed text-muted-foreground">{t("none")}</p>
            </div>
          ) : null}
          {blocking.length > 0 ? (
            <section aria-labelledby="issues-blocking">
              <h3
                id="issues-blocking"
                className="bg-signal-soft px-5 py-3 text-xs font-semibold text-signal-hover"
              >
                {t("blocking", { count: blocking.length })}
              </h3>
              <ul className="divide-y">
                {blocking.map((issue, index) => (
                  <IssueRow key={index} issue={issue} onShow={() => show(issue)} />
                ))}
              </ul>
            </section>
          ) : null}
          {warnings.length > 0 ? (
            <section aria-labelledby="issues-warnings">
              <h3
                id="issues-warnings"
                className="bg-warning-soft px-5 py-3 text-xs font-semibold text-warning"
              >
                {t("warningsTitle", { count: warnings.length })}
              </h3>
              <ul className="divide-y">
                {warnings.map((issue, index) => (
                  <IssueRow key={index} issue={issue} onShow={() => show(issue)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
