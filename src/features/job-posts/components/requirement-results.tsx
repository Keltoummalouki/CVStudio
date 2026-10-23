"use client";

import { useId } from "react";
import { CircleCheckIcon, CircleDashedIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Evidence, FragmentLocation, RequirementResult, RequirementStatus } from "../matching";

function useLocationLabel() {
  const t = useTranslations("jobs.match");
  return (where: FragmentLocation) =>
    where.scope === "cv"
      ? [where.section ?? t("header"), where.item, t(`fields.${where.field}`)]
          .filter(Boolean)
          .join(" · ")
      : [t(`records.${where.record}`), where.item].filter(Boolean).join(" · ");
}

/** Where a requirement was found, with the matched words highlighted in their context. */
export function EvidenceLine({ evidence }: { evidence: Evidence }) {
  const location = useLocationLabel();
  return (
    <li className="min-w-0 space-y-0.5">
      <p className="text-xs text-muted-foreground">{location(evidence.where)}</p>
      <p className="text-[0.8125rem] leading-relaxed wrap-anywhere">
        <span className="text-muted-foreground">{evidence.before}</span>
        <mark className="rounded-sm bg-signal-soft px-0.5 font-medium text-foreground">
          {evidence.match}
        </mark>
        <span className="text-muted-foreground">{evidence.after}</span>
      </p>
    </li>
  );
}

const STATUS_ICONS = {
  matched: CircleCheckIcon,
  hidden: EyeOffIcon,
  missing: CircleDashedIcon,
} as const satisfies Record<RequirementStatus, unknown>;

export const STATUS_TONES: Record<RequirementStatus, string> = {
  matched: "text-success",
  hidden: "text-warning",
  missing: "text-muted-foreground",
};

type RequirementGroupProps = {
  status: RequirementStatus;
  results: readonly RequirementResult[];
  title: string;
  hint: string;
  /** Shown under the hint, e.g. a link to where the owner can act on it. */
  action?: React.ReactNode;
};

/** One group of requirements (found, hidden or missing), each with its evidence. */
export function RequirementGroup({ status, results, title, hint, action }: RequirementGroupProps) {
  const tRequirements = useTranslations("jobs.requirements");
  const headingId = useId();
  if (results.length === 0) return null;
  const Icon = STATUS_ICONS[status];

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <h4 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
          <Icon aria-hidden="true" className={cn("size-4 shrink-0", STATUS_TONES[status])} />
          {title}
        </h4>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {action}
      </div>
      <ul className="space-y-3">
        {results.map(({ requirement, evidence }) => (
          <li key={requirement.id} className="rounded-md border px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{requirement.label}</span>
              <Badge variant={requirement.importance === "required" ? "outline" : "secondary"}>
                {tRequirements(requirement.importance)}
              </Badge>
              {requirement.note ? (
                <span className="text-xs text-muted-foreground">{requirement.note}</span>
              ) : null}
            </div>
            {evidence.length > 0 ? (
              <ul className="mt-2 space-y-2 border-l-2 border-ink-200 pl-3">
                {evidence.map((item, index) => (
                  <EvidenceLine key={index} evidence={item} />
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
