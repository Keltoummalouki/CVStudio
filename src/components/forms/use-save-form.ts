"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { SaveState } from "@/components/feedback/save-status";
import type { ActionErrorCode, ActionResult } from "@/lib/actions/result";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** True when the browser reports no connection; assumed online during server rendering. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false,
  );
}

type UseSaveFormOptions<TValues extends FieldValues, TData> = {
  form: UseFormReturn<TValues>;
  action: (values: TValues) => Promise<ActionResult<TData>>;
  /** Called after the server confirmed the write: reset the form to the saved state here. */
  onSaved: (data: TData, values: TValues) => void;
};

/**
 * Explicit-save workflow for entity forms. Success is only reported after the
 * server confirms; failures keep every edit in place and say why.
 */
export function useSaveForm<TValues extends FieldValues, TData>({
  form,
  action,
  onSaved,
}: UseSaveFormOptions<TValues, TData>) {
  const [isSaving, startTransition] = useTransition();
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const offline = useIsOffline();
  const { isDirty } = form.formState;

  const save = form.handleSubmit(
    (values) => {
      setError(null);
      startTransition(async () => {
        try {
          const result = await action(values);
          if (result.ok) {
            onSaved(result.data, values);
            setSavedOnce(true);
            return;
          }
          setError(result.error);
          for (const issue of result.fieldIssues ?? []) {
            form.setError(issue.path as Path<TValues>, { type: "server", message: issue.message });
          }
        } catch {
          setError("unavailable");
        }
      });
    },
    () => setError("invalid_input"),
  );

  let state: SaveState = "idle";
  if (isSaving) state = "saving";
  else if (error === "unavailable") state = "failed";
  else if (offline && isDirty) state = "offline";
  else if (isDirty) state = "unsaved";
  else if (savedOnce) state = "saved";

  return {
    save,
    state,
    error,
    isSaving,
    clearError: () => setError(null),
  };
}
