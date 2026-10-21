import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { PdfErrorCode } from "@/features/cv-export/errors";
import { attachmentDisposition } from "@/features/cv-export/file-name";
import { createExportLimiter } from "@/features/cv-export/rate-limit";
import { loadExportableCv } from "@/features/cv-export/server/load-export";
import { getOwnerContext } from "@/lib/auth/session";
import { PRINT_PATH } from "@/lib/auth/routes";
import { PdfRenderError, renderPdf } from "@/lib/pdf/render-pdf";

// Node.js runtime (the default): the PDF engine drives a real browser.
// Launching a browser and printing takes a few seconds on a cold serverless start.
export const maxDuration = 60;

const limiter = createExportLimiter();
const uuid = z.uuid();

function failure(error: PdfErrorCode, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error, ...extra },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Downloads one CV as a PDF. Every request re-checks the session, the owner
 * allowlist and that the CV belongs to the caller (an unknown or foreign id is
 * "not found"), and refuses to export while texts are missing in its language.
 * Nothing is stored: the PDF is generated on demand and streamed back.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ cvId: string }> }) {
  const context = await getOwnerContext();
  if (!context) return failure("unauthorized", 401);

  const { cvId } = await params;
  const id = uuid.safeParse(cvId);
  if (!id.success) return failure("not_found", 404);

  let exportable;
  try {
    exportable = await loadExportableCv(context, id.data);
  } catch {
    return failure("unavailable", 503);
  }
  if (!exportable) return failure("not_found", 404);
  if (exportable.missingTranslations > 0) {
    return failure("missing_translations", 409, { count: exportable.missingTranslations });
  }

  const release = limiter.acquire(context.owner.id);
  if (!release) return failure("rate_limited", 429);

  try {
    // Cookies as they stand after this request's own session refresh.
    const sessionCookies = (await cookies()).getAll();
    const pdf = await renderPdf({
      url: `${request.nextUrl.origin}/${exportable.locale}${PRINT_PATH}/${exportable.id}`,
      cookies: sessionCookies,
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": attachmentDisposition(exportable.name),
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Never log CV content or cookies. The engine's own messages hold neither
    // and say what to fix (such as no browser installed); others log by type.
    const reason =
      error instanceof PdfRenderError
        ? error.message
        : error instanceof Error
          ? error.name
          : "unknown error";
    console.error("PDF export failed:", reason);
    return failure("unavailable", 503);
  } finally {
    release();
  }
}
