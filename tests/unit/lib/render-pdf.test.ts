import type { LaunchOptions } from "playwright-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describePdfFailure,
  PdfLayoutError,
  PdfRenderError,
  renderPdf,
} from "@/lib/pdf/render-pdf";

const launch = vi.hoisted(() => vi.fn<(options: LaunchOptions) => Promise<unknown>>());
vi.mock("playwright-core", () => ({ chromium: { launch } }));
vi.mock("@sparticuz/chromium", () => ({
  default: { args: ["--single-process"], executablePath: async () => "/tmp/chromium" },
}));

const CV_ID = "5b0e8d5c-7a4e-4f61-9d0a-3c2b1a0f9e8d";
const PRINT_URL = `http://localhost:3001/en/print/${CV_ID}`;
const notInstalled = () => new Error("Executable doesn't exist");

type FakeOptions = {
  status?: number;
  headers?: Record<string, string>;
  /** Where the page is when the ready marker never appears. */
  finalUrl?: string;
  showsError?: boolean;
  ready?: boolean;
  /** What the print page reports in data-layout-issues; null when the design fits. */
  layoutIssues?: string | null;
};

/** A stand-in browser whose print page answers as described. */
function fakeBrowser({
  status = 200,
  headers = {},
  finalUrl = PRINT_URL,
  showsError = false,
  ready = true,
  layoutIssues = null,
}: FakeOptions = {}) {
  const page = {
    goto: vi.fn(async (_url: string, _options: { timeout: number }) => ({
      ok: () => status < 400,
      status: () => status,
      headers: () => headers,
    })),
    url: vi.fn(() => finalUrl),
    evaluate: vi.fn(async () => showsError),
    waitForSelector: vi.fn(async (_selector: string, _options: { timeout: number }) => {
      if (!ready) throw new Error("page.waitForSelector: Timeout 45000ms exceeded.");
      return null;
    }),
    getAttribute: vi.fn(async (_selector: string, _name: string) => layoutIssues),
    emulateMedia: vi.fn(async () => undefined),
    pdf: vi.fn(async () => Buffer.from("%PDF-1.4")),
  };
  const context = {
    addCookies: vi.fn(async () => undefined),
    newPage: vi.fn(async () => page),
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };
  return { browser, context, page };
}

async function failureOf(fake: ReturnType<typeof fakeBrowser>) {
  launch.mockResolvedValueOnce(fake.browser);
  const error = await renderPdf({
    url: PRINT_URL,
    cookies: [{ name: "sb-abcdefgh-auth-token", value: "session" }],
  }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PdfRenderError);
  expect(fake.page.pdf).not.toHaveBeenCalled();
  expect(fake.browser.close).toHaveBeenCalledTimes(1);
  const { stage, message } = error as PdfRenderError;
  return { stage, message };
}

const failure = (options: FakeOptions) => failureOf(fakeBrowser(options));

describe("renderPdf", () => {
  beforeEach(() => {
    launch.mockReset();
    // Whatever the machine running the tests has set.
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    vi.stubEnv("PDF_CHROMIUM_PATH", "");
  });

  it("uses Playwright's own Chromium when it is installed", async () => {
    launch.mockResolvedValueOnce(fakeBrowser().browser);

    const pdf = await renderPdf({ url: PRINT_URL, cookies: [] });

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({
      headless: true,
      channel: undefined,
      timeout: expect.any(Number),
    });
    expect(Buffer.from(pdf).toString("latin1")).toBe("%PDF-1.4");
  });

  it("falls back to the installed Chrome, then Edge", async () => {
    launch
      .mockRejectedValueOnce(notInstalled())
      .mockRejectedValueOnce(notInstalled())
      .mockResolvedValueOnce(fakeBrowser().browser);

    await renderPdf({ url: PRINT_URL, cookies: [] });

    expect(launch.mock.calls.map(([options]) => options.channel)).toEqual([
      undefined,
      "chrome",
      "msedge",
    ]);
  });

  it("explains how to get a browser when none can start", async () => {
    launch.mockRejectedValue(notInstalled());

    const error = await renderPdf({ url: PRINT_URL, cookies: [] }).catch((caught) => caught);

    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error).toMatchObject({ stage: "launch" });
    expect((error as Error).message).toMatch(/playwright install chromium.*Chrome or Edge/);
  });

  it("uses the browser named in PDF_CHROMIUM_PATH without searching", async () => {
    vi.stubEnv("PDF_CHROMIUM_PATH", "/opt/chromium/chrome");
    launch.mockResolvedValueOnce(fakeBrowser().browser);

    await renderPdf({ url: PRINT_URL, cookies: [] });

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({
      headless: true,
      executablePath: "/opt/chromium/chrome",
      timeout: expect.any(Number),
    });
  });

  it("uses the packaged Chromium on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    launch.mockResolvedValueOnce(fakeBrowser().browser);

    await renderPdf({ url: PRINT_URL, cookies: [] });

    expect(launch).toHaveBeenCalledWith({
      args: ["--single-process"],
      executablePath: "/tmp/chromium",
      headless: true,
      timeout: expect.any(Number),
    });
  });

  it("says why the packaged Chromium did not start, without the long call log", async () => {
    vi.stubEnv("VERCEL", "1");
    launch.mockRejectedValueOnce(
      new Error("browserType.launch: Failed to launch the browser process\nCall log:\n  - spawn"),
    );

    const error = await renderPdf({ url: PRINT_URL, cookies: [] }).catch((caught) => caught);

    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error).toMatchObject({
      stage: "launch",
      message:
        "The packaged Chromium did not start: browserType.launch: Failed to launch the browser process",
    });
  });

  it("sends the session cookies to the print page's origin only, then closes the browser", async () => {
    const { browser, context } = fakeBrowser();
    launch.mockResolvedValueOnce(browser);

    await renderPdf({ url: PRINT_URL, cookies: [{ name: "sb-auth-token", value: "token" }] });

    expect(context.addCookies).toHaveBeenCalledWith([
      { name: "sb-auth-token", value: "token", url: "http://localhost:3001" },
    ]);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("fits every step into one time budget", async () => {
    const { browser, page } = fakeBrowser();
    launch.mockResolvedValueOnce(browser);

    await renderPdf({ url: PRINT_URL, cookies: [], timeoutMs: 10_000 });

    const timeouts = [
      launch.mock.calls[0]?.[0].timeout,
      page.goto.mock.calls[0]?.[1].timeout,
      page.waitForSelector.mock.calls[0]?.[1].timeout,
    ];
    for (const timeout of timeouts) {
      expect(timeout).toBeGreaterThan(0);
      expect(timeout).toBeLessThanOrEqual(10_000);
    }
  });

  it("keeps the PDF when the browser fails to close afterwards", async () => {
    const { browser } = fakeBrowser();
    browser.close.mockRejectedValueOnce(new Error("Target closed"));
    launch.mockResolvedValueOnce(browser);

    await expect(renderPdf({ url: PRINT_URL, cookies: [] })).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("renderPdf failures name the step that failed", () => {
  beforeEach(() => {
    launch.mockReset();
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    vi.stubEnv("PDF_CHROMIUM_PATH", "");
  });

  it("open-page: the browser refused a context, a cookie or a page", async () => {
    const fake = fakeBrowser();
    fake.context.addCookies.mockRejectedValueOnce(
      new Error("browserContext.addCookies: Invalid cookie fields"),
    );

    expect(await failureOf(fake)).toEqual({
      stage: "open-page",
      message:
        "The browser could not open a page: browserContext.addCookies: Invalid cookie fields",
    });
  });

  it("navigate: the print page could not be reached, without the CV id", async () => {
    const fake = fakeBrowser();
    fake.page.goto.mockRejectedValueOnce(
      new Error(`page.goto: net::ERR_NAME_NOT_RESOLVED at ${PRINT_URL}\nCall log:\n  - navigating`),
    );

    expect(await failureOf(fake)).toEqual({
      stage: "navigate",
      message:
        "The print page did not load: page.goto: net::ERR_NAME_NOT_RESOLVED at http://localhost:3001/en/print/:id",
    });
  });

  it("navigate: the print page answered with an error status, naming a firewall verdict", async () => {
    expect(await failure({ status: 404 })).toEqual({
      stage: "navigate",
      message: "The print page answered 404",
    });
    expect(await failure({ status: 403, headers: { "cf-mitigated": "challenge" } })).toEqual({
      stage: "navigate",
      message: "The print page answered 403 (Cloudflare challenge)",
    });
    expect(await failure({ status: 429, headers: { "x-vercel-mitigated": "deny" } })).toEqual({
      stage: "navigate",
      message: "The print page answered 429 (Vercel firewall deny)",
    });
  });

  it("ready: tells a rejected session from an error page and from a slow page", async () => {
    expect(
      await failure({ ready: false, finalUrl: "http://localhost:3001/en/login?next=%2Fprint" }),
    ).toEqual({
      stage: "ready",
      message:
        "The print page sent the browser to sign in (/en/login): the session was not accepted",
    });
    expect(await failure({ ready: false, showsError: true })).toEqual({
      stage: "ready",
      message: "The print page showed an error (/en/print/:id)",
    });
    expect((await failure({ ready: false })).message).toMatch(
      /^The print page was not ready after \d+s \(\/en\/print\/:id\)$/,
    );
  });

  it("refuses to print a design the print page found cut off or overlapping", async () => {
    const fake = fakeBrowser({ layoutIssues: "2" });
    launch.mockResolvedValueOnce(fake.browser);

    const error = await renderPdf({ url: PRINT_URL, cookies: [] }).catch((caught) => caught);

    expect(error).toBeInstanceOf(PdfLayoutError);
    expect(error).toMatchObject({ count: 2 });
    expect(fake.page.getAttribute).toHaveBeenCalledWith("html", "data-layout-issues");
    expect(fake.page.pdf).not.toHaveBeenCalled();
    expect(fake.browser.close).toHaveBeenCalledTimes(1);
  });

  it("print: the page could not be printed", async () => {
    const fake = fakeBrowser();
    fake.page.pdf.mockRejectedValueOnce(new Error("page.pdf: Printing failed"));
    launch.mockResolvedValueOnce(fake.browser);

    const error = await renderPdf({ url: PRINT_URL, cookies: [] }).catch((caught) => caught);

    expect(error).toMatchObject({
      stage: "print",
      message: "The page could not be printed to PDF: page.pdf: Printing failed",
    });
    expect(fake.browser.close).toHaveBeenCalledTimes(1);
  });
});

describe("describePdfFailure", () => {
  it("keeps the step, the reason and the original error with its stack", () => {
    const cause = new Error(
      "Cannot find module '/var/task/node_modules/playwright-core/browsers.json'",
    );
    const failure = new PdfRenderError("load-engine", "The PDF engine could not be loaded", {
      cause,
    });

    expect(describePdfFailure(failure)).toEqual({
      stage: "load-engine",
      reason: "The PDF engine could not be loaded",
      error: {
        name: "Error",
        message: "Cannot find module '/var/task/node_modules/playwright-core/browsers.json'",
        stack: expect.stringContaining("browsers.json"),
      },
    });
  });

  it("describes errors from outside the engine, and values that are not errors", () => {
    expect(describePdfFailure(new RangeError("boom"))).toMatchObject({
      stage: "unknown",
      reason: "boom",
      error: { name: "RangeError", message: "boom" },
    });
    expect(describePdfFailure("plain text")).toEqual({
      stage: "unknown",
      reason: "plain text",
      error: { name: "string", message: "plain text", stack: null },
    });
  });
});
