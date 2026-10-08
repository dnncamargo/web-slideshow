// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onChildAdded: vi.fn(),
  onChildChanged: vi.fn(),
  ref: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onChildAdded: mocks.onChildAdded,
  onChildChanged: mocks.onChildChanged,
  ref: mocks.ref,
}));

import {
  CHECKBOX_CONTROL_ROOT_PATH,
  parseLiveCheckboxControlState,
  subscribeLiveCheckboxControl,
} from "../src/live-checkbox-control";

function record(overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 2,
    currentVersionId: "version-1",
    revision: 1,
    pageId: "off-screen-page",
    elementId: "topics / [1]",
    checkboxId: "item / [1]",
    state: "checked",
    ...overrides,
  };
}

describe("live Checkbox Control subscription", () => {
  it("strictly parses the seven-field absolute record and preserves ids", () => {
    expect(parseLiveCheckboxControlState(record())).toEqual(record());
    expect(parseLiveCheckboxControlState({ ...record(), extra: true })).toBeNull();
    expect(parseLiveCheckboxControlState({ ...record(), state: "toggle" })).toBeNull();
    expect(parseLiveCheckboxControlState({ ...record(), elementId: "" })).toBeNull();
  });

  it("subscribes to the exact root, forwards off-screen records, filters stale slots, and cleans both listeners", () => {
    let added: ((snapshot: { key: string | null; val(): unknown }) => void) | undefined;
    let changed: ((snapshot: { key: string | null; val(): unknown }) => void) | undefined;
    const unsubscribeAdded = vi.fn();
    const unsubscribeChanged = vi.fn();
    mocks.ref.mockReturnValue({ path: CHECKBOX_CONTROL_ROOT_PATH });
    mocks.onChildAdded.mockImplementation((_root, callback) => { added = callback; return unsubscribeAdded; });
    mocks.onChildChanged.mockImplementation((_root, callback) => { changed = callback; return unsubscribeChanged; });
    const controller = { setCheckboxControlState: vi.fn() };

    const cleanup = subscribeLiveCheckboxControl({} as never, "owner-a", 2, "version-1", controller as never);
    expect(mocks.ref).toHaveBeenCalledWith({}, "live/owner-a/checkboxControl");

    added?.({ key: "4", val: () => record() });
    changed?.({ key: "4", val: () => record({ state: "intermediate", revision: 2 }) });
    added?.({ key: "nope", val: () => record() });
    added?.({ key: "5", val: () => record({ activationRevision: 1 }) });
    added?.({ key: "6", val: () => record({ currentVersionId: "old" }) });

    expect(controller.setCheckboxControlState).toHaveBeenNthCalledWith(1, 4, "off-screen-page", "topics / [1]", "item / [1]", "checked");
    expect(controller.setCheckboxControlState).toHaveBeenNthCalledWith(2, 4, "off-screen-page", "topics / [1]", "item / [1]", "intermediate");
    expect(controller.setCheckboxControlState).toHaveBeenCalledTimes(2);

    cleanup();
    expect(unsubscribeAdded).toHaveBeenCalledTimes(1);
    expect(unsubscribeChanged).toHaveBeenCalledTimes(1);
  });
});
