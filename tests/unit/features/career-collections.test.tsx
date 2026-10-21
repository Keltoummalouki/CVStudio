import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SoftSkillsForm,
  SpokenLanguagesForm,
} from "@/features/career-data/components/collection-forms";
import { PhotoField } from "@/features/career-data/components/photo-field";
import type { SoftSkillsValues } from "@/features/career-data/schemas";
import type * as Navigation from "@/lib/i18n/navigation";
import { renderWithIntl } from "../../utils/render";

const mocks = vi.hoisted(() => ({
  saveSoftSkills: vi.fn(),
  saveSpokenLanguages: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  removeProfilePhoto: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/career-data/server/actions", () => ({
  saveSoftSkills: mocks.saveSoftSkills,
  saveSpokenLanguages: mocks.saveSpokenLanguages,
  saveSkillGroups: vi.fn(),
  uploadProfilePhoto: mocks.uploadProfilePhoto,
  removeProfilePhoto: mocks.removeProfilePhoto,
}));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => mocks.router,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const SOFT_SKILLS: SoftSkillsValues = {
  expectedStamp: "2026-10-20T10:00:00Z",
  items: [{ id: "00000000-0000-4000-8000-000000000060", label: { en: "Teamwork" } }],
};

beforeEach(() => {
  for (const fn of [
    mocks.saveSoftSkills,
    mocks.saveSpokenLanguages,
    mocks.uploadProfilePhoto,
    mocks.removeProfilePhoto,
    mocks.toast.success,
  ]) {
    fn.mockReset();
  }
});

describe("collection forms", () => {
  it("adds a soft skill and saves the whole list with its concurrency stamp", async () => {
    const user = userEvent.setup();
    mocks.saveSoftSkills.mockImplementation(async (values: SoftSkillsValues) => ({
      ok: true,
      data: values,
    }));
    renderWithIntl(<SoftSkillsForm initialValues={SOFT_SKILLS} />);

    await user.click(screen.getByRole("button", { name: "Add soft skill" }));
    await user.type(screen.getByRole("textbox", { name: "Soft skill 2 (English)" }), "Curiosity");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveSoftSkills).toHaveBeenCalledTimes(1));
    expect(mocks.saveSoftSkills.mock.calls[0]?.[0]).toEqual({
      expectedStamp: "2026-10-20T10:00:00Z",
      items: [SOFT_SKILLS.items[0], { id: null, label: { en: "Curiosity" } }],
    });
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Changes saved"));
  });

  it("removes an item and requires text in new ones", async () => {
    const user = userEvent.setup();
    renderWithIntl(<SoftSkillsForm initialValues={SOFT_SKILLS} />);

    await user.click(screen.getByRole("button", { name: "Remove: Soft skill 1" }));
    expect(screen.queryByRole("textbox", { name: /Soft skill 1/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add soft skill" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Write this in at least one language.")).toBeInTheDocument();
    expect(mocks.saveSoftSkills).not.toHaveBeenCalled();
  });

  it("edits a spoken language and its level", async () => {
    const user = userEvent.setup();
    mocks.saveSpokenLanguages.mockImplementation(async (values: unknown) => ({
      ok: true,
      data: values,
    }));
    renderWithIntl(<SpokenLanguagesForm initialValues={{ expectedStamp: null, items: [] }} />);

    await user.click(screen.getByRole("button", { name: "Add language" }));
    await user.type(screen.getByRole("textbox", { name: "Language (English)" }), "French");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveSpokenLanguages).toHaveBeenCalledTimes(1));
    expect(mocks.saveSpokenLanguages.mock.calls[0]?.[0]).toMatchObject({
      items: [{ id: null, name: { en: "French" } }],
    });
  });
});

describe("PhotoField", () => {
  const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const choose = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });
  const png = (size = 1024) =>
    new File([new Uint8Array(size)], "portrait.png", { type: "image/png" });

  it("uploads a photo right away and shows it", async () => {
    mocks.uploadProfilePhoto.mockResolvedValue({
      ok: true,
      data: { url: "https://signed/new.png" },
    });
    renderWithIntl(<PhotoField initialUrl={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    choose(png());

    expect(await screen.findByRole("img", { name: "Profile photo" })).toHaveAttribute(
      "src",
      "https://signed/new.png",
    );
    const sent = mocks.uploadProfilePhoto.mock.calls[0]?.[0] as FormData;
    expect((sent.get("photo") as File).name).toBe("portrait.png");
    expect(mocks.toast.success).toHaveBeenCalledWith("Photo updated");
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
  });

  it("checks size and type before uploading", () => {
    renderWithIntl(<PhotoField initialUrl={null} />);

    choose(png(5 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert")).toHaveTextContent("This file is larger than 5 MB.");

    choose(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use a JPEG, PNG or WebP image.");
    expect(mocks.uploadProfilePhoto).not.toHaveBeenCalled();
  });

  it("explains server refusals and failures", async () => {
    mocks.uploadProfilePhoto.mockResolvedValueOnce({ ok: false, error: "unsupported_type" });
    mocks.uploadProfilePhoto.mockImplementationOnce(async () => {
      throw new Error("network");
    });
    renderWithIntl(<PhotoField initialUrl={null} />);

    choose(png());
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPEG, PNG or WebP image.");

    choose(png());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t update the photo. Try again."),
    );
  });

  it("removes the photo after confirmation", async () => {
    const user = userEvent.setup();
    mocks.removeProfilePhoto.mockResolvedValue({ ok: true, data: undefined });
    renderWithIntl(<PhotoField initialUrl="https://signed/old.png" />);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = within(screen.getByRole("alertdialog"));
    await user.click(dialog.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByRole("img")).not.toBeInTheDocument());
    expect(mocks.removeProfilePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success).toHaveBeenCalledWith("Photo removed");
  });
});
