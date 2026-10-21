import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const isMobile = (projectName: string) => projectName === "mobile";

test.describe("locale routing", () => {
  test("the root redirects to the dashboard in the browser's language", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test.describe("French browser", () => {
    test.use({ locale: "fr-FR" });

    test("lands on the French dashboard", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/fr\/dashboard$/);
      await expect(page.getByRole("heading", { level: 1, name: "Vue d’ensemble" })).toBeVisible();
    });
  });

  test("switching language keeps the current page", async ({ page }) => {
    await page.goto("/en/dashboard/templates");
    const switcher = page
      .getByRole("navigation", { name: "Interface language" })
      .filter({ visible: true })
      .first();
    await switcher.getByRole("link", { name: "Français" }).click();

    await expect(page).toHaveURL(/\/fr\/dashboard\/templates$/);
    await expect(page.getByRole("heading", { level: 1, name: "Modèles" })).toBeVisible();
  });

  test("unknown pages show a localized not-found page", async ({ page }) => {
    const response = await page.goto("/fr/dashboard/does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  });
});

test.describe("dashboard shell", () => {
  test("primary navigation reaches every section and marks the current page", async ({
    page,
  }, testInfo) => {
    await page.goto("/en/dashboard");
    const nav = page.getByRole("navigation", { name: "Main navigation" }).filter({ visible: true });
    await expect(nav).toHaveCount(1);

    const destinations = isMobile(testInfo.project.name)
      ? [
          ["Data", "Career data"],
          ["CVs", "CVs"],
          ["Templates", "Templates"],
          ["Settings", "Settings"],
          ["Overview", "Overview"],
        ]
      : [
          ["Career data", "Career data"],
          ["CVs", "CVs"],
          ["Templates", "Templates"],
          ["Settings", "Settings"],
          ["Overview", "Overview"],
        ];

    for (const [linkName, heading] of destinations) {
      await nav.getByRole("link", { name: linkName, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole("link", { name: linkName, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("uses the ink rail on desktop and the tab bar on mobile", async ({ page }, testInfo) => {
    await page.goto("/en/dashboard");
    const tabBar = page.locator("nav.fixed.bottom-0");
    const rail = page.locator("aside");

    if (isMobile(testInfo.project.name)) {
      await expect(tabBar).toBeVisible();
      await expect(rail).toBeHidden();
    } else {
      await expect(rail).toBeVisible();
      await expect(tabBar).toBeHidden();
    }
  });

  test("the skip link moves focus to the main content", async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), "Keyboard flow is verified on desktop.");
    await page.goto("/en/dashboard");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  for (const locale of ["en", "fr"]) {
    test(`${locale} sidebar controls stay reachable in a short window`, async ({
      page,
    }, testInfo) => {
      test.skip(isMobile(testInfo.project.name), "The sidebar is a desktop surface.");
      await page.setViewportSize({ width: 1024, height: 500 });
      await page.goto(`/${locale}/dashboard/content`);
      const rail = page.locator("aside");
      await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(rail.getByRole("link", { name: "Français", exact: true })).toBeVisible();

      // Native tabbing must scroll every control into view, including the footer.
      await page.keyboard.press("Tab"); // Skip to content.
      for (const control of await rail.locator("a, button").all()) {
        await page.keyboard.press("Tab");
        await expect(control).toBeFocused();
        await expect(control).toBeInViewport({ ratio: 1 });
      }

      const dimensions = await rail.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  }

  test("explains setup progress and the empty CV list without inventing content", async ({
    page,
  }) => {
    // Other specs add career data in parallel, so assert structure, not exact counts.
    await page.goto("/en/dashboard");
    await expect(page.getByRole("heading", { name: "Getting started" })).toBeVisible();
    await expect(page.getByText(/^[0-4] of 4 done$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "No CVs yet" })).toBeVisible();
  });

  test("private pages send hardening headers", async ({ page }) => {
    const response = await page.goto("/en/dashboard");
    const headers = response?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});

test.describe("layout", () => {
  for (const path of [
    "/en/dashboard",
    "/fr/dashboard/content",
    "/fr/dashboard/content/skills",
    "/en/dashboard/content/experiences/new",
    "/fr/dashboard/content/profile",
    "/en/dashboard/settings",
  ]) {
    test(`${path} never scrolls horizontally`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});

test.describe("accessibility", () => {
  for (const path of [
    "/en/dashboard",
    "/fr/dashboard/content",
    "/en/dashboard/cvs",
    "/fr/dashboard/templates",
    "/en/dashboard/settings",
  ]) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const blocking = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(
        blocking.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target).join(" | ")}`,
        ),
      ).toEqual([]);
    });
  }
});
