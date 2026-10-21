import { DASHBOARD_HOME } from "@/config/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const LOGIN_PATH = "/login";
/** Print views of CVs: owner-only like the dashboard, outside its shell. */
export const PRINT_PATH = "/print";

export type RouteKind = "protected" | "auth" | "public";

/** "/fr/dashboard/cvs" -> { locale: "fr", path: "/dashboard/cvs" }. */
export function splitLocalePath(pathname: string): { locale: Locale | null; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) return { locale: null, path: pathname };
  const path = `/${rest.join("/")}`.replace(/\/+$/, "");
  return { locale: first, path: path || "/" };
}

export function classifyPath(path: string): RouteKind {
  if (path === DASHBOARD_HOME || path.startsWith(`${DASHBOARD_HOME}/`)) return "protected";
  if (path.startsWith(`${PRINT_PATH}/`)) return "protected";
  if (path === LOGIN_PATH) return "auth";
  return "public";
}

const PROBE_ORIGIN = "http://cvstudio.invalid";

/**
 * Post-login destinations must be same-origin dashboard paths. Anything else
 * (absolute URLs, protocol-relative "//host", backslash tricks, other pages)
 * falls back to the dashboard, so the login page cannot be used as an open redirect.
 */
export function sanitizeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 512) return DASHBOARD_HOME;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DASHBOARD_HOME;
  }

  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return DASHBOARD_HOME;
    return classifyPath(url.pathname) === "protected"
      ? `${url.pathname}${url.search}`
      : DASHBOARD_HOME;
  } catch {
    return DASHBOARD_HOME;
  }
}
