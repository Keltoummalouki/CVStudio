"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env/public";
import type { Database } from "./database.types";

/**
 * Browser Supabase client (singleton per tab, managed by @supabase/ssr).
 * Only ever holds the publishable key; every query is still subject to RLS.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
