import type { LaunchOptions } from "playwright-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfRenderError, renderPdf } from "@/lib/pdf/render-pdf";

const launch = vi.hoisted(() => vi.fn<(options: LaunchOptions) => Promise<unknown>>());
vi.mock("playwright-core", () => ({ chromium: { launch } }));
vi.mock("@sparticuz/chromium", () => ({
  default: { args: ["--single-process"], executablePath: async () => "/tmp/chromium" },
}));

const PRINT_URL = "http://localhost:3001/en/print/5b0e8d5c-7a4e-4f61-9d0a-3c2b1a0f9e8d";
const notInstalled = () => new Error("Executable doesn't exist");

/** A stand-in browser whose print page answers with `status`. */
function fakeBrowser(status = 200) {
  const page = {
    goto: vi.fn(async () => ({ ok: () => status < 400, status: () => status })),
    waitForSelector: vi.fn(async () => null),
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
    expect(launch).toHaveBeenCalledWith({ headless: true, channel: undefined });
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

    const attempt = renderPdf({ url: PRINT_URL, cookies: [] });

    await expect(attempt).rejects.toBeInstanceOf(PdfRenderError);
    await expect(attempt).rejects.toThrow(/playwright install chromium.*Chrome or Edge/);
  });

  it("uses the browser named in PDF_CHROMIUM_PATH without searching", async () => {
    vi.stubEnv("PDF_CHROMIUM_PATH", "/opt/chromium/chrome");
    launch.mockResolvedValueOnce(fakeBrowser().browser);

    await renderPdf({ url: PRINT_URL, cookies: [] });

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({ headless: true, executablePath: "/opt/chromium/chrome" });
  });

  it("uses the packaged Chromium on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    launch.mockResolvedValueOnce(fakeBrowser().browser);

    await renderPdf({ url: PRINT_URL, cookies: [] });

    expect(launch).toHaveBeenCalledWith({
      args: ["--single-process"],
      executablePath: "/tmp/chromium",
      headless: true,
    });
  });

  it("says why the packaged Chromium did not start, without the long call log", async () => {
    vi.stubEnv("VERCEL", "1");
    launch.mockRejectedValueOnce(
      new Error("browserType.launch: Failed to launch the browser process\nCall log:\n  - spawn"),
    );

    const attempt = renderPdf({ url: PRINT_URL, cookies: [] });

    await expect(attempt).rejects.toBeInstanceOf(PdfRenderError);
    await expect(attempt).rejects.toThrow(
      /^The packaged Chromium did not start: browserType\.launch: Failed to launch the browser process$/,
    );
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

  it("prints nothing when the print page refuses, and still closes the browser", async () => {
    const { browser, page } = fakeBrowser(404);
    launch.mockResolvedValueOnce(browser);

    await expect(renderPdf({ url: PRINT_URL, cookies: [] })).rejects.toThrow(PdfRenderError);

    expect(page.pdf).not.toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
