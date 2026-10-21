"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, InfoIcon, LayersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChoiceCard } from "@/components/forms/choice-card";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { TemplateChoice } from "@/features/cv-templates/server/queries";
import type { ActionErrorCode } from "@/lib/actions/result";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { CV_NAME_MAX, createCvSchema, type CreateCvValues } from "../schemas";
import { createCv } from "../server/actions";

/** "" stands for "all career data" in the start choice. */
const CAREER_DATA = "";

type NewCvFormProps = {
  defaultLocale: Locale;
  templates: readonly TemplateChoice[];
  /** Preselected from the templates page ("Use template"). */
  initialTemplateId: string | null;
};

export function NewCvForm({ defaultLocale, templates, initialTemplateId }: NewCvFormProps) {
  const t = useTranslations("cvs.new");
  const tLanguages = useTranslations("languages");
  const validationMessage = useValidationMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ActionErrorCode | null>(null);

  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [start, setStart] = useState(initialTemplate?.id ?? CAREER_DATA);

  const form = useForm<CreateCvValues>({
    resolver: zodResolver(createCvSchema),
    defaultValues: { name: "", locale: initialTemplate?.locale ?? defaultLocale },
  });
  const locale = useWatch({ control: form.control, name: "locale" });

  const chooseStart = (value: string) => {
    setStart(value);
    // A template was saved in one language: start the CV in it (still changeable below).
    const template = templates.find((candidate) => candidate.id === value);
    if (template) form.setValue("locale", template.locale);
  };

  const submit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createCv({ ...values, templateId: start || undefined });
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
      <TextField
        label={t("name")}
        description={t("nameHint")}
        placeholder={t("namePlaceholder")}
        maxLength={CV_NAME_MAX}
        autoComplete="off"
        autoFocus
        error={validationMessage(form.formState.errors.name)}
        {...form.register("name")}
      />

      {templates.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">{t("startFrom.label")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              compact
              name="start"
              value={CAREER_DATA}
              checked={start === CAREER_DATA}
              onChange={() => chooseStart(CAREER_DATA)}
              selected={start === CAREER_DATA}
              title={t("startFrom.careerData")}
              description={t("startFrom.careerDataHint")}
            />
            {templates.map((template) => (
              <ChoiceCard
                key={template.id}
                compact
                name="start"
                value={template.id}
                checked={start === template.id}
                onChange={() => chooseStart(template.id)}
                selected={start === template.id}
                title={template.name}
                description={template.description || t("startFrom.templateHint")}
                meta={
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      start === template.id ? "text-paper/75" : "text-muted-foreground",
                    )}
                  >
                    {t("startFrom.templateLanguage", { language: tLanguages(template.locale) })}
                  </span>
                }
              />
            ))}
          </div>
          {start !== CAREER_DATA ? (
            <p className="flex gap-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("startFrom.templateNote")}
            </p>
          ) : null}
        </fieldset>
      ) : null}

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
