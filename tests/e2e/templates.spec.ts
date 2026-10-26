import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { Database } from "../../src/lib/supabase/database.types";
import { BUILDER_STORAGE_STATE, E2E_BUILDER, OWNER_STORAGE_STATE } from "./support/accounts";
import { localSupabase } from "./support/local-supabase";
import { readPdfText } from "./support/pdf-text";
import { SEED } from "./support/seed";

// The builder owner has a seeded career profile of its own (see support/seed.ts).
test.use({ storageState: BUILDER_STORAGE_STATE });

const unique = () => Math.random().toString(36).slice(2, 8);
const CV_URL = /\/en\/dashboard\/cvs\/[0-9a-f-]{36}$/;
const TEMPLATE_URL = /\/en\/dashboard\/templates\/[0-9a-f-]{36}$/;

const canvas = (page: Page) => page.getByRole("region", { name: "Design canvas" });
const frame = (page: Page, name: RegExp) => canvas(page).getByRole("button", { name });
const field = (page: Page, name: string) => page.getByRole("spinbutton", { name, exact: true });
const expectSaved = (page: Page) =>
  expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

/** "Create a template": a blank A4 page in the designer, renamed. */
async function createDesign(page: Page, name: string) {
  await page.goto("/en/dashboard/templates");
  await page.getByRole("button", { name: "Create a template" }).first().click();
  await expect(page).toHaveURL(TEMPLATE_URL);
  await page.getByRole("textbox", { name: "Template name" }).fill(name);
}

/** A new CV drawn by the design open in the designer; returns its id. */
async function useForNewCv(page: Page, design: string) {
  await expectSaved(page);
  await page.getByRole("link", { name: "Use for a new CV" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/cvs\/new\?template=/);
  await expect(page.getByRole("radio", { name: new RegExp(`^${design}`) })).toBeChecked();
  await page.getByRole("radio", { name: /^English/ }).check();
  await page.getByRole("textbox", { name: "Name" }).fill(`CV ${design}`);
  await page.getByRole("button", { name: "Create and open" }).click();
  await expect(page).toHaveURL(CV_URL);
  return page.url().split("/").at(-1) ?? "";
}

/** PDF exports run one at a time per owner: wait while another test's export runs. */
async function requestPdf(page: Page, id: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await page.request.get(`/api/cvs/${id}/pdf`);
    if (response.status() !== 429) return response;
    await page.waitForTimeout(1000);
  }
  throw new Error("The PDF export stayed busy");
}

/** Drags the pointer from the centre of a box by (dx, dy) screen pixels. */
async function drag(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe("template designer", () => {
  test.skip(({ isMobile }) => isMobile, "The designer is laid out for larger screens.");

  test("designs a blank page: adds, moves and resizes elements, and keeps them", async ({
    page,
  }) => {
    const name = `Design ${unique()}`;
    await createDesign(page, name);
    await expect(canvas(page).getByText(/Add elements from the list/)).toBeVisible();

    await page.getByRole("button", { name: "Add Name" }).click();
    const nameFrame = frame(page, /^Name, at 15 by 15 mm/);
    await expect(nameFrame).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Name On the page$/ })).toBeDisabled();

    // The keyboard moves it: Shift for 5 mm.
    await nameFrame.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(frame(page, /^Name, at 20 by 15 mm/)).toBeVisible();
    await expect(field(page, "X")).toHaveValue("20");

    // The mouse drags it down the page…
    const box = await frame(page, /^Name, at/).boundingBox();
    if (!box) throw new Error("The name has no box");
    await drag(page, box, 0, 160);
    await expect.poll(async () => Number(await field(page, "Y").inputValue())).toBeGreaterThan(40);

    // …and the corner handle makes it wider.
    const handle = canvas(page).locator('[data-handle="se"]');
    const corner = await handle.boundingBox();
    if (!corner) throw new Error("The resize handle has no box");
    await drag(page, corner, 60, 0);
    await expect
      .poll(async () => Number(await field(page, "Width").inputValue()))
      .toBeGreaterThan(130);

    await page.getByRole("button", { name: "Add Work experience" }).click();
    await expectSaved(page);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(name);
    await expect(frame(page, /^Name, at/)).toBeVisible();
    await expect(frame(page, /^Work experience, at/)).toBeVisible();
    // The live preview shows real career data.
    await expect(canvas(page).getByText(SEED.fullName)).toBeVisible();
  });

  test("a CV made from a design is drawn by it, in print and in a PDF read in order", async ({
    page,
  }) => {
    const name = `Layout ${unique()}`;
    await createDesign(page, name);
    // The name at the top, the experience below it: the reading order.
    await page.getByRole("button", { name: "Add Name" }).click();
    await page.getByRole("button", { name: "Add Work experience" }).click();
    const id = await useForNewCv(page, name);

    await expect(
      page.locator('article[data-visual-template="canvas-v1"]').filter({ visible: true }),
    ).toBeVisible();

    const response = await requestPdf(page, id);
    expect(response.status()).toBe(200);
    const text = await readPdfText(await response.body());
    const positions = [SEED.fullName, SEED.experienceRoles.en].map((part) => text.indexOf(part));
    expect(positions, text).not.toContain(-1);
    expect(positions, text).toEqual([...positions].sort((a, b) => a - b));
  });

  test("text a design cuts off blocks the export until it fits", async ({ page }) => {
    const name = `Cramped ${unique()}`;
    await createDesign(page, name);
    await page.getByRole("button", { name: "Add Work experience" }).click();
    // A fixed box far too small for the seeded experience.
    await page.getByRole("switch", { name: "Grow to fit the text" }).click();
    await field(page, "Height").fill("6");
    await expect(page.getByText(/Work experience: the text doesn’t fit its box/)).toBeVisible();
    const id = await useForNewCv(page, name);

    await expect(
      page.getByText(/The design doesn’t fit this CV’s content in 1 place/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect(page.getByText(/Fix 1 layout problem before exporting/)).toBeVisible();

    const response = await requestPdf(page, id);
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: "layout_issues", count: 1 });
  });

  test("duplicates a design from its editor and deletes it with undo", async ({ page }) => {
    const name = `Copied ${unique()}`;
    await createDesign(page, name);
    await page.getByRole("button", { name: "Add Name" }).click();
    await expectSaved(page);

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(
      `Copy of ${name}`,
    );
    await expect(frame(page, /^Name, at/)).toBeVisible();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete template" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete template" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/templates$/);
    await expect(page.getByRole("link", { name: new RegExp(`Copy of ${name}`) })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page).toHaveURL(TEMPLATE_URL);
    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue(
      `Copy of ${name}`,
    );
  });

  test("CV setups saved as templates before designs existed are no longer offered", async ({
    page,
  }) => {
    const legacy = `Legacy setup ${unique()}`;
    const { url, publishableKey } = localSupabase();
    const client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword(E2E_BUILDER);
    if (signInError) throw signInError;
    const { error } = await client
      .from("cv_templates")
      .insert({ name: legacy, locale: "en", definition: { schemaVersion: 1 } });
    if (error) throw error;

    try {
      await page.goto("/en/dashboard/templates");
      await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
      await expect(page.getByText(legacy)).toHaveCount(0);
      await page.goto("/en/dashboard/cvs/new");
      await expect(page.getByRole("radio", { name: /^Classic/ })).toBeChecked();
      await expect(page.getByRole("radio", { name: new RegExp(legacy) })).toHaveCount(0);
    } finally {
      await client.from("cv_templates").delete().eq("name", legacy);
    }
  });

  test("another owner can neither open nor use the design", async ({ page, browser }) => {
    const name = `Private ${unique()}`;
    await createDesign(page, name);
    await expectSaved(page);
    const url = page.url();
    const id = url.split("/").at(-1) ?? "";

    const strangerContext = await browser.newContext({
      storageState: OWNER_STORAGE_STATE,
      baseURL: test.info().project.use.baseURL,
    });
    const stranger = await strangerContext.newPage();
    await stranger.goto(url);
    await expect(stranger.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    // A foreign id in the link preselects nothing.
    await stranger.goto(`/en/dashboard/cvs/new?template=${id}`);
    await expect(stranger.getByRole("radio", { name: new RegExp(name) })).toHaveCount(0);
    await strangerContext.close();

    await page.goto("/en/dashboard/templates/not-a-uuid");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });

  test("the gallery and the designer meet WCAG 2.2 AA (serious and critical)", async ({ page }) => {
    const name = `A11y ${unique()}`;
    await createDesign(page, name);
    await page.getByRole("button", { name: "Add Name" }).click();
    await page.getByRole("button", { name: "Add Work experience" }).click();
    await expectSaved(page);

    for (const check of [
      async () => undefined,
      async () => page.goto("/en/dashboard/templates"),
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
