import { PageSkeleton } from "@/components/feedback/page-skeleton";

/** The job post list: its own boundary, so navigation shows this at once. */
export default function Loading() {
  return <PageSkeleton rows={3} />;
}
