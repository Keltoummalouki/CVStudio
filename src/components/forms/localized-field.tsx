"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { LocaleCoverage } from "@/components/feedback/locale-coverage";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import {
  getLocaleCoverage,
  isSharedText,
  type LocalizedTextValue,
} from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";

type LocalizedFieldProps = {
  label: string;
  value: LocalizedTextValue;
  onChange: (value: LocalizedTextValue) => void;
  onBlur?: () => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  /** Offer "Same in both languages" (default on). */
  allowShared?: boolean;
  description?: string;
  /** Already-translated message. */
  error?: string;
  /** Keep the label for assistive technology only (dense list rows). */
  hideLabel?: boolean;
  className?: string;
  /** Attached to the first input so forms can focus it (new rows, first error). */
  inputRef?: React.Ref<HTMLInputElement & HTMLTextAreaElement>;
};

const LANGUAGE_CODES: Record<Locale | "shared", string> = { en: "EN", fr: "FR", shared: "EN · FR" };

/**
 * One field, two languages. Inputs sit side by side from `sm` so a translation
 * can be written while reading the original; each input carries its `lang`
 * so browsers spell-check in the right language. Switching to "same in both
 * languages" and back never loses text.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  onBlur,
  multiline = false,
  rows = 3,
  required = false,
  allowShared = true,
  description,
  error,
  hideLabel = false,
  className,
  inputRef,
}: LocalizedFieldProps) {
  const t = useTranslations("careerData.localized");
  const tEditor = useTranslations("careerData.editor");
  const tLanguages = useTranslations("languages");
  const id = useId();
  const shared = isSharedText(value);
  const describedBy =
    [description ? `${id}-description` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  function toggleShared(next: boolean) {
    if (next) {
      onChange({ shared: value.en ?? value.fr ?? "" });
    } else {
      const text = value.shared ?? "";
      onChange({ en: text, fr: text });
    }
  }

  function renderControl(slot: Locale | "shared", first: boolean) {
    const Control = multiline ? Textarea : Input;
    const text = slot === "shared" ? (value.shared ?? "") : (value[slot] ?? "");
    const languageName = slot === "shared" ? t("bothLanguages") : tLanguages(slot);

    return (
      <div key={slot} className="relative min-w-0">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-2.5 text-[0.6875rem] font-semibold tracking-[0.04em] text-subtle-foreground",
            multiline ? "top-2.5" : "top-1/2 -translate-y-1/2",
          )}
        >
          {LANGUAGE_CODES[slot]}
        </span>
        <Control
          ref={first ? inputRef : undefined}
          lang={slot === "shared" ? undefined : slot}
          aria-label={`${label} (${languageName})`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={text}
          rows={multiline ? rows : undefined}
          onBlur={onBlur}
          onChange={(event) =>
            onChange(
              slot === "shared"
                ? { shared: event.target.value }
                : { ...value, [slot]: event.target.value },
            )
          }
          className={cn(slot === "shared" ? "pl-16" : "pl-9", multiline && "min-h-0")}
        />
      </div>
    );
  }

  return (
    <fieldset
      className={cn("min-w-0 space-y-2", className)}
      data-invalid={error ? true : undefined}
    >
      <legend
        // sr-only must never be combined with layout classes: a full-width
        // "hidden" legend still occupies space and causes horizontal scroll.
        className={hideLabel ? "sr-only" : "mb-1.5 flex w-full items-center justify-between gap-3"}
      >
        <span className="text-sm font-medium">
          {label}
          {required ? null : (
            <span className="ml-1.5 text-[0.8125rem] font-normal text-subtle-foreground">
              {tEditor("optional")}
            </span>
          )}
        </span>
        {hideLabel ? null : <LocaleCoverage coverage={getLocaleCoverage(value)} />}
      </legend>

      {shared ? (
        renderControl("shared", true)
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {LOCALES.map((locale, index) => renderControl(locale, index === 0))}
        </div>
      )}

      {allowShared ? (
        <label className="flex w-fit items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <Switch
            checked={shared}
            onCheckedChange={toggleShared}
            aria-describedby={`${id}-shared-hint`}
            size="sm"
          />
          <span>{t("same")}</span>
          <span id={`${id}-shared-hint`} className="sr-only">
            {t("sameHint")}
          </span>
        </label>
      ) : null}

      {description ? (
        <p id={`${id}-description`} className="text-[0.8125rem] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
