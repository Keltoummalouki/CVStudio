"use client";

import { useEffect } from "react";
import { PRINT_READY_ATTRIBUTE } from "@/lib/page-markers";

/**
 * Marks the print page ready once fonts and the portrait have loaded, so the
 * PDF engine never captures fallback fonts or a missing photo. With
 * `autoPrint`, then opens the browser's print dialog.
 */
export function PrintReady({ autoPrint = false }: { autoPrint?: boolean }) {
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
      root.setAttribute(PRINT_READY_ATTRIBUTE, "true");
      if (autoPrint) window.print();
    })();

    return () => {
      cancelled = true;
      root.removeAttribute(PRINT_READY_ATTRIBUTE);
    };
  }, [autoPrint]);

  return null;
}
