"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, CheckIcon, LayersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextField } from "@/components/forms/text-field";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionErrorCode } from "@/lib/actions/result";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { CV_NAME_MAX, createCvSchema, type CreateCvValues } from "../schemas";
import { createCv } from "../server/actions";

export function NewCvForm({ defaultLocale }: { defaultLocale: Locale }) {
  const t = useTranslations("cvs.new");
  const tLanguages = useTranslations("languages");
  const validationMessage = useValidationMessage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ActionErrorCode | null>(null);

  const form = useForm<CreateCvValues>({
    resolver: zodResolver(createCvSchema),
    defaultValues: { name: "", locale: defaultLocale },
  });
  const locale = useWatch({ control: form.control, name: "locale" });

  const submit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createCv(values);
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

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t("language")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOCALES.map((option) => (
            <label
              key={option}
              className={cn(
                "relative flex cursor-pointer items-start gap-3 rounded-lg border p-5 transition-colors has-focus-visible:focus-ring",
                locale === option
                  ? "border-ink-950 bg-ink-950 text-paper"
                  : "border-border-strong bg-card hover:border-ink-600 hover:bg-ink-50",
              )}
            >
              <input
                type="radio"
                value={option}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                {...form.register("locale")}
              />
              <span className="flex flex-1 flex-col gap-2">
                <span className="text-lg font-semibold tracking-[-0.02em]">
                  {tLanguages(option)}
                </span>
                <span
                  className={cn(
                    "text-[0.8125rem] leading-relaxed",
                    locale === option ? "text-paper/75" : "text-muted-foreground",
                  )}
                >
                  {t(`languageHint.${option}`)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  locale === option ? "border-paper bg-paper text-ink-950" : "border-input",
                )}
              >
                {locale === option ? <CheckIcon className="size-3.5" /> : null}
              </span>
            </label>
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
