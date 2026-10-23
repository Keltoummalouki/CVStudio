import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguagesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { FitSheet } from "@/features/cv-export/components/fit-sheet";
import { PrintReady } from "@/features/cv-export/components/print-ready";
import { PrintToolbar } from "@/features/cv-export/components/print-toolbar";
import { loadExportableCv } from "@/features/cv-export/server/load-export";
import { CanvasCv } from "@/features/cv-renderer/canvas-v1/canvas-cv";
import { canvasPrintPageCss } from "@/features/cv-renderer/canvas-v1/layout";
import { ClassicCv } from "@/features/cv-renderer/classic-reference-v1/classic-cv";
import { printPageCss } from "@/features/cv-renderer/classic-reference-v1/layout";
import { requireOwner } from "@/lib/auth/session";
import { requireUuid } from "@/lib/data/params";
import { Link } from "@/lib/i18n/navigation";

type Props = {
  params: Promise<{ cvId: string }>;
  searchParams: Promise<{ print?: string | string[] }>;
};

/** One read per request, shared by the metadata and the page. */
const loadForPrint = cache(async (id: string) => loadExportableCv(await requireOwner(), id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cvId } = await params;
  const exportable = await loadForPrint(requireUuid(cvId));
  // The title becomes the default file name in the browser's "Save as PDF".
  return { title: { absolute: exportable?.name ?? "CV" } };
}

/**
 * The CV alone on A4: what the browser prints and what the PDF engine
 * renders, from the same markup and styles as the builder's preview.
 */
export default async function PrintPage({ params, searchParams }: Props) {
  const [{ cvId }, query] = await Promise.all([params, searchParams]);
  const exportable = await loadForPrint(requireUuid(cvId));
  if (!exportable) notFound();

  if (exportable.missingTranslations > 0) {
    const t = await getTranslations("cvExport.blocked");
    const tLanguages = await getTranslations("languages");
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="flex size-10 items-center justify-center rounded-md bg-signal-soft text-signal-hover">
            <LanguagesIcon aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("description", {
              count: exportable.missingTranslations,
              language: tLanguages(exportable.locale),
            })}
          </p>
          <Button asChild>
            <Link href={`/dashboard/cvs/${exportable.id}`}>{t("action")}</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { design } = exportable;
  return (
    <>
      <style href="cvstudio-print-page" precedence="default">
        {design ? canvasPrintPageCss() : printPageCss()}
      </style>
      <PrintToolbar cvId={exportable.id} name={exportable.name} />
      <main className="bg-ink-150 px-4 py-6 print:bg-white print:p-0">
        <FitSheet>
          {design ? (
            <CanvasCv
              design={design}
              definition={exportable.definition}
              cv={exportable.cv}
              labels={exportable.labels}
              photoUrl={exportable.photoUrl}
            />
          ) : (
            <ClassicCv
              cv={exportable.cv}
              labels={exportable.labels}
              photoUrl={exportable.photoUrl}
              className="shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-8px_rgb(0_0_0/0.18)] print:shadow-none"
            />
          )}
        </FitSheet>
      </main>
      <PrintReady autoPrint={query.print === "1"} design={design} cvId={exportable.id} />
    </>
  );
}
