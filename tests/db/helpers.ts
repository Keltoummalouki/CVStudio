import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function config() {
  return inject("supabase");
}

export function anonClient(): Client {
  const { url, publishableKey } = config();
  return createClient<Database>(url, publishableKey, CLIENT_OPTIONS);
}

/** Bypasses RLS. Only used to provision fixtures, never to assert access. */
export function adminClient(): Client {
  const { url, secretKey } = config();
  return createClient<Database>(url, secretKey, CLIENT_OPTIONS);
}

export type TestUser = { id: string; email: string; client: Client };

// Local-only fixture password; the local stack is disposable.
const PASSWORD = "Local-Test-Password-2026";

export async function createUser({ allowlisted }: { allowlisted: boolean }): Promise<TestUser> {
  const admin = adminClient();
  const email = `test-${randomUUID()}@cvstudio.test`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  if (allowlisted) {
    const { error: allowError } = await admin.from("app_owners").insert({ user_id: data.user.id });
    if (allowError) throw allowError;
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export const PERMISSION_DENIED = "42501";
export const CHECK_VIOLATION = "23514";
export const FOREIGN_KEY_VIOLATION = "23503";
