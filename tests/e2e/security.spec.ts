import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { BUILDER_STORAGE_STATE } from "./support/accounts";

// The builder owner's seeded workspace has career data and a portrait.
test.use({ storageState: BUILDER_STORAGE_STATE });

const CV_URL = /\/en\/dashboard\/cvs\/([0-9a-f-]{36})$/;

/** Collects what the browser refused under the Content-Security-Policy. */
function watchPolicyViolations(page: Page) {
  const violations: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
      violations.push(`${new URL(page.url()).pathname}: ${message.text().slice(0, 200)}`);
    }
  });
  return violations;
}

async function expectPortraitLoaded(page: Page, name: string) {
  const portrait = page.getByRole("img", { name });
  await expect(portrait).toBeVisible();
  // Rendered from the private bucket through a signed URL the policy allows.
  await expect
    .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
}

test.describe("security headers", () => {
  test.skip(({ isMobile }) => isMobile, "Headers do not depend on the viewport.");

  test("every page is sent with the Content-Security-Policy and hardening headers", async ({
    page,
  }) => {
    const response = await page.goto("/en/dashboard");
    const headers = response?.headers() ?? {};

    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("the app works under the policy: dashboard, career data, builder and print page", async ({
    page,
    context,
  }) => {
    const violations = watchPolicyViolations(page);

    for (const path of [
      "/en/dashboard",
      "/fr/dashboard/content",
      "/en/dashboard/templates",
      "/fr/dashboard/settings",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
    }

    await page.goto("/en/dashboard/content/profile");
    await expectPortraitLoaded(page, "Profile photo");

    await page.goto("/en/dashboard/cvs/new");
    await page.getByRole("textbox", { name: "Name" }).fill(`Policy ${Date.now()}`);
    await page.getByRole("radio", { name: /^English/ }).check();
    await page.getByRole("button", { name: "Create and open" }).click();
    await expect(page).toHaveURL(CV_URL);
    const id = CV_URL.exec(page.url())?.[1] ?? "";
    // The live preview renders the CV, portrait included.
    await expectPortraitLoaded(page, "Portrait");

    const print = await context.newPage();
    const printViolations = watchPolicyViolations(print);
    await print.goto(`/en/print/${id}`);
    await expect(print.locator("html")).toHaveAttribute("data-print-ready", "true");
    await expectPortraitLoaded(print, "Portrait");

    expect([...violations, ...printViolations]).toEqual([]);
  });
});
