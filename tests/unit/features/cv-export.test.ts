import { describe, expect, it } from "vitest";
import { isPdfErrorCode } from "@/features/cv-export/errors";
import {
  attachmentDisposition,
  fileNameFromDisposition,
  pdfFileName,
} from "@/features/cv-export/file-name";
import { createExportLimiter } from "@/features/cv-export/rate-limit";
import { printPageCss, PAGE_MARGINS_MM } from "@/features/cv-renderer/classic-reference-v1/layout";

describe("PDF file names", () => {
  it("keeps accents and dashes, with an ASCII fallback", () => {
    expect(pdfFileName("CV français – Développeuse web")).toEqual({
      unicode: "CV français – Développeuse web.pdf",
      ascii: "CV francais - Developpeuse web.pdf",
    });
  });

  it("removes characters no operating system accepts", () => {
    expect(pdfFileName('a/b\\c:d*e?f"g<h>i|j').unicode).toBe("a b c d e f g h i j.pdf");
    expect(pdfFileName("  ...  ").unicode).toBe("CV.pdf");
  });

  it("round-trips through the Content-Disposition header", () => {
    const header = attachmentDisposition("CV français – Full stack");
    expect(header).toContain('filename="CV francais - Full stack.pdf"');
    expect(fileNameFromDisposition(header)).toBe("CV français – Full stack.pdf");
    expect(fileNameFromDisposition('attachment; filename="plain.pdf"')).toBe("plain.pdf");
    expect(fileNameFromDisposition(null)).toBeNull();
  });
});

describe("export limiter", () => {
  it("allows one export at a time per owner", () => {
    const limiter = createExportLimiter();
    const release = limiter.acquire("owner", 0);
    expect(release).not.toBeNull();
    expect(limiter.acquire("owner", 1)).toBeNull();
    expect(limiter.acquire("someone-else", 1)).not.toBeNull();
    release?.();
    expect(limiter.acquire("owner", 2)).not.toBeNull();
  });

  it("caps exports per minute, then lets them through again", () => {
    const limiter = createExportLimiter({ perMinute: 2, windowMs: 60_000 });
    limiter.acquire("owner", 0)?.();
    limiter.acquire("owner", 1_000)?.();
    expect(limiter.acquire("owner", 2_000)).toBeNull();
    expect(limiter.acquire("owner", 61_000)).not.toBeNull();
  });
});

describe("print page rules", () => {
  it("prints A4, the first page from the top edge, later pages with a margin", () => {
    const css = printPageCss();
    expect(css).toContain("size: A4");
    expect(css).toContain(`margin: ${PAGE_MARGINS_MM.top}mm 0 ${PAGE_MARGINS_MM.bottom}mm 0`);
    expect(css).toContain("@page :first { margin-top: 0; }");
  });
});

describe("PDF error codes", () => {
  it("recognizes only the codes the interface explains", () => {
    expect(isPdfErrorCode("missing_translations")).toBe(true);
    expect(isPdfErrorCode("boom")).toBe(false);
    expect(isPdfErrorCode(undefined)).toBe(false);
  });
});
