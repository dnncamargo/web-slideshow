import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNotesAutosave } from "../src/features/editor/notes/notes-autosave";
import type { PointedNote } from "../src/features/persistence/presentation-notes";

const setTimeoutFn = (handler: () => void, delayMs: number) =>
  setTimeout(handler, delayMs) as unknown as number;
const clearTimeoutFn = (handle: number) => clearTimeout(handle);
const slideNotes = (text: string, pointed: PointedNote[] = []) => ({
  text,
  pointed,
});

describe("notes autosave lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists a complete slide snapshot after the 500 ms debounce", () => {
    const saved: unknown[] = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => saved.push(save),
      setTimeoutFn,
      clearTimeoutFn,
    });
    const snapshot = slideNotes("hello", [
      { id: "pointed-1", text: "marker", x: 10, y: 20 },
    ]);

    autosave.schedule("pres-1", "slide-1", snapshot);
    expect(saved).toEqual([]);
    expect(autosave.hasPending()).toBe(true);

    vi.advanceTimersByTime(500);

    expect(saved).toEqual([
      { presentationId: "pres-1", slideId: "slide-1", slideNotes: snapshot },
    ]);
    expect(autosave.hasPending()).toBe(false);
  });

  it("coalesces repeated edits into a single complete snapshot", () => {
    const saved: unknown[] = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => saved.push(save),
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-1", slideNotes("a"));
    vi.advanceTimersByTime(200);
    autosave.schedule("pres-1", "slide-1", slideNotes("ab"));
    vi.advanceTimersByTime(200);
    autosave.schedule("pres-1", "slide-1", slideNotes("abc"));
    vi.advanceTimersByTime(500);

    expect(saved).toEqual([
      {
        presentationId: "pres-1",
        slideId: "slide-1",
        slideNotes: slideNotes("abc"),
      },
    ]);
  });

  it("keeps pending saves independent across slides and presentations", () => {
    const saved: unknown[] = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => saved.push(save),
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-a", "slide-a", slideNotes("a"));
    vi.advanceTimersByTime(300);
    autosave.schedule("pres-b", "slide-a", slideNotes("b"));
    autosave.schedule("pres-a", "slide-b", slideNotes("c"));
    vi.advanceTimersByTime(200);

    expect(saved).toEqual([
      { presentationId: "pres-a", slideId: "slide-a", slideNotes: slideNotes("a") },
    ]);

    vi.advanceTimersByTime(300);
    expect(saved).toEqual([
      { presentationId: "pres-a", slideId: "slide-a", slideNotes: slideNotes("a") },
      { presentationId: "pres-b", slideId: "slide-a", slideNotes: slideNotes("b") },
      { presentationId: "pres-a", slideId: "slide-b", slideNotes: slideNotes("c") },
    ]);
  });

  it("flushes all pending complete snapshots immediately", () => {
    const saved: unknown[] = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => saved.push(save),
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-1", slideNotes("pending"));
    autosave.flush();

    expect(saved).toEqual([
      {
        presentationId: "pres-1",
        slideId: "slide-1",
        slideNotes: slideNotes("pending"),
      },
    ]);
    expect(autosave.hasPending()).toBe(false);
  });

  it("does not save early or after dispose", () => {
    const saved: unknown[] = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => saved.push(save),
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-1", slideNotes("pending"));
    vi.advanceTimersByTime(200);
    expect(saved).toEqual([]);
    expect(autosave.hasPending()).toBe(true);

    autosave.dispose();
    vi.advanceTimersByTime(1000);
    expect(saved).toEqual([]);
    expect(autosave.hasPending()).toBe(false);
  });

  it("does nothing when flushed without a pending edit", () => {
    const saved: unknown[] = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => saved.push(save),
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.flush();

    expect(saved).toEqual([]);
  });
});
