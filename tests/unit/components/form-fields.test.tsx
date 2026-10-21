import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { FormActionBar } from "@/components/forms/form-action-bar";
import { LocalizedField } from "@/components/forms/localized-field";
import { PeriodField } from "@/components/forms/period-field";
import { useSaveForm } from "@/components/forms/use-save-form";
import { useUnsavedChangesGuard } from "@/components/forms/use-unsaved-changes";
import type { ActionResult } from "@/lib/actions/result";
import type { Period } from "@/lib/dates/period";
import type * as Navigation from "@/lib/i18n/navigation";
import type { LocalizedTextValue } from "@/lib/i18n/localized-text";
import { renderWithIntl } from "../../utils/render";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => router,
}));

function ControlledLocalized({
  initial = {},
  onChange = () => {},
  ...props
}: {
  initial?: LocalizedTextValue;
  onChange?: (value: LocalizedTextValue) => void;
  required?: boolean;
  allowShared?: boolean;
  error?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <LocalizedField
      label="Role"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...props}
    />
  );
}

describe("LocalizedField", () => {
  it("offers one input per language, each spell-checked in its own language", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<ControlledLocalized initial={{ fr: "Développeur" }} onChange={onChange} />);

    const english = screen.getByRole("textbox", { name: "Role (English)" });
    const french = screen.getByRole("textbox", { name: "Role (French)" });
    expect(english).toHaveAttribute("lang", "en");
    expect(french).toHaveAttribute("lang", "fr");
    expect(french).toHaveValue("Développeur");

    await user.type(english, "Dev");
    expect(onChange).toHaveBeenLastCalledWith({ fr: "Développeur", en: "Dev" });
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("switches to one shared text and back without losing what was written", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<ControlledLocalized initial={{ en: "TypeScript" }} onChange={onChange} />);

    await user.click(screen.getByRole("switch", { name: /Same in both languages/ }));
    expect(onChange).toHaveBeenLastCalledWith({ shared: "TypeScript" });
    expect(screen.getByRole("textbox", { name: "Role (Both languages)" })).toHaveValue(
      "TypeScript",
    );
    expect(screen.queryByRole("textbox", { name: "Role (English)" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: /Same in both languages/ }));
    expect(onChange).toHaveBeenLastCalledWith({ en: "TypeScript", fr: "TypeScript" });
  });

  it("announces errors and links them to the inputs", () => {
    renderWithIntl(
      <ControlledLocalized required allowShared={false} error="Write it in one language" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Write it in one language");
    const english = screen.getByRole("textbox", { name: "Role (English)" });
    expect(english).toHaveAttribute("aria-invalid", "true");
    expect(english.getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
  });
});

describe("PeriodField", () => {
  const PERIOD: Period = {
    startYear: 2024,
    startMonth: 3,
    endYear: 2025,
    endMonth: 6,
    isCurrent: false,
  };

  it("clears the end date when the period becomes ongoing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(
      <PeriodField value={PERIOD} onChange={onChange} currentLabel="I currently work here" />,
    );

    await user.click(screen.getByRole("checkbox", { name: "I currently work here" }));

    expect(onChange).toHaveBeenCalledWith({
      ...PERIOD,
      isCurrent: true,
      endYear: null,
      endMonth: null,
    });
  });

  it("shows Present instead of an end date while ongoing, and reports errors", () => {
    renderWithIntl(
      <PeriodField
        value={{ ...PERIOD, isCurrent: true, endYear: null, endMonth: null }}
        onChange={() => {}}
        currentLabel="Ongoing"
        startError="Enter a year"
        endError="End is before start"
      />,
    );

    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ongoing" })).toBeChecked();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      "Enter a year",
      "End is before start",
    ]);
  });
});

describe("FormActionBar", () => {
  it("shows the save state, a cancel link and the single Save button", () => {
    renderWithIntl(
      <FormActionBar state="unsaved" isSaving={false} cancelHref="/dashboard/content" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/en/dashboard/content",
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("blocks double submission while saving and offers a retry after a failure", async () => {
    const onRetry = vi.fn();
    const { rerender } = renderWithIntl(<FormActionBar state="saving" isSaving />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    rerender(<FormActionBar state="failed" isSaving={false} onRetry={onRetry} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

type NameForm = { name: string };
type SaveFormHarnessProps = {
  action: (values: NameForm) => Promise<ActionResult<{ name: string }>>;
  onSaved?: (data: { name: string }) => void;
};

function SaveFormHarness({ action, onSaved = () => {} }: SaveFormHarnessProps) {
  const form = useForm<NameForm>({ defaultValues: { name: "Old" } });
  const { save, state, error } = useSaveForm({
    form,
    action,
    onSaved: (data) => {
      onSaved(data);
      form.reset(data);
    },
  });
  return (
    <form onSubmit={save}>
      <input aria-label="Name" {...form.register("name", { required: "required" })} />
      <p role="status">{state}</p>
      <p data-testid="error">{error ?? ""}</p>
      <p data-testid="field-error">{form.formState.errors.name?.message ?? ""}</p>
      <button type="submit">Save</button>
    </form>
  );
}

describe("useSaveForm", () => {
  async function editAndSave(value: string) {
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: "Name" });
    await user.clear(input);
    if (value) await user.type(input, value);
    await user.click(screen.getByRole("button", { name: "Save" }));
  }

  it("reports saved only after the server confirms", async () => {
    const onSaved = vi.fn();
    const action = vi.fn(async (values: NameForm) => ({ ok: true as const, data: values }));
    renderWithIntl(<SaveFormHarness action={action} onSaved={onSaved} />);

    await editAndSave("New");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("saved"));
    expect(action).toHaveBeenCalledWith({ name: "New" });
    expect(onSaved).toHaveBeenCalledWith({ name: "New" });
  });

  it("puts server field issues on the fields and keeps the edits", async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      error: "invalid_input" as const,
      fieldIssues: [{ path: "name", message: "tooLong" }],
    }));
    renderWithIntl(<SaveFormHarness action={action} />);

    await editAndSave("Very long");

    await waitFor(() => expect(screen.getByTestId("field-error")).toHaveTextContent("tooLong"));
    expect(screen.getByTestId("error")).toHaveTextContent("invalid_input");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Very long");
    expect(screen.getByRole("status")).toHaveTextContent("unsaved");
  });

  it("shows a recoverable failure when the request itself fails", async () => {
    renderWithIntl(<SaveFormHarness action={() => Promise.reject(new Error("offline"))} />);

    await editAndSave("New");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("failed"));
  });

  it("does not call the server when client validation fails", async () => {
    const action = vi.fn();
    renderWithIntl(<SaveFormHarness action={action} />);

    await editAndSave("");

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("invalid_input"));
    expect(action).not.toHaveBeenCalled();
  });
});

function GuardHarness({ when, onDiscard }: { when: boolean; onDiscard?: () => void }) {
  const { dialog, allowNavigation } = useUnsavedChangesGuard({ when, onDiscard });
  return (
    <>
      {/* The guard intercepts any in-app anchor; a plain one keeps Next's router out of the test. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/fr/dashboard/cvs">CVs</a>
      <a href="https://example.com/help">External</a>
      <button type="button" onClick={allowNavigation}>
        Allow
      </button>
      {dialog}
    </>
  );
}

describe("useUnsavedChangesGuard", () => {
  /** Clicks a link and returns whether the guard intercepted it. */
  const click = (name: string) => {
    const link = screen.getByRole("link", { name });
    // The guard stops intercepted clicks before they reach the link.
    let intercepted = true;
    const observe = (event: Event) => {
      intercepted = event.defaultPrevented;
      // jsdom cannot navigate; stop it from trying once the guard has decided.
      event.preventDefault();
    };
    link.addEventListener("click", observe);
    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    link.removeEventListener("click", observe);
    return intercepted;
  };

  it("confirms before an in-app link discards edits, then navigates", async () => {
    router.push.mockReset();
    const onDiscard = vi.fn();
    renderWithIntl(<GuardHarness when onDiscard={onDiscard} />);

    expect(click("CVs")).toBe(true);
    expect(
      screen.getByRole("alertdialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/cvs", { locale: "fr" });
  });

  it("keeps editing when the owner cancels", () => {
    router.push.mockReset();
    renderWithIntl(<GuardHarness when />);

    click("CVs");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves external links, clean forms and deliberate navigation alone", () => {
    const { rerender } = renderWithIntl(<GuardHarness when />);
    expect(click("External")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(click("CVs")).toBe(false);

    rerender(<GuardHarness when={false} />);
    expect(click("CVs")).toBe(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks the browser to confirm closing the tab while edits are unsaved", () => {
    renderWithIntl(<GuardHarness when />);
    const event = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
