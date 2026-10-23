"use client";

import { useId, useState } from "react";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  EyeOffIcon,
  InfoIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Panel, PanelHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEW_CV_HREF } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { MatchReport, RequirementResult, RequirementStatus } from "../matching";
import type { CvMatch } from "../server/queries";
import { EvidenceLine, RequirementGroup } from "./requirement-results";
import { ScoreMeter } from "./score-meter";

/** The best CVs shown first; the rest stay one click away. */
const TOP_MATCHES = 5;

function StatusGroup({
  status,
  results,
}: {
  status: RequirementStatus;
  results: RequirementResult[];
}) {
  const t = useTranslations("jobs.match");
  return (
    <RequirementGroup
      status={status}
      results={results}
      title={t(`groups.${status}`, { count: results.length })}
      hint={t(`groupHints.${status}`)}
    />
  );
}

function MatchDetails({ report }: { report: MatchReport }) {
  const t = useTranslations("jobs.match");
  const byStatus = (status: RequirementStatus) =>
    report.requirements.filter((result) => result.status === status);

  return (
    <div className="mt-4 space-y-5 rounded-lg bg-ink-50 p-4">
      {report.title.status !== "none" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {report.title.status === "matched" ? (
              <CircleCheckIcon aria-hidden="true" className="size-4 text-success" />
            ) : (
              <CircleDashedIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            )}
            {t(report.title.status === "matched" ? "titleFound" : "titleMissing")}
          </p>
          {report.title.evidence.length > 0 ? (
            <ul className="space-y-2 border-l-2 border-ink-200 pl-3">
              {report.title.evidence.map((item, index) => (
                <EvidenceLine key={index} evidence={item} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{t("titleHint")}</p>
          )}
        </div>
      ) : null}
      <StatusGroup status="matched" results={byStatus("matched")} />
      <StatusGroup status="hidden" results={byStatus("hidden")} />
      <StatusGroup status="missing" results={byStatus("missing")} />
    </div>
  );
}

function CvMatchRow({ match, best }: { match: CvMatch; best: boolean }) {
  const t = useTranslations("jobs.match");
  const tLanguages = useTranslations("languages");
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const { report } = match;
  // Only the groups the job has: "nice to have 0/0" says nothing.
  const counts = report
    ? [
        report.required.total > 0 ? t("countsRequired", report.required) : null,
        report.preferred.total > 0 ? t("countsPreferred", report.preferred) : null,
      ]
    : [];

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1 basis-56 space-y-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{match.cvName}</span>
            {best ? (
              <Badge variant="success" className="shrink-0">
                {t("best")}
              </Badge>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground" data-numeric>
            {[tLanguages(match.locale), ...counts].filter(Boolean).join(" · ")}
          </p>
        </div>
        {report ? (
          <ScoreMeter score={report.score} className="w-full sm:w-60" />
        ) : (
          <p className="text-sm text-muted-foreground">{t("unreadable")}</p>
        )}
      </div>

      {report ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {report.title.status !== "none" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {report.title.status === "matched" ? (
                <CircleCheckIcon aria-hidden="true" className="size-3.5 text-success" />
              ) : (
                <CircleDashedIcon aria-hidden="true" className="size-3.5" />
              )}
              {t(report.title.status === "matched" ? "titleFound" : "titleMissing")}
            </span>
          ) : null}
          {report.hidden > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-warning">
              <EyeOffIcon aria-hidden="true" className="size-3.5" />
              {t("hiddenCount", { count: report.hidden })}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {report.requirements.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={open}
                aria-controls={detailsId}
                aria-label={t(open ? "hideDetailsFor" : "showDetailsFor", { cv: match.cvName })}
                onClick={() => setOpen((value) => !value)}
              >
                {t(open ? "hideDetails" : "showDetails")}
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-(--duration-fast) motion-reduce:transition-none",
                    open && "rotate-180",
                  )}
                />
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link
                href={`/dashboard/cvs/${match.cvId}`}
                aria-label={t("openCvFor", { cv: match.cvName })}
              >
                {t("openCv")}
                <ArrowUpRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div id={detailsId} hidden={!open}>
        {open && report ? <MatchDetails report={report} /> : null}
      </div>
    </li>
  );
}

/**
 * Every CV scored against the saved requirements, best first. The score is an
 * estimate of keyword coverage, never presented as an employer's ATS result.
 */
export function CvMatchList({
  matches,
  hasRequirements,
  dirty,
}: {
  matches: readonly CvMatch[];
  hasRequirements: boolean;
  /** The form has unsaved edits: the scores still describe the saved version. */
  dirty: boolean;
}) {
  const t = useTranslations("jobs.match");
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? matches : matches.slice(0, TOP_MATCHES);

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader titleId={titleId} title={t("title")} description={t("description")} />
      {dirty ? (
        <p
          role="status"
          className="flex items-start gap-2 border-b bg-warning-soft px-5 py-3 text-[0.8125rem] sm:px-6"
        >
          <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {t("unsavedNote")}
        </p>
      ) : null}
      {matches.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-5 py-6 sm:px-6">
          <p className="text-sm text-muted-foreground">{t("noCvs")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href={NEW_CV_HREF}>{t("createCv")}</Link>
          </Button>
        </div>
      ) : !hasRequirements ? (
        <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">{t("noRequirements")}</p>
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((match, index) => (
              <CvMatchRow
                key={match.cvId}
                match={match}
                // Sorted best first; a CV that covers nothing is not a "best" match.
                best={index === 0 && (match.report?.score ?? 0) > 0}
              />
            ))}
          </ul>
          {matches.length > TOP_MATCHES ? (
            <div className="border-t px-3 py-2 sm:px-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? t("showFewer") : t("showAll", { count: matches.length })}
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-(--duration-fast) motion-reduce:transition-none",
                    showAll && "rotate-180",
                  )}
                />
              </Button>
            </div>
          ) : null}
        </>
      )}
      <details className="group border-t px-5 py-4 sm:px-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 transition-transform duration-(--duration-fast) group-open:rotate-180 motion-reduce:transition-none"
          />
          {t("howTitle")}
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          {(["once", "weights", "visible", "words", "title", "estimate"] as const).map((key) => (
            <li key={key}>{t(`how.${key}`)}</li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}
