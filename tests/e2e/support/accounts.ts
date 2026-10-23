import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/lib/supabase/database.types";
import { localSupabase } from "./local-supabase";

// Local-only fixture accounts. They exist solely in the disposable Docker stack.
export const E2E_OWNER = { email: "e2e-owner@cvstudio.test", password: "E2e-Owner-Pass-2026" };
export const E2E_INTRUDER = {
  email: "e2e-intruder@cvstudio.test",
  password: "E2e-Intruder-Pass-2026",
};

/**
 * A second allowlisted owner for the CV builder flows. Its workspace is seeded
 * with a full career profile and never shared with the career-data tests,
 * which run in parallel against the first owner.
 */
export const E2E_BUILDER = {
  email: "e2e-builder@cvstudio.test",
  password: "E2e-Builder-Pass-2026",
};

export const OWNER_STORAGE_STATE = "playwright/.auth/owner.json";
export const BUILDER_STORAGE_STATE = "playwright/.auth/builder.json";

function admin() {
  const { url, secretKey } = localSupabase();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureUser({ email, password }: { email: string; password: string }) {
  const client = admin();
  const { data: list, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const existing = list.users.find((user) => user.email === email);
  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`could not create ${email}`);
  return data.user.id;
}

/** Top-level tables; child rows cascade with their parents. */
const OWNER_TABLES = [
  // AI usage and settings too, so every run starts with AI off and a full daily quota.
  "ai_requests",
  "owner_settings",
  "job_posts",
  "cv_documents",
  "cv_templates",
  "profile_links",
  "experiences",
  "educations",
  "skill_groups",
  "projects",
  "certifications",
  "soft_skills",
  "spoken_languages",
  "custom_sections",
] as const;

async function resetWorkspace(ownerId: string) {
  const client = admin();
  for (const table of OWNER_TABLES) {
    const { error } = await client.from(table).delete().eq("owner_id", ownerId);
    if (error) throw error;
  }
  const { error } = await client
    .from("profiles")
    .update({
      full_name: "",
      title_i18n: {},
      summary_i18n: {},
      location_i18n: {},
      email: null,
      phone: null,
      photo_path: null,
    })
    .eq("owner_id", ownerId);
  if (error) throw error;
}

/** Creates (or resets) both owners and the non-allowlisted account, with empty workspaces. */
export async function provisionAccounts() {
  const client = admin();
  const ownerId = await ensureUser(E2E_OWNER);
  const builderId = await ensureUser(E2E_BUILDER);
  const intruderId = await ensureUser(E2E_INTRUDER);

  await client.from("app_owners").upsert([{ user_id: ownerId }, { user_id: builderId }]);
  await client.from("app_owners").delete().eq("user_id", intruderId);

  await resetWorkspace(ownerId);
  await resetWorkspace(builderId);
  return { ownerId, builderId, intruderId };
}
