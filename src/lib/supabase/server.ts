import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/env/public";
import type { Database } from "./database.types";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Always create a new client per request; never cache it in
 * module scope. Authorization is enforced by RLS plus explicit ownership checks
 * in the data-access layer, never by this client alone.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Session refresh happens in
          // the proxy, so this is safe to ignore here.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
