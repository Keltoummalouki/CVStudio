"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { REQUIREMENT_IMPORTANCE, type RequirementImportance } from "../schemas";

/** Two radio cells, one tap to switch: "Required" or "Nice to have". */
export function ImportanceToggle({
  value,
  onChange,
  onBlur,
  label,
}: {
  value: RequirementImportance;
  onChange: (value: RequirementImportance) => void;
  onBlur?: () => void;
  /** Accessible name of the group, e.g. "Importance of React". */
  label: string;
}) {
  const t = useTranslations("jobs.requirements");
  const name = useId();

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">
        <span aria-hidden="true">{t("importance")}</span>
        <span className="sr-only">{label}</span>
      </legend>
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-input">
        {REQUIREMENT_IMPORTANCE.map((option, index) => (
          <label
            key={option}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center px-3 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-ink-100 hover:text-foreground has-focus-visible:focus-ring has-focus-visible:-outline-offset-2 pointer-coarse:h-11",
              index > 0 && "border-l border-input",
              value === option && "bg-ink-950 text-paper hover:bg-ink-950 hover:text-paper",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              onBlur={onBlur}
              className="sr-only"
            />
            {t(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
