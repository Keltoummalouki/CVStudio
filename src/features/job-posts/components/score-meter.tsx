import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** The estimated coverage as a number and a bar; the number is what screen readers hear. */
export function ScoreMeter({ score, className }: { score: number | null; className?: string }) {
  const t = useTranslations("jobs.match");

  if (score === null) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{t("noScore")}</span>;
  }
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        className="w-14 shrink-0 text-right text-xl font-semibold tracking-[-0.02em]"
        data-numeric
        aria-hidden="true"
      >
        {t("score", { score })}
      </span>
      <span
        aria-hidden="true"
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-ink-100"
      >
        <span className="block h-full rounded-full bg-ink-950" style={{ width: `${score}%` }} />
      </span>
      <span className="sr-only">{t("scoreLabel", { score })}</span>
    </div>
  );
}
