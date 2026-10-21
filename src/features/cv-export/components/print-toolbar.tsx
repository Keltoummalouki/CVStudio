"use client";

import { ArrowLeftIcon, DownloadIcon, InfoIcon, PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/lib/i18n/navigation";
import { useCvExport } from "./use-cv-export";

/** Screen-only bar above the printable sheet; never part of the printout. */
export function PrintToolbar({ cvId, name }: { cvId: string; name: string }) {
  const t = useTranslations("cvExport");
  const { downloadPdf, downloading } = useCvExport();

  return (
    <div className="sticky top-0 z-10 border-b bg-card print:hidden">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard/cvs/${cvId}`}>
            <ArrowLeftIcon aria-hidden="true" />
            {t("backToEditor")}
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <PrinterIcon aria-hidden="true" />
            {t("print")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={downloading}
            onClick={() => void downloadPdf(cvId, name)}
          >
            {downloading ? <Spinner /> : <DownloadIcon aria-hidden="true" />}
            {downloading ? t("preparing") : t("download")}
          </Button>
        </div>
      </div>
      <p className="mx-auto flex max-w-[210mm] items-start gap-2 px-4 pb-3 text-xs text-muted-foreground">
        <InfoIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        {t("printHint")}
      </p>
    </div>
  );
}
