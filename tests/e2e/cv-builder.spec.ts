import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BUILDER_STORAGE_STATE } from "./support/accounts";
import { SEED } from "./support/seed";

// The builder owner has a seeded career profile of its own (see support/seed.ts).
test.use({ storageState: BUILDER_STORAGE_STATE });

const unique = () => Math.random().toString(36).slice(2, 8);
const CV_URL = /\/en\/dashboard\/cvs\/[0-9a-f-]{36}$/;

// Visible only: Next keeps pages navigated away from mounted but hidden, and the
// Templates gallery draws each template's first page with the same renderer.
const preview = (page: Page) =>
  page.locator("article[data-visual-template]").filter({ visible: true });
const outline = (page: Page) => page.getByRole("navigation", { name: "CV structure" });
const saveStatus = (page: Page) =>
  page
    .getByRole("status")
    .filter({ hasText: /^(All changes saved|Saved|Saving…|Unsaved changes)$/ });

async function createCv(page: Page, name: string, language: "English" | "French") {
  await page.goto("/en/dashboard/cvs/new");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByRole("radio", { name: new RegExp(`^${language}`) }).check();
  await page.getByRole("button", { name: "Create and open" }).click();
  await expect(page).toHaveURL(CV_URL);
  await expect(page.getByRole("textbox", { name: "CV name" })).toHaveValue(name);
}

async function openSection(page: Page, name: string) {
  // Phones show the outline and the editor one at a time.
  const views = page.getByRole("tablist", { name: "Editor view" });
  if (await views.isVisible()) await views.getByRole("tab", { name: "Edit" }).click();
  await outline(page)
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}

async function expectSaved(page: Page) {
  await expect(saveStatus(page)).toHaveText("Saved");
}

test.describe("CV builder", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop flows; the mobile layout has its own test.");

  test("creates a CV from career data and keeps edits after reload", async ({ page }) => {
    const name = `Builder ${unique()}`;
    await createCv(page, name, "English");

    await expect(page.getByRole("textbox", { name: "CV name" })).toHaveValue(name);
    await expect(preview(page).getByRole("heading", { level: 1 })).toHaveText(SEED.title.en);
    await expect(preview(page)).toContainText("February 2026 – Present");
    await expect(page.getByRole("button", { name: "Ready" })).toBeVisible();

    // Hide a whole section: it leaves the preview, autosaves, and survives a reload.
    await outline(page).getByRole("button", { name: "Show “Soft skills” on the CV" }).click();
    await expect(preview(page).locator('[data-section-kind="soft_skills"]')).toHaveCount(0);
    await expectSaved(page);

    await page.reload();
    await expect(preview(page)).toBeVisible();
    await expect(preview(page).locator('[data-section-kind="soft_skills"]')).toHaveCount(0);
    await expect(
      outline(page).getByRole("button", { name: "Show “Soft skills” on the CV" }),
    ).toHaveAttribute("aria-pressed", "false");

    await page.goto("/en/dashboard/cvs");
    // Ten CVs per page: parallel tests may push this one past the first page.
    await page.getByRole("searchbox", { name: "Search your CVs" }).fill(name);
    await expect(page.getByRole("link", { name: new RegExp(name) })).toContainText(
      "Ready to export",
    );
  });

  test("blocks a French CV on a missing translation until it is resolved for this CV", async ({
    page,
  }) => {
    await createCv(page, `Français ${unique()}`, "French");
    await expect(preview(page).getByRole("heading", { level: 1 })).toHaveText(SEED.title.fr);
    await expect(preview(page)).toContainText("Février 2026 – Présent");

    const issues = page.getByRole("button", { name: "1 to translate" });
    await expect(issues).toBeVisible();
    await issues.click();
    const panel = page.getByRole("dialog", { name: "Before you export" });
    await expect(panel).toContainText("Description missing in French");
    await panel.getByRole("button", { name: "Show" }).click();

    // The projects section opens; reword the English-only description for this CV.
    await expect(page.getByRole("heading", { level: 2, name: "Projects" })).toBeVisible();
    await page.getByRole("button", { name: /^Plateforme de réservation/ }).click();
    await page
      .getByRole("textbox", { name: "Description on this CV" })
      .fill("Plateforme de réservation de services avec gestion des disponibilités.");

    await expect(page.getByRole("button", { name: "Ready" })).toBeVisible();
    await expect(preview(page)).toContainText("gestion des disponibilités");
    await expect(preview(page).locator("[data-missing]")).toHaveCount(0);
    await expectSaved(page);

    // The override belongs to this CV only: the career data still lacks French.
    await page.reload();
    await expect(page.getByRole("button", { name: "Ready" })).toBeVisible();
  });

  test("orders sections and entries, hides entries and rewords headings", async ({ page }) => {
    await createCv(page, `Order ${unique()}`, "English");
    const sectionKinds = () =>
      preview(page)
        .locator("section[data-section-kind]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-section-kind")));

    expect((await sectionKinds()).slice(0, 2)).toEqual(["technical_skills", "experience"]);
    // Keyboard path of the dense outline: the move buttons appear once the row has focus.
    await outline(page).getByRole("button", { name: "Reorder Work experience" }).focus();
    await page.keyboard.press("Tab");
    await expect(
      outline(page).getByRole("button", { name: "Move up: Work experience" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await sectionKinds()).slice(0, 2))
      .toEqual(["experience", "technical_skills"]);

    await openSection(page, "Work experience");
    await page.getByRole("button", { name: "Show “Web developer intern” on the CV" }).click();
    await expect(preview(page)).not.toContainText("Sample Studio");

    await page.getByRole("textbox", { name: "Heading on this CV" }).fill("Selected experience");
    await expect(preview(page).locator('[data-section-kind="experience"] h2')).toHaveText(
      "Selected experience",
    );

    // Undo restores the previous heading.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(preview(page).locator('[data-section-kind="experience"] h2')).toHaveText(
      "Professional experience",
    );
    await expectSaved(page);
  });

  test("hides single achievements and technologies of an entry", async ({ page }) => {
    await createCv(page, `Details ${unique()}`, "English");
    await openSection(page, "Work experience");
    await page.getByRole("button", { name: /^Full stack developer/ }).click();

    await page
      .getByRole("button", {
        name: "Show “Improved user interfaces and the overall user experience.” on the CV",
      })
      .click();
    await page.getByRole("button", { name: "Docker", exact: true }).first().click();

    const entry = preview(page).locator('[data-section-kind="experience"]');
    await expect(entry).not.toContainText("Improved user interfaces");
    await expect(entry).not.toContainText("Docker");
    await expect(entry).toContainText("Ruby on Rails, Angular, MongoDB, Git/GitHub");
  });

  test("duplicates and deletes CVs from the list, with undo", async ({ page }) => {
    const name = `List ${unique()}`;
    await createCv(page, name, "English");
    await page.goto("/en/dashboard/cvs");
    // Finds the CV and its copy whatever page they land on.
    await page.getByRole("searchbox", { name: "Search your CVs" }).fill(name);

    await page.getByRole("button", { name: `More actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("link", { name: new RegExp(`Copy of ${name}`) })).toBeVisible();

    await page.getByRole("button", { name: `More actions for Copy of ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: new RegExp(`Copy of ${name}`) })).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("link", { name: new RegExp(`Copy of ${name}`) })).toBeVisible();
  });

  test("reports a conflict instead of overwriting another tab", async ({ page, context }) => {
    await createCv(page, `Conflict ${unique()}`, "English");
    const other = await context.newPage();
    await other.goto(page.url());
    await expect(preview(other)).toBeVisible();

    await outline(page).getByRole("button", { name: "Show “Languages” on the CV" }).click();
    await expectSaved(page);

    await outline(other).getByRole("button", { name: "Show “Certifications” on the CV" }).click();
    const conflict = other.getByRole("alert").filter({ hasText: "changed in another tab" });
    await expect(conflict).toBeVisible();

    await other.getByRole("button", { name: "Keep my version" }).click();
    await expect(conflict).toHaveCount(0);
    await expectSaved(other);
    await other.close();
  });

  test("never opens another owner's CV or a malformed id", async ({ page, browser }) => {
    await createCv(page, `Private ${unique()}`, "English");
    const url = page.url();

    // The first e2e owner is a different, fully authorized account.
    const strangerContext = await browser.newContext({
      storageState: "playwright/.auth/owner.json",
      baseURL: test.info().project.use.baseURL,
    });
    const stranger = await strangerContext.newPage();
    // Ownership is checked by the query and by RLS: the page is simply not found.
    await stranger.goto(url);
    await expect(stranger.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(stranger.locator("article[data-visual-template]")).toHaveCount(0);
    await strangerContext.close();

    await page.goto("/en/dashboard/cvs/not-a-uuid");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });

  test("builder and CV pages meet WCAG 2.2 AA (serious and critical)", async ({ page }) => {
    await createCv(page, `A11y ${unique()}`, "French");
    for (const check of [
      async () => undefined,
      async () => openSection(page, "Projects"),
      async () => page.goto("/en/dashboard/cvs"),
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

test.describe("CV builder on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone layout only.");

  test("switches between editing and preview without horizontal scrolling", async ({ page }) => {
    await createCv(page, `Phone ${unique()}`, "English");
    const views = page.getByRole("tablist", { name: "Editor view" });
    await expect(views.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
    await expect(preview(page)).toBeHidden();

    await openSection(page, "Education");
    await expect(page.getByRole("heading", { level: 2, name: "Education" })).toBeVisible();
    await page.getByRole("button", { name: "Move down: Full stack development training" }).click();

    await views.getByRole("tab", { name: "Edit" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(views.getByRole("tab", { name: "Preview" })).toBeFocused();
    await expect(views.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(preview(page)).toBeVisible();
    await expect(preview(page).locator('[data-section-kind="education"]')).toContainText(
      /Baccalaureate[\s\S]*Full stack development training/,
    );

    // Zoom stays inside the canvas; the rest of the phone layout never scrolls sideways.
    await page.getByRole("button", { name: "View at 100%" }).click();
    const canvas = page.getByRole("region", { name: "CV preview canvas" });
    expect(await canvas.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    expect(
      await canvas.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);

    await views.getByRole("tab", { name: "Preview" }).focus();
    await page.keyboard.press("Home");
    await expect(views.getByRole("tab", { name: "Edit" })).toBeFocused();
    await expect(preview(page)).toBeHidden();
    await page.keyboard.press("End");
    await expect(views.getByRole("tab", { name: "Preview" })).toBeFocused();
    await expect(preview(page)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
