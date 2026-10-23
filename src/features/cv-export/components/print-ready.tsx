"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { measureLayout } from "@/features/cv-design/components/measure-layout";
import type { Design } from "@/features/cv-design/design";
import { layoutIssues } from "@/features/cv-design/layout";
import { Link } from "@/lib/i18n/navigation";
import { LAYOUT_ISSUES_ATTRIBUTE, PRINT_READY_ATTRIBUTE } from "@/lib/page-markers";

type PrintReadyProps = {
  autoPrint?: boolean;
  /** A CV's free-form design, checked once laid out: text cut off blocks printing. */
  design?: Design | null;
  cvId: string;
};

/**
 * Marks the print page ready once fonts and the portrait have loaded, so the
 * PDF engine never captures fallback fonts or a missing photo. A free-form
 * design is checked first: text it cuts off, pushes off the page or overlaps
 * is reported to the PDF engine, which then refuses to print, and shown here.
 * With `autoPrint` and nothing to fix, then opens the browser's print dialog.
 */
export function PrintReady({ autoPrint = false, design = null, cvId }: PrintReadyProps) {
  const t = useTranslations("cvExport.layout");
  const [issues, setIssues] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const root = document.documentElement;

    void (async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images, (image) =>
          image.complete ? null : image.decode().catch(() => null),
        ),
      );
      if (cancelled) return;
      const found = design ? layoutIssues(design, measureLayout(document)).length : 0;
      if (found > 0) root.setAttribute(LAYOUT_ISSUES_ATTRIBUTE, String(found));
      setIssues(found);
      root.setAttribute(PRINT_READY_ATTRIBUTE, "true");
      if (autoPrint && found === 0) window.print();
    })();

    return () => {
      cancelled = true;
      root.removeAttribute(PRINT_READY_ATTRIBUTE);
      root.removeAttribute(LAYOUT_ISSUES_ATTRIBUTE);
    };
  }, [autoPrint, design]);

  if (issues === 0) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-lg border border-destructive/30 bg-card p-4 shadow-lg sm:flex-row sm:items-center print:hidden"
    >
      <p className="min-w-0 flex-1 text-sm">{t("description", { count: issues })}</p>
      <Button asChild size="sm">
        <Link href={`/dashboard/cvs/${cvId}`}>{t("action")}</Link>
      </Button>
    </div>
  );
}
