import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrintReady } from "@/features/cv-export/components/print-ready";
import { PrintToolbar } from "@/features/cv-export/components/print-toolbar";
import { useCvExport } from "@/features/cv-export/components/use-cv-export";
import { renderHookWithIntl, renderWithIntl } from "../../utils/render";

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";

function pdfResponse() {
  return new Response(new Blob(["%PDF-1.7"], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Disposition":
        "attachment; filename=\"CV francais.pdf\"; filename*=UTF-8''CV%20fran%C3%A7ais.pdf",
    },
  });
}

const errorResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("useCvExport", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let downloads: { href: string; download: string }[];

  beforeEach(() => {
    toast.error.mockReset();
    toast.success.mockReset();
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ href: this.href, download: this.download });
    });
    URL.createObjectURL = vi.fn(() => "blob:cv");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads the PDF under the server's file name", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const { result } = renderHookWithIntl(() => useCvExport());

    let outcome: Awaited<ReturnType<typeof result.current.downloadPdf>> | undefined;
    await act(async () => {
      outcome = await result.current.downloadPdf(CV_ID, "Fallback name");
    });

    expect(outcome).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(`/api/cvs/${CV_ID}/pdf`, { cache: "no-store" });
    expect(downloads).toEqual([{ href: "blob:cv", download: "CV français.pdf" }]);
    expect(toast.success).toHaveBeenCalledWith("PDF downloaded");
    expect(result.current.downloading).toBe(false);
  });

  it("explains why the server refused, with the number of missing texts", async () => {
    fetchMock.mockResolvedValue(errorResponse(409, { error: "missing_translations", count: 2 }));
    const { result } = renderHookWithIntl(() => useCvExport());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.downloadPdf(CV_ID, "CV");
    });

    expect(outcome).toEqual({ ok: false, error: "missing_translations" });
    expect(toast.error).toHaveBeenCalledWith("Translate 2 texts before exporting this CV.");
    expect(downloads).toEqual([]);
  });

  it("treats unknown or unreadable errors as unavailable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));
    fetchMock.mockResolvedValueOnce(errorResponse(500, { error: "stack trace…" }));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = renderHookWithIntl(() => useCvExport());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        expect(await result.current.downloadPdf(CV_ID, "CV")).toEqual({
          ok: false,
          error: "unavailable",
        });
      });
    }
    expect(toast.error).toHaveBeenCalledTimes(3);
    expect(toast.error).toHaveBeenLastCalledWith(
      "The PDF couldn’t be created. Try again, or use Print and “Save as PDF”.",
    );
  });

  it("does not export when saving pending edits failed", async () => {
    const { result } = renderHookWithIntl(() => useCvExport());

    await act(async () => {
      expect(await result.current.downloadPdf(CV_ID, "CV", async () => false)).toEqual({
        ok: false,
        error: "unavailable",
      });
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the print page in a new tab without a link back to this one", async () => {
    const tab = { opener: window as unknown, close: vi.fn(), location: { href: "" } };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { result } = renderHookWithIntl(() => useCvExport(), { locale: "fr" });

    await act(async () => {
      result.current.openPrint(CV_ID, async () => true);
    });

    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe(`/fr/print/${CV_ID}?print=1`);
  });

  it("closes the print tab when pending edits could not be saved", async () => {
    const tab = { opener: null, close: vi.fn(), location: { href: "" } };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { result } = renderHookWithIntl(() => useCvExport());

    await act(async () => {
      result.current.openPrint(CV_ID, async () => false);
    });

    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe("");
  });

  it("tells the owner when the browser blocks the print tab", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { result } = renderHookWithIntl(() => useCvExport());

    result.current.openPrint(CV_ID);

    expect(toast.error).toHaveBeenCalledWith(
      "Your browser blocked the print tab. Allow pop-ups for this site and try again.",
    );
  });
});

describe("PrintReady", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    vi.spyOn(window, "print").mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks the page ready once fonts and images have loaded, then prints on request", async () => {
    const image = document.body.appendChild(document.createElement("img"));
    Object.defineProperty(image, "complete", { value: false });
    // A broken portrait must not block printing forever.
    image.decode = vi.fn(() => Promise.reject(new Error("decode failed")));

    const { unmount } = render(<PrintReady autoPrint />);

    await waitFor(() => expect(document.documentElement.dataset.printReady).toBe("true"));
    expect(image.decode).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.documentElement.dataset.printReady).toBeUndefined();
  });

  it("only marks the page ready by default", async () => {
    const { unmount } = render(<PrintReady />);

    await waitFor(() => expect(document.documentElement.dataset.printReady).toBe("true"));
    expect(window.print).not.toHaveBeenCalled();
    unmount();
  });
});

describe("PrintToolbar", () => {
  it("prints, downloads and links back to the editor", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "print").mockImplementation(() => {});
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))),
    );
    URL.createObjectURL = vi.fn(() => "blob:cv");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithIntl(<PrintToolbar cvId={CV_ID} name="Frontend CV" />);

    expect(screen.getByRole("heading", { name: "Frontend CV" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to editor" })).toHaveAttribute(
      "href",
      `/en/dashboard/cvs/${CV_ID}`,
    );

    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(window.print).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(screen.getByRole("button", { name: "Preparing PDF…" })).toBeDisabled();

    await act(async () => finish(pdfResponse()));
    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeEnabled();
    vi.unstubAllGlobals();
  });
});
