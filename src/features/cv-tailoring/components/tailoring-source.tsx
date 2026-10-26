"use client";

import { useId } from "react";
import { CircleAlertIcon, LockKeyholeIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { TextareaField } from "@/components/forms/textarea-field";
import { fieldControlClassName } from "@/components/ui/input";
import type { AiAccess } from "@/features/ai-settings/access";
import { JOB_POST_LIMITS } from "@/features/job-posts/schemas";
import type { JobPostChoice } from "@/features/job-posts/server/queries";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const SETTINGS_HREF = "/dashboard/settings";

/** What the picker shows: both inputs keep their value while the other one is in use. */
export type SourceDraft = { kind: "paste" | "saved"; text: string; savedId: string };

export const jobLabel = (job: Pick<JobPostChoice, "title" | "company">) =>
  [job.title, job.company].filter(Boolean).join(" – ");

/** Whether the picker holds a job a CV can be tailored to. */
export function isSourceReady(source: SourceDraft, jobPosts: readonly JobPostChoice[]): boolean {
  if (source.kind === "paste") return source.text.trim().length >= JOB_POST_LIMITS.minDescription;
  const job = jobPosts.find((candidate) => candidate.id === source.savedId);
  return !!job && job.requirementCount > 0;
}

/** What tailoring sends where, how many requests are left, or why AI can't be used now. */
function AiNote({ ai, paste }: { ai: AiAccess; paste: boolean }) {
  const t = useTranslations("cvs.new.tailoring");
  const tProviders = useTranslations("ai.providers");
  const format = useFormatter();
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
          {t("remaining", { count: ai.remaining })} {paste ? t("pasteCost") : null}
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
          ? t("limit", { time: format.dateTime(new Date(ai.resetsAt), { timeStyle: "short" }) })
          : t(ai.state === "off" ? "aiOff" : "aiUnavailable")}{" "}
        {ai.state === "unavailable" ? null : (
          <Link
            href={SETTINGS_HREF}
            className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            {t("settingsLink")}
          </Link>
        )}
      </span>
    </p>
  );
}

type TailoringSourceProps = {
  jobPosts: readonly JobPostChoice[];
  value: SourceDraft;
  onChange: (value: SourceDraft) => void;
  ai: AiAccess;
  disabled: boolean;
};

/** The job post a CV is tailored to: pasted here, or one of the owner's saved posts. */
export function TailoringSource({ jobPosts, value, onChange, ai, disabled }: TailoringSourceProps) {
  const t = useTranslations("cvs.new.tailoring");
  const id = useId();
  const selected = jobPosts.find((job) => job.id === value.savedId);
  const tooShort = value.text.trim().length < JOB_POST_LIMITS.minDescription;

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      {jobPosts.length > 0 ? (
        <div
          role="radiogroup"
          aria-label={t("source")}
          className="inline-grid w-fit grid-cols-2 gap-0.5 rounded-md bg-ink-100 p-1"
        >
          {(["paste", "saved"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={value.kind === kind}
              disabled={disabled}
              onClick={() => onChange({ ...value, kind })}
              className={cn(
                "flex h-8 items-center justify-center rounded-sm px-3 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:z-10 focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-10",
                value.kind === kind
                  ? "bg-ink-950 text-paper"
                  : "text-muted-foreground hover:bg-ink-150 hover:text-foreground",
              )}
            >
              {t(kind)}
            </button>
          ))}
        </div>
      ) : null}

      {value.kind === "paste" ? (
        <div className="flex flex-col gap-1.5">
          <TextareaField
            label={t("pasteLabel")}
            description={t("pasteHint")}
            rows={9}
            value={value.text}
            maxLength={JOB_POST_LIMITS.description}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, text: event.target.value })}
          />
          <p className="text-right text-xs text-muted-foreground" data-numeric>
            {t("counter", { count: value.text.length, max: JOB_POST_LIMITS.description })}
          </p>
          {tooShort && value.text.trim() ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              {t("tooShort", { min: JOB_POST_LIMITS.minDescription })}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-saved`} className="text-sm font-medium">
            {t("savedLabel")}
          </label>
          <select
            id={`${id}-saved`}
            value={value.savedId}
            disabled={disabled}
            aria-describedby={selected?.requirementCount === 0 ? `${id}-empty` : undefined}
            onChange={(event) => onChange({ ...value, savedId: event.target.value })}
            className={cn(fieldControlClassName, "h-10 w-full px-3 pointer-coarse:h-11")}
          >
            <option value="" disabled>
              {t("savedPlaceholder")}
            </option>
            {jobPosts.map((job) => (
              <option key={job.id} value={job.id}>
                {t("savedOption", { title: jobLabel(job), count: job.requirementCount })}
              </option>
            ))}
          </select>
          {selected?.requirementCount === 0 ? (
            <p id={`${id}-empty`} className="text-[0.8125rem] text-muted-foreground">
              {t("noRequirements")}
            </p>
          ) : null}
        </div>
      )}

      <AiNote ai={ai} paste={value.kind === "paste"} />
    </div>
  );
}
