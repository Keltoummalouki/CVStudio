import { readFile } from "node:fs/promises";
import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import { BUILDER_STORAGE_STATE, OWNER_STORAGE_STATE } from "./support/accounts";
import { readPdfText } from "./support/pdf-text";
import { SEED } from "./support/seed";

// The builder owner has a seeded career profile of its own (see support/seed.ts).
test.use({ storageState: BUILDER_STORAGE_STATE });

const unique = () => Math.random().toString(36).slice(2, 8);
const CV_URL = /\/en\/dashboard\/cvs\/([0-9a-f-]{36})$/;

async function createCv(page: Page, name: string, language: "English" | "French") {
  await page.goto("/en/dashboard/cvs/new");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByRole("radio", { name: new RegExp(`^${language}`) }).check();
  await page.getByRole("button", { name: "Create and open" }).click();
  await expect(page).toHaveURL(CV_URL);
  await expect(page.getByRole("textbox", { name: "CV name" })).toHaveValue(name);
  return CV_URL.exec(page.url())?.[1] ?? "";
}

test.describe("CV export", () => {
  test.skip(({ isMobile }) => isMobile, "Export flows run on the desktop project.");

  test("Print opens the CV alone on A4 and starts the print dialog", async ({ page, context }) => {
    // The real dialog would block the headless browser; record the call instead.
    await context.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.printed = "true";
      };
    });
    const id = await createCv(page, `Print ${unique()}`, "English");

    const [printTab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Print", exact: true }).click(),
    ]);
    await printTab.waitForURL(new RegExp(`/en/print/${id}\\?print=1$`));
    await expect(printTab.locator("article[data-visual-template]")).toBeVisible();
    await expect(printTab.locator("html")).toHaveAttribute("data-printed", "true");
    // Only the document: no dashboard navigation around it.
    await expect(printTab.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
    await printTab.emulateMedia({ media: "print" });
    await expect(printTab.getByRole("button", { name: "Download PDF" })).toBeHidden();
  });

  // The only test that renders a PDF: the export limiter allows one at a time
  // per owner, so parallel export tests would collide.
  test("Download PDF returns a real PDF named after the CV, in reading order", async ({ page }) => {
    const name = `Export ${unique()}`;
    await createCv(page, name, "English");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`${name}.pdf`);
    const bytes = await readFile((await download.path()) ?? "");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(10_000);
    // One A4 page for the seeded profile.
    expect(bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
    await expect(page.getByText("PDF downloaded")).toBeVisible();

    // ATS parsers read the order stored in the file, not the visual layout:
    // each achievement must come under its job, before the later sections.
    const text = await readPdfText(bytes);
    const positions = [
      SEED.experienceRoles.en,
      "medical appointment booking platform",
      "overall user experience",
      "Web developer intern",
      "showcase website",
      "Full stack development training",
      "Arabic",
    ].map((fragment) => text.indexOf(fragment));
    expect(positions, text).not.toContain(-1);
    expect(positions, text).toEqual([...positions].sort((a, b) => a - b));
  });

  test("a missing translation blocks printing and the PDF", async ({ page }) => {
    // The seeded profile has one English-only project description.
    const id = await createCv(page, `Blocked ${unique()}`, "French");

    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect(page.getByText("Translate 1 text before printing or exporting.")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Before you export" })).toBeVisible();

    const response = await page.request.get(`/api/cvs/${id}/pdf`);
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: "missing_translations", count: 1 });

    await page.goto(`/en/print/${id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "This CV can’t be printed yet" }),
    ).toBeVisible();
    await expect(page.locator("article[data-visual-template]")).toHaveCount(0);
  });

  test("the PDF route refuses anonymous callers and other owners", async ({ page, baseURL }) => {
    const id = await createCv(page, `Private ${unique()}`, "English");

    // Request contexts inherit the project's signed-in state unless told otherwise.
    const anonymous = await playwrightRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    expect((await anonymous.get(`/api/cvs/${id}/pdf`)).status()).toBe(401);
    await anonymous.dispose();

    const stranger = await playwrightRequest.newContext({
      baseURL,
      storageState: OWNER_STORAGE_STATE,
    });
    const foreign = await stranger.get(`/api/cvs/${id}/pdf`);
    expect(foreign.status()).toBe(404);
    expect(await foreign.json()).toEqual({ error: "not_found" });
    expect((await stranger.get("/api/cvs/not-a-uuid/pdf")).status()).toBe(404);
    await stranger.dispose();
  });
});

test.describe("print page on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone layout only.");

  test("shows the whole A4 sheet without horizontal scrolling", async ({ page }) => {
    const id = await createCv(page, `Phone print ${unique()}`, "English");
    await page.goto(`/en/print/${id}`);
    await expect(page.locator("html")).toHaveAttribute("data-print-ready", "true");
    const sheet = await page.locator("article[data-visual-template]").boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(sheet).not.toBeNull();
    expect((sheet?.x ?? 0) + (sheet?.width ?? 0)).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });
});
