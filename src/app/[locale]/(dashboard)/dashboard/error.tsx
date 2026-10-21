"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/feedback/error-state";
import { PageContainer } from "@/components/layout/page";
import { Button } from "@/components/ui/button";

function getDigest(error: unknown): string | undefined {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    return error.digest;
  }
  return undefined;
}

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errors.boundary");
  const digest = getDigest(error);

  useEffect(() => {
    // Server errors arrive redacted (digest only); nothing sensitive is logged here.
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <ErrorState
        headingLevel="h1"
        title={t("title")}
        description={t("description")}
        reference={digest ? t("reference", { digest }) : undefined}
        action={
          <Button type="button" onClick={() => retry()}>
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        }
      />
    </PageContainer>
  );
}
