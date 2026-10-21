import { useTranslations } from "next-intl";
import { LOCALES } from "@/lib/i18n/config";
import type { LocaleCoverage as Coverage } from "@/lib/i18n/localized-text";
import { cn } from "@/lib/utils";

/**
 * The EN | FR split as a status: an inked cell means the text exists in that
 * language, an open cell means it is missing. Never colour alone: each cell
 * carries its language code and a spoken status.
 */
export function LocaleCoverage({
  coverage,
  className,
}: {
  coverage: Coverage;
  className?: string;
}) {
  const t = useTranslations("localeSplit");
  const tLanguages = useTranslations("languages");
  const tRecords = useTranslations("careerData.records");

  return (
    <span
      role="group"
      aria-label={tRecords("coverage")}
      className={cn(
        "inline-grid shrink-0 grid-cols-2 overflow-hidden rounded-sm border border-border-strong text-[0.6875rem] leading-none font-semibold tracking-[0.04em]",
        className,
      )}
    >
      {LOCALES.map((locale, index) => (
        <span
          key={locale}
          className={cn(
            "flex h-5 min-w-7 items-center justify-center px-1.5",
            index > 0 && "border-l border-border-strong",
            coverage[locale] ? "bg-ink-950 text-paper" : "bg-card text-subtle-foreground",
          )}
        >
          <span aria-hidden="true">{locale.toUpperCase()}</span>
          <span className="sr-only">
            {t(coverage[locale] ? "complete" : "missing", { language: tLanguages(locale) })}
          </span>
        </span>
      ))}
    </span>
  );
}
