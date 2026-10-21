"use client";

import { useTranslations } from "next-intl";
import { SaveStatus, type SaveState } from "@/components/feedback/save-status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/lib/i18n/navigation";

type FormActionBarProps = {
  state: SaveState;
  isSaving: boolean;
  onRetry?: () => void;
  cancelHref?: string;
};

/**
 * Sticky save bar for entity forms. It stays above the mobile tab bar, keeps
 * its status slot a fixed width, and is the single place where Save lives.
 */
export function FormActionBar({ state, isSaving, onRetry, cancelHref }: FormActionBarProps) {
  const t = useTranslations("careerData.editor");

  return (
    <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+0.5rem)] z-20 mt-2 rounded-lg border bg-card px-4 py-3 shadow-overlay sm:px-5 lg:bottom-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveStatus state={state} onRetry={onRetry} />
        <div className="flex items-center gap-2">
          {cancelHref ? (
            <Button asChild variant="ghost">
              <Link href={cancelHref}>{t("cancel")}</Link>
            </Button>
          ) : null}
          <Button type="submit" variant="signal" disabled={isSaving}>
            {isSaving ? <Spinner /> : null}
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
