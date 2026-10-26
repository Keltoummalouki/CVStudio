"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  InfoIcon,
  LayersIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DocumentGlyph } from "@/components/feedback/document-glyph";
import { ChoiceCard } from "@/components/forms/choice-card";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { AiAccess } from "@/features/ai-settings/access";
import {
  acceptedTitle,
  initialTitleChoice,
  TailoringReview,
  type TitleChoice,
} from "@/features/cv-tailoring/components/tailoring-review";
import {
  isSourceReady,
  TailoringSource,
  type SourceDraft,
} from "@/features/cv-tailoring/components/tailoring-source";
import {
  useTailoring,
  useTailoringErrorMessage,
  type JobFacts,
} from "@/features/cv-tailoring/components/use-tailoring";
import { TAILORED_PROJECTS, type TailoringMode } from "@/features/cv-tailoring/tailoring";
import type { TemplateChoice } from "@/features/cv-templates/server/queries";
import type { JobPostChoice } from "@/features/job-posts/server/queries";
import type { ActionErrorCode } from "@/lib/actions/result";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/config";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { CV_NAME_MAX, newCvFormSchema, type NewCvFormValues } from "../schemas";
import { createCv } from "../server/actions";

/** "" stands for the built-in Classic template: every active entry of the career data. */
const CLASSIC = "";

type Content = "all" | "tailored";

/** Without AI access the page can still tailor a CV by keywords. */
const OFF_AI: AiAccess = {
  state: "unavailable",
  fake: false,
  providers: [],
  remaining: 0,
  resetsAt: new Date(0).toISOString(),
};

type NewCvFormProps = {
  defaultLocale: Locale;
  templates: readonly TemplateChoice[];
  /** Preselected from the templates page ("Use template"). */
  initialTemplateId: string | null;
  /** The job post this CV is made for (its page links here): names it and picks its language. */
  job?: JobPostChoice | null;
  /** The owner's job posts a CV can be tailored to. */
  jobPosts?: readonly JobPostChoice[];
  ai?: AiAccess;
};

/** "Frontend developer – Acme", within the name limit. */
function nameForJob(job: JobFacts): string {
  return [job.title, job.company].filter(Boolean).join(" – ").slice(0, CV_NAME_MAX);
}

function Thumbnail({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-12 items-center justify-center rounded-md",
        selected ? "bg-paper/10" : "bg-ink-100",
      )}
    >
      <DocumentGlyph className="w-6" />
    </span>
  );
}

function ReviewSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function NewCvForm({
  defaultLocale,
  templates,
  initialTemplateId,
  job = null,
  jobPosts = [],
  ai = OFF_AI,
}: NewCvFormProps) {
  const t = useTranslations("cvs.new");
  const tLanguages = useTranslations("languages");
  const validationMessage = useValidationMessage();
  const tailoringMessage = useTailoringErrorMessage();
  const router = useRouter();
  const uiLocale = useLocale();
  const [isCreating, startCreating] = useTransition();
  const [createError, setCreateError] = useState<ActionErrorCode | "jobNotFound" | null>(null);

  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? CLASSIC);

  // The job a page linked here for may be older than the posts listed.
  const posts = job && !jobPosts.some((post) => post.id === job.id) ? [job, ...jobPosts] : jobPosts;
  const [content, setContent] = useState<Content>(
    job && job.requirementCount > 0 ? "tailored" : "all",
  );
  const [source, setSource] = useState<SourceDraft>({
    kind: job ? "saved" : "paste",
    text: "",
    savedId: job?.id ?? "",
  });
  const [title, setTitle] = useState<TitleChoice>({ use: "profile", text: "" });
  const tailoring = useTailoring({ uiLocale: isLocale(uiLocale) ? uiLocale : defaultLocale });
  const proposal = tailoring.result?.proposal ?? null;
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  // A job post in English or French sets the CV language; "other" leaves the usual default.
  // Designs hold no text of their own language: they never decide it.
  const jobLocale = job && isLocale(job.language) ? job.language : null;
  const form = useForm<NewCvFormValues>({
    resolver: zodResolver(newCvFormSchema),
    defaultValues: {
      name: job ? nameForJob(job) : "",
      locale: jobLocale ?? defaultLocale,
    },
  });
  const locale = useWatch({ control: form.control, name: "locale" });
  // What the owner typed or picked is never replaced by what a job post suggests.
  const [edited, setEdited] = useState({ name: false, locale: false });
  const markEdited = (field: keyof typeof edited) =>
    setEdited((current) => (current[field] ? current : { ...current, [field]: true }));

  const busy = tailoring.busy || isCreating;
  const locked = busy || proposal !== null;
  const remaining = Math.max(0, ai.remaining - tailoring.spent);
  const liveAi: AiAccess =
    ai.state === "ready" && (remaining === 0 || tailoring.outOfRequests)
      ? { ...ai, state: "limit", remaining: 0 }
      : { ...ai, remaining };
  const sourceReady = isSourceReady(source, posts);
  const canUseKeywords = sourceReady && (source.kind === "saved" || tailoring.hasRead(source.text));

  useEffect(() => {
    if (proposal) reviewHeading.current?.focus();
  }, [proposal]);

  /** Names the CV after the job and writes it in the post's language, unless the owner chose. */
  const prepare = (facts: JobFacts): Locale => {
    if (!edited.name) {
      form.setValue("name", nameForJob(facts), { shouldValidate: form.formState.isSubmitted });
    }
    if (!edited.locale && isLocale(facts.language)) form.setValue("locale", facts.language);
    return form.getValues("locale");
  };

  const changeSource = (next: SourceDraft) => {
    setSource(next);
    const post = next.kind === "saved" ? posts.find((p) => p.id === next.savedId) : undefined;
    if (post && next.savedId !== source.savedId) prepare(post);
  };

  const generate = (mode: TailoringMode) => {
    setCreateError(null);
    const post = posts.find((candidate) => candidate.id === source.savedId);
    const from = tailoring.result
      ? tailoring.result.job
      : source.kind === "saved" && post
        ? ({ kind: "saved", job: post } as const)
        : ({ kind: "paste", text: source.text } as const);
    void tailoring.generate(mode, from, prepare).then((next) => {
      if (next) setTitle(initialTitleChoice(next));
    });
  };

  const startOver = () => {
    tailoring.startOver();
    setCreateError(null);
  };

  const create = form.handleSubmit((values) => {
    setCreateError(null);
    startCreating(async () => {
      try {
        let jobPostId = content === "all" ? job?.id : undefined;
        let choice;
        if (content === "tailored") {
          if (!tailoring.result) return;
          const saved = await tailoring.savedJobPostId(tailoring.result.job);
          if (!saved.ok) {
            setCreateError(saved.error);
            return;
          }
          jobPostId = saved.id;
          const { projectIds, skillIds } = tailoring.result.proposal.picks;
          choice = { projectIds, skillIds, title: acceptedTitle(title) };
        }
        const result = await createCv({
          ...values,
          templateId: templateId || undefined,
          jobPostId,
          tailoring: choice,
        });
        if (result.ok) {
          router.push(`/dashboard/cvs/${result.data.id}`);
          return;
        }
        const jobGone = result.fieldIssues?.some((issue) => issue.path === "jobPostId");
        setCreateError(jobGone ? "jobNotFound" : result.error);
      } catch {
        setCreateError("unavailable");
      }
    });
  });

  const message = createError
    ? t(`errors.${createError}`)
    : tailoring.error
      ? tailoringMessage(tailoring.error)
      : null;

  const nameField = form.register("name", { onChange: () => markEdited("name") });
  const localeField = form.register("locale", { onChange: () => markEdited("locale") });

  const actionClass = "w-full sm:w-auto";
  const secondaryActions: React.ReactNode[] = [];
  let primaryAction: React.ReactNode;
  if (content === "tailored" && !proposal) {
    if (canUseKeywords) {
      secondaryActions.push(
        <Button
          key="keywords"
          type="button"
          variant="outline"
          size="lg"
          className={actionClass}
          disabled={busy}
          onClick={() => generate("keywords")}
        >
          {t("tailoring.keywords")}
        </Button>,
      );
    }
    primaryAction = (
      <Button
        type="button"
        variant="signal"
        size="lg"
        className={actionClass}
        disabled={busy || !sourceReady || liveAi.state !== "ready"}
        onClick={() => generate("ai")}
      >
        {tailoring.busy ? <Spinner /> : <SparklesIcon aria-hidden="true" />}
        {t("tailoring.generate")}
      </Button>
    );
  } else {
    if (content === "tailored") {
      secondaryActions.push(
        <Button
          key="start-over"
          type="button"
          variant="ghost"
          size="lg"
          className={actionClass}
          disabled={busy}
          onClick={startOver}
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("tailoring.startOver")}
        </Button>,
      );
      if (proposal?.mode === "ai" && liveAi.state === "ready") {
        secondaryActions.push(
          <Button
            key="again"
            type="button"
            variant="outline"
            size="lg"
            className={actionClass}
            disabled={busy}
            onClick={() => generate("ai")}
          >
            {t("tailoring.again")}
          </Button>,
        );
      }
    }
    primaryAction = (
      <Button type="submit" variant="signal" size="lg" className={actionClass} disabled={busy}>
        {isCreating ? <Spinner /> : null}
        {isCreating ? t("creating") : t("create")}
        {isCreating ? null : <ArrowRightIcon aria-hidden="true" />}
      </Button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        // Before a proposal exists, only the Generate buttons move a tailored CV forward.
        if (content === "tailored" && !proposal) {
          event.preventDefault();
          return;
        }
        void create(event);
      }}
      noValidate
      className="flex flex-col gap-8"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t("template.label")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            compact
            name="template"
            value={CLASSIC}
            checked={templateId === CLASSIC}
            onChange={() => setTemplateId(CLASSIC)}
            disabled={busy}
            selected={templateId === CLASSIC}
            media={<Thumbnail selected={templateId === CLASSIC} />}
            title={t("template.classic")}
            description={t("template.classicHint")}
            meta={
              <span
                className={cn(
                  "text-xs font-semibold",
                  templateId === CLASSIC ? "text-paper/75" : "text-muted-foreground",
                )}
              >
                {t("template.builtIn")}
              </span>
            }
          />
          {templates.map((template) => (
            <ChoiceCard
              key={template.id}
              compact
              name="template"
              value={template.id}
              checked={templateId === template.id}
              onChange={() => setTemplateId(template.id)}
              disabled={busy}
              selected={templateId === template.id}
              media={<Thumbnail selected={templateId === template.id} />}
              title={template.name}
              description={template.description || t("template.savedHint")}
            />
          ))}
        </div>
        <p className="flex gap-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {templateId === CLASSIC
            ? templates.length === 0
              ? t("template.makeYourOwn")
              : t("template.classicNote")
            : t("template.savedNote")}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t("content.label")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            compact
            name="content"
            value="all"
            checked={content === "all"}
            onChange={() => setContent("all")}
            disabled={locked}
            selected={content === "all"}
            title={t("content.all")}
            description={t("content.allHint")}
          />
          <ChoiceCard
            compact
            name="content"
            value="tailored"
            checked={content === "tailored"}
            onChange={() => setContent("tailored")}
            disabled={locked}
            selected={content === "tailored"}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {t("content.tailored")}
                <Badge variant={content === "tailored" ? "outline" : "signal"}>
                  <SparklesIcon aria-hidden="true" />
                  {t("content.aiBadge")}
                </Badge>
              </span>
            }
            description={t("content.tailoredHint", { count: TAILORED_PROJECTS })}
          />
        </div>
        {content === "tailored" ? (
          <>
            <TailoringSource
              jobPosts={posts}
              value={source}
              onChange={changeSource}
              ai={liveAi}
              disabled={locked}
            />
            {canUseKeywords && !proposal ? (
              <p className="text-[0.8125rem] text-muted-foreground">
                {t("tailoring.keywordsHint")}
              </p>
            ) : null}
          </>
        ) : job ? (
          <p className="flex gap-2.5 rounded-md border border-info/30 bg-info-soft px-4 py-3 text-sm/relaxed">
            <BriefcaseBusinessIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-info"
            />
            <span>{t("content.forJob", { title: job.title })}</span>
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t("language")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOCALES.map((option) => (
            <ChoiceCard
              key={option}
              value={option}
              selected={locale === option}
              title={tLanguages(option)}
              description={t(`languageHint.${option}`)}
              disabled={locked}
              {...localeField}
            />
          ))}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          {proposal ? t("tailoring.languageLocked") : t("languageNote")}
        </p>
      </fieldset>

      <TextField
        label={t("name")}
        description={t("nameHint")}
        placeholder={t("namePlaceholder")}
        maxLength={CV_NAME_MAX}
        autoComplete="off"
        disabled={busy}
        error={validationMessage(form.formState.errors.name)}
        {...nameField}
      />

      {content === "tailored" && tailoring.busy ? <ReviewSkeleton /> : null}
      {content === "tailored" && tailoring.result && proposal ? (
        <TailoringReview
          proposal={proposal}
          jobTitle={tailoring.jobTitle ?? ""}
          cvLocale={locale}
          fake={ai.fake}
          title={title}
          onTitleChange={setTitle}
          disabled={busy}
          headingRef={reviewHeading}
        />
      ) : null}

      {message ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        {tailoring.busy ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium">
            <Spinner />
            {t(`tailoring.${tailoring.status === "idle" ? "choosing" : tailoring.status}`)}
          </p>
        ) : proposal ? null : (
          <p className="flex max-w-xs items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <LayersIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t("independent")}
          </p>
        )}
        {/* On phones the secondary actions sit side by side, the main one full width below. */}
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
          {secondaryActions.length > 0 ? (
            <div className={cn("grid gap-2 sm:flex", secondaryActions.length > 1 && "grid-cols-2")}>
              {secondaryActions}
            </div>
          ) : null}
          {primaryAction}
        </div>
      </div>
    </form>
  );
}
