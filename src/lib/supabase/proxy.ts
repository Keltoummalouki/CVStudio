import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "./database.types";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export type ProxySession = {
  /** Verified JWT claims, or null when signed out. Proxy checks are optimistic only. */
  claims: JwtPayload | null;
  /** Copies refreshed auth cookies and their no-store headers onto the outgoing response. */
  commit: <T extends NextResponse>(response: T) => T;
};

/**
 * Refreshes the Supabase session for this request. Refreshed cookies are
 * written onto the request first, so the response that next-intl builds from
 * the request headers forwards them to Server Components in the same pass.
 */
export async function refreshSession(request: NextRequest): Promise<ProxySession> {
  if (!isSupabaseConfigured()) {
    return { claims: null, commit: (response) => response };
  }

  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.push(cookie);
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  // Nothing may run between creating the client and getClaims(): it is what
  // refreshes an expiring session.
  const { data } = await supabase.auth.getClaims();

  return {
    claims: data?.claims ?? null,
    commit(response) {
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      for (const [key, value] of Object.entries(pendingHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    },
  };
}
