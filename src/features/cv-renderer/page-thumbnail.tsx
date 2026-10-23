"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PAGE_WIDTH_PX = (210 * 96) / 25.4;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The first A4 page of a document, scaled down to the frame's width: a
 * picture of the page. It is hidden from assistive technology and inert (its
 * links cannot be focused or clicked); the card around it names what it shows.
 * `zoom` rather than a transform, so the page lays out at its scaled size.
 */
export function PageThumbnail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      if (frame.clientWidth > 0) setZoom(frame.clientWidth / PAGE_WIDTH_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      aria-hidden="true"
      inert
      className={cn("aspect-a4 w-full overflow-hidden bg-paper select-none", className)}
    >
      {/* Until measured, nothing shows: never a full-size page flashing in a small card. */}
      <div style={{ zoom: zoom ?? 0.25 }} className={cn("w-fit", zoom === null && "invisible")}>
        {children}
      </div>
    </div>
  );
}
