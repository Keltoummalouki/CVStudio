"use client";

import { Suspense } from "react";
import { ArrowUpRightIcon, LockKeyholeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/brand-mark";
import { DASHBOARD_HOME, PRIMARY_NAVIGATION, isNavigationItemActive } from "@/config/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";

/** `pathname` is null in the prerendered shell; the active marker streams in. */
function RailLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("navigation");

  return (
    <ul className="flex min-h-full flex-col gap-2">
      {PRIMARY_NAVIGATION.map((item) => {
        const active = pathname !== null && isNavigationItemActive(item, pathname);
        const Icon = item.icon;
        return (
          <li
            key={item.id}
            className={cn(
              "shrink-0",
              item.id === "settings" && "mt-auto border-t border-rail-border pt-3",
            )}
          >
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-md px-3.5 text-sm font-medium text-rail-muted",
                "transition-colors duration-(--duration-fast) hover:bg-rail-hover hover:text-rail-foreground",
                "aria-[current=page]:bg-rail-active aria-[current=page]:text-rail-foreground",
              )}
            >
              <Icon
                aria-hidden="true"
                className="size-[1.125rem] shrink-0"
                strokeWidth={active ? 2 : 1.65}
              />
              <span className="truncate">{t(item.id)}</span>
              {active ? (
                <span
                  aria-hidden="true"
                  className="ml-auto size-1.5 shrink-0 rounded-full bg-signal"
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CurrentRailLinks() {
  return <RailLinks pathname={usePathname()} />;
}

/** Desktop navigation: the ink rail. Hidden below the lg breakpoint. */
export function AppRail({ newCvAction }: { newCvAction: React.ReactNode }) {
  const t = useTranslations("navigation");
  const tSwitcher = useTranslations("localeSwitcher");
  const tStudio = useTranslations("studio");

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--rail-width) flex-col bg-rail text-rail-foreground lg:flex">
      <div className="flex h-24 shrink-0 items-center px-6">
        <Link
          href={DASHBOARD_HOME}
          aria-label={t("home")}
          className="flex items-center rounded-sm focus-visible:outline-offset-4 pointer-coarse:min-h-11"
        >
          <BrandMark tone="rail" wordmarkClassName="text-xl" />
        </Link>
      </div>

      <div className="shrink-0 px-4 pb-6">{newCvAction}</div>

      <nav aria-label={t("label")} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <Suspense fallback={<RailLinks pathname={null} />}>
          <CurrentRailLinks />
        </Suspense>
      </nav>

      <div className="mx-4 mb-4 hidden shrink-0 space-y-3 rounded-lg border border-rail-border p-4 [@media(min-height:760px)]:block">
        <p className="text-sm font-medium">{tStudio("railTitle")}</p>
        <p className="text-xs/relaxed text-rail-muted">{tStudio("railDescription")}</p>
        <Link
          href="/dashboard/content/profile"
          className="inline-flex min-h-8 items-center gap-2 rounded-sm text-xs font-medium text-rail-foreground hover:underline"
        >
          {tStudio("editProfile")}
          <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      <div className="shrink-0 space-y-3 border-t border-rail-border px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-rail-muted">{tSwitcher("label")}</p>
          <LocaleSwitcher tone="rail" />
        </div>
        <p className="flex items-center gap-2 text-xs text-rail-muted">
          <LockKeyholeIcon aria-hidden="true" className="size-3" />
          {tStudio("privateWorkspace")}
        </p>
      </div>
    </aside>
  );
}
