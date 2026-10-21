"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { PRIMARY_NAVIGATION, isNavigationItemActive } from "@/config/navigation";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** `pathname` is null in the prerendered shell; the active marker streams in. */
function TabLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("navigation");

  return (
    <ul className="mx-auto grid h-(--tabbar-height) max-w-xl grid-cols-5">
      {PRIMARY_NAVIGATION.map((item) => {
        const active = pathname !== null && isNavigationItemActive(item, pathname);
        const Icon = item.icon;
        return (
          <li key={item.id} className="relative">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1.5 px-1 text-xs leading-none font-medium text-muted-foreground",
                "transition-colors duration-(--duration-fast) focus-visible:-outline-offset-2 aria-[current=page]:text-signal-hover",
              )}
            >
              {active ? (
                <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 bg-signal" />
              ) : null}
              <span
                className={cn(
                  "flex h-7 w-10 items-center justify-center rounded-md",
                  active && "bg-signal-soft",
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className="max-w-full truncate">{t(`short.${item.id}`)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CurrentTabLinks() {
  return <TabLinks pathname={usePathname()} />;
}

/** Thumb-reach navigation below the lg breakpoint. Labels use the short variants. */
export function MobileTabBar() {
  const t = useTranslations("navigation");

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Suspense fallback={<TabLinks pathname={null} />}>
        <CurrentTabLinks />
      </Suspense>
    </nav>
  );
}
