import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shaped like a job post page: header, scores panel, then requirement rows. */
export function JobPostSkeleton({ variant }: { variant: "new" | "detail" }) {
  const t = useTranslations("common");

  return (
    <PageContainer className="max-w-5xl" aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <Skeleton className="h-5 w-24" />
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {variant === "new" ? (
        <div className="space-y-4 rounded-lg border bg-card p-5 sm:p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-72 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-52" />
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <div className="space-y-2 border-b px-5 py-5 sm:px-6">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-4 border-b px-5 py-4 last:border-b-0 sm:px-6"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
                <Skeleton className="h-6 w-60 max-w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border bg-card p-5 sm:p-6">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-40" />
                </div>
                <Skeleton className="h-8 w-2/3" />
              </div>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
