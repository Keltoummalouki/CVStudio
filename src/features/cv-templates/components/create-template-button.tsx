"use client";

import { useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isLocale } from "@/lib/i18n/config";
import { useRouter } from "@/lib/i18n/navigation";
import { templateHref } from "../routes";
import { createDesignTemplate } from "../server/actions";

/** Creates a blank A4 design and opens it in the designer. */
export function CreateTemplateButton({ variant = "signal" }: Pick<ButtonProps, "variant">) {
  const t = useTranslations("designer");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      try {
        const result = await createDesignTemplate({
          name: t("untitled"),
          locale: isLocale(locale) ? locale : "en",
        });
        if (result.ok) {
          router.push(templateHref(result.data.id));
          return;
        }
      } catch {
        // Reported below, like a refused request.
      }
      toast.error(t("createFailed"));
    });

  return (
    <Button type="button" variant={variant} disabled={isPending} onClick={create}>
      {isPending ? <Spinner /> : <PlusIcon aria-hidden="true" />}
      {isPending ? t("creating") : t("create")}
    </Button>
  );
}
