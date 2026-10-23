import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/brand-mark";
import { DASHBOARD_HOME } from "@/config/navigation";
import { Link } from "@/lib/i18n/navigation";
import { AccountMenu } from "./account-menu";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * Compact header for phones and tablets; navigation lives in the bottom tab
 * bar, Settings and the profile in the account menu.
 */
export function MobileTopBar({ newCvAction }: { newCvAction: React.ReactNode }) {
  const t = useTranslations("navigation");

  return (
    <header className="sticky top-0 z-30 flex h-[calc(var(--topbar-height)+env(safe-area-inset-top))] items-center gap-3 border-b bg-card px-4 pt-[env(safe-area-inset-top)] lg:hidden">
      <Link
        href={DASHBOARD_HOME}
        aria-label={t("home")}
        className="mr-auto flex shrink-0 items-center rounded-sm pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <BrandMark wordmarkClassName="max-[379px]:hidden" />
      </Link>
      <LocaleSwitcher />
      {newCvAction}
      <AccountMenu />
    </header>
  );
}
