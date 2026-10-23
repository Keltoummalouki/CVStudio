import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TermsInput } from "@/components/forms/terms-input";
import { termKey } from "@/features/job-posts/matching";
import { renderWithIntl } from "../../utils/render";

function Harness({
  initial = [],
  max = 5,
  onChange,
}: {
  initial?: string[];
  max?: number;
  onChange?: (next: string[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TermsInput
      label="Other names"
      labelDetail="React"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      max={max}
      maxLength={20}
      identity={termKey}
      taken={["React"]}
      description="Spellings and translations."
    />
  );
}

const input = () => screen.getByRole("textbox", { name: "Other names, React" });
const chips = () =>
  screen.queryByRole("list", { name: /Other names/ })?.querySelectorAll("li") ?? [];

describe("TermsInput", () => {
  it("adds a name on Enter without submitting the form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    renderWithIntl(
      <form onSubmit={submit}>
        <Harness />
      </form>,
    );

    await user.type(input(), "React.js{Enter}");

    expect(chips()).toHaveLength(1);
    expect(screen.getByText("React.js")).toBeInTheDocument();
    expect(input()).toHaveValue("");
    expect(submit).not.toHaveBeenCalled();
  });

  it("splits a pasted list and refuses names already present, saying so", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness initial={["JS"]} />);

    await user.click(input());
    await user.paste("TypeScript, reactjs; JS\nNode.js");

    // "reactjs" is React.js, a different term from the label "React".
    expect([...chips()].map((chip) => chip.textContent)).toEqual([
      "JS",
      "TypeScript",
      "reactjs",
      "Node.js",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Already listed: JS");
  });

  it("treats the item's own name as taken", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    await user.type(input(), "react{Enter}");
    expect(chips()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Already listed: react");
  });

  it("removes a name with its button and keeps typed text on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness initial={["React.js", "ReactJS 18"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Remove “React.js”" }));
    expect(onChange).toHaveBeenLastCalledWith(["ReactJS 18"]);

    await user.type(input(), "React 19");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(["ReactJS 18", "React 19"]);
  });

  it("adds with the button on touch screens, and stops at the limit", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness max={2} initial={["One"]} />);

    await user.type(input(), "Two");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(chips()).toHaveLength(2);
    expect(input()).toBeDisabled();
    expect(input()).toHaveAttribute("placeholder", "Up to 2 names.");
  });

  it("trims long names to the limit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    await user.type(input(), `${"x".repeat(25)}{Enter}`);
    expect(onChange).toHaveBeenLastCalledWith(["x".repeat(20)]);
  });
});
