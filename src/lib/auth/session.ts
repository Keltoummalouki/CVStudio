import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { LOGIN_PATH } from "@/lib/auth/routes";
import type { Locale } from "@/lib/i18n/config";
import { redirect } from "@/lib/i18n/navigation";
import { createSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";

export type Owner = {
  id: string;
  email: string | null;
};

export type SessionState =
  | { status: "anonymous" }
  | { status: "not_owner"; email: string | null }
  | { status: "owner"; owner: Owner };

export type OwnerContext = {
  supabase: SupabaseServerClient;
  owner: Owner;
};

export class AccessCheckError extends Error {
  constructor() {
    super("Workspace access could not be verified.");
    this.name = "AccessCheckError";
  }
}

/**
 * Verifies the session JWT and the owner allowlist once per request.
 * getClaims() validates the token signature; getSession() is never trusted
 * on the server.
 */
const resolveSession = cache(
  async (): Promise<{ supabase: SupabaseServerClient; state: SessionState }> => {
    // Authorization is decided per request, never during a (runtime) prerender:
    // supabase-js reads the clock to check token expiry, which prerendering forbids.
    await connection();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const subject = data?.claims?.sub;

    if (error || !subject) {
      return { supabase, state: { status: "anonymous" } };
    }

    const email = typeof data.claims.email === "string" ? data.claims.email : null;
    const allowlist = await supabase
      .from("app_owners")
      .select("user_id")
      .eq("user_id", subject)
      .maybeSingle();

    if (allowlist.error) throw new AccessCheckError();

    return {
      supabase,
      state: allowlist.data
        ? { status: "owner", owner: { id: subject, email } }
        : { status: "not_owner", email },
    };
  },
);

export async function getSessionState(): Promise<SessionState> {
  return (await resolveSession()).state;
}

/**
 * For Server Components: returns the owner context or redirects to the login
 * page. Data functions call this themselves; layout-level checks are UX only.
 */
export async function requireOwner(locale?: Locale): Promise<OwnerContext> {
  const { supabase, state } = await resolveSession();
  if (state.status === "owner") return { supabase, owner: state.owner };

  const targetLocale = locale ?? ((await getLocale()) as Locale);
  return redirect({
    href:
      state.status === "anonymous"
        ? LOGIN_PATH
        : { pathname: LOGIN_PATH, query: { reason: "not_authorized" } },
    locale: targetLocale,
  });
}

/** For Server Actions and Route Handlers: never redirects, returns null when unauthorized. */
export async function getOwnerContext(): Promise<OwnerContext | null> {
  const { supabase, state } = await resolveSession();
  return state.status === "owner" ? { supabase, owner: state.owner } : null;
}
