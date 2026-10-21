import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the studio and document area while overview data streams in. */
export default function OverviewLoading() {
  const t = useTranslations("common");

  return (
    <PageContainer aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 pointer-coarse:h-11" />
      </div>
      <div className="grid overflow-hidden rounded-lg border bg-card md:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 p-6 sm:p-8">
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-4/5 max-w-md" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="hidden min-h-64 items-center justify-center border-l bg-ink-100 md:flex">
          <Skeleton className="aspect-a4 w-28 bg-paper" />
        </div>
      </div>
      <div className="grid gap-5 lg:gap-6 xl:grid-cols-12">
        <div className="rounded-lg border bg-card xl:col-span-7">
          <div className="space-y-2 border-b p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b p-5 last:border-b-0">
              <Skeleton className="size-14 shrink-0" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-52 max-w-full" />
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card xl:col-span-5">
          <div className="space-y-2 border-b p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-full max-w-64" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex gap-4 border-b px-5 py-4 last:border-b-0">
              <Skeleton className="size-7 shrink-0" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                {index === 0 ? (
                  <>
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="mt-3 h-8 w-28 pointer-coarse:h-11" />
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 border-y py-5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </PageContainer>
  );
}
