"use client";

import { useState, useTransition } from "react";
import { CircleAlertIcon, LockKeyholeIcon, PencilLineIcon, ScanTextIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { TextareaField } from "@/components/forms/textarea-field";
import { Panel } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { AiAccess } from "@/features/ai-settings/access";
import { useAiErrorMessage } from "@/features/ai-settings/components/use-ai-error-message";
import type { AiFailureInfo } from "@/lib/ai/errors";
import { Link } from "@/lib/i18n/navigation";
import { JOB_POST_LIMITS, NEW_JOB_POST, type JobPostValues } from "../schemas";
import { analyzeJobPost } from "../server/actions";
import { JobPostForm } from "./job-post-form";

const SETTINGS_HREF = "/dashboard/settings";

/** Why the Analyze button is unavailable, or what using it involves. */
function AiNote({ ai }: { ai: AiAccess }) {
  const t = useTranslations("jobs.new");
  const tProviders = useTranslations("ai.providers");
  const format = useFormatter();
  const link = (
    <Link
      href={SETTINGS_HREF}
      className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
    >
      {t("settingsLink")}
    </Link>
  );

  const [primary, fallback] = ai.providers;
  if (ai.state === "ready" && primary) {
    return (
      <p className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground">
        <LockKeyholeIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {fallback
            ? t("privacyFallback", {
                primary: tProviders(primary),
                fallback: tProviders(fallback),
              })
            : t("privacy", { provider: tProviders(primary) })}{" "}
          {t("remaining", { count: ai.remaining })}
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-border-strong bg-ink-50 px-3 py-2.5 text-[0.8125rem]">
      <CircleAlertIcon
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
      <span>
        {ai.state === "limit"
          ? t("limit", {
              time: format.dateTime(new Date(ai.resetsAt), { timeStyle: "short" }),
            })
          : t(ai.state === "off" ? "aiOff" : "aiUnavailable")}{" "}
        {ai.state === "unavailable" ? null : link}
      </span>
    </p>
  );
}

function RequirementsSkeleton() {
  const t = useTranslations("jobs.new");
  return (
    <Panel aria-busy="true" className="gap-3 p-5 sm:p-6">
      <p role="status" className="flex items-center gap-2 text-sm font-medium">
        <Spinner />
        {t("analyzing")}
      </p>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-8 w-2/3" />
        </div>
      ))}
    </Panel>
  );
}

/**
 * Step 1, paste the post; step 2, review what the AI found (or enter it by
 * hand) in the editor. Nothing is stored before the owner saves.
 */
export function NewJobPost({ ai }: { ai: AiAccess }) {
  const t = useTranslations("jobs.new");
  const aiMessage = useAiErrorMessage();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ values: JobPostValues; fromAi: boolean } | null>(null);
  const [error, setError] = useState<AiFailureInfo | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();
  const tooShort = text.trim().length < JOB_POST_LIMITS.minDescription;

  if (draft) {
    const count = draft.values.requirements.items.length;
    return (
      <JobPostForm
        initialValues={draft.values}
        ai={ai}
        // An empty manual form has nothing to lose yet.
        unsaved={draft.fromAi || draft.values.description.length > 0}
        intro={
          draft.fromAi ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft p-4 sm:p-5"
            >
              <ScanTextIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
              <div className="space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {t("reviewTitle")}
                  {ai.fake ? <Badge variant="outline">{t("fakeBadge")}</Badge> : null}
                </p>
                <p className="text-sm/relaxed">{t("reviewDescription", { count })}</p>
              </div>
            </div>
          ) : null
        }
      />
    );
  }

  const analyze = () => {
    setError(null);
    startAnalyzing(async () => {
      const result = await analyzeJobPost({ description: text });
      if (result.ok) {
        setDraft({ values: { ...NEW_JOB_POST, ...result.data }, fromAi: true });
      } else {
        setError({ error: result.error, provider: result.provider });
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel className="gap-4 p-5 sm:p-6">
        <TextareaField
          label={t("pasteLabel")}
          description={t("pasteHint")}
          rows={14}
          value={text}
          maxLength={JOB_POST_LIMITS.description}
          disabled={isAnalyzing}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="-mt-2 text-right text-xs text-muted-foreground" data-numeric>
          {t("counter", { count: text.length, max: JOB_POST_LIMITS.description })}
        </p>
        <AiNote ai={ai} />
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
          >
            <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {aiMessage(error)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="signal"
            onClick={analyze}
            disabled={ai.state !== "ready" || tooShort || isAnalyzing}
            aria-describedby={tooShort && text.trim() ? "job-post-too-short" : undefined}
          >
            {isAnalyzing ? <Spinner /> : <ScanTextIcon aria-hidden="true" />}
            {isAnalyzing ? t("analyzing") : t("analyze")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isAnalyzing}
            onClick={() =>
              setDraft({ values: { ...NEW_JOB_POST, description: text.trim() }, fromAi: false })
            }
          >
            <PencilLineIcon aria-hidden="true" />
            {t("manual")}
          </Button>
          {ai.fake && ai.state === "ready" ? (
            <Badge variant="outline">{t("fakeBadge")}</Badge>
          ) : null}
        </div>
        {tooShort && text.trim() ? (
          <p id="job-post-too-short" className="text-[0.8125rem] text-muted-foreground">
            {t("tooShort", { min: JOB_POST_LIMITS.minDescription })}
          </p>
        ) : null}
      </Panel>
      {isAnalyzing ? <RequirementsSkeleton /> : null}
    </div>
  );
}
