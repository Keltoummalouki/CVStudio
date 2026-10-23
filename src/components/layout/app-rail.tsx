"use client";

import { Fragment, Suspense } from "react";
import { ArrowRightIcon, LockKeyholeIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  DASHBOARD_HOME,
  PRIMARY_NAVIGATION,
  PROFILE_HREF,
  isNavigationItemActive,
} from "@/config/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";

const railLinkClassName = cn(
  "group flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-rail-muted",
  "transition-colors duration-(--duration-fast) hover:bg-rail-hover hover:text-rail-foreground",
  "focus-visible:-outline-offset-2 aria-[current=page]:bg-rail-active aria-[current=page]:text-rail-foreground",
);

/** `pathname` is null in the prerendered shell; the active marker streams in. */
function RailLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("navigation");
  const tStudio = useTranslations("studio");

  return (
    <ul className="flex flex-1 flex-col gap-1">
      {PRIMARY_NAVIGATION.map((item) => {
        const active = pathname !== null && isNavigationItemActive(item, pathname);
        const Icon = item.icon;
        return (
          <Fragment key={item.id}>
            {item.id === "settings" ? (
              <li className="mt-auto shrink-0 pt-8">
                <div className="border-t border-rail-border pt-3">
                  <Link href={PROFILE_HREF} className={railLinkClassName}>
                    <UserRoundIcon
                      aria-hidden="true"
                      className="size-[1.125rem] shrink-0"
                      strokeWidth={1.65}
                    />
                    <span className="min-w-0 flex-1">{tStudio("editProfile")}</span>
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-rail-muted"
                    />
                  </Link>
                </div>
              </li>
            ) : null}
            <li className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={railLinkClassName}
              >
                <Icon
                  aria-hidden="true"
                  className="size-[1.125rem] shrink-0"
                  strokeWidth={active ? 2 : 1.65}
                />
                <span className="min-w-0 flex-1">{t(item.id)}</span>
                {active ? (
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-signal" />
                ) : null}
              </Link>
            </li>
          </Fragment>
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
    <aside className="studio-rail fixed inset-y-0 left-0 z-30 hidden w-(--rail-width) overflow-x-hidden overflow-y-auto overscroll-contain border-r border-rail-border bg-rail text-rail-foreground [color-scheme:dark] lg:block">
      <div className="flex min-h-full flex-col px-4 pt-7 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="shrink-0 px-3">
          <Link
            href={DASHBOARD_HOME}
            aria-label={t("home")}
            className="flex items-center rounded-sm focus-visible:outline-offset-4 pointer-coarse:min-h-11"
          >
            <BrandMark tone="rail" wordmarkClassName="text-xl" />
          </Link>
          <p className="mt-3 flex items-center gap-2 text-xs text-rail-muted">
            <LockKeyholeIcon aria-hidden="true" className="size-3 shrink-0" />
            {tStudio("privateWorkspace")}
          </p>
        </div>

        <div className="shrink-0 pt-6 pb-5">{newCvAction}</div>

        <nav aria-label={t("label")} className="flex flex-1 flex-col">
          <Suspense fallback={<RailLinks pathname={null} />}>
            <CurrentRailLinks />
          </Suspense>
        </nav>

        <div className="mt-4 shrink-0 space-y-2.5 border-t border-rail-border pt-4">
          <div className="px-3">
            <p className="text-xs text-rail-muted">{tSwitcher("label")}</p>
          </div>
          <LocaleSwitcher tone="rail" labels="names" />
        </div>
      </div>
    </aside>
  );
}
