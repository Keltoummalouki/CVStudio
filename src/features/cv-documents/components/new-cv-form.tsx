"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, BriefcaseBusinessIcon, InfoIcon, LayersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DocumentGlyph } from "@/components/feedback/document-glyph";
import { ChoiceCard } from "@/components/forms/choice-card";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { TemplateChoice } from "@/features/cv-templates/server/queries";
import type { JobPostChoice } from "@/features/job-posts/server/queries";
import type { ActionErrorCode } from "@/lib/actions/result";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/config";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { CV_NAME_MAX, createCvSchema, type CreateCvValues } from "../schemas";
import { createCv } from "../server/actions";

/** "" stands for the built-in Classic template: every active entry of the career data. */
const CLASSIC = "";

type NewCvFormProps = {
  defaultLocale: Locale;
  templates: readonly TemplateChoice[];
  /** Preselected from the templates page ("Use template"). */
  initialTemplateId: string | null;
  /** The job post this CV is made for (its page links here): names it and picks its language. */
  job?: JobPostChoice | null;
};

/** "Frontend developer – Acme", within the name limit. */
function nameForJob(job: JobPostChoice): string {
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

export function NewCvForm({
  defaultLocale,
  templates,
  initialTemplateId,
  job = null,
}: NewCvFormProps) {
  const t = useTranslations("cvs.new");
  const tLanguages = useTranslations("languages");
  const validationMessage = useValidationMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ActionErrorCode | null>(null);

  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? CLASSIC);

  // A job post in English or French sets the CV language; "other" leaves the usual default.
  // Designs hold no text of their own language: they never decide it.
  const jobLocale = job && isLocale(job.language) ? job.language : null;
  const form = useForm<CreateCvValues>({
    resolver: zodResolver(createCvSchema),
    defaultValues: {
      name: job ? nameForJob(job) : "",
      locale: jobLocale ?? defaultLocale,
    },
  });
  const locale = useWatch({ control: form.control, name: "locale" });

  const submit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createCv({ ...values, templateId: templateId || undefined });
        if (result.ok) {
          router.push(`/dashboard/cvs/${result.data.id}`);
          return;
        }
        setError(result.error);
      } catch {
        setError("unavailable");
      }
    });
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      {job ? (
        <p className="flex gap-2.5 rounded-md border border-info/30 bg-info-soft px-4 py-3 text-sm/relaxed">
          <BriefcaseBusinessIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          <span>{t("forJob", { title: job.title })}</span>
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t("template.label")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            compact
            name="template"
            value={CLASSIC}
            checked={templateId === CLASSIC}
            onChange={() => setTemplateId(CLASSIC)}
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
        <legend className="mb-3 text-sm font-semibold">{t("language")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOCALES.map((option) => (
            <ChoiceCard
              key={option}
              value={option}
              selected={locale === option}
              title={tLanguages(option)}
              description={t(`languageHint.${option}`)}
              {...form.register("locale")}
            />
          ))}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">{t("languageNote")}</p>
      </fieldset>

      <TextField
        label={t("name")}
        description={t("nameHint")}
        placeholder={t("namePlaceholder")}
        maxLength={CV_NAME_MAX}
        autoComplete="off"
        error={validationMessage(form.formState.errors.name)}
        {...form.register("name")}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {t(`errors.${error}`)}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex max-w-xs items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <LayersIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("independent")}
        </p>
        <Button type="submit" variant="signal" size="lg" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? t("creating") : t("create")}
          {isPending ? null : <ArrowRightIcon aria-hidden="true" />}
        </Button>
      </div>
    </form>
  );
}
