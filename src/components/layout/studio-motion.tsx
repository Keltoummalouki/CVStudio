"use client";

import { useEffect } from "react";
import { usePathname } from "@/lib/i18n/navigation";

export function StudioMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: no-preference) and (pointer: fine)");
    let cancelled = false;
    let generation = 0;
    let cleanup = () => {};
    const setup = async () => {
      const current = ++generation;
      cleanup();
      cleanup = () => {};
      if (!media.matches || /\/cvs\/[^/]+$|\/templates\/[^/]+$/.test(pathname)) return;
      const module = await import("lenis").catch(() => null);
      if (!module || cancelled || current !== generation || !media.matches) return;
      const { default: Lenis } = module;
      const lenis = new Lenis({
        autoRaf: true,
        autoToggle: true,
        lerp: 0.14,
        smoothWheel: true,
        syncTouch: false,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
        respectReducedMotion: true,
        prevent: (node) =>
          Boolean(
            node.closest('[role="dialog"], [data-lenis-prevent], textarea, [role="listbox"]'),
          ),
      });
      cleanup = () => lenis.destroy();
    };
    void setup();
    media.addEventListener("change", setup);
    return () => {
      cancelled = true;
      cleanup();
      media.removeEventListener("change", setup);
    };
  }, [pathname]);
  return null;
}
