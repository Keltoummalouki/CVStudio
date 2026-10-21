/**
 * Calendar periods with optional month precision, formatted without any
 * Date/time-zone arithmetic. Shared by the dashboard and the CV renderer so
 * dates read the same everywhere ("Juin – Août 2025", "Février 2026 – Présent").
 */

export type Period = {
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
};

export const PERIOD_SEPARATOR = " – ";

const monthFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatMonthName(month: number, locale: string): string {
  let formatter = monthFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
    monthFormatters.set(locale, formatter);
  }
  const name = formatter.format(new Date(Date.UTC(2000, month - 1, 1)));
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

export function formatMonthYear(year: number, month: number | null, locale: string): string {
  return month === null ? String(year) : `${formatMonthName(month, locale)} ${year}`;
}

export function formatPeriod(period: Period, locale: string, presentLabel: string): string {
  const { startYear, startMonth, endYear, endMonth, isCurrent } = period;
  const start = startYear === null ? null : formatMonthYear(startYear, startMonth, locale);

  if (isCurrent) {
    return start ? `${start}${PERIOD_SEPARATOR}${presentLabel}` : presentLabel;
  }

  const end = endYear === null ? null : formatMonthYear(endYear, endMonth, locale);
  if (!start || !end) return start ?? end ?? "";

  if (startYear === endYear) {
    if (startMonth !== null && endMonth !== null) {
      if (startMonth === endMonth) return end;
      // Same year: name the year once, as in "June – August 2025".
      return `${formatMonthName(startMonth, locale)}${PERIOD_SEPARATOR}${end}`;
    }
    if (startMonth === null && endMonth === null) return String(endYear);
  }

  return `${start}${PERIOD_SEPARATOR}${end}`;
}
