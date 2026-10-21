import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { MESSAGES, renderWithIntl } from "../../utils/render";

function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? "dialog-open" : "dialog-closed"}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete template?"
        description="Existing CVs created from it are not affected."
        confirmLabel="Delete template"
        tone="destructive"
        onConfirm={onConfirm}
      />
    </>
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ConfirmDialog", () => {
  it("shows a pending state and closes only after the action succeeds", async () => {
    const pending = deferred();
    renderWithIntl(<Harness onConfirm={() => pending.promise} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete template" }));

    const busyButton = await screen.findByRole("button", {
      name: MESSAGES.en.confirmDialog.pending,
    });
    expect(busyButton).toBeDisabled();
    expect(screen.getByRole("button", { name: MESSAGES.en.confirmDialog.cancel })).toBeDisabled();
    expect(screen.getByText("dialog-open")).toBeInTheDocument();

    pending.resolve();
    await waitFor(() => expect(screen.getByText("dialog-closed")).toBeInTheDocument());
  });

  it("stays open and explains when the action fails", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("network"));
    renderWithIntl(<Harness onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete template" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.en.confirmDialog.failed);
    expect(screen.getByText("dialog-open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete template" })).toBeEnabled();
  });

  it("states the consequence in the accessible description", () => {
    renderWithIntl(<Harness onConfirm={vi.fn()} />);
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      "Existing CVs created from it are not affected.",
    );
  });
});
