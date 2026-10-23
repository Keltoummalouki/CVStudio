import { expect, test, type Page } from "@playwright/test";
import { BUILDER_STORAGE_STATE } from "./support/accounts";
import { expectNoSeriousViolations } from "./support/axe";

// The builder owner's seeded career data lists React, TypeScript, Node.js,
// PostgreSQL and Docker as skills, and "Full stack developer" as a role.
test.use({ storageState: BUILDER_STORAGE_STATE });

const unique = () => Math.random().toString(36).slice(2, 8);
const CV_URL = /\/en\/dashboard\/cvs\/[0-9a-f-]{36}$/;
const JOB_URL = /\/en\/dashboard\/jobs\/[0-9a-f-]{36}$/;

// The fake providers (AI_FAKE_PROVIDER=1) read this vocabulary line by line. The
// marker makes the stand-in for Groq time out, so the one for Gemini answers:
// the fallback path, end to end, without calling either.
const POST = [
  "Full stack developer",
  "Company: Example Robotics",
  "You will build web apps with React and TypeScript.",
  "Our APIs run on Node.js with PostgreSQL.",
  "Kubernetes experience is a plus.",
  "Mobile work in React Native is a plus.",
  "[[fake:groq:timeout]]",
].join("\n");

async function createCv(page: Page, name: string) {
  await page.goto("/en/dashboard/cvs/new");
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByRole("radio", { name: /^Classic/ }).check();
  await page.getByRole("radio", { name: /^English/ }).check();
  await page.getByRole("button", { name: "Create and open" }).click();
  await expect(page).toHaveURL(CV_URL);
}

async function setAi(page: Page, { enabled, limit }: { enabled: boolean; limit: number }) {
  await page.goto("/en/dashboard/settings");
  const toggle = page.getByRole("switch", { name: "Use AI to analyze job posts" });
  if ((await toggle.getAttribute("aria-checked")) !== String(enabled)) await toggle.click();
  await page.getByRole("spinbutton", { name: "Daily limit" }).fill(String(limit));
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(page.getByText("AI settings saved")).toBeVisible();
}

/** One CV's row in "How your CVs match". */
async function matchRow(page: Page, cvName: string) {
  const panel = page.getByRole("region", { name: "How your CVs match" });
  // Other specs add CVs to this owner in parallel: ours may be past the best five.
  const showAll = panel.getByRole("button", { name: /^Show all \d+ CVs$/ });
  if ((await showAll.count()) > 0) await showAll.click();
  return panel.getByRole("listitem").filter({ has: page.getByText(cvName, { exact: true }) });
}

test.describe("job posts and the match score", () => {
  // One owner, one daily AI quota: these steps build on each other.
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "Desktop flows; phones are covered by the shell spec.");

  const cvName = `Match ${unique()}`;

  test("requirements typed by hand score the CVs, with no AI involved", async ({ page }) => {
    await createCv(page, cvName);

    await page.goto("/en/dashboard/jobs/new");
    await expect(page.getByText(/AI analysis is off/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze with AI" })).toBeDisabled();
    await page.getByRole("button", { name: "Enter requirements myself" }).click();

    const jobTitle = `Platform engineer ${unique()}`;
    await page.getByRole("textbox", { name: "Job title" }).fill(jobTitle);
    await page.getByRole("button", { name: "Add a requirement" }).click();
    await page.getByRole("textbox", { name: "Requirement 1", exact: true }).fill("Docker");
    await page.getByRole("button", { name: "Add a requirement" }).click();
    await page.getByRole("textbox", { name: "Requirement 2", exact: true }).fill("Kubernetes");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(JOB_URL);
    const row = await matchRow(page, cvName);
    // Docker (2) found of Docker + Kubernetes (2 + 2).
    await expect(row.getByText("Estimated keyword coverage: 50 percent")).toBeAttached();
    await row.getByRole("button", { name: `Details: ${cvName}` }).click();
    await expect(row.getByRole("region", { name: "Found in this CV (1)" })).toContainText("Docker");
    await expect(row.getByRole("region", { name: "Not found (1)" })).toContainText("Kubernetes");

    // The whole career data, not only what a CV shows.
    const career = page.getByRole("region", { name: "Your career and this job" });
    await expect(career.getByText("1 of 2 requirements found in your career data")).toBeVisible();
    await expect(
      career.getByRole("region", { name: "In your career data (1)", exact: true }),
    ).toContainText("Docker");
    await expect(
      career.getByRole("region", { name: "Not in your career data (1)", exact: true }),
    ).toContainText("Kubernetes");
    await career.getByRole("button", { name: "Show where each one is" }).click();
    await expect(career.getByRole("region", { name: "Where each one appears" })).toContainText(
      "Docker",
    );
    await expectNoSeriousViolations(page);

    // A CV for this job starts named after it.
    await page.getByRole("link", { name: "Create a CV for this job" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/cvs\/new\?job=[0-9a-f-]{36}$/);
    await expect(page.getByText(`For the job post “${jobTitle}”`, { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(jobTitle);
  });

  test("the test provider reads a post, and the owner reviews it before saving", async ({
    page,
  }) => {
    await setAi(page, { enabled: true, limit: 3 });
    await expect(page.getByText(/Test providers answer instead/)).toBeVisible();

    await page.goto("/en/dashboard/jobs/new");
    await expect(
      page.getByText(/Only this text is sent to Groq, or to Gemini when Groq is unavailable/),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Job post" }).fill(POST);
    await page.getByRole("button", { name: "Analyze with AI" }).click();

    await expect(page.getByText("Check what the AI found")).toBeVisible();
    await expect(page.getByText(/The AI found 6 requirements/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Job title" })).toHaveValue(
      "Full stack developer",
    );
    await expectNoSeriousViolations(page);

    // The owner corrects the draft: React Native does not apply.
    await page.getByRole("button", { name: "Remove React Native" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(JOB_URL);
    await expect(page.getByText(/Requirements found by AI on/)).toBeVisible();
    const row = await matchRow(page, cvName);
    // React, TypeScript, Node.js, PostgreSQL found (4 × 2) of those + Kubernetes (1).
    await expect(row.getByText("Estimated keyword coverage: 89 percent")).toBeAttached();
    await expect(row.getByText("Job title found")).toBeVisible();
    await row.getByRole("button", { name: `Details: ${cvName}` }).click();
    await expect(row.getByRole("region", { name: "Found in this CV (4)" })).toContainText(
      "PostgreSQL",
    );
  });

  test("the daily limit stops further analyses and says so", async ({ page }) => {
    await setAi(page, { enabled: true, limit: 1 });

    await page.goto("/en/dashboard/jobs/new");
    await expect(page.getByText(/You’ve used today’s AI requests/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze with AI" })).toBeDisabled();

    await page.goto("/en/dashboard/settings");
    // One analysis, one request, although two providers were tried.
    await expect(page.getByText(/1 of 1 requests/)).toBeVisible();
    await expect(page.getByText("Job post analysis · Succeeded")).toBeVisible();
    await expect(page.getByText("Groq (took too long) → Gemini · fake-gemini")).toBeVisible();
    await expect(page.getByText(/^fake-gemini \(Gemini, as the fallback\)/)).toBeVisible();
    await setAi(page, { enabled: false, limit: 10 });
  });

  test("a job post can be deleted, with Undo, without touching CVs", async ({ page }) => {
    await page.goto("/en/dashboard/jobs");
    const job = page.getByRole("listitem").filter({ hasText: "Full stack developer" });
    await expect(job.getByText(/^Best match \d+%/)).toBeVisible();

    const remove = async () => {
      await job.getByRole("button", { name: "More actions for Full stack developer" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page
        .getByRole("alertdialog", { name: "Delete “Full stack developer”?" })
        .getByRole("button", { name: "Delete" })
        .click();
      await expect(page.getByText("“Full stack developer” deleted")).toBeVisible();
    };

    // Undo straight from the toast, which closes on its own after a few seconds.
    await remove();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(job).toHaveCount(1);
    await page.reload();
    await expect(job).toHaveCount(1);

    await remove();
    await expect(job).toHaveCount(0);
    await page.reload();
    await expect(job).toHaveCount(0);

    await page.goto("/en/dashboard/cvs");
    // Parallel flows add CVs: search, so the list's paging never hides this one.
    await page.getByRole("searchbox", { name: "Search your CVs" }).fill(cvName);
    await expect(page.getByRole("link", { name: cvName })).toBeVisible();
  });
});
