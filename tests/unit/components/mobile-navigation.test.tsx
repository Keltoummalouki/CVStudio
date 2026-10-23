import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  usePathname: () => "/dashboard/jobs/123",
}));

describe("mobile navigation", () => {
  it("keeps five destinations in the tab bar, Job match included and Settings moved out", () => {
    renderWithIntl(<MobileTabBar />);
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    const links = nav.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Overview",
      "Data",
      "CVs",
      "Match",
      "Templates",
    ]);
    expect(nav.getByRole("link", { name: "Match" })).toHaveAttribute("aria-current", "page");
  });

  it("reaches Settings and the profile from the account menu", async () => {
    const user = userEvent.setup();
    renderWithIntl(<AccountMenu />, { locale: "fr" });

    const trigger = screen.getByRole("button", { name: "Menu du compte" });
    await user.click(trigger);
    expect(await screen.findByRole("menuitem", { name: "Réglages" })).toHaveAttribute(
      "href",
      "/fr/dashboard/settings",
    );
    expect(screen.getByRole("menuitem", { name: "Votre profil" })).toHaveAttribute(
      "href",
      "/fr/dashboard/content/profile",
    );

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
});
