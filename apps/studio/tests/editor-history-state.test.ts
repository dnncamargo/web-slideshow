import type { Presentation } from "@powershow/document-schema";
import { describe, expect, it } from "vitest";

import {
  EDITOR_HISTORY_LIMIT,
  commitHistory,
  createHistoryState,
  redoHistory,
  redoSteps,
  resetHistory,
  undoHistory,
  undoSteps,
} from "../src/features/editor/editor-history-state";

const action = (kind: string) => ({
  kind,
  labelKey: `history.${kind}`,
});

const presentation = (id: string): Presentation => ({
  schemaVersion: 1,
  id,
  title: id,
  description: "",
  aspectRatio: "16:9",
  slides: [],
});

describe("editor history state", () => {
  it("starts with only the initial present", () => {
    const present = presentation("A");
    const state = createHistoryState(present);

    expect(state).toEqual({ past: [], present, future: [] });
  });

  it("commits immutable references and semantic metadata", () => {
    const a = presentation("A");
    const b = presentation("B");
    const metadata = { kind: "slide.rename", labelKey: "history.rename", labelParams: { count: 1 } } as const;
    const state = commitHistory(createHistoryState(a), b, metadata);

    expect(state.present).toBe(b);
    expect(state.past).toHaveLength(1);
    expect(state.past[0]).toEqual({ before: a, after: b, action: metadata });
    expect(state.past[0]?.before).toBe(a);
    expect(state.past[0]?.after).toBe(b);
    expect(state.future).toEqual([]);
  });

  it("preserves chronological ordering through undo and redo", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    const x = action("x");
    const y = action("y");
    const committed = commitHistory(commitHistory(createHistoryState(a), b, x), c, y);

    expect(committed.past.map((entry) => entry.action.kind)).toEqual(["x", "y"]);
    const undone = undoHistory(committed);
    expect(undone.present).toBe(b);
    expect(undone.future[0]?.after).toBe(c);
    expect(undone.future[0]?.action).toBe(y);
    const redone = redoHistory(undone);
    expect(redone.present).toBe(c);
    expect(redone.past.map((entry) => entry.action.kind)).toEqual(["x", "y"]);
    expect(redone.past[1]?.action).toBe(y);
  });

  it("clears future after a real edit, but not after a no-op", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    const d = presentation("D");
    const afterUndo = undoHistory(commitHistory(commitHistory(createHistoryState(a), b, action("b")), c, action("c")));
    const noOp = commitHistory(afterUndo, b, action("ignored"));

    expect(noOp).toBe(afterUndo);
    expect(noOp.future[0]?.after).toBe(c);
    const edited = commitHistory(afterUndo, d, action("d"));
    expect(edited.present).toBe(d);
    expect(edited.future).toEqual([]);
    expect(redoHistory(edited)).toBe(edited);
  });

  it("bounds past to 30 actions and retains the correct oldest reachable state", () => {
    const initial = presentation("0");
    let state = createHistoryState(initial);
    const snapshots = [initial];
    for (let index = 1; index <= EDITOR_HISTORY_LIMIT + 5; index += 1) {
      const next = presentation(String(index));
      snapshots.push(next);
      state = commitHistory(state, next, action(String(index)));
    }

    expect(state.past).toHaveLength(EDITOR_HISTORY_LIMIT);
    expect(state.past[0]?.before).toBe(snapshots[5]);
    expect(state.present).toBe(snapshots[35]);
    const oldest = undoSteps(state, EDITOR_HISTORY_LIMIT);
    expect(oldest.present).toBe(snapshots[5]);
    expect(oldest.past).toEqual([]);
  });

  it("supports atomic multi-step replay, clamping, and non-positive no-ops", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    const d = presentation("D");
    let state = createHistoryState(a);
    state = commitHistory(state, b, action("b"));
    state = commitHistory(state, c, action("c"));
    state = commitHistory(state, d, action("d"));

    const undone = undoSteps(state, 2);
    expect(undone.present).toBe(b);
    expect(undone.past.map((entry) => entry.action.kind)).toEqual(["b"]);
    expect(undone.future.map((entry) => entry.action.kind)).toEqual(["c", "d"]);
    expect(redoSteps(undone, 2).present).toBe(d);
    expect(undoSteps(state, 0)).toBe(state);
    expect(redoSteps(undone, -1)).toBe(undone);
    expect(redoSteps(undone, 99).future).toEqual([]);
  });

  it("resets to a new session", () => {
    const state = commitHistory(createHistoryState(presentation("A")), presentation("B"), action("b"));
    const next = presentation("new-session");
    const reset = resetHistory(next);

    expect(reset).toEqual({ past: [], present: next, future: [] });
    expect(reset.past).not.toBe(state.past);
    expect(reset.present).toBe(next);
  });
});
