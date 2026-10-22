"use client";

import { useEffect } from "react";
import { RotateCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROUTE_ERROR_ATTRIBUTE } from "@/lib/page-markers";
import { ErrorState } from "./error-state";

// Lets the PDF engine tell a failed print page from a slow one.
const marker = { [ROUTE_ERROR_ATTRIBUTE]: "" };

function getDigest(error: unknown): string | undefined {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    return error.digest;
  }
  return undefined;
}

type RouteErrorProps = {
  error: unknown;
  retry: () => void;
  /** A second way out, such as a link back to the overview. */
  action?: React.ReactNode;
};

/** What every route error boundary shows: a plain message, the server reference and a retry. */
export function RouteError({ error, retry, action }: RouteErrorProps) {
  const t = useTranslations("errors.boundary");
  const digest = getDigest(error);

  useEffect(() => {
    // Server errors arrive redacted (digest only); nothing sensitive is logged here.
    console.error(error);
  }, [error]);

  return (
    <div {...marker}>
      <ErrorState
        headingLevel="h1"
        title={t("title")}
        description={t("description")}
        reference={digest ? t("reference", { digest }) : undefined}
        action={
          <>
            <Button type="button" onClick={() => retry()}>
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
            {action}
          </>
        }
      />
    </div>
  );
}
