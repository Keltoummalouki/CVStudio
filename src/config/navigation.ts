import {
  BriefcaseBusinessIcon,
  FileTextIcon,
  LayersIcon,
  LayoutGridIcon,
  LibraryBigIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavigationItemId =
  "overview" | "careerData" | "cvs" | "jobs" | "templates" | "settings";

export type NavigationItem = {
  id: NavigationItemId;
  /** Locale-less path; the localized Link adds the prefix. */
  href: string;
  icon: LucideIcon;
  /** Additional path prefixes that belong to this destination. */
  matches?: readonly string[];
};

export const DASHBOARD_HOME = "/dashboard";
export const SETTINGS_HREF = "/dashboard/settings";
export const PROFILE_HREF = "/dashboard/content/profile";

export const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
  { id: "overview", href: DASHBOARD_HOME, icon: LayoutGridIcon },
  { id: "careerData", href: "/dashboard/content", icon: LibraryBigIcon },
  { id: "cvs", href: "/dashboard/cvs", icon: FileTextIcon },
  { id: "jobs", href: "/dashboard/jobs", icon: BriefcaseBusinessIcon },
  { id: "templates", href: "/dashboard/templates", icon: LayersIcon },
  { id: "settings", href: SETTINGS_HREF, icon: SettingsIcon },
];

/**
 * The phone tab bar holds five destinations; Settings moves to the account
 * menu in the top bar (AccountMenu).
 */
export const MOBILE_TAB_NAVIGATION: readonly NavigationItem[] = PRIMARY_NAVIGATION.filter(
  (item) => item.id !== "settings",
);

export const NEW_CV_HREF = "/dashboard/cvs/new";

function isWithin(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The overview is only active on its exact path; every other destination owns
 * its whole subtree so nested editors keep their section highlighted.
 */
export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (item.href === DASHBOARD_HOME) {
    return normalized === DASHBOARD_HOME;
  }

  return [item.href, ...(item.matches ?? [])].some((base) => isWithin(normalized, base));
}
