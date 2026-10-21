"use client";

import { useId } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon, LanguagesIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fieldControlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBuilder, type DisplayText } from "./builder-context";

/** Show/hide on the CV. The name stays constant; the pressed state carries the status. */
export function VisibilityToggle({
  visible,
  onChange,
  name,
  className,
}: {
  visible: boolean;
  onChange: (visible: boolean) => void;
  name: string;
  className?: string;
}) {
  const t = useTranslations("cvBuilder");
  const Icon = visible ? EyeIcon : EyeOffIcon;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-pressed={visible}
      aria-label={t("visibility.toggle", { name })}
      title={t(visible ? "visibility.shown" : "visibility.hidden")}
      onClick={() => onChange(!visible)}
      className={cn(!visible && "text-subtle-foreground", className)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

/**
 * A compact on/off option, e.g. "Dates" or one technology. Shown is a solid
 * outline with a check; hidden is dashed and struck through, so the state never
 * relies on colour alone.
 */
export function ToggleChip({
  pressed,
  onChange,
  children,
  label,
  missing = false,
}: {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  children: React.ReactNode;
  /** Accessible name when the visible content is not enough. */
  label?: string;
  missing?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={() => onChange(!pressed)}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-sm border px-2 text-[0.8125rem] transition-colors outline-none focus-visible:focus-ring pointer-coarse:h-10",
        pressed
          ? "border-ink-400 bg-card font-medium text-foreground hover:border-ink-800"
          : "border-dashed border-border-strong bg-transparent text-subtle-foreground line-through decoration-ink-300 hover:border-ink-600 hover:text-muted-foreground",
        missing &&
          pressed &&
          "border-signal/60 bg-signal-soft text-signal-hover hover:border-signal",
      )}
    >
      {pressed ? <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Master text in the CV's language; text borrowed from the other language is marked. */
export function SourceText({
  value,
  fallback,
  className,
}: {
  value: DisplayText;
  fallback?: string;
  className?: string;
}) {
  const t = useTranslations("cvBuilder");
  const tLanguages = useTranslations("languages");
  const { cvLocale } = useBuilder();

  if (!value) return <span className={cn("text-subtle-foreground", className)}>{fallback}</span>;
  return (
    <span className={cn("min-w-0", className)}>
      <span className={cn(value.missing && "text-muted-foreground")}>{value.text}</span>
      {value.missing ? (
        <Badge variant="signal" className="ml-1.5 align-[0.1em]">
          <LanguagesIcon aria-hidden="true" />
          {t("missingIn", { language: tLanguages(cvLocale) })}
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * Per-CV wording in the CV's language. Empty means "use the career data
 * text", which stays the placeholder so the owner sees what they replace.
 */
export function OverrideField({
  label,
  value,
  source,
  onChange,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  source: DisplayText;
  onChange: (text: string) => void;
  multiline?: boolean;
  maxLength: number;
}) {
  const t = useTranslations("cvBuilder.override");
  const tLanguages = useTranslations("languages");
  const { cvLocale } = useBuilder();
  const id = useId();
  const hintId = `${id}-hint`;
  const language = tLanguages(cvLocale);
  const placeholder = source && !source.missing ? source.text : t("missing", { language });
  const Control = multiline ? "textarea" : "input";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[0.8125rem] font-medium">
          {label}
        </label>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <RotateCcwIcon aria-hidden="true" />
            {t("reset")}
          </Button>
        ) : null}
      </div>
      <Control
        id={id}
        lang={cvLocale}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
        rows={multiline ? 3 : undefined}
        className={cn(
          fieldControlClassName,
          multiline
            ? "field-sizing-content min-h-20 px-3 py-2 leading-relaxed"
            : "h-9 px-3 py-1 pointer-coarse:h-11",
        )}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        {source?.missing ? t("hintMissing", { language }) : t("hint", { language })}
      </p>
    </div>
  );
}

/** Small uppercase-free group heading inside an editor panel. */
export function EditorGroup({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3 id={id} className="text-sm font-semibold">
            {title}
          </h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
