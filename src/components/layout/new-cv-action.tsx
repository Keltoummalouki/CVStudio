import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";
import { NEW_CV_HREF } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";

type NewCvActionProps = Pick<ButtonProps, "variant" | "size" | "className"> & {
  /** Icon only on the narrowest phones; the label stays available to screen readers. */
  compact?: boolean;
};

/** The primary creation action, wherever it appears in the shell. */
export function NewCvAction({
  variant = "signal",
  size,
  className,
  compact = false,
}: NewCvActionProps) {
  const t = useTranslations("navigation");
  const content = (
    <>
      <PlusIcon aria-hidden="true" />
      <span className={compact ? "max-[379px]:sr-only" : undefined}>{t("newCv")}</span>
    </>
  );

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={NEW_CV_HREF}>{content}</Link>
    </Button>
  );
}
