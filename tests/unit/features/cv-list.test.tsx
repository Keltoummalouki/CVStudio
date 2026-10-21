import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
