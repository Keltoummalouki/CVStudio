"use client";

import { useCallback, useRef, useState } from "react";

const LIMIT = 100;
// Consecutive keystrokes in one text field within this window form one undo
// step, so undo removes a phrase, not a letter. Clicks are always their own step.
const COALESCE_MS = 1000;

type History<T> = { past: T[]; present: T; future: T[] };

/** Undo/redo for the builder draft. */
export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });
  const lastChange = useRef<{ at: number; field: Element | null }>({ at: 0, field: null });

  const set = useCallback((change: (current: T) => T) => {
    const now = Date.now();
    const active = typeof document === "undefined" ? null : document.activeElement;
    const field =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
    const coalesce =
      field !== null &&
      field === lastChange.current.field &&
      now - lastChange.current.at < COALESCE_MS;
    lastChange.current = { at: now, field };
    setHistory((current) => {
      const next = change(current.present);
      if (Object.is(next, current.present)) return current;
      return {
        past:
          coalesce && current.past.length > 0
            ? current.past
            : [...current.past, current.present].slice(-LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    lastChange.current = { at: 0, field: null };
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (previous === undefined) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastChange.current = { at: 0, field: null };
    setHistory((current) => {
      const [next, ...future] = current.future;
      if (next === undefined) return current;
      return { past: [...current.past, current.present], present: next, future };
    });
  }, []);

  return {
    value: history.present,
    set,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
