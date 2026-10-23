import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BUILDER_STORAGE_STATE, OWNER_STORAGE_STATE } from "./support/accounts";

// The builder owner has a seeded career profile of its own (see support/seed.ts).
test.use({ storageState: BUILDER_STORAGE_STATE });

const unique = () => Math.random().toString(36).slice(2, 8);
const CV_URL = /\/en\/dashboard\/cvs\/[0-9a-f-]{36}$/;
const TEMPLATE_URL = /\/en\/dashboard\/templates\/[0-9a-f-]{36}$/;

const preview = (page: Page) => page.locator("article[data-visual-template]");
const outline = (page: Page) => page.getByRole("navigation", { name: "CV structure" });
const sectionCount = (page: Page, kind: string) =>
  preview(page).locator(`[data-section-kind="${kind}"]`);
const expectSaved = (page: Page) =>
  expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

async function createCv(page: Page, name: string) {
  await page.goto("/en/dashboard/cvs/new");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  // The built-in template: every active entry of the career data.
  await page.getByRole("radio", { name: /^Classic/ }).check();
  await page.getByRole("radio", { name: /^English/ }).check();
  await page.getByRole("button", { name: "Create and open" }).click();
  await expect(page).toHaveURL(CV_URL);
  await expect(page.getByRole("textbox", { name: "CV name" })).toHaveValue(name);
}

/** In the CV builder: More actions → Save as template. */
async function openSaveAsTemplate(page: Page) {
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Save as template…" }).click();
  return page.getByRole("dialog", { name: "Save as template" });
}

async function saveAsNewTemplate(page: Page, name: string) {
  const dialog = await openSaveAsTemplate(page);
  await dialog.getByRole("textbox", { name: "Template name" }).fill(name);
  await dialog.getByRole("textbox", { name: /Description/ }).fill("For frontend roles");
  await dialog.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText(`Template “${name}” saved`)).toBeVisible();
  await expect(dialog).toBeHidden();
}

test.describe("saved templates", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop flows.");

  test("a CV saved as a template starts new CVs that stay independent of it", async ({ page }) => {
    const template = `Template ${unique()}`;
    await createCv(page, `Source ${unique()}`);
    // A recognizable setup: no soft skills.
    await outline(page).getByRole("button", { name: "Show “Soft skills” on the CV" }).click();
    await expect(sectionCount(page, "soft_skills")).toHaveCount(0);
    await saveAsNewTemplate(page, template);

    // The template is listed, unused so far.
    await page.goto("/en/dashboard/templates");
    const row = page.getByRole("listitem").filter({ hasText: template });
    await expect(row).toContainText("For frontend roles");
    await expect(row).toContainText("No CV made from it yet");

    // Use it: the new CV form preselects it.
    await row.getByRole("link", { name: "Use template" }).click();
    await expect(page.getByRole("radio", { name: new RegExp(`^${template}`) })).toBeChecked();
    const cvName = `From template ${unique()}`;
    await page.getByRole("textbox", { name: "Name" }).fill(cvName);
    await page.getByRole("button", { name: "Create and open" }).click();
    await expect(page).toHaveURL(CV_URL);
    const cvUrl = page.url();
    await expect(preview(page)).toBeVisible();
    await expect(sectionCount(page, "soft_skills")).toHaveCount(0);
    await expect(sectionCount(page, "languages")).toHaveCount(1);

    // Editing the template later changes new CVs only.
    await page.goto("/en/dashboard/templates");
    await expect(row).toContainText("Used for 1 CV");
    await row.getByRole("link", { name: new RegExp(template) }).click();
    await expect(page).toHaveURL(TEMPLATE_URL);
    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(template);
    await outline(page).getByRole("button", { name: "Show “Languages” on the CV" }).click();
    await expect(sectionCount(page, "languages")).toHaveCount(0);
    await expectSaved(page);

    await page.goto(cvUrl);
    await expect(sectionCount(page, "languages")).toHaveCount(1);

    // Deleting the template never touches the CV made from it.
    await page.goto("/en/dashboard/templates");
    await page.getByRole("button", { name: `More actions for ${template}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("The CV made from it stays exactly as it is.");
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: new RegExp(template) })).toHaveCount(0);

    await page.goto("/en/dashboard/cvs");
    await expect(page.getByRole("link", { name: new RegExp(cvName) })).toContainText(
      `From “${template}”`,
    );
    await page.goto(cvUrl);
    await expect(sectionCount(page, "soft_skills")).toHaveCount(0);
    await expect(sectionCount(page, "languages")).toHaveCount(1);
  });

  test("replaces an existing template only after a warning", async ({ page }) => {
    const template = `Template ${unique()}`;
    await createCv(page, `First ${unique()}`);
    await saveAsNewTemplate(page, template);

    await createCv(page, `Second ${unique()}`);
    await outline(page).getByRole("button", { name: "Show “Projects” on the CV" }).click();
    const dialog = await openSaveAsTemplate(page);
    await dialog.getByRole("radio", { name: /Replace a template/ }).check();
    await dialog.getByRole("combobox", { name: "Template to replace" }).selectOption({
      label: `${template} (English)`,
    });
    await expect(dialog).toContainText(
      `“${template}” will get this CV’s sections, order, wording and language.`,
    );
    await dialog.getByRole("button", { name: "Replace template" }).click();
    await expect(page.getByText(`Template “${template}” updated`)).toBeVisible();

    await page.goto("/en/dashboard/templates");
    await page.getByRole("link", { name: new RegExp(template) }).click();
    await expect(page).toHaveURL(TEMPLATE_URL);
    await expect(sectionCount(page, "projects")).toHaveCount(0);
    // Its own description stayed.
    await expect(page.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "For frontend roles",
    );
  });

  test("duplicates a template from its editor and deletes it with undo", async ({ page }) => {
    const template = `Template ${unique()}`;
    await createCv(page, `Source ${unique()}`);
    await saveAsNewTemplate(page, template);
    await page.goto("/en/dashboard/templates");
    await page.getByRole("link", { name: new RegExp(template) }).click();
    await expect(page).toHaveURL(TEMPLATE_URL);

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(
      `Copy of ${template}`,
    );

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete template" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete template" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/templates$/);
    await expect(page.getByRole("link", { name: new RegExp(`Copy of ${template}`) })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page).toHaveURL(TEMPLATE_URL);
    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(
      `Copy of ${template}`,
    );
  });

  test("another owner can neither open nor use the template", async ({ page, browser }) => {
    const template = `Template ${unique()}`;
    await createCv(page, `Private ${unique()}`);
    await saveAsNewTemplate(page, template);
    await page.goto("/en/dashboard/templates");
    await page.getByRole("link", { name: new RegExp(template) }).click();
    await expect(page).toHaveURL(TEMPLATE_URL);
    const url = page.url();
    const id = url.split("/").at(-1) ?? "";

    const strangerContext = await browser.newContext({
      storageState: OWNER_STORAGE_STATE,
      baseURL: test.info().project.use.baseURL,
    });
    const stranger = await strangerContext.newPage();
    await stranger.goto(url);
    await expect(stranger.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();

    // A foreign id in the link preselects nothing: the stranger starts from their own data.
    await stranger.goto(`/en/dashboard/cvs/new?template=${id}`);
    await expect(stranger.getByRole("radio", { name: new RegExp(template) })).toHaveCount(0);
    await strangerContext.close();

    await page.goto("/en/dashboard/templates/not-a-uuid");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });

  test("template pages meet WCAG 2.2 AA (serious and critical)", async ({ page }) => {
    const template = `Template ${unique()}`;
    await createCv(page, `A11y ${unique()}`);
    await saveAsNewTemplate(page, template);

    for (const check of [
      async () => {
        await openSaveAsTemplate(page);
      },
      async () => page.goto("/en/dashboard/templates"),
      async () => {
        await page.getByRole("link", { name: new RegExp(template) }).click();
        await expect(page).toHaveURL(TEMPLATE_URL);
        await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(template);
        await expect(page).toHaveTitle(new RegExp(template));
      },
      async () => page.goto("/fr/dashboard/cvs/new"),
    ]) {
      await check();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const blocking = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    }
  });
});
