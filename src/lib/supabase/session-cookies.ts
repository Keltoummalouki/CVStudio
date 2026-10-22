/**
 * @supabase/ssr keeps the session in `sb-<project>-auth-token`, split into
 * `.0`, `.1`… when it is long.
 */
const SESSION_COOKIE = /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/;

/** Only the Supabase session cookies, e.g. to hand a server-side browser no more than it needs. */
export function sessionCookies<T extends { name: string }>(cookies: readonly T[]): T[] {
  return cookies.filter((cookie) => SESSION_COOKIE.test(cookie.name));
}
