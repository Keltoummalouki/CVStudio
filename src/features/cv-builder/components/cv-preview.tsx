"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScanIcon, ZoomInIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ClassicCv, PAGE_MARGINS_MM } from "@/features/cv-renderer/classic-reference-v1/classic-cv";
import { cn } from "@/lib/utils";
import type { CvLabels } from "../labels";
import type { ResolvedCv } from "../resolve";

const MM = 96 / 25.4;
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
// Print margins of the renderer, used to estimate where each page ends.
const FIRST_TOP = PAGE_MARGINS_MM.firstTop * MM;
const MARGIN_TOP = PAGE_MARGINS_MM.top * MM;
const MARGIN_BOTTOM = PAGE_MARGINS_MM.bottom * MM;
const FIRST_PAGE_CONTENT = PAGE_HEIGHT - FIRST_TOP - MARGIN_BOTTOM;
const PAGE_CONTENT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Live A4 preview: the real document markup at its physical size, scaled to
 * the available width. Page boundaries are estimated from the print margins;
 * the print dialog and PDF remain the reference for exact breaks.
 */
export function CvPreview({
  cv,
  labels,
  photoUrl,
  selectedNodeId,
  onSelectSection,
  className,
}: {
  cv: ResolvedCv;
  labels: CvLabels;
  photoUrl: string | null;
  selectedNodeId: string | null;
  onSelectSection?: (nodeId: string) => void;
  className?: string;
}) {
  const t = useTranslations("cvBuilder.preview");
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  const scale = zoom === "actual" ? 1 : fitScale;
  const [height, setHeight] = useState(PAGE_HEIGHT);

  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current;
    const sheet = sheetRef.current;
    if (!frame || !sheet) return;
    const measure = () => {
      const available = frame.clientWidth;
      if (available > 0) setFitScale(Math.min(1, available / PAGE_WIDTH));
      setHeight(Math.max(PAGE_HEIGHT, sheet.offsetHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.querySelector("[data-selected]")?.removeAttribute("data-selected");
    if (selectedNodeId) {
      sheet
        .querySelector(`[data-node-id="${CSS.escape(selectedNodeId)}"]`)
        ?.setAttribute("data-selected", "");
    }
  }, [selectedNodeId, cv]);

  // The continuous sheet only has the first page's top margin: page 1 holds
  // FIRST_PAGE_CONTENT, every later page PAGE_CONTENT.
  const content = height - FIRST_TOP - MARGIN_BOTTOM;
  const pages =
    content <= FIRST_PAGE_CONTENT + 1
      ? 1
      : 1 + Math.ceil((content - FIRST_PAGE_CONTENT - 1) / PAGE_CONTENT);
  const breaks = Array.from(
    { length: pages - 1 },
    (_, index) => FIRST_TOP + FIRST_PAGE_CONTENT + index * PAGE_CONTENT,
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{t("live")}</h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t("pages", { count: pages })}
          </p>
        </div>
        <div
          role="group"
          aria-label={t("zoom")}
          className="flex items-center gap-0.5 rounded-md bg-card p-1"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={zoom === "fit"}
            title={t("fit")}
            onClick={() => setZoom("fit")}
            className="aria-pressed:bg-ink-950 aria-pressed:text-paper"
          >
            <ScanIcon aria-hidden="true" />
            {t("fit")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={zoom === "actual"}
            aria-label={t("actualSize")}
            onClick={() => setZoom("actual")}
            className="tabular-nums aria-pressed:bg-ink-950 aria-pressed:text-paper"
          >
            <ZoomInIcon aria-hidden="true" />
            100%
          </Button>
        </div>
      </div>
      <div
        ref={frameRef}
        className="w-full min-w-0 overflow-x-auto pb-4"
        tabIndex={zoom === "actual" ? 0 : undefined}
        role="region"
        aria-label={t("canvas")}
      >
        <div
          className="relative mx-auto overflow-hidden bg-white shadow-[0_12px_32px_-12px_rgb(0_0_0/0.2)]"
          style={{ width: PAGE_WIDTH * scale, height: height * scale }}
        >
          {/* Pointer shortcut only: the outline offers the same selection to keyboards and screen readers. */}
          <div
            ref={sheetRef}
            onClick={(event) => {
              const node = (event.target as Element).closest("[data-node-id]");
              const nodeId = node?.getAttribute("data-node-id");
              if (nodeId) onSelectSection?.(nodeId);
            }}
            className={cn(
              "absolute top-0 left-0 origin-top-left",
              onSelectSection && "[&_[data-node-id]]:cursor-pointer",
              "[&_[data-selected]]:outline-2 [&_[data-selected]]:outline-offset-[2mm] [&_[data-selected]]:outline-signal [&_[data-selected]]:outline-dashed",
            )}
            style={{ transform: `scale(${scale})`, width: PAGE_WIDTH }}
          >
            <ClassicCv cv={cv} labels={labels} photoUrl={photoUrl} />
          </div>
          {breaks.map((top, index) => (
            <div
              key={top}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-signal/70"
              style={{ top: top * scale }}
            >
              <span className="absolute top-0 right-1 -translate-y-1/2 rounded-sm bg-signal px-1 text-[0.625rem] leading-4 font-semibold text-signal-foreground">
                {t("pageBreak", { number: index + 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
