import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordList } from "@/features/career-data/components/record-list";
import { reorderRecords } from "@/features/career-data/server/actions";
import type { RecordListItem } from "@/features/career-data/server/queries";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/features/career-data/server/actions", () => ({
  deleteArchivedRecord: vi.fn(),
  getRecordReferences: vi.fn(),
  reorderRecords: vi.fn().mockResolvedValue({ ok: true }),
  setRecordArchived: vi.fn(),
}));

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const ITEMS: RecordListItem[] = [
  {
    id: "frontend",
    title: { en: "Frontend developer", fr: "Développeur frontend" },
    context: "Studio North",
    localizedContext: { en: "Remote", fr: "À distance" },
    period: null,
    coverage: { en: true, fr: true },
    archived: false,
  },
  {
    id: "data",
    title: { en: "Data engineer", fr: "Ingénieur données" },
    context: "Atelier West",
    localizedContext: null,
    period: null,
    coverage: { en: true, fr: false },
    archived: false,
  },
  {
    id: "archived",
    title: { en: "Archived role" },
    context: "Studio North",
    localizedContext: null,
    period: null,
    coverage: { en: true, fr: false },
    archived: true,
  },
];

function renderList(locale: "en" | "fr" = "en") {
  return renderWithIntl(
    <RecordList kind="experience" items={ITEMS} hrefBase="/dashboard/content/experiences" />,
    { locale },
  );
}

describe("career record discovery", () => {
  it("searches both languages and context without pulling archived records into active results", async () => {
    const user = userEvent.setup();
    renderList();
    const search = screen.getByRole("searchbox");

    await user.type(search, "DONNÉES");
    expect(screen.getByRole("link", { name: /Data engineer/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Frontend developer/ })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "studio north");
    expect(screen.getByRole("link", { name: /Frontend developer/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Data engineer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Archived role/ })).not.toBeInTheDocument();
  });

  it("combines the translation filter with search and recovers from an empty result", async () => {
    const user = userEvent.setup();
    renderList();

    const filter = screen.getByRole("button", { name: "Needs translation" });
    await user.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /Data engineer/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Frontend developer/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "frontend");
    expect(screen.getByRole("heading", { name: "No matching entries" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(filter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
  });

  it("prevents reordering a filtered subset and restores keyboard move controls after clearing", async () => {
    const user = userEvent.setup();
    renderList();
    await user.type(screen.getByRole("searchbox"), "data");

    expect(screen.getByRole("button", { name: "Move up: Data engineer" })).toBeDisabled();
    expect(screen.getByText("Clear filters to reorder entries.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    const moveUp = screen.getByRole("button", { name: "Move up: Data engineer" });
    expect(moveUp).toBeEnabled();
    await user.click(moveUp);

    expect(reorderRecords).toHaveBeenCalledWith("experience", ["data", "frontend"]);
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(rows[0]!).getByRole("link", { name: /Data engineer/ })).toBeInTheDocument();
  });

  it("keeps archive access explicit and provides the translated filter in French", async () => {
    const user = userEvent.setup();
    renderList("fr");
    expect(screen.getByRole("button", { name: "À traduire" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", {
      name: /Afficher les éléments archivés/,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("link", { name: /Archived role/ })).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("shows pending order changes, prevents overlapping moves, and restores the order after a failed save", async () => {
    const pending = Promise.withResolvers<Awaited<ReturnType<typeof reorderRecords>>>();
    vi.mocked(reorderRecords).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("button", { name: "Move up: Data engineer" }));
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move down: Data engineer" })).toBeDisabled();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")[0]).toHaveTextContent(
      "Data engineer",
    );

    await act(async () => pending.resolve({ ok: false, error: "unavailable" }));
    await waitFor(() => expect(screen.queryByText("Saving…")).not.toBeInTheDocument());
    expect(within(screen.getByRole("list")).getAllByRole("listitem")[0]).toHaveTextContent(
      "Frontend developer",
    );
    expect(screen.getByRole("button", { name: "Move up: Data engineer" })).toBeEnabled();
  });
});
