"use client";

import { useId, useState } from "react";
import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  EyeOffIcon,
  LanguagesIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_TONES } from "@/features/job-posts/components/requirement-results";
import { ScoreMeter } from "@/features/job-posts/components/score-meter";
import type { RequirementStatus } from "@/features/job-posts/matching";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { TailoringProposal, TailoringReview as Review } from "../review";

/** The CV title the owner keeps: the suggestion (as edited) or their profile's. */
export type TitleChoice = { use: "suggested" | "profile"; text: string };

export function initialTitleChoice(proposal: TailoringProposal): TitleChoice {
  const suggested = proposal.review.title.suggested;
  return suggested ? { use: "suggested", text: suggested } : { use: "profile", text: "" };
}

/** The accepted title for createCv: null keeps the profile's. */
export function acceptedTitle(choice: TitleChoice): string | null {
  return choice.use === "suggested" ? choice.text.trim() || null : null;
}

const STATUS_ICONS = {
  matched: CircleCheckIcon,
  hidden: EyeOffIcon,
  missing: CircleDashedIcon,
} as const satisfies Record<RequirementStatus, unknown>;

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-sm font-semibold">
      {children}
    </h3>
  );
}

function TitleChoiceField({
  review,
  mode,
  value,
  onChange,
  disabled,
}: {
  review: Review;
  mode: TailoringProposal["mode"];
  value: TitleChoice;
  onChange: (value: TitleChoice) => void;
  disabled: boolean;
}) {
  const t = useTranslations("cvs.new.tailoring.review");
  const id = useId();
  const profile = review.title.profile ?? t("noProfileTitle");
  if (!review.title.suggested) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t("cvTitle")}</h3>
        <p className="text-sm">{profile}</p>
      </div>
    );
  }
  return (
    <fieldset className="space-y-2.5" disabled={disabled}>
      <legend className="mb-2.5 text-sm font-semibold">{t("cvTitle")}</legend>
      <div
        className={cn(
          "space-y-2 rounded-md border p-3",
          value.use === "suggested" ? "border-ink-950" : "border-border",
        )}
      >
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="radio"
            name={`${id}-title`}
            className="size-4 accent-ink-950"
            checked={value.use === "suggested"}
            onChange={() => onChange({ ...value, use: "suggested" })}
          />
          {t("suggestedTitle")}
        </label>
        <Input
          aria-label={t("titleField")}
          aria-describedby={`${id}-hint`}
          value={value.text}
          maxLength={160}
          onFocus={() => onChange({ ...value, use: "suggested" })}
          onChange={(event) => onChange({ use: "suggested", text: event.target.value })}
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {mode === "ai" ? t("suggestedTitleAi") : t("suggestedTitleKeywords")}
        </p>
      </div>
      <label
        className={cn(
          "flex items-start gap-2.5 rounded-md border p-3 text-sm",
          value.use === "profile" ? "border-ink-950" : "border-border",
        )}
      >
        <input
          type="radio"
          name={`${id}-title`}
          className="mt-0.5 size-4 accent-ink-950"
          checked={value.use === "profile"}
          onChange={() => onChange({ ...value, use: "profile" })}
        />
        <span className="min-w-0 space-y-0.5">
          <span className="block font-medium">{t("profileTitle")}</span>
          <span className="block wrap-anywhere text-muted-foreground">{profile}</span>
        </span>
      </label>
    </fieldset>
  );
}

function ProjectList({ review, cvLocale }: { review: Review; cvLocale: Locale }) {
  const t = useTranslations("cvs.new.tailoring.review");
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <SectionHeading id={headingId}>
        {t("projects", { count: review.projects.length, total: review.projectTotal })}
      </SectionHeading>
      {review.projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
      ) : (
        <ol className="space-y-2.5">
          {review.projects.map((project, index) => (
            <li key={project.id} className="flex gap-3 rounded-md border p-3">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold"
                data-numeric
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-semibold wrap-anywhere">{project.title}</p>
                {project.technologies.length > 0 ? (
                  <p className="text-[0.8125rem] wrap-anywhere text-muted-foreground">
                    {project.technologies.join(" · ")}
                  </p>
                ) : null}
                {project.reason ? (
                  <p className="text-[0.8125rem] leading-relaxed">
                    <span className="sr-only">{t("reasonLabel")} </span>
                    {project.reason}
                  </p>
                ) : null}
                {project.missingTranslation ? (
                  <Badge variant="warning">
                    <LanguagesIcon aria-hidden="true" />
                    {t("missingTranslation", { language: cvLocale })}
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {review.projectsNotSent > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("projectsNotSent", { count: review.projectsNotSent })}
        </p>
      ) : null}
    </section>
  );
}

function SkillList({ review }: { review: Review }) {
  const t = useTranslations("cvs.new.tailoring.review");
  const headingId = useId();
  const hiddenId = useId();
  const [showHidden, setShowHidden] = useState(false);
  const { shown, hidden } = review.skills;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <SectionHeading id={headingId}>
        {t("skills", { shown: shown.length, hidden: hidden.length })}
      </SectionHeading>
      {shown.length + hidden.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noSkills")}</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((skill) => (
              <li
                key={skill.id}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  skill.named ? "border-border-strong font-semibold" : "text-muted-foreground",
                )}
              >
                {skill.label}
              </li>
            ))}
          </ul>
          {shown.some((skill) => skill.named) ? (
            <p className="text-xs text-muted-foreground">{t("skillsNamed")}</p>
          ) : null}
          {hidden.length > 0 ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2"
                aria-expanded={showHidden}
                aria-controls={hiddenId}
                onClick={() => setShowHidden((open) => !open)}
              >
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn("transition-transform", showHidden && "rotate-180")}
                />
                {showHidden ? t("hideHidden") : t("showHidden")}
              </Button>
              <ul id={hiddenId} hidden={!showHidden} className="flex flex-wrap gap-1.5">
                {hidden.map((skill) => (
                  <li
                    key={skill.id}
                    className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {skill.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RequirementList({ review }: { review: Review }) {
  const t = useTranslations("cvs.new.tailoring.review");
  const tRequirements = useTranslations("jobs.requirements");
  const headingId = useId();
  const groups = (["matched", "hidden", "missing"] as const).map((status) => ({
    status,
    items: review.requirements.filter((requirement) => requirement.status === status),
  }));
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <SectionHeading id={headingId}>{t("requirements")}</SectionHeading>
      {groups.map(({ status, items }) => {
        if (items.length === 0) return null;
        const Icon = STATUS_ICONS[status];
        return (
          <div key={status} className="space-y-1.5">
            <p className="flex items-center gap-2 text-[0.8125rem] font-medium">
              <Icon aria-hidden="true" className={cn("size-4 shrink-0", STATUS_TONES[status])} />
              {t(status, { count: items.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5 pl-6">
              {items.map((requirement) => (
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
            {status === "matched" ? null : (
              <p className="pl-6 text-xs text-muted-foreground">
                {t(status === "hidden" ? "hiddenHint" : "missingHint")}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

type TailoringReviewProps = {
  proposal: TailoringProposal;
  jobTitle: string;
  cvLocale: Locale;
  /** Test providers answered instead of the real ones. */
  fake: boolean;
  title: TitleChoice;
  onTitleChange: (value: TitleChoice) => void;
  disabled: boolean;
  /** The heading, which takes focus when the review appears. */
  headingRef?: React.Ref<HTMLHeadingElement>;
};

/**
 * What a tailored CV will show, before it exists: the estimated keyword
 * coverage, the suggested title, the chosen projects with the AI's reasons,
 * the skills shown and hidden, and the job's requirements the CV covers or
 * the career data lacks. Only the title is edited here; the rest in the editor.
 */
export function TailoringReview({
  proposal,
  jobTitle,
  cvLocale,
  fake,
  title,
  onTitleChange,
  disabled,
  headingRef,
}: TailoringReviewProps) {
  const t = useTranslations("cvs.new.tailoring");
  const tReview = useTranslations("cvs.new.tailoring.review");
  const headingId = useId();
  const { review, mode } = proposal;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-6 rounded-lg border border-ink-950/15 bg-card p-4 sm:p-5"
    >
      <div className="flex items-start gap-2.5">
        <SparklesIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-signal" />
        <div className="min-w-0 space-y-2">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold tracking-[-0.01em] wrap-anywhere outline-none"
          >
            {tReview("title", { title: jobTitle })}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={mode === "ai" ? "signal" : "outline"}>
              {mode === "ai" ? tReview("byAi") : tReview("byKeywords")}
            </Badge>
            {fake && mode === "ai" ? <Badge variant="outline">{t("fakeBadge")}</Badge> : null}
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            {tReview("intro")}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{tReview("coverage")}</p>
        <ScoreMeter score={review.score} />
        {review.careerScore !== null ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tReview("coverageNote", { score: review.careerScore })}
          </p>
        ) : null}
      </div>

      <TitleChoiceField
        review={review}
        mode={mode}
        value={title}
        onChange={onTitleChange}
        disabled={disabled}
      />
      <ProjectList review={review} cvLocale={cvLocale} />
      <SkillList review={review} />
      <RequirementList review={review} />
    </section>
  );
}
