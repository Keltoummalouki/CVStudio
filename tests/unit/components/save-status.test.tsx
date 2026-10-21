import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SAVE_STATES, SaveStatus } from "@/components/feedback/save-status";
import { MESSAGES, renderWithIntl } from "../../utils/render";

describe("SaveStatus", () => {
  it.each(SAVE_STATES)("announces the %s state politely", (state) => {
    renderWithIntl(<SaveStatus state={state} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(MESSAGES.en.saveStatus[state]);
  });

  it("offers a retry that preserves the edit flow after a failed save", async () => {
    const onRetry = vi.fn();
    renderWithIntl(<SaveStatus state="failed" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: MESSAGES.en.saveStatus.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not offer retry outside the failed state", () => {
    renderWithIntl(<SaveStatus state="saved" onRetry={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("speaks French when the interface is French", () => {
    renderWithIntl(<SaveStatus state="saving" />, { locale: "fr" });
    expect(screen.getByRole("status")).toHaveTextContent("Enregistrement…");
  });
});
