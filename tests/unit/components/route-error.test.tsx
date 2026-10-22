import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DashboardError from "@/app/[locale]/(dashboard)/dashboard/error";
import LocaleError from "@/app/[locale]/error";
import { renderWithIntl } from "../../utils/render";

/** A server error as it reaches the browser: redacted, with a digest. */
const serverError = () => Object.assign(new Error("redacted"), { digest: "4012345678" });

describe("route error boundaries", () => {
  it("explain the failure in the interface language and retry on request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const { container } = renderWithIntl(<DashboardError error={serverError()} retry={retry} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "This page couldn’t load" }),
    ).toBeVisible();
    expect(screen.getByText("Reference 4012345678")).toBeInTheDocument();
    // The PDF engine recognizes a failed print page by this marker.
    expect(container.querySelector("[data-route-error]")).not.toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("offer a way back to the overview outside the dashboard, in French too", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithIntl(<LocaleError error={new Error("boom")} retry={() => {}} />, { locale: "fr" });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Impossible de charger cette page" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Aller à la vue d’ensemble" })).toHaveAttribute(
      "href",
      "/fr/dashboard",
    );
    // Only the digest of a server error is shown, never its message.
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });
});
