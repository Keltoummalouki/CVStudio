"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TextareaFieldProps = React.ComponentProps<typeof Textarea> & {
  label: string;
  /** Already-translated message. */
  error?: string;
  description?: string;
  optional?: boolean;
  containerClassName?: string;
};

/** The multi-line counterpart of TextField, for single-language values. */
export function TextareaField({
  label,
  error,
  description,
  optional = false,
  containerClassName,
  ...textareaProps
}: TextareaFieldProps) {
  const t = useTranslations("careerData.editor");
  const id = useId();
  const describedBy =
    [description ? `${id}-description` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div
      className={cn("min-w-0 space-y-1.5", containerClassName)}
      data-invalid={error ? true : undefined}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? (
          <span className="ml-1.5 text-[0.8125rem] font-normal text-subtle-foreground">
            {t("optional")}
          </span>
        ) : null}
      </label>
      <Textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...textareaProps}
      />
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
    </div>
  );
}
