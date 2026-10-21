"use client";

import { useEffect } from "react";

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
      root.dataset.printReady = "true";
      if (autoPrint) window.print();
    })();

    return () => {
      cancelled = true;
      delete root.dataset.printReady;
    };
  }, [autoPrint]);

  return null;
}
