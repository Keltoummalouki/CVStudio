import { useTranslations } from "next-intl";
import { AppRail } from "./app-rail";
import { MobileTabBar } from "./mobile-tab-bar";
import { MobileTopBar } from "./mobile-top-bar";
import { NewCvAction } from "./new-cv-action";
import { WorkspaceHeader } from "./workspace-header";

export const MAIN_CONTENT_ID = "main-content";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");

  return (
    <div className="min-h-dvh">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only z-50 rounded-md bg-ink-950 px-3 py-2 text-sm font-medium text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skipToContent")}
      </a>
      <AppRail newCvAction={<NewCvAction className="w-full justify-center" />} />
      <MobileTopBar newCvAction={<NewCvAction size="sm" compact />} />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] outline-none lg:pb-0 lg:pl-(--rail-width)"
      >
        <WorkspaceHeader />
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
