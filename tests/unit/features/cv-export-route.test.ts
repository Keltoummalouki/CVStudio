import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportableCv } from "@/features/cv-export/server/load-export";
import { OWNER_ID } from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => {
  class PdfRenderError extends Error {
    override name = "PdfRenderError";
  }
  return {
    PdfRenderError,
    getOwnerContext: vi.fn(),
    loadExportableCv: vi.fn(),
    renderPdf: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("@/features/cv-export/server/load-export", () => ({
  loadExportableCv: mocks.loadExportableCv,
}));
vi.mock("@/lib/pdf/render-pdf", () => ({
  PdfRenderError: mocks.PdfRenderError,
  renderPdf: mocks.renderPdf,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [{ name: "sb-auth-token", value: "session" }] }),
}));

const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";

const { GET } = await import("@/app/api/cvs/[cvId]/pdf/route");

function exportable(overrides: Partial<ExportableCv> = {}) {
  return {
    id: CV_ID,
    name: "CV français – Développeuse",
    locale: "fr",
    missingTranslations: 0,
    ...overrides,
  } as ExportableCv;
}

async function download(cvId = CV_ID) {
  const request = new NextRequest(`https://cv.example.test/api/cvs/${cvId}/pdf`);
  return GET(request, { params: Promise.resolve({ cvId }) });
}

describe("GET /api/cvs/[cvId]/pdf", () => {
  // The route's rate limiter lives for the module's lifetime: give each test its own owner.
  let ownerSeq = 0;

  beforeEach(() => {
    mocks.getOwnerContext.mockReset();
    mocks.loadExportableCv.mockReset();
    mocks.renderPdf.mockReset();
    ownerSeq += 1;
    mocks.getOwnerContext.mockResolvedValue({
      supabase: {},
      owner: { id: `${OWNER_ID}-${ownerSeq}`, email: null },
    });
    mocks.loadExportableCv.mockResolvedValue(exportable());
    mocks.renderPdf.mockResolvedValue(new TextEncoder().encode("%PDF-1.7"));
  });

  it("refuses anyone who is not the signed-in owner, before reading anything", async () => {
    mocks.getOwnerContext.mockResolvedValue(null);

    const response = await download();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.loadExportableCv).not.toHaveBeenCalled();
    expect(mocks.renderPdf).not.toHaveBeenCalled();
  });

  it("answers 404 for ids that are not UUIDs, without a database read", async () => {
    const response = await download("not-a-uuid");

    expect(response.status).toBe(404);
    expect(mocks.loadExportableCv).not.toHaveBeenCalled();
  });

  it("answers 404, not 403, for another owner's CV", async () => {
    mocks.loadExportableCv.mockResolvedValue(null);

    const response = await download();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(mocks.renderPdf).not.toHaveBeenCalled();
  });

  it("blocks export while texts are missing in the CV's language", async () => {
    mocks.loadExportableCv.mockResolvedValue(exportable({ missingTranslations: 3 }));

    const response = await download();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "missing_translations", count: 3 });
    expect(mocks.renderPdf).not.toHaveBeenCalled();
  });

  it("reports an unavailable database as 503", async () => {
    mocks.loadExportableCv.mockRejectedValue(new Error("connection refused"));

    expect((await download()).status).toBe(503);
  });

  it("prints the CV's own print page with the caller's session and streams the PDF", async () => {
    const response = await download();

    expect(mocks.renderPdf).toHaveBeenCalledWith({
      url: `https://cv.example.test/fr/print/${CV_ID}`,
      cookies: [{ name: "sb-auth-token", value: "session" }],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Length")).toBe("8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="CV francais - Developpeuse.pdf"',
    );
    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("%PDF-1.7");
  });

  it("allows one export at a time per owner", async () => {
    let finish: (pdf: Uint8Array) => void = () => {};
    mocks.renderPdf.mockImplementationOnce(
      () => new Promise<Uint8Array>((resolve) => (finish = resolve)),
    );

    const first = download();
    // Let the first request reach the PDF engine before the second arrives.
    await vi.waitFor(() => expect(mocks.renderPdf).toHaveBeenCalledTimes(1));
    const second = await download();
    finish(new Uint8Array([37]));

    expect(second.status).toBe(429);
    expect((await first).status).toBe(200);
    // The slot is released once the first export is done.
    expect((await download()).status).toBe(200);
  });

  it("logs why the engine failed without logging CV content", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.renderPdf.mockRejectedValueOnce(new mocks.PdfRenderError("No Chromium-based browser"));
    mocks.renderPdf.mockRejectedValueOnce(new TypeError("Jane Doe, 12 Secret Street"));

    expect((await download()).status).toBe(503);
    expect(log).toHaveBeenLastCalledWith("PDF export failed:", "No Chromium-based browser");

    expect((await download()).status).toBe(503);
    expect(log).toHaveBeenLastCalledWith("PDF export failed:", "TypeError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("Secret Street");
  });
});
