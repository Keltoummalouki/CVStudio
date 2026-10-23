import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CvList } from "@/features/cv-documents/components/cv-list";
import type { CvListItem } from "@/features/cv-documents/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/cv-documents/server/actions", () => ({
  deleteCv: vi.fn(),
  duplicateCv: vi.fn(),
  restoreCv: vi.fn(),
}));

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: vi.fn() }),
}));

/** The URL query the App Router would expose; jsdom has no router. */
const url = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSearchParams: () => url.searchParams,
}));

beforeEach(() => {
  url.searchParams = new URLSearchParams();
  window.history.replaceState(null, "", "/en/dashboard/cvs");
});

/** `count` ready CVs named "CV 01", "CV 02", …, newest first. */
function manyCvs(count: number): CvListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `cv-${index + 1}`,
    name: `CV ${String(index + 1).padStart(2, "0")}`,
    locale: "en",
    updatedAt: "2026-10-20T09:00:00Z",
    createdFromTemplateName: null,
    missingTranslations: 0,
    warnings: 0,
  }));
}

const shownNames = () =>
  screen.getAllByRole("link").map((link) => link.textContent?.match(/CV \d+/)?.[0]);

const cvs: CvListItem[] = [
  {
    id: "ready",
    name: "Frontend — Acme",
    locale: "en",
    updatedAt: "2026-10-20T09:00:00Z",
    createdFromTemplateName: "Engineering",
    missingTranslations: 0,
    warnings: 0,
  },
  {
    id: "translate",
    name: "Développeur web",
    locale: "fr",
    updatedAt: "2026-10-19T09:00:00Z",
    createdFromTemplateName: null,
    missingTranslations: 2,
    warnings: 0,
  },
  {
    id: "warning",
    name: "Archived reference",
    locale: "en",
    updatedAt: "2026-10-18T09:00:00Z",
    createdFromTemplateName: null,
    missingTranslations: 0,
    warnings: 1,
  },
  {
    id: "unreadable",
    name: "Old layout",
    locale: "en",
    updatedAt: "2026-10-17T09:00:00Z",
    createdFromTemplateName: null,
    missingTranslations: null,
    warnings: 0,
  },
];

describe("CV library", () => {
  it("keeps unreadable layouts and warnings in needs attention, separate from ready documents", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CvList cvs={cvs} />);

    await user.click(screen.getByRole("button", { name: "Needs attention 3" }));
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /Frontend — Acme/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Old layout/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Archived reference/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ready 1" }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Frontend — Acme/ })).toBeInTheDocument();
  });

  it("combines search with status filters and recovers from an empty result", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CvList cvs={cvs} />);
    const search = screen.getByRole("searchbox", { name: "Search your CVs" });

    await user.type(search, "  ENGINEERING ");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Frontend — Acme/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Needs attention 3" }));
    expect(screen.getByRole("heading", { name: "No CVs match this view" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all CVs" }));
    expect(search).toHaveValue("");
    expect(screen.getAllByRole("link")).toHaveLength(4);

    await user.type(search, "AcMe");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});

describe("CV library pages", () => {
  it("shows ten CVs per page and keeps the page in the address bar", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CvList cvs={manyCvs(23)} />);

    expect(shownNames()).toEqual([
      "CV 01",
      "CV 02",
      "CV 03",
      "CV 04",
      "CV 05",
      "CV 06",
      "CV 07",
      "CV 08",
      "CV 09",
      "CV 10",
    ]);
    expect(screen.getByText("1–10 of 23")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(shownNames()[0]).toBe("CV 11");
    expect(screen.getByText("11–20 of 23")).toBeInTheDocument();
    expect(window.location.search).toBe("?page=2");

    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(shownNames()).toEqual(["CV 21", "CV 22", "CV 23"]);
    expect(screen.getByText("21–23 of 23")).toBeInTheDocument();
    // The new page starts where the reader is.
    expect(screen.getByRole("list", { name: "Your CVs, page 3 of 3" })).toHaveFocus();
    expect(window.location.search).toBe("?page=3");

    // A new search or filter starts again from its first page.
    const search = screen.getByRole("searchbox", { name: "Search your CVs" });
    await user.type(search, "CV 2");
    expect(search).toHaveFocus();
    expect(shownNames()).toEqual(["CV 20", "CV 21", "CV 22", "CV 23"]);
    expect(screen.queryByRole("navigation", { name: "Pages of your CVs" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("?q=CV+2");

    await user.clear(search);
    await user.type(search, "nothing like it");
    await user.click(screen.getByRole("button", { name: "Show all CVs" }));
    expect(screen.getByText("1–10 of 23")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/en/dashboard/cvs");
  });

  it("opens on the view in the URL, and follows a navigation to another view", () => {
    url.searchParams = new URLSearchParams("page=2&status=ready&q=CV");
    const cvs = manyCvs(23);
    const { rerender } = renderWithIntl(<CvList cvs={cvs} />);

    expect(screen.getByRole("searchbox", { name: "Search your CVs" })).toHaveValue("CV");
    expect(screen.getByRole("button", { name: "Ready 23" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("11–20 of 23")).toBeInTheDocument();

    // E.g. the CVs link in the navigation, followed while on page 2.
    url.searchParams = new URLSearchParams();
    rerender(<CvList cvs={cvs} />);
    expect(screen.getByRole("searchbox", { name: "Search your CVs" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "All CVs 23" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("1–10 of 23")).toBeInTheDocument();
  });

  it("shows the last page when the URL asks for one past the end", () => {
    url.searchParams = new URLSearchParams("page=9&status=nonsense");
    renderWithIntl(<CvList cvs={manyCvs(23)} />);

    expect(screen.getByText("21–23 of 23")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All CVs 23" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says when older CVs are left out of the list", () => {
    const { rerender } = renderWithIntl(<CvList cvs={manyCvs(3)} total={3} />);
    expect(screen.queryByText(/most recently edited/)).not.toBeInTheDocument();

    rerender(<CvList cvs={manyCvs(3)} total={250} />);
    expect(
      screen.getByText("Only your 3 most recently edited CVs are listed (250 in all)."),
    ).toBeInTheDocument();
  });
});
