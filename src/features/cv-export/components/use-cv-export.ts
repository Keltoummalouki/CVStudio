"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { PRINT_PATH } from "@/lib/auth/routes";
import { isPdfErrorCode, type PdfErrorCode } from "../errors";
import { fileNameFromDisposition, pdfFileName } from "../file-name";

type Prepare = () => Promise<boolean>;

export type DownloadResult = { ok: true } | { ok: false; error: PdfErrorCode };

/**
 * Print and PDF download of a saved CV. `prepare` runs first (the builder
 * uses it to save pending edits); returning false cancels quietly.
 */
export function useCvExport() {
  const t = useTranslations("cvExport");
  const locale = useLocale();
  const [downloading, setDownloading] = useState(false);

  const openPrint = useCallback(
    (cvId: string, prepare?: Prepare) => {
      // Opened synchronously inside the click, so pop-up blockers allow it.
      const tab = window.open("", "_blank");
      if (!tab) {
        toast.error(t("popupBlocked"));
        return;
      }
      tab.opener = null;
      void (async () => {
        if (prepare && !(await prepare())) {
          tab.close();
          return;
        }
        tab.location.href = `/${locale}${PRINT_PATH}/${cvId}?print=1`;
      })();
    },
    [locale, t],
  );

  const downloadPdf = useCallback(
    async (cvId: string, name: string, prepare?: Prepare): Promise<DownloadResult> => {
      setDownloading(true);
      try {
        if (prepare && !(await prepare())) return { ok: false, error: "unavailable" };
        const response = await fetch(`/api/cvs/${cvId}/pdf`, { cache: "no-store" });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const record = (body ?? {}) as { error?: unknown; count?: unknown };
          const error = isPdfErrorCode(record.error) ? record.error : "unavailable";
          toast.error(
            t(`errors.${error}`, { count: typeof record.count === "number" ? record.count : 0 }),
          );
          return { ok: false, error };
        }

        const blob = await response.blob();
        const fileName =
          fileNameFromDisposition(response.headers.get("Content-Disposition")) ??
          pdfFileName(name).unicode;
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = fileName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
        toast.success(t("downloaded"));
        return { ok: true };
      } catch {
        toast.error(t("errors.unavailable"));
        return { ok: false, error: "unavailable" };
      } finally {
        setDownloading(false);
      }
    },
    [t],
  );

  return { openPrint, downloadPdf, downloading };
}
