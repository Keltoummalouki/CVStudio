import { act, fireEvent, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useBuilderAutosave,
  type BuilderDraft,
} from "@/features/cv-builder/components/use-builder-autosave";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import type { ActionResult } from "@/lib/actions/result";
import type * as Navigation from "@/lib/i18n/navigation";
import { buildMasterData, sequentialIds } from "../../fixtures/master-data";
import { renderWithIntl } from "../../utils/render";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => router,
}));

const CV_ID = "3e9f6c1a-5b7d-4e2f-8a1c-9d0b2e4f6a8c";
const SAVE_DELAY_MS = 700;
const definition = createDefaultDefinition(buildMasterData(), sequentialIds());
const draft = (name: string): BuilderDraft => ({ name, locale: "en", definition });

type SaveResult = ActionResult<{ revision: number }>;
type Autosave = ReturnType<typeof useBuilderAutosave<BuilderDraft>>;

let save: ReturnType<
  typeof vi.fn<
    (input: BuilderDraft & { id: string; expectedRevision: number }) => Promise<SaveResult>
  >
>;
let getRevision: ReturnType<typeof vi.fn<(id: string) => Promise<SaveResult>>>;
let autosave: Autosave;

function Harness({ value, expose }: { value: BuilderDraft; expose: (result: Autosave) => void }) {
  const result = useBuilderAutosave({ id: CV_ID, revision: 1, draft: value, save, getRevision });
  useEffect(() => expose(result));
  return (
    <>
      <output aria-label="state">{result.state}</output>
      {/* The hook intercepts any in-app anchor; a plain one keeps Next's router out of the test. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/fr/dashboard/cvs?view=ready">Library</a>
      {result.leaveDialog}
    </>
  );
}

const expose = (result: Autosave) => {
  autosave = result;
};

function setup(initial = draft("CV")) {
  const view = renderWithIntl(<Harness value={initial} expose={expose} />);
  return {
    edit: (next: BuilderDraft) => view.rerender(<Harness value={next} expose={expose} />),
  };
}

const state = () => screen.getByLabelText("state").textContent;
const elapse = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  router.push.mockReset();
  router.refresh.mockReset();
  let revision = 1;
  save = vi.fn(async () => ({ ok: true as const, data: { revision: ++revision } }));
  getRevision = vi.fn(async () => ({ ok: true as const, data: { revision: 10 } }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useBuilderAutosave", () => {
  it("starts idle and saves edits once the owner pauses", async () => {
    const { edit } = setup();
    expect(state()).toBe("idle");

    edit(draft("CV v2"));
    expect(state()).toBe("unsaved");
    await elapse(SAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();

    await elapse(1);
    expect(save).toHaveBeenCalledWith({ ...draft("CV v2"), id: CV_ID, expectedRevision: 1 });
    expect(state()).toBe("saved");
  });

  it("debounces bursts of edits into one write of the latest draft", async () => {
    const { edit } = setup();

    edit(draft("a"));
    await elapse(300);
    edit(draft("ab"));
    await elapse(300);
    edit(draft("abc"));
    await elapse(SAVE_DELAY_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].name).toBe("abc");
  });

  it("bases each write on the revision the previous one returned", async () => {
    const { edit } = setup();

    edit(draft("first"));
    await elapse(SAVE_DELAY_MS);
    edit(draft("second"));
    await elapse(SAVE_DELAY_MS);

    expect(save.mock.calls.map(([input]) => input.expectedRevision)).toEqual([1, 2]);
  });

  it("stops on a conflict until the owner keeps their version", async () => {
    save.mockResolvedValueOnce({ ok: false, error: "stale" });
    const { edit } = setup();

    edit(draft("mine"));
    await elapse(SAVE_DELAY_MS);
    expect(autosave.conflict).toBe(true);
    expect(state()).toBe("failed");

    // No silent retries over the other tab's version.
    await elapse(SAVE_DELAY_MS * 3);
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => autosave.keepMine());
    expect(getRevision).toHaveBeenCalledWith(CV_ID);
    expect(save).toHaveBeenLastCalledWith({ ...draft("mine"), id: CV_ID, expectedRevision: 10 });
    expect(autosave.conflict).toBe(false);
    expect(state()).toBe("saved");
  });

  it("reloads the other version when the owner chooses it", async () => {
    save.mockResolvedValueOnce({ ok: false, error: "stale" });
    const { edit } = setup();
    edit(draft("mine"));
    await elapse(SAVE_DELAY_MS);

    act(() => autosave.loadLatest());

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps a conflict when the latest revision cannot be read", async () => {
    save.mockResolvedValueOnce({ ok: false, error: "stale" });
    getRevision.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    const { edit } = setup();
    edit(draft("mine"));
    await elapse(SAVE_DELAY_MS);

    await act(async () => autosave.keepMine());

    expect(autosave.error).toBe("unavailable");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("reports a failed save, keeps the edits and retries on request", async () => {
    save.mockRejectedValueOnce(new Error("network"));
    const { edit } = setup();

    edit(draft("kept"));
    await elapse(SAVE_DELAY_MS);
    expect(state()).toBe("failed");
    expect(autosave.error).toBe("unavailable");

    await elapse(SAVE_DELAY_MS * 3);
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => autosave.retry());
    expect(save).toHaveBeenCalledTimes(2);
    expect(state()).toBe("saved");
  });

  it("waits while offline instead of failing", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const { edit } = setup();

    edit(draft("offline edit"));
    act(() => void window.dispatchEvent(new Event("offline")));
    await elapse(SAVE_DELAY_MS * 2);

    expect(state()).toBe("offline");
    expect(save).not.toHaveBeenCalled();
    await act(async () => expect(await autosave.flush()).toBe(false));
  });

  it("flushes pending edits immediately, and has nothing to do when saved", async () => {
    const { edit } = setup();
    await act(async () => expect(await autosave.flush()).toBe(true));
    expect(save).not.toHaveBeenCalled();

    edit(draft("now"));
    await act(async () => expect(await autosave.flush()).toBe(true));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("asks the browser to confirm closing the tab only while edits are unsaved", async () => {
    const { edit } = setup();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);
    edit(draft("pending"));
    expect(unload()).toBe(true);
    await elapse(SAVE_DELAY_MS);
    expect(unload()).toBe(false);
  });

  it("saves before following an in-app link, then navigates in the link's locale", async () => {
    const { edit } = setup();
    edit(draft("pending"));

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Library" }));
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/cvs?view=ready", { locale: "fr" });
  });

  it("asks before leaving when the edits could not be saved", async () => {
    save.mockResolvedValue({ ok: false, error: "unavailable" });
    const { edit } = setup();
    edit(draft("pending"));

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Library" }));
    });
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Leave without saving?" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Leave anyway" }));
    });
    expect(router.push).toHaveBeenCalledWith("/dashboard/cvs?view=ready", { locale: "fr" });
  });
});
