"use client";

import { RouteError } from "@/components/feedback/route-error";
import { PageContainer } from "@/components/layout/page";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <PageContainer>
      <RouteError error={error} retry={retry} />
    </PageContainer>
  );
}
