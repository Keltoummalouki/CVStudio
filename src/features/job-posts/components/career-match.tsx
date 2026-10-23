"use client";

import { useId, useState } from "react";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  InfoIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Panel, PanelHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { MatchReport, RequirementResult } from "../matching";
import { RequirementGroup, STATUS_TONES } from "./requirement-results";
import { ScoreMeter } from "./score-meter";

const CAREER_DATA_HREF = "/dashboard/content";

/** Requirement names at a glance; required ones in bold (and said aloud). */
function RequirementChips({ results }: { results: readonly RequirementResult[] }) {
  const tRequirements = useTranslations("jobs.requirements");
  return (
    <ul className="flex flex-wrap gap-1.5">
      {results.map(({ requirement }) => (
        <li
          key={requirement.id}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            requirement.importance === "required"
              ? "border-border-strong font-semibold"
              : "text-muted-foreground",
          )}
        >
          {requirement.label}
          <span className="sr-only">, {tRequirements(requirement.importance)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The job's requirements looked for in all career data, whether a CV shows
 * them or not: what the owner can put forward for this job, and what they
 * do not have. Same deterministic matching and formula as the CV scores.
 */
export function CareerMatch({ report, dirty }: { report: MatchReport; dirty: boolean }) {
  const t = useTranslations("jobs.career");
  const tMatch = useTranslations("jobs.match");
  const titleId = useId();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const matched = report.requirements.filter((result) => result.status === "matched");
  const missing = report.requirements.filter((result) => result.status !== "matched");
  const total = report.requirements.length;
  // Only the groups the job has: "nice to have 0/0" says nothing.
  const counts = [
    report.required.total > 0 ? tMatch("countsRequired", report.required) : null,
    report.preferred.total > 0 ? tMatch("countsPreferred", report.preferred) : null,
  ].filter(Boolean);

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader titleId={titleId} title={t("title")} description={t("description")} />
      {dirty ? (
        <p
          role="status"
          className="flex items-start gap-2 border-b bg-warning-soft px-5 py-3 text-[0.8125rem] sm:px-6"
        >
          <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {tMatch("unsavedNote")}
        </p>
      ) : null}
      {total === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">{t("noRequirements")}</p>
      ) : (
        <div className="space-y-6 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-56 space-y-1">
              <p className="text-sm font-semibold" data-numeric>
                {t("covers", { matched: matched.length, total })}
              </p>
              <p className="text-xs text-muted-foreground" data-numeric>
                {counts.join(" · ")}
              </p>
            </div>
            <ScoreMeter score={report.score} className="w-full sm:w-60" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-labelledby={`${titleId}-have`} className="min-w-0 space-y-2.5">
              <h3 id={`${titleId}-have`} className="flex items-center gap-2 text-sm font-semibold">
                <CircleCheckIcon
                  aria-hidden="true"
                  className={cn("size-4 shrink-0", STATUS_TONES.matched)}
                />
                {t("have", { count: matched.length })}
              </h3>
              {matched.length > 0 ? (
                <RequirementChips results={matched} />
              ) : (
                <p className="text-xs text-muted-foreground">{t("haveNone")}</p>
              )}
            </section>
            <section aria-labelledby={`${titleId}-lack`} className="min-w-0 space-y-2.5">
              <h3 id={`${titleId}-lack`} className="flex items-center gap-2 text-sm font-semibold">
                <CircleDashedIcon
                  aria-hidden="true"
                  className={cn("size-4 shrink-0", STATUS_TONES.missing)}
                />
                {t("lack", { count: missing.length })}
              </h3>
              {missing.length > 0 ? (
                <>
                  <RequirementChips results={missing} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("lackHint")}{" "}
                    <Link
                      href={CAREER_DATA_HREF}
                      className="inline-flex items-center gap-0.5 font-medium text-foreground underline decoration-ink-300 underline-offset-4 hover:decoration-foreground"
                    >
                      {t("openCareerData")}
                      <ArrowUpRightIcon aria-hidden="true" className="size-3" />
                    </Link>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t("lackNone")}</p>
              )}
            </section>
          </div>

          {matched.length > 0 ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2.5"
                aria-expanded={open}
                aria-controls={detailsId}
                onClick={() => setOpen((value) => !value)}
              >
                {t(open ? "hideWhere" : "showWhere")}
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-(--duration-fast) motion-reduce:transition-none",
                    open && "rotate-180",
                  )}
                />
              </Button>
              <div id={detailsId} hidden={!open} className="mt-3 rounded-lg bg-ink-50 p-4">
                {open ? (
                  <RequirementGroup
                    status="matched"
                    results={matched}
                    title={t("whereTitle")}
                    hint={t("whereHint")}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
