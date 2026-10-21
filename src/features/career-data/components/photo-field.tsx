"use client";

import { useRef, useState, useTransition } from "react";
import { ImageUpIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MAX_PHOTO_BYTES, PHOTO_ACCEPT } from "../constants";
import { removeProfilePhoto, uploadProfilePhoto } from "../server/actions";

/**
 * Uploads immediately (independent of the profile form's Save). Files are
 * checked here for fast feedback and again on the server by their bytes.
 */
export function PhotoField({ initialUrl }: { initialUrl: string | null }) {
  const t = useTranslations("careerData.photo");
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) return setError(t("errors.too_large"));
    if (!PHOTO_ACCEPT.split(",").includes(file.type)) return setError(t("errors.unsupported_type"));

    const data = new FormData();
    data.set("photo", file);
    startTransition(async () => {
      try {
        const result = await uploadProfilePhoto(data);
        if (result.ok) {
          setUrl(result.data.url);
          toast.success(t("uploaded"));
        } else if (result.error === "too_large" || result.error === "unsupported_type") {
          setError(t(`errors.${result.error}`));
        } else {
          setError(t("errors.failed"));
        }
      } catch {
        setError(t("errors.failed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-ink-100">
        {url ? (
          // A private, short-lived signed URL: deliberately not routed through
          // the image optimizer, which would cache the owner's photo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={t("alt")} className="size-full object-cover" />
        ) : (
          <UserRoundIcon aria-hidden="true" className="size-10 text-ink-400" />
        )}
      </div>

      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? <Spinner /> : <ImageUpIcon aria-hidden="true" />}
            {isPending ? t("uploading") : url ? t("replace") : t("upload")}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmRemove(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon aria-hidden="true" />
              {t("remove")}
            </Button>
          ) : null}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">{t("hint")}</p>
        {error ? (
          <p role="alert" className="text-[0.8125rem] text-destructive">
            {error}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("remove")}
        description={t("hint")}
        confirmLabel={t("remove")}
        tone="destructive"
        onConfirm={async () => {
          const result = await removeProfilePhoto();
          if (!result.ok) throw new Error(result.error);
          setUrl(null);
          toast.success(t("removed"));
        }}
      />
    </div>
  );
}
