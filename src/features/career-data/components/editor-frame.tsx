"use client";

import { useId } from "react";
import { ArrowLeftIcon, CircleAlertIcon, LibraryBigIcon, RotateCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SaveState } from "@/components/feedback/save-status";
import { FormActionBar } from "@/components/forms/form-action-bar";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionErrorCode } from "@/lib/actions/result";
import { Link } from "@/lib/i18n/navigation";

type EditorFrameProps = {
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
  state: SaveState;
  isSaving: boolean;
  error: ActionErrorCode | null;
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  onReloadLatest: () => void;
  isReloading: boolean;
  guardDialog: React.ReactNode;
  children: React.ReactNode;
};

export function EditorFrame({
  title,
  description,
  backHref,
  backLabel,
  state,
  isSaving,
  error,
  onSubmit,
  onReloadLatest,
  isReloading,
  guardDialog,
  children,
}: EditorFrameProps) {
  const t = useTranslations("careerData.editor");
  const workspace = useTranslations("careerWorkspace.editor");

  return (
    <PageContainer className="max-w-5xl">
      <Link
        href={backHref}
        className="-mb-1 inline-flex min-h-9 w-fit items-center gap-2 rounded-[10px] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
        {backLabel}
      </Link>
      <PageHeader title={title} description={description} />
      <p className="flex items-start gap-2.5 text-sm/relaxed text-muted-foreground">
        <LibraryBigIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {workspace("sourceHint")}
      </p>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 lg:gap-6">
        {error === "stale" ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-warning">{t("stale.title")}</p>
              <p className="text-sm/relaxed text-foreground">{t("stale.description")}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReloadLatest}
              disabled={isReloading}
            >
              {isReloading ? <Spinner /> : <RotateCwIcon aria-hidden="true" />}
              {t("stale.reload")}
            </Button>
          </div>
        ) : error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-sm text-destructive"
          >
            <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t(`errors.${error}`)}
          </p>
        ) : null}

        {children}

        <FormActionBar
          state={state}
          isSaving={isSaving}
          onRetry={() => void onSubmit()}
          cancelHref={backHref}
        />
      </form>
      {guardDialog}
    </PageContainer>
  );
}

/** A titled group of fields inside an editor form. */
export function EditorSection({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-5 py-5 sm:px-6">
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="text-base font-semibold tracking-[-0.015em]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-prose text-sm/relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-6 px-5 py-6 sm:px-6">{children}</div>
    </section>
  );
}
