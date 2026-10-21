/**
 * File name for a downloaded CV: the CV's name, made safe for every operating
 * system, with an ASCII fallback for old clients (RFC 6266 / RFC 5987).
 */
export function pdfFileName(name: string): { unicode: string; ascii: string } {
  const base =
    name
      .normalize("NFC")
      // Characters Windows, macOS or Linux refuse in file names, and control characters.
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 120) || "CV";
  const ascii =
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "CV";
  return { unicode: `${base}.pdf`, ascii: `${ascii}.pdf` };
}

/** `Content-Disposition` value that keeps accents and dashes in modern browsers. */
export function attachmentDisposition(name: string): string {
  const { unicode, ascii } = pdfFileName(name);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(unicode)}`;
}

/** The unicode file name from a `Content-Disposition` header, if any. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      /* fall through to the ASCII name */
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null;
}
