import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@messages/en.json";
import { SortableList } from "@/components/forms/sortable-list";

function List() {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <SortableList
        items={["Summary", "Experience", "Education"]}
        getKey={(item) => item}
        getLabel={(item) => item}
        onMove={() => {}}
        renderItem={(item) => <span>{item}</span>}
      />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("SortableList", () => {
  it("hydrates server-rendered markup without attribute mismatches", async () => {
    // Rendering first on the "server" advances dnd-kit's module-level id
    // counter, exactly as a real server render does before the browser hydrates.
    const html = renderToString(<List />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <List />);
    });

    const hydrationErrors = errors.mock.calls.filter((call) =>
      String(call[0]).toLowerCase().includes("hydrat"),
    );
    expect(hydrationErrors).toEqual([]);
    const handle = container.querySelector("[aria-roledescription=sortable]");
    const describedBy = handle?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy).not.toMatch(/^DndDescribedBy-\d+$/);
  });
});
