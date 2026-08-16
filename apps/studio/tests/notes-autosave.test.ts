import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNotesAutosave } from "../src/features/editor/notes/notes-autosave";

const setTimeoutFn = (handler: () => void, delayMs: number) =>
  setTimeout(handler, delayMs) as unknown as number;
const clearTimeoutFn = (handle: number) => clearTimeout(handle);

describe("notes autosave lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const presentationId = "pres-1";

  it("persists a scheduled edit after the debounce delay", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule(presentationId, "slide-1", "hello");

    expect(saved).toEqual([]);
    expect(autosave.hasPending()).toBe(true);

    vi.advanceTimersByTime(500);

    expect(saved).toEqual([
      {
        presentationId,
        slideId: "slide-1",
        note: "hello",
      },
    ]);
    expect(autosave.hasPending()).toBe(false);
  });

  it("coalesces repeated edits into a single save", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule(presentationId, "slide-1", "a");
    vi.advanceTimersByTime(200);
    autosave.schedule(presentationId, "slide-1", "ab");
    vi.advanceTimersByTime(200);
    autosave.schedule(presentationId, "slide-1", "abc");
    vi.advanceTimersByTime(500);

    expect(saved).toEqual([
      {
        presentationId,
        slideId: "slide-1",
        note: "abc",
      },
    ]);
  });

  it("keeps pending saves independent across different slides", () => {
    const saved: Array<{
      presentationId: string;
      slideId: string;
      note: string;
    }> = [];

    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule(presentationId, "slide-a", "note for a");

    vi.advanceTimersByTime(300);

    autosave.schedule(presentationId, "slide-b", "note for b");

    // A reaches its own 500 ms deadline.
    vi.advanceTimersByTime(200);

    expect(saved).toEqual([
      {
        presentationId: "pres-1",
        slideId: "slide-a",
        note: "note for a",
      },
    ]);

    // B reaches its independent deadline.
    vi.advanceTimersByTime(300);

    expect(saved).toEqual([
      {
        presentationId: "pres-1",
        slideId: "slide-a",
        note: "note for a",
      },
      {
        presentationId: "pres-1",
        slideId: "slide-b",
        note: "note for b",
      },
    ]);
  });

  it("keeps the presentation identity captured at schedule time", () => {
    const saved: Array<{
      presentationId: string;
      slideId: string;
      note: string;
    }> = [];

    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-a", "slide-1", "note from A");

    autosave.schedule("pres-b", "slide-1", "note from B");

    vi.advanceTimersByTime(500);

    expect(saved).toEqual([
      {
        presentationId: "pres-a",
        slideId: "slide-1",
        note: "note from A",
      },
      {
        presentationId: "pres-b",
        slideId: "slide-1",
        note: "note from B",
      },
    ]);
  });

  it("never writes slide A's pending note into slide B", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-a", "note for a");
    vi.advanceTimersByTime(300);

    autosave.schedule("pres-1", "slide-b", "note for b");
    vi.advanceTimersByTime(500);

    expect(saved).toEqual([
      {
        presentationId,
        slideId: "slide-a",
        note: "note for a",
      },
      {
        presentationId,
        slideId: "slide-b",
        note: "note for b",
      },
    ]);
  });

  it("flush persists the pending edit immediately", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-1", "pending");
    autosave.flush();

    expect(saved).toEqual([
      {
        presentationId,
        slideId: "slide-1",
        note: "pending",
      },
    ]);
    expect(autosave.hasPending()).toBe(false);
  });

  it("pending edit survives until flushed without saving early", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-1", "still editing");
    vi.advanceTimersByTime(200);

    expect(saved).toEqual([]);
    expect(autosave.hasPending()).toBe(true);
  });

  it("dispose clears the pending timer without firing a save", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.schedule("pres-1", "slide-1", "discarded");
    autosave.dispose();
    vi.advanceTimersByTime(1000);

    expect(saved).toEqual([]);
    expect(autosave.hasPending()).toBe(false);
  });

  it("schedule with no prior edit and flush does nothing", () => {
    const saved: Array<{ slideId: string; note: string }> = [];
    const autosave = createNotesAutosave({
      delayMs: 500,
      onSave: (save) => {
        saved.push(save);
      },
      setTimeoutFn,
      clearTimeoutFn,
    });

    autosave.flush();

    expect(saved).toEqual([]);
  });
});
