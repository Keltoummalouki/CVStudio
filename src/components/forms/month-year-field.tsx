"use client";

import { useId, useMemo } from "react";
import { ChevronDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { fieldControlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Calendar value without a day or time: month is null for year-only precision.
 * Stored as plain numbers, so it can never shift across time zones.
 */
export type MonthYearValue = {
  year: number | null;
  month: number | null;
};

export const EMPTY_MONTH_YEAR: MonthYearValue = { year: null, month: null };

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Localized month names, computed in UTC so no local offset can change the month. */
export function getMonthNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  return MONTHS.map((month) => {
    const name = formatter.format(new Date(Date.UTC(2000, month - 1, 1)));
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  });
}

export function getYearOptions(minYear: number, maxYear: number): number[] {
  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) years.push(year);
  return years;
}

type MonthYearFieldProps = {
  value: MonthYearValue;
  onChange: (value: MonthYearValue) => void;
  /** Visible group label, e.g. "Start date". */
  legend: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

const selectClassName = cn(
  fieldControlClassName,
  "h-10 appearance-none pr-8 pl-3 disabled:opacity-100 pointer-coarse:h-11",
);

export function MonthYearField({
  value,
  onChange,
  legend,
  minYear = 1950,
  maxYear = new Date().getUTCFullYear() + 5,
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: MonthYearFieldProps) {
  const t = useTranslations("dateField");
  const locale = useLocale();
  const id = useId();
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const years = useMemo(() => getYearOptions(minYear, maxYear), [minYear, maxYear]);

  function handleYearChange(raw: string) {
    const year = raw === "" ? null : Number(raw);
    // A month without a year is meaningless (and rejected by the database).
    onChange({ year, month: year === null ? null : value.month });
  }

  function handleMonthChange(raw: string) {
    onChange({ year: value.year, month: raw === "" ? null : Number(raw) });
  }

  return (
    <fieldset className={cn("min-w-0", className)} aria-describedby={describedBy}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <div className="relative">
          <label htmlFor={`${id}-month`} className="sr-only">
            {t("month")}
          </label>
          <select
            id={`${id}-month`}
            className={selectClassName}
            value={value.month ?? ""}
            onChange={(event) => handleMonthChange(event.target.value)}
            disabled={disabled || value.year === null}
            aria-invalid={invalid || undefined}
          >
            <option value="">{t("noMonth")}</option>
            {monthNames.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        <div className="relative">
          <label htmlFor={`${id}-year`} className="sr-only">
            {t("year")}
          </label>
          <select
            id={`${id}-year`}
            className={cn(selectClassName, "tabular-nums")}
            value={value.year ?? ""}
            onChange={(event) => handleYearChange(event.target.value)}
            disabled={disabled}
            aria-invalid={invalid || undefined}
          >
            <option value="">{t("noYear")}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>
    </fieldset>
  );
}
