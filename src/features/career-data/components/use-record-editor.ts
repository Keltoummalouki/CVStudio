"use client";

import { useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { DefaultValues, FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { useSaveForm } from "@/components/forms/use-save-form";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes";
import type { ActionResult } from "@/lib/actions/result";
import { useRouter } from "@/lib/i18n/navigation";

type UseRecordEditorOptions<TValues extends FieldValues> = {
  form: UseFormReturn<TValues>;
  /** The server's current values; they change after a save or a reload. */
  initialValues: TValues;
  action: (values: TValues) => Promise<ActionResult<TValues>>;
  /** For creatable records: where the record lives once it has an id. */
  recordHref?: (id: string) => string;
};

/**
 * Glue for every career-data editor: explicit save, server-confirmed reset,
 * navigation to the new record after creation, unsaved-changes protection,
 * and an explicit reload path when the record changed elsewhere.
 */
export function useRecordEditor<TValues extends FieldValues>({
  form,
  initialValues,
  action,
  recordHref,
}: UseRecordEditorOptions<TValues>) {
  const t = useTranslations("careerData.editor");
  const router = useRouter();
  const reloadRequested = useRef(false);
  const [isReloading, startReload] = useTransition();

  const guard = useUnsavedChangesGuard({
    when: form.formState.isDirty,
    onDiscard: () => form.reset(),
  });

  const saver = useSaveForm<TValues, TValues>({
    form,
    action,
    onSaved: (saved, submitted) => {
      const savedId = (saved as { id?: string | null }).id ?? null;
      const wasNew = (submitted as { id?: string | null }).id === null;

      if (wasNew && savedId && recordHref) {
        toast.success(t("createdToast"));
        // Leave the "new" form empty: navigation keeps visited pages mounted.
        form.reset();
        guard.allowNavigation();
        router.replace(recordHref(savedId));
        return;
      }

      form.reset(saved as DefaultValues<TValues>);
      toast.success(t("savedToast"));
    },
  });

  // After an explicit "reload latest", adopt the refreshed server values.
  useEffect(() => {
    if (!reloadRequested.current) return;
    reloadRequested.current = false;
    form.reset(initialValues as DefaultValues<TValues>);
    saver.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to new server values
  }, [initialValues]);

  return {
    ...saver,
    guardDialog: guard.dialog,
    isReloading,
    reloadLatest: () => {
      reloadRequested.current = true;
      startReload(() => router.refresh());
    },
  };
}
