import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_INTRUDER, E2E_OWNER } from "./support/accounts";

// Every test here starts signed out.
test.use({ storageState: { cookies: [], origins: [] } });

/** The form's own alert (Next's route announcer also uses role="alert"). */
function formAlert(page: Page) {
  return page.locator("form").getByRole("alert");
}

async function signIn(page: Page, { email, password }: { email: string; password: string }) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("authentication", () => {
  test("sends signed-out visitors to the login page and back after sign-in", async ({ page }) => {
    await page.goto("/en/dashboard/cvs");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard%2Fcvs$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

    await signIn(page, E2E_OWNER);
    await expect(page).toHaveURL(/\/en\/dashboard\/cvs$/);
    await expect(page.getByRole("heading", { level: 1, name: "CVs" })).toBeVisible();
  });

  test("explains a wrong password without revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/en/login");
    await signIn(page, { email: E2E_OWNER.email, password: "Not-The-Password-1" });

    await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

    await signIn(page, { email: "nobody@cvstudio.test", password: "Not-The-Password-1" });
    await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  test("validates fields before contacting the server", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("This field is required.")).toHaveCount(2);
    await expect(page.getByLabel("Email")).toBeFocused();

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("x");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("refuses a valid account that is not the workspace owner", async ({ page }) => {
    await page.goto("/en/login");
    await signIn(page, E2E_INTRUDER);
    await expect(formAlert(page)).toHaveText("This account is not allowed to use this workspace.");

    // The rejected session was discarded immediately.
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard$/);
  });

  test("ignores off-site destinations after sign-in", async ({ page }) => {
    await page.goto("/en/login?next=%2F%2Fevil.example%2Fsteal");
    await signIn(page, E2E_OWNER);
    await expect(page).toHaveURL(/127\.0\.0\.1:3100\/en\/dashboard$/);
  });

  test("signs out from settings and protects the dashboard again", async ({ page }) => {
    await page.goto("/en/login");
    await signIn(page, E2E_OWNER);
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    await page.goto("/en/dashboard/settings");
    await expect(page.getByText(`Signed in as ${E2E_OWNER.email}`)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/en\/login\?reason=signed_out$/);
    await expect(page.getByText("You’re signed out.")).toBeVisible();

    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard$/);
  });

  test("a signed-in owner skips the login page", async ({ page }) => {
    await page.goto("/fr/login");
    await page.getByLabel("E-mail").fill(E2E_OWNER.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_OWNER.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/fr\/dashboard$/);

    await page.goto("/fr/login");
    await expect(page).toHaveURL(/\/fr\/dashboard$/);
  });

  test("the login page meets WCAG 2.2 AA (serious and critical)", async ({ page }) => {
    await page.goto("/fr/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(blocking.map((violation) => violation.id)).toEqual([]);
  });
});
