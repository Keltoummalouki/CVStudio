"use server";

import { LOGIN_PATH, sanitizeNextPath } from "@/lib/auth/routes";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { redirect } from "@/lib/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapSignInError } from "./errors";
import { signInSchema, type AuthErrorCode } from "./schema";

export type SignInResult = { ok: false; error: AuthErrorCode };

/**
 * Signs in with email and password, then enforces the owner allowlist: a valid
 * account that is not allowlisted is signed straight back out. On success the
 * browser is redirected to the sanitized `next` path.
 */
export async function signIn(input: unknown): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const { email, password, locale, next } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: mapSignInError(error) };

  const allowlist = await supabase
    .from("app_owners")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (allowlist.error || !allowlist.data) {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, error: allowlist.error ? "unavailable" : "not_authorized" };
  }

  return redirect({ href: sanitizeNextPath(next), locale });
}

/** Signs out this browser only; sessions on the owner's other devices stay active. */
export async function signOut(locale: unknown): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect({
    href: { pathname: LOGIN_PATH, query: { reason: "signed_out" } },
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
  });
}
