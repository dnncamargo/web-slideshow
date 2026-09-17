import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import {
  addClipboardEntry,
  canPinClipboardEntry,
  clearDisposableClipboardEntries,
  createClipboardEntry,
  MAX_DISPOSABLE_CLIPBOARD_ENTRIES,
  MAX_PINNED_CLIPBOARD_ENTRIES,
  pinClipboardEntry,
  removeClipboardEntry,
  unpinClipboardEntry,
  type ClipboardEntry,
  type ClipboardSessionState,
} from "../src/features/editor/clipboard-session";

const element = (id: string): PowerShowElement =>
  ({ id, type: "divider" } as PowerShowElement);

const entry = (id: string, pinned = false): ClipboardEntry => ({
  id,
  element: element(id),
  sourceParentKind: "slide",
  pinned,
});

const stateWith = (...entries: ClipboardEntry[]): ClipboardSessionState => ({
  entries,
  selectedEntryId: null,
});

describe("Clipboard session state", () => {
  it("creates an independent complete snapshot with its source parent kind", () => {
    const source = {
      id: "container",
      type: "container",
      children: [element("child")],
    } as unknown as Extract<PowerShowElement, { type: "container" }>;

    const snapshot = createClipboardEntry(source, "container");
    expect(snapshot.id).not.toBe(source.id);
    expect(snapshot.sourceParentKind).toBe("container");
    expect(snapshot.element).toEqual(source);
    expect(snapshot.element).not.toBe(source);
    if (snapshot.element.type !== "container") throw new Error("expected a Container snapshot");
    expect(snapshot.element.children).not.toBe(source.children);
  });

  it("keeps at most 15 newest disposable entries", () => {
    let state = stateWith();
    for (let index = 0; index < 16; index += 1) {
      state = addClipboardEntry(state, entry("entry-" + index));
    }

    expect(state.entries).toHaveLength(MAX_DISPOSABLE_CLIPBOARD_ENTRIES);
    expect(state.entries[0]?.id).toBe("entry-15");
    expect(state.entries.at(-1)?.id).toBe("entry-1");
  });

  it("keeps pinned entries protected and rejects a sixth pin", () => {
    const pinned = Array.from({ length: MAX_PINNED_CLIPBOARD_ENTRIES }, (_, index) =>
      entry("pinned-" + index, true),
    );
    const state = stateWith(...pinned, entry("disposable"));

    expect(canPinClipboardEntry(state.entries, "disposable")).toBe(false);
    expect(pinClipboardEntry(state, "disposable")).toBe(state);
    expect(state.entries.filter((candidate) => candidate.pinned)).toHaveLength(5);
  });

  it("puts newly pinned entries first and unpinning first among disposables", () => {
    const state = stateWith(entry("pinned", true), entry("older"));
    const pinned = pinClipboardEntry(state, "older");
    expect(pinned.entries.map((candidate) => candidate.id)).toEqual(["older", "pinned"]);

    const unpinned = unpinClipboardEntry(pinned, "older");
    expect(unpinned.entries.map((candidate) => candidate.id)).toEqual(["pinned", "older"]);
  });

  it("clears disposables and only clears selection when its entry is removed", () => {
    const state = {
      entries: [entry("pinned", true), entry("disposable")],
      selectedEntryId: "pinned",
    };
    expect(clearDisposableClipboardEntries(state)).toEqual({
      entries: [entry("pinned", true)],
      selectedEntryId: "pinned",
    });
    expect(
      clearDisposableClipboardEntries({ ...state, selectedEntryId: "disposable" }),
    ).toEqual({ entries: [entry("pinned", true)], selectedEntryId: null });
  });

  it("clears selection when an entry is manually removed", () => {
    const state = { entries: [entry("selected")], selectedEntryId: "selected" };
    expect(removeClipboardEntry(state, "selected")).toEqual({
      entries: [],
      selectedEntryId: null,
    });
  });
});
