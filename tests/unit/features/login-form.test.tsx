import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/components/login-form";
import { renderWithIntl } from "../../utils/render";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/actions", () => ({ signIn }));

const redirectSignal = () =>
  Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/fr/dashboard;307;" });

function renderForm(props: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  const user = userEvent.setup();
  renderWithIntl(<LoginForm locale="fr" next="/dashboard/cvs" {...props} />);
  return { user };
}

async function submit(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password", { selector: "input" }), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

// A block body: a function returned from beforeEach would run as the test's teardown.
beforeEach(() => {
  signIn.mockReset();
});

describe("LoginForm", () => {
  it("explains missing and malformed fields without contacting the server", async () => {
    const { user } = renderForm();

    await submit(user, "", "");
    expect(await screen.findAllByText("This field is required.")).toHaveLength(2);

    await submit(user, "not-an-email", "");
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with the page's locale and return path, and lets Next navigate", async () => {
    signIn.mockImplementation(async () => {
      throw redirectSignal();
    });
    const { user } = renderForm();

    await submit(user, "owner@example.test", "secret");

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: "owner@example.test",
        password: "secret",
        locale: "fr",
        next: "/dashboard/cvs",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the password after wrong credentials", async () => {
    signIn.mockResolvedValue({ ok: false, error: "invalid_credentials" });
    const { user } = renderForm();

    await submit(user, "owner@example.test", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByLabelText("Password", { selector: "input" })).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("owner@example.test");
  });

  it("reports an unreachable server as unavailable", async () => {
    signIn.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { user } = renderForm();

    await submit(user, "owner@example.test", "secret");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in is unavailable right now. Try again in a moment.",
    );
  });

  it("shows a pending state and blocks double submission", async () => {
    let resolve: (value: unknown) => void = () => {};
    signIn.mockImplementation(() => new Promise((done) => (resolve = done)));
    const { user } = renderForm();

    await submit(user, "owner@example.test", "secret");

    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();
    resolve({ ok: false, error: "rate_limited" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts.");
  });

  it("toggles password visibility", async () => {
    const { user } = renderForm();
    const password = screen.getByLabelText("Password", { selector: "input" });

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("confirms a sign-out, and shows errors carried over from the server", () => {
    const { unmount } = renderWithIntl(
      <LoginForm locale="en" next="/dashboard" notice="signedOut" />,
    );
    expect(screen.getByText("You’re signed out.")).toBeInTheDocument();
    unmount();

    renderWithIntl(
      <LoginForm locale="en" next="/dashboard" notice="signedOut" initialError="not_authorized" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This account is not allowed to use this workspace.",
    );
    expect(screen.queryByText("You’re signed out.")).not.toBeInTheDocument();
  });
});
