import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  const t = useTranslations("cvExport");
  return (
    <main
      aria-busy="true"
      className="flex min-h-dvh items-center justify-center gap-2 bg-ink-150 text-sm text-muted-foreground print:hidden"
    >
      <Spinner />
      <span role="status">{t("loadingPrint")}</span>
    </main>
  );
}
