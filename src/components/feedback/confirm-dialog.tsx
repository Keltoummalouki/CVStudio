"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** State the consequence plainly, including what is NOT affected. */
  description: React.ReactNode;
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  tone?: "default" | "destructive";
  /**
   * Runs the action. The dialog stays open with a pending state until it
   * settles; on failure it stays open and explains, so nothing fails silently.
   */
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("confirmDialog");
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) setFailed(false);
    onOpenChange(next);
  }

  function handleConfirm() {
    setFailed(false);
    startTransition(async () => {
      try {
        await onConfirm();
        onOpenChange(false);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent aria-busy={isPending}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {failed ? (
          <p
            role="alert"
            className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {t("failed")}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel ?? t("cancel")}</AlertDialogCancel>
          {/* A plain button (not AlertDialogAction) so the dialog does not close before the work settles. */}
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : null}
            {isPending ? t("pending") : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
