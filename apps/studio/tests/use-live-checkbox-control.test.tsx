// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
  writeCheckboxControlState: vi.fn(),
}));

vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));
vi.mock("../src/features/control/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/features/control/control-command-writer", () => ({ writeCheckboxControlState: mocks.writeCheckboxControlState }));

import { useLiveCheckboxControl, type UseLiveCheckboxControlResult } from "../src/features/control/use-live-checkbox-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 2 };

function record(overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 2,
    currentVersionId: "version-1",
    revision: 1,
    pageId: "page-a",
    elementId: "topics / [a]",
    checkboxId: "item / [1]",
    state: "unchecked",
    ...overrides,
  };
}

describe("useLiveCheckboxControl", () => {
  let root: Root;
  let result: UseLiveCheckboxControlResult | null;
  let input = { live: LIVE as typeof LIVE | null, desiredPageId: "page-a" as string | null };

  function Harness() {
    result = useLiveCheckboxControl(input);
    return null;
  }

  async function render(): Promise<void> {
    await act(async () => root.render(<Harness />));
  }

  async function emit(value: unknown): Promise<void> {
    const callback = mocks.onValue.mock.calls.at(-1)?.[1] as ((snapshot: { val(): unknown }) => void) | undefined;
    if (!callback) throw new Error("missing Checkbox root listener");
    await act(async () => callback({ val: () => value }));
  }

  beforeEach(async () => {
    root = createRoot(document.body.appendChild(document.createElement("div")));
    result = null;
    input = { live: LIVE, desiredPageId: "page-a" };
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(() => vi.fn());
    mocks.writeCheckboxControlState.mockImplementation(async (_db, activationRevision, currentVersionId, pageId, slot, elementId, checkboxId, state) => record({ activationRevision, currentVersionId, pageId, revision: 2, elementId, checkboxId, state }));
    await render();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("reads the exact root and exposes only current valid records sorted by numeric slot", async () => {
    expect(mocks.ref).toHaveBeenCalledWith({}, "live/owner-a/checkboxControl");
    await emit({
      "10": record({ elementId: "ten", checkboxId: "ten-id", state: "checked" }),
      "2": record({ elementId: "two", checkboxId: "two-id", state: "intermediate" }),
      "bad": record(),
      "3": record({ pageId: "other" }),
      "4": { state: "checked" },
      "5": record({ currentVersionId: "old" }),
    });
    expect(result?.targets).toEqual([
      { slot: 2, elementId: "two", checkboxId: "two-id", state: "intermediate" },
      { slot: 10, elementId: "ten", checkboxId: "ten-id", state: "checked" },
    ]);
  });

  it("writes absolute states, including rapid three-state activations", async () => {
    const pending: Array<(value: unknown) => void> = [];
    mocks.writeCheckboxControlState.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    await act(async () => {
      result?.setCheckboxState(0, "topics / [a]", "item / [1]", "intermediate");
      result?.setCheckboxState(0, "topics / [a]", "item / [1]", "checked");
    });
    expect(mocks.writeCheckboxControlState).toHaveBeenNthCalledWith(1, {}, 2, "version-1", "page-a", 0, "topics / [a]", "item / [1]", "intermediate");
    expect(mocks.writeCheckboxControlState).toHaveBeenNthCalledWith(2, {}, 2, "version-1", "page-a", 0, "topics / [a]", "item / [1]", "checked");
    expect(result?.targets).toEqual([{ slot: 0, elementId: "topics / [a]", checkboxId: "item / [1]", state: "checked" }]);
    await act(async () => {
      pending.forEach((resolve) => resolve(record({ state: "checked" })));
      await Promise.resolve();
    });
  });

  it("reports the latest write failure and resets failure on context change", async () => {
    mocks.writeCheckboxControlState.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      result?.setCheckboxState(0, "topics / [a]", "item / [1]", "checked");
      await Promise.resolve();
    });
    expect(result?.sendFailed).toBe(true);
    input = { live: { ...LIVE, revision: 3, currentVersionId: "version-2" }, desiredPageId: "page-b" };
    await render();
    expect(result?.sendFailed).toBe(false);
    expect(result?.targets).toEqual([]);
    expect(mocks.writeCheckboxControlState).toHaveBeenCalledTimes(1);
  });
});
