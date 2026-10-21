import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  usePathname: () => "/dashboard/cvs",
}));

describe("LocaleSwitcher", () => {
  it("links the current page in each language and marks the active one", () => {
    renderWithIntl(<LocaleSwitcher />, { locale: "fr" });
    const nav = within(screen.getByRole("navigation", { name: "Langue de l’interface" }));

    const english = nav.getByRole("link", { name: "English" });
    expect(english).toHaveAttribute("href", "/en/dashboard/cvs");
    expect(english).toHaveAttribute("hreflang", "en");
    expect(english).toHaveAttribute("lang", "en");
    expect(english).not.toHaveAttribute("aria-current");

    const french = nav.getByRole("link", { name: "Français" });
    expect(french).toHaveAttribute("href", "/fr/dashboard/cvs");
    expect(french).toHaveAttribute("aria-current", "true");
  });

  it("can show full language names", () => {
    renderWithIntl(<LocaleSwitcher labels="names" tone="rail" />);

    expect(screen.getByRole("link", { name: "Français" })).toHaveTextContent("Français");
    expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute(
      "title",
      "Switch interface to Français",
    );
  });
});
