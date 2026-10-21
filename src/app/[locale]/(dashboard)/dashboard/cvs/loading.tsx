import { PageSkeleton } from "@/components/feedback/page-skeleton";

/**
 * The CV list: a boundary of its own, so a click from another dashboard page shows
 * this placeholder at once while the owner check and data load.
 */
export default function Loading() {
  return <PageSkeleton rows={3} />;
}
