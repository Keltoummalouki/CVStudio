"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const PAGE_WIDTH_PX = (210 * 96) / 25.4;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Shrinks the A4 sheet to the available width on narrow screens. `zoom` (not
 * a transform) so the page height follows; printing resets it so paper and
 * PDF always get the sheet at its physical size.
 */
export function FitSheet({ children }: { children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setZoom(Math.min(1, frame.clientWidth / PAGE_WIDTH_PX));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="w-full">
      <div
        style={{ "--fit-zoom": zoom } as React.CSSProperties}
        className="mx-auto w-fit [zoom:var(--fit-zoom)] print:[zoom:1]"
      >
        {children}
      </div>
    </div>
  );
}
