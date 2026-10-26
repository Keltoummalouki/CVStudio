import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// These flows mutate the shared e2e owner's data; run them once, on desktop.
test.skip(({ isMobile }) => isMobile, "Career-data flows run on the desktop project.");

const unique = () => Math.random().toString(36).slice(2, 8);

/** The two inputs of a localized field (English, French), found by its legend. */
function localized(page: Page, label: string) {
  const group = page.getByRole("group", { name: new RegExp(`^${label}`) }).first();
  return {
    en: group.getByRole("textbox", { name: `${label} (English)` }),
    fr: group.getByRole("textbox", { name: `${label} (French)` }),
    shared: group.getByRole("textbox", { name: `${label} (Both languages)` }),
    sameSwitch: group.getByRole("switch"),
  };
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.describe("career data", () => {
  test("creates an experience with translations, achievements and technologies", async ({
    page,
  }) => {
    const tag = unique();
    await page.goto("/en/dashboard/content/experiences/new");
    await expect(page.getByRole("heading", { level: 1, name: "New experience" })).toBeVisible();

    const role = localized(page, "Role");
    await role.en.fill(`Frontend developer ${tag}`);
    await role.fr.fill(`Développeuse frontend ${tag}`);
    await page.getByRole("textbox", { name: "Organization", exact: true }).fill(`Acme ${tag}`);
    await page.getByRole("checkbox", { name: "I currently work here" }).check();

    await page.getByRole("button", { name: "Add achievement" }).click();
    await page
      .getByRole("textbox", { name: "Achievements 1 (English)" })
      .fill("Shipped the design system");
    await page
      .getByRole("textbox", { name: "Achievements 1 (French)" })
      .fill("Livré le design system");

    await page.getByRole("button", { name: "Add technology" }).click();
    await page
      .getByRole("textbox", { name: "Technologies & tools 1 (Both languages)" })
      .fill("TypeScript");

    await save(page);
    await expect(page.getByText("Created")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/dashboard\/content\/experiences\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: `Frontend developer ${tag}` }),
    ).toBeVisible();

    // Reload: everything was stored, including the nested details.
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Achievements 1 (French)" })).toHaveValue(
      "Livré le design system",
    );
    await expect(
      page.getByRole("textbox", { name: "Technologies & tools 1 (Both languages)" }),
    ).toHaveValue("TypeScript");

    // The list shows the record with complete EN and FR coverage.
    await page.goto("/en/dashboard/content/experiences");
    const row = page.getByRole("listitem").filter({ hasText: `Frontend developer ${tag}` });
    await expect(row).toContainText(`Acme ${tag}`);
    await expect(row.getByRole("group", { name: "Translation status" })).toContainText(
      "English: complete",
    );
    await expect(row.getByRole("group", { name: "Translation status" })).toContainText(
      "French: complete",
    );
  });

  test("validates before saving and keeps the user on the form", async ({ page }) => {
    await page.goto("/en/dashboard/content/experiences/new");
    await save(page);

    await expect(page.getByText("Some fields need attention.")).toBeVisible();
    await expect(page.getByText("Write this in at least one language.")).toBeVisible();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(page).toHaveURL(/\/experiences\/new$/);
  });

  test("protects unsaved edits when leaving the page", async ({ page }) => {
    await page.goto("/en/dashboard/content/education/new");
    await localized(page, "Degree or program").en.fill("Unsaved degree");
    await expect(page.getByText("Unsaved changes")).toBeVisible();

    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "CVs" })
      .click();
    const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(localized(page, "Degree or program").en).toHaveValue("Unsaved degree");

    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "CVs" })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/cvs$/);
  });

  test("reorders, archives and restores records", async ({ page }) => {
    const tag = unique();
    for (const name of [`First ${tag}`, `Second ${tag}`]) {
      await page.goto("/en/dashboard/content/certifications/new");
      await localized(page, "Certificate").en.fill(name);
      await save(page);
      await expect(page).toHaveURL(/certifications\/[0-9a-f-]{36}$/);
    }

    await page.goto("/en/dashboard/content/certifications");
    const rows = page.getByRole("listitem").filter({ hasText: tag });
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(`First ${tag}`);

    await page.getByRole("button", { name: `Move down: First ${tag}` }).click();
    await expect(page.getByText("Order saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: tag }).first()).toContainText(
      `Second ${tag}`,
    );

    await page.getByRole("button", { name: `More actions for First ${tag}` }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    const dialog = page.getByRole("alertdialog", { name: `Archive “First ${tag}”?` });
    await expect(dialog).toContainText("Used by no CV and no template.");
    await dialog.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /Show archived/ }).click();
    await page.getByRole("button", { name: `More actions for First ${tag}` }).click();
    await page.getByRole("menuitem", { name: "Restore" }).click();
    // Exact: the closing menu's "Restore" + "Delete permanently" also contains "restored".
    await expect(page.getByText("Restored", { exact: true })).toBeVisible();
  });

  test("saves the profile and marks the first setup step done", async ({ page }) => {
    await page.goto("/en/dashboard/content/profile");
    await page.getByRole("textbox", { name: /^Full name/ }).fill("Alex Example");
    const title = localized(page, "Professional title");
    await title.en.fill("Full stack web developer");
    await title.fr.fill("Développeur web full stack");
    await page.getByRole("textbox", { name: /^Email/ }).fill("alex@example.com");

    await page.getByRole("button", { name: "Add link" }).click();
    await page
      .getByRole("textbox", { name: "URL", exact: true })
      .first()
      .fill("https://github.com/example");
    await page
      .getByRole("textbox", { name: /^Displayed text/ })
      .first()
      .fill("example");

    await save(page);
    await expect(page.getByText("Changes saved")).toBeVisible();
    // The status reports the server-confirmed save, in place of "Unsaved changes".
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox", { name: /^Full name/ })).toHaveValue("Alex Example");
    await expect(page.getByRole("textbox", { name: "URL", exact: true }).first()).toHaveValue(
      "https://github.com/example",
    );

    await page.goto("/en/dashboard");
    const step = page.getByRole("listitem").filter({ hasText: "Add your personal information" });
    await expect(step).toContainText("Done");
  });

  test("edits technical skills as one collection", async ({ page }) => {
    const tag = unique();
    await page.goto("/en/dashboard/content/skills");
    await page.getByRole("button", { name: "Add skill group" }).click();
    const group = localized(page, "Group name");
    await group.en.last().fill(`Frameworks ${tag}`);
    await group.fr.last().fill(`Frameworks ${tag}`);
    await page.getByRole("button", { name: "Add skill", exact: true }).last().click();
    await page.getByRole("textbox", { name: "Skills 1 (Both languages)" }).last().fill("Next.js");

    await save(page);
    await expect(page.getByText("Changes saved")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Group name (English)" }).last()).toHaveValue(
      `Frameworks ${tag}`,
    );
  });

  test("editor pages meet WCAG 2.2 AA (serious and critical)", async ({ page }) => {
    for (const path of ["/en/dashboard/content/experiences/new", "/fr/dashboard/content/profile"]) {
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
            `${path} ${violation.id}: ${violation.nodes.map((node) => node.target).join(" | ")}`,
        ),
      ).toEqual([]);
    }
  });
});
