import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@/components/layout/pagination";
import { renderWithIntl } from "../../utils/render";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = renderWithIntl(
      <Pagination page={1} pageCount={1} onPageChange={vi.fn()} label="Pages" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page and moves between pages", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderWithIntl(
      <Pagination page={5} pageCount={12} onPageChange={onPageChange} label="Pages" />,
    );

    const navigation = screen.getByRole("navigation", { name: "Pages" });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 5" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 4" })).not.toHaveAttribute("aria-current");
    // First, last and the neighbours of the current page; the rest is a gap.
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Page 8" })).not.toBeInTheDocument();
    expect(screen.getByText("Page 5 of 12")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Page 12" }));
    expect(onPageChange.mock.calls).toEqual([[4], [6], [12]]);
  });

  it("disables the arrows at either end", () => {
    const { rerender } = renderWithIntl(
      <Pagination page={1} pageCount={3} onPageChange={vi.fn()} label="Pages" />,
    );
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    rerender(<Pagination page={3} pageCount={3} onPageChange={vi.fn()} label="Pages" />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("speaks French", () => {
    renderWithIntl(<Pagination page={2} pageCount={3} onPageChange={vi.fn()} label="Pages" />, {
      locale: "fr",
    });
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeInTheDocument();
    expect(screen.getByText("Page 2 sur 3")).toBeInTheDocument();
  });
});
