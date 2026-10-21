"use client";

import { Suspense, useEffect, useRef } from "react";
import { LibraryBigIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CAREER_SECTIONS } from "@/config/career-sections";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

function SectionLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("careerData");
  const workspace = useTranslations("careerWorkspace");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    // Keep the chosen subsection visible on phones without moving the page itself.
    list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <ul
      ref={listRef}
      className="relative flex gap-1 overflow-x-auto px-4 py-3 sm:px-6 xl:flex-col xl:overflow-visible xl:p-0"
    >
      <li className="shrink-0 xl:mb-3 xl:border-b xl:pb-3">
        <Link
          href="/dashboard/content"
          aria-current={pathname === "/dashboard/content" ? "page" : undefined}
          className="flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground aria-[current=page]:bg-ink-950 aria-[current=page]:text-paper pointer-coarse:min-h-11"
        >
          <LibraryBigIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{workspace("navigation.overview")}</span>
        </Link>
      </li>
      {CAREER_SECTIONS.map((section) => {
        const active =
          pathname !== null &&
          (pathname === section.href || pathname.startsWith(`${section.href}/`));
        const Icon = section.icon;
        return (
          <li key={section.kind} className="shrink-0">
            <Link
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors pointer-coarse:min-h-11",
                "hover:bg-ink-100 hover:text-foreground",
                "aria-[current=page]:bg-signal-soft aria-[current=page]:font-semibold aria-[current=page]:text-signal-hover",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{t(`sections.${section.messageKey}.title`)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CurrentSectionLinks() {
  return <SectionLinks pathname={usePathname()} />;
}

/** Persistent section navigation, horizontally scrollable on smaller screens. */
export function SectionNav({ className }: { className?: string }) {
  const t = useTranslations("careerData");

  return (
    <nav aria-label={t("listLabel")} className={className}>
      <Suspense fallback={<SectionLinks pathname={null} />}>
        <CurrentSectionLinks />
      </Suspense>
    </nav>
  );
}
