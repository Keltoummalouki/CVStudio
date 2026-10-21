import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Builder-shaped placeholder: toolbar, outline, editor and an A4 sheet (CV and template editors). */
export function BuilderSkeleton() {
  const t = useTranslations("common");

  return (
    <div aria-busy="true" className="flex flex-col lg:h-dvh">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Skeleton className="size-8" />
        <Skeleton className="h-6 w-56 max-w-[50%]" />
        <Skeleton className="ml-auto h-8 w-20" />
        <Skeleton className="h-8 w-28 max-sm:hidden" />
      </div>
      <div className="grid flex-1 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_minmax(22rem,40%)]">
        <div className="hidden flex-col gap-2 border-r bg-ink-50 p-3 md:flex">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-4 bg-card px-6 py-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="hidden bg-ink-100 p-6 xl:block">
          <Skeleton className="aspect-a4 w-full bg-white" />
        </div>
      </div>
    </div>
  );
}
