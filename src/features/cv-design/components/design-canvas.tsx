"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CvDefinition } from "@/features/cv-builder/definition";
import type { CvLabels } from "@/features/cv-builder/labels";
import type { ResolvedCv, ResolvedSection } from "@/features/cv-builder/resolve";
import { CanvasCv } from "@/features/cv-renderer/canvas-v1/canvas-cv";
import { cn } from "@/lib/utils";
import { PAGE_MM, isDecoration, type Design, type DesignElement } from "../design";
import type { Measured } from "../layout";
import { moveElement, resizeElement, type Rect } from "../operations";
import { HANDLES, SNAP_MM, snapMove, snapResize, type Guide, type Handle } from "../snapping";
import { measureLayout } from "./measure-layout";

const PX_PER_MM = 96 / 25.4;
/** The gap between pages of the canvas renderer (canvas-cv.module.css). */
const PAGE_GAP_MM = 8;
/** Pointer travel (px) before a press becomes a drag, so a click never nudges an element. */
const DRAG_START_PX = 3;
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Drag = {
  id: string;
  mode: "move" | Handle;
  start: { x: number; y: number };
  origin: Rect;
  pxPerMm: number;
  rect: Rect;
  guides: Guide[];
  moved: boolean;
};

const HANDLE_POSITION: Record<Handle, { left: string; top: string; cursor: string }> = {
  nw: { left: "0%", top: "0%", cursor: "nwse-resize" },
  n: { left: "50%", top: "0%", cursor: "ns-resize" },
  ne: { left: "100%", top: "0%", cursor: "nesw-resize" },
  e: { left: "100%", top: "50%", cursor: "ew-resize" },
  se: { left: "100%", top: "100%", cursor: "nwse-resize" },
  s: { left: "50%", top: "100%", cursor: "ns-resize" },
  sw: { left: "0%", top: "100%", cursor: "nesw-resize" },
  w: { left: "0%", top: "50%", cursor: "ew-resize" },
};

type DesignCanvasProps = {
  design: Design;
  definition: CvDefinition;
  sections: Map<string, ResolvedSection>;
  cv: ResolvedCv;
  labels: CvLabels;
  photoUrl: string | null;
  measured: Measured;
  /** Elements with a layout issue, outlined in red. */
  flagged: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Applies one change to the design: one undo step. */
  onChange: (change: (design: Design) => Design) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMeasure: (measured: Measured) => void;
  /** Says what happened, for screen readers. */
  announce: (message: string) => void;
  label: (element: DesignElement) => string;
  placeholder: (element: DesignElement) => string;
};

/**
 * The designer's page: the real rendering underneath, and on top one frame
 * per element to select, drag, resize and nudge it with the keyboard. Edges
 * snap to the page and to the other elements; Alt drags freely.
 */
export function DesignCanvas({
  design,
  definition,
  sections,
  cv,
  labels,
  photoUrl,
  measured,
  flagged,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
  onMeasure,
  announce,
  label,
  placeholder,
}: DesignCanvasProps) {
  const t = useTranslations("designer.canvas");
  const keysId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frameRefs = useRef(new Map<string, HTMLDivElement>());
  const [zoom, setZoom] = useState(0.6);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const latest = useRef({ design, measured });
  const lastMeasure = useRef("");

  useEffect(() => {
    latest.current = { design, measured };
  }, [design, measured]);

  // Fit the page to the available width; never larger than its real size.
  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const available = frame.clientWidth - 48;
      if (available > 0) setZoom(Math.min(1, available / (PAGE_MM.width * PX_PER_MM)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const shown =
    drag?.moved === true
      ? drag.mode === "move"
        ? moveElement(design, drag.id, drag.rect.x, drag.rect.y)
        : resizeElement(design, drag.id, drag.rect)
      : design;

  // Measure what the browser drew: grown heights and clipped text.
  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const result = measureLayout(stage);
      const key = JSON.stringify(result);
      if (key !== lastMeasure.current) {
        lastMeasure.current = key;
        onMeasure(result);
      }
    };
    measure();
    // Webfonts change text metrics once they arrive.
    void document.fonts?.ready.then(measure);
  });

  const othersOnPage = useCallback((id: string, page: number): Rect[] => {
    const { design: current, measured: sizes } = latest.current;
    return current.elements
      .filter((element) => element.id !== id && element.page === page)
      .map((element) => ({
        x: element.x,
        y: element.y,
        w: element.w,
        h: sizes[element.id]?.h ?? element.h,
      }));
  }, []);

  const finish = useCallback(
    (commit: boolean) => {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!commit || !current?.moved) return;
      const { id, rect, mode } = current;
      onChange((draft) =>
        mode === "move" ? moveElement(draft, id, rect.x, rect.y) : resizeElement(draft, id, rect),
      );
    },
    [onChange],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dxPx = event.clientX - current.start.x;
      const dyPx = event.clientY - current.start.y;
      if (!current.moved && Math.hypot(dxPx, dyPx) < DRAG_START_PX) return;
      const dx = dxPx / current.pxPerMm;
      const dy = dyPx / current.pxPerMm;
      const element = latest.current.design.elements.find((item) => item.id === current.id);
      if (!element) return;
      const others = event.altKey ? [] : othersOnPage(current.id, element.page);
      const threshold = event.altKey ? 0 : SNAP_MM;
      let next: Drag;
      if (current.mode === "move") {
        const moved = { ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy };
        const snapped = event.altKey
          ? { x: moved.x, y: moved.y, guides: [] }
          : snapMove(moved, others, threshold);
        next = {
          ...current,
          moved: true,
          rect: { ...moved, x: snapped.x, y: snapped.y },
          guides: snapped.guides,
        };
      } else {
        const resized = snapResize(current.origin, current.mode, dx, dy, others, threshold);
        next = { ...current, moved: true, rect: resized.rect, guides: resized.guides };
      }
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [finish, othersOnPage]);

  const begin = (event: React.PointerEvent, element: DesignElement, mode: "move" | Handle) => {
    if (event.button !== 0) return;
    // No text selection or native drag while moving a box.
    event.preventDefault();
    event.stopPropagation();
    onSelect(element.id);
    frameRefs.current.get(element.id)?.focus({ preventScroll: true });
    const page = pageRefs.current[element.page];
    if (!page) return;
    const origin = {
      x: element.x,
      y: element.y,
      w: element.w,
      h: measured[element.id]?.h ?? element.h,
    };
    dragRef.current = {
      id: element.id,
      mode,
      start: { x: event.clientX, y: event.clientY },
      origin,
      pxPerMm: page.getBoundingClientRect().width / PAGE_MM.width,
      rect: origin,
      guides: [],
      moved: false,
    };
  };

  const onKeyDown = (event: React.KeyboardEvent, element: DesignElement) => {
    const name = label(element);
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const [dx, dy] = arrow;
      if (event.ctrlKey || event.metaKey) {
        const rect = {
          x: element.x,
          y: element.y,
          w: element.w + dx * step,
          h: element.h + dy * step,
        };
        const next = resizeElement(design, element.id, rect).elements.find(
          (item) => item.id === element.id,
        );
        onChange((draft) => resizeElement(draft, element.id, rect));
        if (next) announce(t("resized", { name, w: next.w, h: next.h }));
      } else {
        const x = element.x + dx * step;
        const y = element.y + dy * step;
        const next = moveElement(design, element.id, x, y).elements.find(
          (item) => item.id === element.id,
        );
        onChange((draft) => moveElement(draft, element.id, x, y));
        if (next) announce(t("moved", { name, x: next.x, y: next.y }));
      }
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(element.id);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      onDuplicate(element.id);
      return;
    }
    if (event.key === "Escape") {
      onSelect(null);
      if (event.currentTarget instanceof HTMLElement) event.currentTarget.blur();
    }
  };

  const pages = Array.from({ length: design.pages }, (_, page) => page);
  // Frames of text first, in reading order, so Tab follows the reading order;
  // decorations after, but drawn below the text frames.
  const frames = [
    ...shown.elements.filter((element) => !isDecoration(element.content)),
    ...shown.elements.filter((element) => isDecoration(element.content)),
  ];
  const handleSize = 10 / zoom;
  const line = 1 / zoom;

  return (
    <div
      ref={frameRef}
      role="region"
      aria-label={t("label")}
      className="relative min-h-0 flex-1 overflow-auto bg-ink-100 p-6"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
    >
      <p id={keysId} className="sr-only">
        {t("keys")}
      </p>
      <div className="mx-auto w-fit" style={{ zoom }}>
        <div ref={stageRef} className="relative">
          <div inert className="shadow-[0_10px_30px_oklch(0.175_0.006_265/0.12)]">
            <CanvasCv
              design={shown}
              definition={definition}
              sections={sections}
              cv={cv}
              labels={labels}
              photoUrl={photoUrl}
              placeholder={placeholder}
            />
          </div>
          {pages.map((page) => (
            <div
              key={page}
              ref={(node) => {
                pageRefs.current[page] = node;
              }}
              role="group"
              aria-label={t("page", { number: page + 1 })}
              className="absolute left-0"
              style={{
                top: `${page * (PAGE_MM.height + PAGE_GAP_MM)}mm`,
                width: `${PAGE_MM.width}mm`,
                height: `${PAGE_MM.height}mm`,
              }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) onSelect(null);
              }}
            >
              {page === 0 && design.elements.length === 0 ? (
                <p
                  className="pointer-events-none absolute inset-x-[20mm] top-[40mm] text-center text-muted-foreground"
                  style={{ fontSize: `${14 / zoom}px` }}
                >
                  {t("emptyPage")}
                </p>
              ) : null}
              {drag?.moved
                ? drag.guides.map((guide, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className="pointer-events-none absolute z-30 bg-signal"
                      style={
                        guide.axis === "x"
                          ? { left: `${guide.at}mm`, top: 0, bottom: 0, width: line }
                          : { top: `${guide.at}mm`, left: 0, right: 0, height: line }
                      }
                    />
                  ))
                : null}
              {frames
                .filter((element) => element.page === page)
                .map((element) => {
                  const selected = element.id === selectedId;
                  const decoration = isDecoration(element.content);
                  const rect =
                    drag?.moved && drag.id === element.id
                      ? drag.rect
                      : {
                          x: element.x,
                          y: element.y,
                          w: element.w,
                          h: measured[element.id]?.h ?? element.h,
                        };
                  return (
                    <div
                      key={element.id}
                      ref={(node) => {
                        if (node) frameRefs.current.set(element.id, node);
                        else frameRefs.current.delete(element.id);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={t("frame", {
                        name: label(element),
                        x: element.x,
                        y: element.y,
                        w: element.w,
                        h: element.h,
                      })}
                      aria-describedby={keysId}
                      data-frame-id={element.id}
                      className={cn(
                        "group/frame absolute cursor-move touch-none outline-none",
                        selected ? "z-20" : decoration ? "z-0" : "z-10",
                      )}
                      style={{
                        left: `${rect.x}mm`,
                        top: `${rect.y}mm`,
                        width: `${rect.w}mm`,
                        height: `${rect.h}mm`,
                        boxShadow: selected
                          ? `0 0 0 ${2 * line}px var(--color-signal)`
                          : flagged.has(element.id)
                            ? `0 0 0 ${2 * line}px var(--color-destructive)`
                            : undefined,
                      }}
                      onPointerDown={(event) => begin(event, element, "move")}
                      onKeyDown={(event) => onKeyDown(event, element)}
                      onFocus={() => {
                        if (!selected) onSelect(element.id);
                      }}
                    >
                      {!selected ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover/frame:opacity-100 group-focus-visible/frame:opacity-100 motion-reduce:transition-none"
                          style={{ boxShadow: `0 0 0 ${line}px var(--color-signal)` }}
                        />
                      ) : (
                        HANDLES.map((handle) => (
                          <span
                            key={handle}
                            aria-hidden="true"
                            data-handle={handle}
                            className="absolute rounded-xs border-signal bg-paper"
                            style={{
                              left: HANDLE_POSITION[handle].left,
                              top: HANDLE_POSITION[handle].top,
                              width: handleSize,
                              height: handleSize,
                              marginLeft: -handleSize / 2,
                              marginTop: -handleSize / 2,
                              borderWidth: 1.5 * line,
                              cursor: HANDLE_POSITION[handle].cursor,
                            }}
                            onPointerDown={(event) => begin(event, element, handle)}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
