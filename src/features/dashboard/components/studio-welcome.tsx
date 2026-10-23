import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { StudioPaper } from "@/components/layout/studio-paper";
import { Button } from "@/components/ui/button";
import { NEW_CV_HREF } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";
import type { DashboardOverview } from "../overview";

/** The next useful action comes from the owner's actual workspace state. */
export function StudioWelcome({ overview }: { overview: DashboardOverview }) {
  const t = useTranslations("overview.studio");
  const recentCv = overview.recentCvs[0];
  const action = recentCv
    ? { href: `/dashboard/cvs/${recentCv.id}`, label: t("continueCv") }
    : !overview.setup.profile
      ? { href: "/dashboard/content/profile", label: t("addProfile") }
      : !overview.setup.careerRecords
        ? { href: "/dashboard/content", label: t("addCareer") }
        : { href: NEW_CV_HREF, label: t("createCv") };

  return (
    <section
      aria-labelledby="studio-welcome-title"
      className="studio-welcome grid overflow-hidden rounded-lg bg-card md:grid-cols-[minmax(0,1fr)_40%]"
    >
      <div className="flex flex-col items-start justify-center p-6 sm:p-8">
        <h2
          id="studio-welcome-title"
          className="max-w-xl text-[1.75rem]/tight font-semibold tracking-[-0.035em] text-balance sm:text-[2.125rem]"
        >
          {t(recentCv ? "returningTitle" : "newTitle")}
        </h2>
        <p className="mt-3 max-w-xl text-sm/relaxed text-muted-foreground">
          {t(recentCv ? "returningDescription" : "newDescription")}
        </p>
        {recentCv ? (
          <p className="mt-4 max-w-full truncate text-sm font-medium">
            <span className="text-muted-foreground">{t("lastEdited")} </span>
            {recentCv.name}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={action.href}>
              {action.label}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={recentCv ? NEW_CV_HREF : "/dashboard/cvs"}>
              {t(recentCv ? "createCv" : "exploreCvs")}
              <ArrowUpRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
      <figure className="studio-welcome-art relative flex min-h-64 flex-col items-center justify-center overflow-hidden">
        <StudioPaper />
        <figcaption className="relative px-6 pb-6 text-center text-xs font-medium">
          {t("paperCaption")}
        </figcaption>
      </figure>
    </section>
  );
}
