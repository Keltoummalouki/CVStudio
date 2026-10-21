import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, classifyPath, splitLocalePath } from "@/lib/auth/routes";
import { routing } from "@/lib/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);

/**
 * 1. Refresh the Supabase session (cookies land on the request).
 * 2. Optimistically send signed-out visitors of the dashboard to the login page.
 * 3. Let next-intl route the request, carrying the refreshed cookies along.
 *
 * This is never the authorization boundary: every page, Server Action and data
 * function re-verifies the session and the owner allowlist on the server.
 */
export default async function proxy(request: NextRequest) {
  const session = await refreshSession(request);
  const { locale, path } = splitLocalePath(request.nextUrl.pathname);

  if (locale && classifyPath(path) === "protected" && !session.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}${LOGIN_PATH}`;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return session.commit(NextResponse.redirect(loginUrl));
  }

  return session.commit(handleI18nRouting(request));
}

export const config = {
  // Skip API routes, Next internals and any path with a file extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
