import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportableCv } from "@/features/cv-export/server/load-export";
import type * as RenderPdf from "@/lib/pdf/render-pdf";
import { PdfRenderError } from "@/lib/pdf/render-pdf";
import { OWNER_ID } from "../../utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  loadExportableCv: vi.fn(),
  renderPdf: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock("@/features/cv-export/server/load-export", () => ({
  loadExportableCv: mocks.loadExportableCv,
}));
// The real error type and failure description; only the browser is replaced.
vi.mock("@/lib/pdf/render-pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof RenderPdf>()),
  renderPdf: mocks.renderPdf,
}));

const SESSION_VALUE = "base64-eyJhY2Nlc3NfdG9rZW4iOiJzZWNyZXQifQ";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [
      { name: "sb-abcdefgh-auth-token.0", value: SESSION_VALUE },
      { name: "sb-abcdefgh-auth-token.1", value: "base64-second-half" },
      { name: "__cf_bm", value: "cloudflare-cookie" },
      { name: "NEXT_LOCALE", value: "fr" },
    ],
  }),
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

/** The structured line the route logged with `message`, parsed. */
function logged(spy: { mock: { calls: unknown[][] } }, message: string) {
  const call = spy.mock.calls.findLast(([first]) => first === message);
  expect(call, `a "${message}" log line`).toBeDefined();
  return JSON.parse(String(call?.[1])) as Record<string, unknown>;
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
    vi.spyOn(console, "info").mockImplementation(() => {});
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

  it("prints the CV's own print page with only the session cookies, and streams the PDF", async () => {
    const response = await download();

    expect(mocks.renderPdf).toHaveBeenCalledWith({
      url: `https://cv.example.test/fr/print/${CV_ID}`,
      cookies: [
        { name: "sb-abcdefgh-auth-token.0", value: SESSION_VALUE },
        { name: "sb-abcdefgh-auth-token.1", value: "base64-second-half" },
      ],
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
    expect(logged(vi.mocked(console.info), "PDF export")).toEqual({
      origin: "https://cv.example.test",
      elapsedMs: expect.any(Number),
      bytes: 8,
    });
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

  it("logs the failing step, where the print page was looked for, and the cookies sent", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("page.goto: net::ERR_CONNECTION_REFUSED");
    mocks.renderPdf.mockRejectedValueOnce(
      new PdfRenderError("navigate", "The print page did not load: net::ERR_CONNECTION_REFUSED", {
        cause,
      }),
    );

    expect((await download()).status).toBe(503);

    expect(logged(log, "PDF export failed")).toEqual({
      stage: "navigate",
      reason: "The print page did not load: net::ERR_CONNECTION_REFUSED",
      error: {
        name: "Error",
        message: "page.goto: net::ERR_CONNECTION_REFUSED",
        stack: expect.stringContaining("page.goto: net::ERR_CONNECTION_REFUSED"),
      },
      origin: "https://cv.example.test",
      sessionCookies: 2,
      elapsedMs: expect.any(Number),
    });
  });

  it("logs unexpected errors with their message and stack, redacted", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.renderPdf.mockRejectedValueOnce(
      new TypeError(
        `cookie ${SESSION_VALUE} rejected for ${CV_ID}, token eyJhbGciOi.eyJzdWIi.c2ln`,
      ),
    );

    expect((await download()).status).toBe(503);

    const entry = logged(log, "PDF export failed");
    expect(entry).toMatchObject({
      stage: "unknown",
      error: { name: "TypeError", message: "cookie [cookie] rejected for :id, token [token]" },
    });
    const line = JSON.stringify(log.mock.calls);
    expect(line).not.toContain(SESSION_VALUE);
    expect(line).not.toContain(CV_ID);
    expect(line).not.toContain("eyJhbGciOi");
  });
});
