"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pageSlots } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Names the navigation landmark, e.g. "Pages of your CVs". */
  label: string;
  className?: string;
};

/**
 * Previous / page numbers / next for a list split into pages. Phones show
 * "Page 2 of 5" between the arrows instead of the numbers. Renders nothing for
 * a single page.
 */
export function Pagination({ page, pageCount, onPageChange, label, className }: PaginationProps) {
  const t = useTranslations("pagination");
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={label} className={cn("flex items-center justify-between gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        aria-label={t("previousPage")}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon aria-hidden="true" />
        {t("previous")}
      </Button>

      <ul className="hidden items-center gap-1 sm:flex">
        {pageSlots(page, pageCount).map((slot, index) =>
          slot === "gap" ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="flex size-8 items-end justify-center pb-1.5 text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={slot}>
              <Button
                type="button"
                variant={slot === page ? "default" : "ghost"}
                size="icon-sm"
                aria-current={slot === page ? "page" : undefined}
                aria-label={t("page", { page: slot })}
                onClick={() => onPageChange(slot)}
                className="tabular-nums"
              >
                {slot}
              </Button>
            </li>
          ),
        )}
      </ul>
      <p className="text-xs text-muted-foreground tabular-nums sm:hidden">
        {t("pageOf", { page, count: pageCount })}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        aria-label={t("nextPage")}
        onClick={() => onPageChange(page + 1)}
      >
        {t("next")}
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </nav>
  );
}
