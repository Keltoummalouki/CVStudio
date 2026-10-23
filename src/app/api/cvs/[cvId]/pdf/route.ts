import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { PdfErrorCode } from "@/features/cv-export/errors";
import { attachmentDisposition } from "@/features/cv-export/file-name";
import { createExportLimiter } from "@/features/cv-export/rate-limit";
import { loadExportableCv } from "@/features/cv-export/server/load-export";
import { getOwnerContext } from "@/lib/auth/session";
import { PRINT_PATH } from "@/lib/auth/routes";
import { PdfLayoutError, describePdfFailure, renderPdf } from "@/lib/pdf/render-pdf";
import { sessionCookies } from "@/lib/supabase/session-cookies";

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

  const started = Date.now();
  const origin = request.nextUrl.origin;
  let forwarded = 0;
  try {
    // The session cookies as they stand after this request's own refresh:
    // all the print page needs to recognize the owner, and nothing else.
    const session = sessionCookies((await cookies()).getAll());
    forwarded = session.length;
    const pdf = await renderPdf({
      url: `${origin}/${exportable.locale}${PRINT_PATH}/${exportable.id}`,
      cookies: session,
    });
    console.info(
      "PDF export",
      JSON.stringify({ origin, elapsedMs: Date.now() - started, bytes: pdf.byteLength }),
    );
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
    // The design cuts text off: the owner fixes it in the CV, nothing is broken.
    if (error instanceof PdfLayoutError) {
      return failure("layout_issues", 409, { count: error.count });
    }
    // One structured line: the step that failed and the original error with
    // its stack, redacted. Never cookie values, tokens or CV content.
    console.error(
      "PDF export failed",
      JSON.stringify({
        ...describePdfFailure(error),
        origin,
        sessionCookies: forwarded,
        elapsedMs: Date.now() - started,
      }),
    );
    return failure("unavailable", 503);
  } finally {
    release();
  }
}
