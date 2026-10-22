import { expect, test, type Page } from "@playwright/test";
import { BUILDER_STORAGE_STATE } from "./support/accounts";
import { expectNoSeriousViolations } from "./support/axe";

// The builder owner's seeded workspace fills every list, so rows, badges and
// coverage indicators are checked too, not only empty states.
test.use({ storageState: BUILDER_STORAGE_STATE });

const CV_URL = /\/en\/dashboard\/cvs\/([0-9a-f-]{36})$/;

async function createCv(page: Page, language: "English" | "French") {
  await page.goto("/en/dashboard/cvs/new");
  await page.getByRole("textbox", { name: "Name" }).fill(`A11y ${language} ${Date.now()}`);
  await page.getByRole("radio", { name: new RegExp(`^${language}`) }).check();
  await page.getByRole("button", { name: "Create and open" }).click();
  await expect(page).toHaveURL(CV_URL);
  return CV_URL.exec(page.url())?.[1] ?? "";
}

test.describe("accessibility sweep (WCAG 2.2 AA, serious and critical)", () => {
  test("career data lists and collection editors", async ({ page }) => {
    for (const path of [
      "/fr/dashboard/content/experiences",
      "/en/dashboard/content/education",
      "/en/dashboard/content/projects",
      "/fr/dashboard/content/certifications",
      "/en/dashboard/content/custom-sections",
      "/en/dashboard/content/skills",
      "/fr/dashboard/content/soft-skills",
      "/en/dashboard/content/languages",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoSeriousViolations(page);
    }
  });

  test("the export checks panel and the blocked print page", async ({ page }) => {
    // French CVs of the seeded data have one missing translation.
    const id = await createCv(page, "French");

    await page.getByRole("button", { name: /^\d+ to translate$/ }).click();
    await expect(page.getByRole("dialog", { name: "Before you export" })).toBeVisible();
    await expectNoSeriousViolations(page);

    await page.goto(`/fr/print/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("the print page with its A4 sheet", async ({ page }) => {
    const id = await createCv(page, "English");

    await page.goto(`/en/print/${id}`);
    await expect(page.locator("html")).toHaveAttribute("data-print-ready", "true");
    await expect(page.locator("article[data-visual-template]")).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("an unknown page", async ({ page }) => {
    await page.goto("/fr/dashboard/nothing-here");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});
