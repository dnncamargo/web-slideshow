import type { Presentation } from "@web-slideshow/document-schema";
import { describe, expect, it } from "vitest";

import {
  EDITOR_HISTORY_LIMIT,
  applyUntrackedHistoryUpdate,
  beginHistoryTransaction,
  cancelHistoryTransaction,
  commitHistory,
  commitHistoryTransaction,
  createHistoryState,
  redoHistory,
  redoSteps,
  resetHistory,
  updateHistoryTransaction,
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

  it("groups live transaction updates into one immutable action", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    let state = beginHistoryTransaction(createHistoryState(a), "title", action("rename"));
    state = updateHistoryTransaction(state, "title", b);
    state = updateHistoryTransaction(state, "title", c);

    expect(state.present).toBe(c);
    expect(state.past).toEqual([]);
    const committed = commitHistoryTransaction(state, "title");
    expect(committed.past).toHaveLength(1);
    expect(committed.past[0]).toMatchObject({ before: a, after: c, action: action("rename") });
    expect(committed.transaction).toBeUndefined();
  });

  it("cancels without changing past or future", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    const afterUndo = undoHistory(commitHistory(commitHistory(createHistoryState(a), b, action("b")), c, action("c")));
    const live = updateHistoryTransaction(beginHistoryTransaction(afterUndo, "field", action("edit")), "field", presentation("D"));
    const cancelled = cancelHistoryTransaction(live, "field");
    expect(cancelled.present).toBe(b);
    expect(cancelled.past).toEqual(afterUndo.past);
    expect(cancelled.future).toEqual(afterUndo.future);
  });

  it("preserves future for a transaction no-op and clears it on commit", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    const afterUndo = undoHistory(commitHistory(commitHistory(createHistoryState(a), b, action("b")), c, action("c")));
    const active = beginHistoryTransaction(afterUndo, "field", action("edit"));
    const mismatched = commitHistoryTransaction(active, "other-field");
    expect(mismatched).toBe(active);
    expect(mismatched.transaction?.key).toBe("field");
    const noOp = commitHistoryTransaction(mismatched, "field");
    expect(noOp.future[0]?.after).toBe(c);

    const committed = commitHistoryTransaction(
      updateHistoryTransaction(beginHistoryTransaction(afterUndo, "field", action("edit")), "field", presentation("D")),
      "field",
    );
    expect(committed.past.at(-1)?.before).toBe(b);
    expect(committed.past.at(-1)?.after.id).toBe("D");
    expect(committed.future).toEqual([]);
  });

  it("finalizes an active transaction before undo", () => {
    const a = presentation("A");
    const b = presentation("B");
    const state = updateHistoryTransaction(
      beginHistoryTransaction(createHistoryState(a), "field", action("edit")),
      "field",
      b,
    );
    const undone = undoHistory(state);
    expect(undone.present).toBe(a);
    expect(undone.past).toEqual([]);
    expect(undone.future[0]?.after).toBe(b);
  });

  it("finalizes a changed transaction before beginning a different key", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    let state = updateHistoryTransaction(
      beginHistoryTransaction(createHistoryState(a), "first", action("first")),
      "first",
      b,
    );
    state = beginHistoryTransaction(state, "second", action("second"));

    expect(state.past[0]).toMatchObject({ before: a, after: b });
    expect(state.transaction?.key).toBe("second");
    expect(state.transaction?.baseline).toBe(b);
    expect(updateHistoryTransaction(state, "first", c)).toBe(state);
  });

  it("does not reset the baseline when beginning the same key again", () => {
    const a = presentation("A");
    const b = presentation("B");
    const state = updateHistoryTransaction(
      beginHistoryTransaction(createHistoryState(a), "field", action("edit")),
      "field",
      b,
    );
    const repeated = beginHistoryTransaction(state, "field", action("replacement"));

    expect(repeated).toBe(state);
    expect(repeated.transaction?.baseline).toBe(a);
    expect(repeated.transaction?.action).toEqual(action("edit"));
  });

  it("keeps a same-root untracked no-op transaction intact", () => {
    const a = presentation("A");
    const state = beginHistoryTransaction(createHistoryState(a), "field", action("edit"));
    expect(state.present).toBe(a);
    expect(state.transaction?.key).toBe("field");
    expect(applyUntrackedHistoryUpdate(state, a)).toBe(state);
  });

  it("resets all history and clears a transaction for a real untracked mutation", () => {
    const a = presentation("A");
    const b = presentation("B");
    const state = updateHistoryTransaction(
      beginHistoryTransaction(createHistoryState(a), "field", action("edit")),
      "field",
      b,
    );
    const next = presentation("untracked");
    const reset = applyUntrackedHistoryUpdate(state, next);

    expect(reset).toEqual({ past: [], present: next, future: [] });
    expect(reset.transaction).toBeUndefined();
  });

  it("keeps a finalized continuous action separate from a discrete action", () => {
    const a = presentation("A");
    const b = presentation("B");
    const c = presentation("C");
    const editing = updateHistoryTransaction(
      beginHistoryTransaction(createHistoryState(a), "title", action("rename")),
      "title",
      b,
    );
    const finalized = commitHistoryTransaction(editing);
    const discrete = commitHistory(finalized, c, action("slide.add"));

    expect(discrete.past.map((entry) => entry.action.kind)).toEqual(["rename", "slide.add"]);
    expect(discrete.past[1]?.before).toBe(b);
  });
});
