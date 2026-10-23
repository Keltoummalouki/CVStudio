import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { Database, Json } from "../../src/lib/supabase/database.types";
import { BUILDER_STORAGE_STATE, E2E_BUILDER } from "./support/accounts";
import { localSupabase } from "./support/local-supabase";

// The first owner's tests expect an empty CV list (shell.spec.ts); CV flows use the builder owner.
test.use({ storageState: BUILDER_STORAGE_STATE });

const unique = () => Math.random().toString(36).slice(2, 8);
const CV_URL = /\/en\/dashboard\/cvs\/[0-9a-f-]{36}$/;

/** A valid, empty CV layout: the list resolves it like any other. */
const EMPTY_DEFINITION: NonNullable<Json> = {
  schemaVersion: 1,
  header: {
    showTitle: true,
    showName: true,
    showPhoto: false,
    showEmail: true,
    showPhone: true,
    showLocation: true,
    showLinks: true,
    links: [],
  },
  sections: [],
};

/** Signed in as the builder owner, so RLS applies as it does in the app. */
async function builderClient() {
  const { url, publishableKey } = localSupabase();
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword(E2E_BUILDER);
  if (error) throw error;
  return client;
}

const cvLinks = (page: Page, prefix: string) =>
  page.getByRole("main").getByRole("link", { name: new RegExp(prefix) });

test("the CV list pages through CVs and comes back to the same page", async ({ page }) => {
  const prefix = `Paged ${unique()}`;
  const client = await builderClient();
  // Inserted directly: much faster than creating twelve CVs in the UI.
  const { error } = await client.from("cv_documents").insert(
    Array.from({ length: 12 }, (_, index) => ({
      name: `${prefix} ${String(index + 1).padStart(2, "0")}`,
      locale: "en",
      definition: EMPTY_DEFINITION,
    })),
  );
  if (error) throw error;

  try {
    await page.goto("/en/dashboard/cvs");
    await page.getByRole("searchbox", { name: "Search your CVs" }).fill(prefix);
    await expect(page.getByText("1–10 of 12")).toBeVisible();
    await expect(cvLinks(page, prefix)).toHaveCount(10);

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("11–12 of 12")).toBeVisible();
    await expect(cvLinks(page, prefix)).toHaveCount(2);
    await expect(page).toHaveURL(/[?&]page=2(&|$)/);
    await expect(page).toHaveURL(/[?&]q=Paged/);

    // Open a CV, then come back: same page, same search.
    await cvLinks(page, prefix).first().click();
    await expect(page).toHaveURL(CV_URL);
    await page.goBack();
    await expect(page.getByText("11–12 of 12")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search your CVs" })).toHaveValue(prefix);

    // The CVs link starts the list over.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .filter({ visible: true })
      .getByRole("link", { name: "CVs" })
      .click();
    await expect(page).toHaveURL(/\/en\/dashboard\/cvs$/);
    await expect(page.getByRole("searchbox", { name: "Search your CVs" })).toHaveValue("");
    await expect(page.getByText(/^1–10 of \d+$/)).toBeVisible();
  } finally {
    // Other builder flows rank recent CVs (job scores): leave the owner's list as it was.
    await client.from("cv_documents").delete().like("name", `${prefix} %`);
  }
});
