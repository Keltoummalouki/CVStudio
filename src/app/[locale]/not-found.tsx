import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { DASHBOARD_HOME } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("errors.notFound");

  return (
    <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <BrandMark />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 py-16">
        <div className="space-y-2 border-t-2 border-ink-950 pt-5">
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">{t("title")}</h1>
          <p className="text-sm/relaxed text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild className="self-start">
          <Link href={DASHBOARD_HOME}>
            <ArrowLeftIcon aria-hidden="true" />
            {t("action")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
