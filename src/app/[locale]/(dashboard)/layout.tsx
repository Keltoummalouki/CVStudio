import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { requireOwner } from "@/lib/auth/session";

/** Verifies the owner before any page content renders. Data functions re-check on their own. */
async function OwnerGate({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return children;
}

export default function DashboardLayout({ children }: LayoutProps<"/[locale]">) {
  // The shell prerenders statically; only the content behind the gate waits for the session.
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <OwnerGate>{children}</OwnerGate>
      </Suspense>
    </AppShell>
  );
}
