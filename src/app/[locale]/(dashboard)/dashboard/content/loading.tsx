import { PageSkeleton } from "@/components/feedback/page-skeleton";

/**
 * Career-data pages: a boundary of their own, so a click from another
 * dashboard page shows this placeholder at once (the layout's section menu
 * stays visible) while the owner check and data load.
 */
export default function Loading() {
  return <PageSkeleton rows={4} />;
}
