"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/brand-mark";
import { RouteError } from "@/components/feedback/route-error";
import { Button } from "@/components/ui/button";
import { DASHBOARD_HOME } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";

/**
 * Pages outside the dashboard shell (sign-in, the print page) fail here,
 * inside the localized layout, instead of on the bilingual global error page.
 */
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errors.notFound");

  return (
    <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <BrandMark />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16">
        <RouteError
          error={error}
          retry={retry}
          action={
            <Button asChild variant="outline">
              <Link href={DASHBOARD_HOME}>
                <ArrowLeftIcon aria-hidden="true" />
                {t("action")}
              </Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
