import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/skeleton";

/** Generic page placeholder: header, then one ruled panel of rows. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  const t = useTranslations("common");

  return (
    <PageContainer aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="space-y-2.5 border-b pb-5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-5">
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3.5 border-b px-5 py-4 last:border-b-0">
            <Skeleton className="size-9" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
