"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import type { SaveState } from "@/components/feedback/save-status";
import { useIsOffline } from "@/components/forms/use-save-form";
import type { ActionErrorCode, ActionResult } from "@/lib/actions/result";
import { splitLocalePath } from "@/lib/auth/routes";
import type { Locale } from "@/lib/i18n/config";
import { useRouter } from "@/lib/i18n/navigation";
import type { CvDefinition } from "../definition";

/** What the builder edits, for a CV or a template. */
export type BuilderDraft = { name: string; locale: Locale; definition: CvDefinition };

const SAVE_DELAY_MS = 700;

type Options<D extends BuilderDraft> = {
  id: string;
  revision: number;
  draft: D;
  /** Server action writing the draft at the expected revision. */
  save: (
    input: D & { id: string; expectedRevision: number },
  ) => Promise<ActionResult<{ revision: number }>>;
  /** Server action reading the latest revision, to keep this tab's edits after a conflict. */
  getRevision: (id: string) => Promise<ActionResult<{ revision: number }>>;
};

/**
 * Debounced autosave for the builder. Writes are serialized and carry the
 * revision they were based on; a write from another tab surfaces as a
 * conflict instead of being overwritten. Leaving the page first flushes
 * pending edits, and only asks when they could not be saved.
 */
export function useBuilderAutosave<D extends BuilderDraft>({
  id,
  revision,
  draft,
  save,
  getRevision,
}: Options<D>) {
  const t = useTranslations("cvBuilder.leave");
  const router = useRouter();
  const offline = useIsOffline();

  const snapshot = useMemo(() => JSON.stringify(draft), [draft]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [failure, setFailure] = useState<{ snapshot: string; error: ActionErrorCode } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const revisionRef = useRef(revision);
  const latest = useRef({ draft, snapshot });
  const savedRef = useRef(snapshot);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const bypass = useRef(false);

  useEffect(() => {
    latest.current = { draft, snapshot };
  }, [draft, snapshot]);

  const dirty = snapshot !== savedSnapshot;

  const run = useCallback(async (): Promise<boolean> => {
    while (inFlight.current) await inFlight.current;
    const { draft: current, snapshot: currentSnapshot } = latest.current;
    if (currentSnapshot === savedRef.current) return true;
    if (!navigator.onLine) return false;

    const attempt = (async () => {
      setSaving(true);
      try {
        const result = await save({ ...current, id, expectedRevision: revisionRef.current });
        if (result.ok) {
          revisionRef.current = result.data.revision;
          savedRef.current = currentSnapshot;
          setSavedSnapshot(currentSnapshot);
          setSavedOnce(true);
          setFailure(null);
          return true;
        }
        if (result.error === "stale") setConflict(true);
        setFailure({ snapshot: currentSnapshot, error: result.error });
        return false;
      } catch {
        setFailure({ snapshot: currentSnapshot, error: "unavailable" });
        return false;
      } finally {
        setSaving(false);
      }
    })();
    inFlight.current = attempt;
    try {
      return await attempt;
    } finally {
      inFlight.current = null;
    }
  }, [id, save]);

  // Edits made during a save keep `dirty` true, so this schedules the next write.
  const blocked = conflict || offline || failure?.snapshot === snapshot;
  useEffect(() => {
    if (!dirty || blocked) return;
    const timer = window.setTimeout(() => void run(), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, blocked, snapshot, run]);

  const retry = useCallback(() => {
    setFailure(null);
    void run();
  }, [run]);

  /** After a conflict: keep this tab's version and save it over the newer one. */
  const keepMine = useCallback(async () => {
    const latestRevision = await getRevision(id);
    if (!latestRevision.ok) {
      setFailure({ snapshot: latest.current.snapshot, error: latestRevision.error });
      return;
    }
    revisionRef.current = latestRevision.data.revision;
    setConflict(false);
    setFailure(null);
    await run();
  }, [id, run, getRevision]);

  /** After a conflict: drop this tab's edits and show what was saved elsewhere. */
  const loadLatest = useCallback(() => {
    bypass.current = true;
    router.refresh();
  }, [router]);

  const mustProtect = dirty || saving;

  useEffect(() => {
    if (!mustProtect) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!bypass.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mustProtect]);

  const navigate = useCallback(
    (href: string) => {
      bypass.current = true;
      const { locale, path } = splitLocalePath(href);
      router.push(path, locale ? { locale } : undefined);
    },
    [router],
  );

  // In-app links: save first, then leave. Ask only when the save failed.
  useEffect(() => {
    if (!mustProtect) return;
    const onClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      const href = `${url.pathname}${url.search}${url.hash}`;
      void run().then((saved) => (saved ? navigate(href) : setPendingHref(href)));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [mustProtect, run, navigate]);

  let state: SaveState;
  if (saving) state = "saving";
  else if (conflict) state = "failed";
  else if (dirty && offline) state = "offline";
  else if (failure && failure.snapshot === snapshot) state = "failed";
  else if (dirty) state = "unsaved";
  else state = savedOnce ? "saved" : "idle";

  const leaveDialog = (
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
        if (href) navigate(href);
      }}
    />
  );

  return {
    state,
    error: failure?.error ?? null,
    conflict,
    retry,
    keepMine,
    loadLatest,
    /** Saves now; resolves to false when the edits could not be saved. */
    flush: run,
    leaveDialog,
  };
}
