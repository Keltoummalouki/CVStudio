import { expect, test as setup, type Page } from "@playwright/test";
import {
  BUILDER_STORAGE_STATE,
  E2E_BUILDER,
  E2E_OWNER,
  OWNER_STORAGE_STATE,
  provisionAccounts,
} from "./support/accounts";
import { seedBuilderWorkspace } from "./support/seed";

async function signIn(page: Page, account: { email: string; password: string }, path: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await page.context().storageState({ path });
}

setup("provision accounts and sign in as both owners", async ({ browser }) => {
  await provisionAccounts();
  await seedBuilderWorkspace();

  for (const [account, path] of [
    [E2E_OWNER, OWNER_STORAGE_STATE],
    [E2E_BUILDER, BUILDER_STORAGE_STATE],
  ] as const) {
    // Manually created contexts do not inherit the project's baseURL.
    const context = await browser.newContext({ baseURL: setup.info().project.use.baseURL });
    await signIn(await context.newPage(), account, path);
    await context.close();
  }
});
