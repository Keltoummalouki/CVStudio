import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Panel, PanelHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEW_CV_HREF } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  getSetupSteps,
  type SetupProgress,
  type SetupStepId,
  type SetupStepState,
} from "../overview";

const STEP_HREFS: Record<SetupStepId, string> = {
  profile: "/dashboard/content/profile",
  career: "/dashboard/content",
  cv: NEW_CV_HREF,
  template: "/dashboard/templates",
};

function StepMarker({ position, state }: { position: number; state: SetupStepState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
        state === "done" && "bg-ink-100 text-ink-700",
        state === "next" && "bg-signal text-signal-foreground",
        state === "upcoming" && "border border-border text-muted-foreground",
      )}
    >
      {state === "done" ? <CheckIcon className="size-4" strokeWidth={2.5} /> : position}
    </span>
  );
}

function StepAction({ id }: { id: SetupStepId }) {
  const t = useTranslations("overview.gettingStarted.actions");

  return (
    <Button asChild size="sm">
      <Link href={STEP_HREFS[id]}>
        {t(id)}
        <ArrowRightIcon aria-hidden="true" />
      </Link>
    </Button>
  );
}

export function GettingStarted({ setup, className }: { setup: SetupProgress; className?: string }) {
  const t = useTranslations("overview.gettingStarted");
  const steps = getSetupSteps(setup);
  const doneCount = steps.filter((step) => step.state === "done").length;

  return (
    <Panel aria-labelledby="getting-started-title" className={className}>
      <PanelHeader
        titleId="getting-started-title"
        title={t("title")}
        description={t("description")}
        aside={
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {t("progress", { done: doneCount, total: steps.length })}
          </span>
        }
      />
      <ol className="flex-1 divide-y overflow-hidden rounded-b-lg">
        {steps.map((step, index) => (
          <li
            key={step.id}
            aria-current={step.state === "next" ? "step" : undefined}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 px-5 py-3.5",
              step.state === "next" && "bg-ink-50 py-5",
            )}
          >
            <StepMarker position={index + 1} state={step.state} />
            <div className="min-w-0 space-y-1">
              <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className={cn("text-sm font-medium", step.state === "next" && "font-semibold")}>
                  {t(`steps.${step.id}.title`)}
                </h3>
                {step.state === "done" ? <Badge variant="secondary">{t("done")}</Badge> : null}
                {step.state === "next" ? (
                  <span className="text-xs font-medium text-signal-hover">{t("next")}</span>
                ) : null}
              </div>
              {step.state === "next" ? (
                <>
                  <p className="max-w-prose text-[0.8125rem]/relaxed text-muted-foreground">
                    {t(`steps.${step.id}.description`)}
                  </p>
                  <div className="pt-2">
                    <StepAction id={step.id} />
                  </div>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
