import "server-only";
import type { Browser } from "playwright-core";

export class PdfRenderError extends Error {
  override name = "PdfRenderError";
}

/** Set by the print page (PrintReady) once fonts and images are loaded. */
const READY_ATTRIBUTE = "data-print-ready";

/** Launch errors carry long call logs; their first line names the problem. */
const firstLine = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).split("\n", 1)[0]?.slice(0, 300) ?? "";

/**
 * Locally, in order: Playwright's own Chromium (`pnpm exec playwright install
 * chromium`), then the Chrome or Edge already installed on the machine, so PDF
 * export works in development without downloading a browser.
 */
const LOCAL_CHANNELS = [undefined, "chrome", "msedge"] as const;

/**
 * Serverless hosts (Vercel, AWS Lambda) have no browser: use the packaged
 * Chromium build. PDF_CHROMIUM_PATH forces a specific binary anywhere else.
 */
async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      const { default: serverlessChromium } = await import("@sparticuz/chromium");
      return await chromium.launch({
        args: serverlessChromium.args,
        executablePath: await serverlessChromium.executablePath(),
        headless: true,
      });
    } catch (error) {
      // The server log shows this message: say what failed (e.g. missing packaged files).
      throw new PdfRenderError(`The packaged Chromium did not start: ${firstLine(error)}`, {
        cause: error,
      });
    }
  }
  if (process.env.PDF_CHROMIUM_PATH) {
    return chromium.launch({ headless: true, executablePath: process.env.PDF_CHROMIUM_PATH });
  }
  let lastError: unknown;
  for (const channel of LOCAL_CHANNELS) {
    try {
      return await chromium.launch({ headless: true, channel });
    } catch (error) {
      // A missing browser fails immediately; try the next one.
      lastError = error;
    }
  }
  throw new PdfRenderError(
    "No Chromium-based browser for PDF export: run `pnpm exec playwright install chromium`, or install Chrome or Edge.",
    { cause: lastError },
  );
}

/**
 * Prints a page of this app to a PDF, exactly as the browser's print dialog
 * would (same HTML, same @page rules), keeping text selectable and links live.
 * The caller's session cookies are passed through so the page enforces the
 * same owner checks as for the owner themselves.
 */
export async function renderPdf({
  url,
  cookies,
  timeoutMs = 25_000,
}: {
  url: string;
  cookies: readonly { name: string; value: string }[];
  timeoutMs?: number;
}): Promise<Uint8Array> {
  const target = new URL(url);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
      javaScriptEnabled: true,
    });
    if (cookies.length > 0) {
      await context.addCookies(
        cookies.map(({ name, value }) => ({ name, value, url: target.origin })),
      );
    }
    const page = await context.newPage();
    const response = await page.goto(target.href, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    if (!response?.ok()) {
      throw new PdfRenderError(`print page answered ${response?.status() ?? "nothing"}`);
    }
    // Only an exportable CV renders the ready marker; anything else times out.
    await page.waitForSelector(`html[${READY_ATTRIBUTE}]`, {
      state: "attached",
      timeout: timeoutMs,
    });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
