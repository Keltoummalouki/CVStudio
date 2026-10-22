import "server-only";
import type { Browser, Page, Response } from "playwright-core";
import { PRINT_READY_ATTRIBUTE, ROUTE_ERROR_ATTRIBUTE } from "@/lib/page-markers";
import { redact } from "./redact";

/** The steps of an export, in order, as named in logs. */
export const PDF_STAGES = [
  "load-engine",
  "launch",
  "open-page",
  "navigate",
  "ready",
  "print",
] as const;
export type PdfStage = (typeof PDF_STAGES)[number];

export class PdfRenderError extends Error {
  override name = "PdfRenderError";
  readonly stage: PdfStage;

  constructor(stage: PdfStage, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.stage = stage;
  }
}

/** Browser errors carry long call logs; their first line names the problem. */
const firstLine = (error: unknown) =>
  redact((error instanceof Error ? error.message : String(error)).split("\n", 1)[0] ?? "").slice(
    0,
    300,
  );

const pathOf = (url: string) => {
  try {
    return redact(new URL(url).pathname);
  } catch {
    return "an unknown page";
  }
};

/** Runs one step; any failure becomes a PdfRenderError naming the step, the original kept as its cause. */
async function step<T>(stage: PdfStage, failure: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError(stage, `${failure}: ${firstLine(error)}`, { cause: error });
  }
}

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
async function launchBrowser(timeout: number): Promise<Browser> {
  const chromium = await step(
    "load-engine",
    "The PDF engine could not be loaded",
    async () => (await import("playwright-core")).chromium,
  );
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const serverlessChromium = await step(
      "load-engine",
      "The packaged Chromium could not be loaded",
      async () => (await import("@sparticuz/chromium")).default,
    );
    return step("launch", "The packaged Chromium did not start", async () =>
      chromium.launch({
        args: serverlessChromium.args,
        executablePath: await serverlessChromium.executablePath(),
        headless: true,
        timeout,
      }),
    );
  }
  if (process.env.PDF_CHROMIUM_PATH) {
    const executablePath = process.env.PDF_CHROMIUM_PATH;
    return step("launch", "The browser in PDF_CHROMIUM_PATH did not start", () =>
      chromium.launch({ headless: true, executablePath, timeout }),
    );
  }
  let lastError: unknown;
  for (const channel of LOCAL_CHANNELS) {
    try {
      return await chromium.launch({ headless: true, channel, timeout });
    } catch (error) {
      // A missing browser fails immediately; try the next one.
      lastError = error;
    }
  }
  throw new PdfRenderError(
    "launch",
    "No Chromium-based browser for PDF export: run `pnpm exec playwright install chromium`, or install Chrome or Edge.",
    { cause: lastError },
  );
}

/** A refused print page, with the firewall's verdict when one blocked it. */
function describeRefusal(response: Response): string {
  const headers = response.headers();
  const verdict = headers["cf-mitigated"]
    ? `Cloudflare ${headers["cf-mitigated"]}`
    : headers["x-vercel-mitigated"]
      ? `Vercel firewall ${headers["x-vercel-mitigated"]}`
      : null;
  return `The print page answered ${response.status()}${verdict ? ` (${verdict})` : ""}`;
}

/** Where a print page that never became ready ended up. */
async function describeStall(page: Page, seconds: number): Promise<string> {
  const where = pathOf(page.url());
  const showsError = await page
    .evaluate((selector) => document.querySelector(selector) !== null, `[${ROUTE_ERROR_ATTRIBUTE}]`)
    .catch(() => false);
  if (showsError) return `The print page showed an error (${where})`;
  if (where.endsWith("/login")) {
    return `The print page sent the browser to sign in (${where}): the session was not accepted`;
  }
  return `The print page was not ready after ${seconds}s (${where})`;
}

/**
 * Prints a page of this app to a PDF, exactly as the browser's print dialog
 * would (same HTML, same @page rules), keeping text selectable and links live.
 * The caller's session cookies are passed through so the page enforces the
 * same owner checks as for the owner themselves.
 *
 * Everything, from loading the engine to the last byte, shares one time
 * budget, so the caller can always answer before its own deadline. Every
 * failure is a PdfRenderError naming its step, with the original error as
 * its cause; none includes page content.
 */
export async function renderPdf({
  url,
  cookies,
  timeoutMs = 45_000,
}: {
  url: string;
  cookies: readonly { name: string; value: string }[];
  timeoutMs?: number;
}): Promise<Uint8Array> {
  const started = Date.now();
  const remaining = () => Math.max(1, started + timeoutMs - Date.now());
  const target = new URL(url);
  const browser = await launchBrowser(remaining());
  try {
    const page = await step("open-page", "The browser could not open a page", async () => {
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
      return context.newPage();
    });

    const response = await step("navigate", "The print page did not load", () =>
      page.goto(target.href, { waitUntil: "domcontentloaded", timeout: remaining() }),
    );
    if (!response) throw new PdfRenderError("navigate", "The print page sent no response");
    if (!response.ok()) throw new PdfRenderError("navigate", describeRefusal(response));

    // Only an exportable CV renders the ready marker.
    try {
      await page.waitForSelector(`html[${PRINT_READY_ATTRIBUTE}]`, {
        state: "attached",
        timeout: remaining(),
      });
    } catch (error) {
      const seconds = Math.round((Date.now() - started) / 1000);
      throw new PdfRenderError("ready", await describeStall(page, seconds), { cause: error });
    }

    const pdf = await step("print", "The page could not be printed to PDF", async () => {
      await page.emulateMedia({ media: "print" });
      return page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true });
    });
    return new Uint8Array(pdf);
  } finally {
    // A failure to close must never hide the error that matters.
    await browser.close().catch(() => undefined);
  }
}

export type PdfFailureLog = {
  stage: PdfStage | "unknown";
  /** What failed, in one line. */
  reason: string;
  /** The original error, redacted. */
  error: { name: string; message: string; stack: string | null };
};

/** A redacted, structured description of an export failure, for the server log. */
export function describePdfFailure(failure: unknown): PdfFailureLog {
  const stage = failure instanceof PdfRenderError ? failure.stage : "unknown";
  const original = failure instanceof PdfRenderError && failure.cause ? failure.cause : failure;
  const error =
    original instanceof Error
      ? {
          name: original.name,
          message: redact(original.message),
          stack: original.stack ? redact(original.stack) : null,
        }
      : { name: typeof original, message: redact(String(original)), stack: null };
  return {
    stage,
    reason: failure instanceof Error ? redact(failure.message) : error.message,
    error,
  };
}
