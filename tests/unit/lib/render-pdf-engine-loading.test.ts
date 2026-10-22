import { describe, expect, it, vi } from "vitest";
import { PdfRenderError, renderPdf } from "@/lib/pdf/render-pdf";

// What production hit: playwright-core loads browsers.json at import time, and
// a serverless bundle without that file cannot load the engine at all.
vi.mock("playwright-core", () => ({
  get chromium(): never {
    throw new Error(
      "Cannot find module '/var/task/node_modules/.pnpm/playwright-core@1.64.1/node_modules/playwright-core/browsers.json'",
    );
  },
}));

describe("renderPdf when the engine cannot be loaded", () => {
  it("fails in the load-engine step and keeps the original error", async () => {
    const error = await renderPdf({
      url: "https://cv.example.test/en/print/5b0e8d5c-7a4e-4f61-9d0a-3c2b1a0f9e8d",
      cookies: [],
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error).toMatchObject({
      stage: "load-engine",
      message: expect.stringMatching(
        /^The PDF engine could not be loaded: Cannot find module '.*playwright-core\/browsers\.json'$/,
      ),
    });
    expect((error as PdfRenderError).cause).toBeInstanceOf(Error);
  });
});
