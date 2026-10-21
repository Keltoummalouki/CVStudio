import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHistory } from "@/features/cv-builder/components/use-history";

afterEach(() => {
  document.body.innerHTML = "";
});

function focusField() {
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  return input;
}

describe("builder undo history", () => {
  it("records each discrete change as its own step", () => {
    const { result } = renderHook(() => useHistory(0));
    act(() => result.current.set((value) => value + 1));
    act(() => result.current.set((value) => value + 1));
    expect(result.current.value).toBe(2);

    act(() => result.current.undo());
    expect(result.current.value).toBe(1);
    act(() => result.current.undo());
    expect(result.current.value).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("groups consecutive keystrokes in one field into one step", () => {
    const { result } = renderHook(() => useHistory(""));
    focusField();
    act(() => result.current.set(() => "R"));
    act(() => result.current.set(() => "Ro"));
    act(() => result.current.set(() => "Role"));

    act(() => result.current.undo());
    expect(result.current.value).toBe("");
  });

  it("starts a new step when typing moves to another field", () => {
    const { result } = renderHook(() => useHistory(""));
    focusField();
    act(() => result.current.set(() => "a"));
    focusField();
    act(() => result.current.set(() => "ab"));

    act(() => result.current.undo());
    expect(result.current.value).toBe("a");
  });

  it("redoes what was undone, until a new change", () => {
    const { result } = renderHook(() => useHistory(0));
    act(() => result.current.set(() => 5));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.value).toBe(5);

    act(() => result.current.undo());
    act(() => result.current.set(() => 7));
    expect(result.current.canRedo).toBe(false);
  });

  it("ignores changes that return the same value", () => {
    const { result } = renderHook(() => useHistory({ a: 1 }));
    act(() => result.current.set((value) => value));
    expect(result.current.canUndo).toBe(false);
  });
});
