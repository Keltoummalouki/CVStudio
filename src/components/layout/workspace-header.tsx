"use client";

import { Suspense } from "react";
import { ChevronRightIcon, PanelsTopLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CAREER_SECTIONS } from "@/config/career-sections";
import { PRIMARY_NAVIGATION, isNavigationItemActive } from "@/config/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";

function CurrentLocation() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const tSections = useTranslations("careerData.sections");
  const tStudio = useTranslations("studio");
  const tJobs = useTranslations("jobs.breadcrumb");
  const current = PRIMARY_NAVIGATION.find((item) => isNavigationItemActive(item, pathname));
  const jobPage = pathname.startsWith("/dashboard/jobs/")
    ? tJobs(pathname.endsWith("/new") ? "new" : "detail")
    : null;
  const section = CAREER_SECTIONS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const isCvEditor =
    (pathname.startsWith("/dashboard/cvs/") && !pathname.endsWith("/new")) ||
    pathname.startsWith("/dashboard/templates/");
  return (
    <nav aria-label={tStudio("breadcrumb")} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2.5 text-xs">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground"
          >
            <PanelsTopLeftIcon aria-hidden="true" className="size-4" />
            {tStudio("workspace")}
          </Link>
        </li>
        {current ? (
          <li className="flex min-w-0 items-center gap-2.5">
            <ChevronRightIcon aria-hidden="true" className="size-3 text-subtle-foreground" />
            <Link
              href={current.href}
              aria-current={!section && !isCvEditor && !jobPage ? "page" : undefined}
              className="truncate rounded-sm font-medium hover:underline"
            >
              {t(current.id)}
            </Link>
          </li>
        ) : null}
        {section ? (
          <li className="flex min-w-0 items-center gap-2.5">
            <ChevronRightIcon aria-hidden="true" className="size-3 text-subtle-foreground" />
            <span className="truncate" aria-current="page">
              {tSections(`${section.messageKey}.title`)}
            </span>
          </li>
        ) : null}
        {isCvEditor ? (
          <li className="flex items-center gap-2.5">
            <ChevronRightIcon aria-hidden="true" className="size-3 text-subtle-foreground" />
            <span aria-current="page">{tStudio("editor")}</span>
          </li>
        ) : null}
        {jobPage ? (
          <li className="flex items-center gap-2.5">
            <ChevronRightIcon aria-hidden="true" className="size-3 text-subtle-foreground" />
            <span aria-current="page">{jobPage}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

export function WorkspaceHeader() {
  const t = useTranslations("studio");
  return (
    <div className="studio-workspace-header hidden h-(--workspace-header-height) items-center justify-between gap-4 border-b bg-card px-8 lg:flex">
      <Suspense fallback={<span className="text-xs text-muted-foreground">{t("workspace")}</span>}>
        <CurrentLocation />
      </Suspense>
      <span className="shrink-0 text-xs text-muted-foreground">{t("studioNote")}</span>
    </div>
  );
}
