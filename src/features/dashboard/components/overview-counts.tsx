import { ArrowUpRightIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { BUILT_IN_SECTION_COUNT } from "@/config/career-sections";
import { Link } from "@/lib/i18n/navigation";
import type { DashboardOverview } from "../overview";

type CountKey = "careerRecords" | "cvs" | "templates" | "sections";

export function OverviewCounts({ counts }: { counts: DashboardOverview["counts"] }) {
  const t = useTranslations("overview.counts");
  const format = useFormatter();

  const items: { key: CountKey; value: number; href: string }[] = [
    { key: "careerRecords", value: counts.careerRecords, href: "/dashboard/content" },
    { key: "cvs", value: counts.cvs, href: "/dashboard/cvs" },
    { key: "templates", value: counts.templates, href: "/dashboard/templates" },
    { key: "sections", value: BUILT_IN_SECTION_COUNT, href: "/dashboard/content" },
  ];

  return (
    <section aria-label={t("label")}>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-y py-4 sm:grid-cols-4 sm:gap-x-6">
        {items.map((item) => (
          <div
            key={item.key}
            className="group relative flex items-start justify-between gap-3 rounded-md px-1 py-1 pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            <dt className="min-w-0 text-[0.8125rem] font-medium text-muted-foreground">
              <Link
                href={item.href}
                className="rounded-sm transition-colors before:absolute before:inset-0 hover:text-foreground focus-visible:outline-none focus-visible:before:rounded-md focus-visible:before:focus-ring focus-visible:before:outline-offset-4"
              >
                {t(item.key)}
              </Link>
            </dt>
            <dd
              data-numeric
              className="flex shrink-0 items-center gap-2 text-lg leading-tight font-semibold tracking-[-0.02em] tabular-nums"
            >
              {format.number(item.value)}
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-3.5 text-subtle-foreground transition-colors group-focus-within:text-foreground group-hover:text-foreground"
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
