"use client";

import { CheckIcon, CircleAlertIcon, CircleDotIcon, CloudOffIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const SAVE_STATES = ["idle", "saving", "saved", "unsaved", "failed", "offline"] as const;
export type SaveState = (typeof SAVE_STATES)[number];

type SaveStatusProps = {
  state: SaveState;
  /** Required for the failed state so the owner can recover without losing edits. */
  onRetry?: () => void;
  className?: string;
};

const ICONS = {
  idle: CheckIcon,
  saving: Loader2Icon,
  saved: CheckIcon,
  unsaved: CircleDotIcon,
  failed: CircleAlertIcon,
  offline: CloudOffIcon,
} as const satisfies Record<SaveState, unknown>;

const TONES: Record<SaveState, string> = {
  idle: "text-muted-foreground",
  saving: "text-muted-foreground",
  saved: "text-success",
  unsaved: "text-warning",
  failed: "text-destructive",
  offline: "text-warning",
};

/**
 * Inline save indicator. It reserves its width so a state change restyles in
 * place instead of shifting the toolbar around it, and it is announced politely.
 * Success is only shown after the server confirms the write.
 */
export function SaveStatus({ state, onRetry, className }: SaveStatusProps) {
  const t = useTranslations("saveStatus");
  const Icon = ICONS[state];

  return (
    <div
      data-state={state}
      className={cn("inline-flex min-w-40 items-center gap-2 text-[0.8125rem]", className)}
    >
      <span
        role="status"
        aria-live="polite"
        className={cn("inline-flex items-center gap-1.5", TONES[state])}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-3.5 shrink-0", state === "saving" && "animate-spin")}
        />
        <span className="font-medium">{t(state)}</span>
      </span>
      {state === "failed" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm px-1 font-medium text-foreground underline decoration-ink-300 underline-offset-4 hover:decoration-foreground"
        >
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
