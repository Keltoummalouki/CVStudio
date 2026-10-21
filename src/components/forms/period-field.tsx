"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import type { Period } from "@/lib/dates/period";
import { cn } from "@/lib/utils";
import { MonthYearField } from "./month-year-field";

type PeriodFieldProps = {
  value: Period;
  onChange: (value: Period) => void;
  /** Wording of the "still ongoing" checkbox for this kind of record. */
  currentLabel: string;
  startError?: string;
  endError?: string;
  className?: string;
};

export function PeriodField({
  value,
  onChange,
  currentLabel,
  startError,
  endError,
  className,
}: PeriodFieldProps) {
  const t = useTranslations("careerData.period");
  const id = useId();

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <MonthYearField
            legend={t("start")}
            value={{ year: value.startYear, month: value.startMonth }}
            onChange={(next) =>
              onChange({ ...value, startYear: next.year, startMonth: next.month })
            }
            invalid={!!startError}
            describedBy={startError ? `${id}-start-error` : undefined}
          />
          {startError ? (
            <p id={`${id}-start-error`} role="alert" className="text-[0.8125rem] text-destructive">
              {startError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {value.isCurrent ? (
            <div>
              <p className="mb-2 text-sm font-medium">{t("end")}</p>
              <p className="flex h-10 items-center rounded-md border border-dashed border-border-strong px-3 text-sm text-muted-foreground pointer-coarse:h-11">
                {t("present")}
              </p>
            </div>
          ) : (
            <MonthYearField
              legend={t("end")}
              value={{ year: value.endYear, month: value.endMonth }}
              onChange={(next) => onChange({ ...value, endYear: next.year, endMonth: next.month })}
              invalid={!!endError}
              describedBy={endError ? `${id}-end-error` : undefined}
            />
          )}
          {endError ? (
            <p id={`${id}-end-error`} role="alert" className="text-[0.8125rem] text-destructive">
              {endError}
            </p>
          ) : null}
        </div>
      </div>

      <label className="flex w-fit items-center gap-2.5 text-sm">
        <Checkbox
          checked={value.isCurrent}
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              isCurrent: checked === true,
              // An ongoing period has no end; clear it so nothing stale is saved.
              endYear: checked === true ? null : value.endYear,
              endMonth: checked === true ? null : value.endMonth,
            })
          }
        />
        {currentLabel}
      </label>
    </div>
  );
}
