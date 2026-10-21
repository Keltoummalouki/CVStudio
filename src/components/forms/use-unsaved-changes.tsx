"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { splitLocalePath } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";

type GuardOptions = {
  when: boolean;
  /** Restore the saved values before leaving, so a revisited page does not resurrect discarded edits. */
  onDiscard?: () => void;
};

/**
 * Protects unsaved edits from accidental loss: browser reloads and closing the
 * tab (native prompt), and in-app link clicks (confirmation dialog).
 */
export function useUnsavedChangesGuard({ when, onDiscard }: GuardOptions) {
  const t = useTranslations("careerData.editor.unsaved");
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const bypass = useRef(false);

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypass.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  useEffect(() => {
    if (!when) return;
    const onClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [when]);

  const dialog = (
    <ConfirmDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      tone="destructive"
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (!href) return;
        onDiscard?.();
        bypass.current = true;
        const { locale, path } = splitLocalePath(href);
        router.push(path, locale ? { locale } : undefined);
      }}
    />
  );

  return {
    dialog,
    /** Call right before a deliberate navigation (e.g. after a successful save). */
    allowNavigation: () => {
      bypass.current = true;
    },
  };
}
