// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
  writeGalleryControlState: vi.fn(),
}));

vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));
vi.mock("../src/features/control/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/features/control/control-command-writer", () => ({ writeGalleryControlState: mocks.writeGalleryControlState }));

import {
  useLiveGalleryControl,
  type UseLiveGalleryControlResult,
} from "../src/features/control/use-live-gallery-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 2 };

function presentation(elements: unknown[] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1, id: "presentation", title: "Presentation",
    slides: [{ id: "page-a", title: "Page A", elements }, { id: "page-b", title: "Page B", elements: [] }],
  });
}

function gallery(id: string, count = 3) {
  return { id, type: "gallery", items: Array.from({ length: count }, (_, index) => ({ src: `/${id}-${index}.png` })) };
}

function record(overrides: Record<string, unknown> = {}) {
  return { activationRevision: 2, currentVersionId: "version-1", revision: 1, pageId: "page-a", elementId: "gallery-a", targetIndex: 0, expanded: false, ...overrides };
}

function snapshot(value: unknown) { return { val: () => value }; }

describe("useLiveGalleryControl", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: UseLiveGalleryControlResult | null;
  let input: { live: typeof LIVE | null; livePresentation: Presentation | null; desiredPageId: string | null };

  const render = async () => {
    function Harness() { result = useLiveGalleryControl(input); return null; }
    await act(async () => { root.render(<Harness />); });
  };
  const emit = async (value: unknown) => {
    const callback = mocks.onValue.mock.calls.at(-1)?.[1] as ((value: { val(): unknown }) => void) | undefined;
    if (!callback) throw new Error("missing Gallery root listener");
    await act(async () => { callback(snapshot(value)); });
  };

  beforeEach(async () => {
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); result = null;
    input = { live: LIVE, livePresentation: presentation([gallery("gallery-a")]), desiredPageId: "page-a" };
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(() => vi.fn());
    mocks.writeGalleryControlState.mockImplementation(async (_db, activationRevision, currentVersionId, pageId, _slot, elementId, targetIndex, expanded) => record({ activationRevision, currentVersionId, pageId, elementId, targetIndex, expanded }));
    await render();
  });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; vi.clearAllMocks(); });

  it("has no model without a complete active context and discovers nested Galleries in canonical order", async () => {
    input = { live: null, livePresentation: null, desiredPageId: null }; await render(); expect(result?.galleries).toEqual([]);
    input = { live: LIVE, livePresentation: presentation([{ id: "container", type: "container", children: [gallery("gallery-a"), { id: "nested", type: "container", children: [gallery(" gallery / #% ", 2)] }] }]), desiredPageId: "page-a" };
    await render();
    expect(result?.galleries).toMatchObject([{ slot: 0, elementId: "gallery-a", itemCount: 3, targetIndex: 0, expanded: false }, { slot: 1, elementId: " gallery / #% ", itemCount: 2, targetIndex: 0, expanded: false }]);
    expect(mocks.writeGalleryControlState).not.toHaveBeenCalled();
  });

  it("hydrates only matching strict current-page Gallery records, including exact element ids", async () => {
    input.livePresentation = presentation([gallery("gallery-a"), gallery(" gallery / #% ", 2)]); await render();
    await emit({ 0: record({ targetIndex: 2, expanded: true }), 1: record({ elementId: " gallery / #% ", targetIndex: 1, expanded: true }) });
    expect(result?.galleries).toMatchObject([{ slot: 0, targetIndex: 2, expanded: true }, { slot: 1, elementId: " gallery / #% ", targetIndex: 1, expanded: true }]);
  });

  it("ignores stale, wrong-version, wrong-page, slot/element mismatch, and invalid-index records", async () => {
    for (const value of [record({ activationRevision: 1 }), record({ currentVersionId: "old" }), record({ pageId: "page-b" }), record({ elementId: "other" }), record({ targetIndex: 3 })]) {
      await emit({ 0: value });
      expect(result?.galleries[0]).toMatchObject({ targetIndex: 0, expanded: false });
    }
    await emit({ 1: record({ targetIndex: 1 }) });
    expect(result?.galleries[0]).toMatchObject({ targetIndex: 0, expanded: false });
  });

  it("writes absolute next intent, wraps, and preserves expanded state", async () => {
    await emit({ 0: record({ targetIndex: 0, expanded: true }) });
    await act(async () => { result?.nextGallery("gallery-a"); await Promise.resolve(); });
    expect(mocks.writeGalleryControlState).toHaveBeenLastCalledWith({}, 2, "version-1", "page-a", 0, "gallery-a", 1, true);
    await emit({ 0: record({ targetIndex: 2, expanded: true, revision: 2 }) });
    await act(async () => { result?.nextGallery("gallery-a"); await Promise.resolve(); });
    expect(mocks.writeGalleryControlState).toHaveBeenLastCalledWith({}, 2, "version-1", "page-a", 0, "gallery-a", 0, true);
  });

  it("does not write next for empty or single-item Galleries and expands absolutely without redundant writes", async () => {
    input.livePresentation = presentation([gallery("empty", 0), gallery("single", 1), gallery("gallery-a")]); await render();
    await act(async () => { result?.nextGallery("empty"); result?.nextGallery("single"); });
    expect(mocks.writeGalleryControlState).not.toHaveBeenCalled();
    await emit({ 2: record({ elementId: "gallery-a", targetIndex: 2 }) });
    await act(async () => { result?.setGalleryExpanded("gallery-a", true); await Promise.resolve(); });
    expect(mocks.writeGalleryControlState).toHaveBeenLastCalledWith({}, 2, "version-1", "page-a", 2, "gallery-a", 2, true);
    await act(async () => { result?.setGalleryExpanded("gallery-a", true); });
    expect(mocks.writeGalleryControlState).toHaveBeenCalledTimes(1);
  });

  it("isolates pending writes per Gallery and immediately uses committed success", async () => {
    let resolveFirst: ((value: ReturnType<typeof record>) => void) | undefined;
    mocks.writeGalleryControlState.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    input.livePresentation = presentation([gallery("gallery-a"), gallery("gallery-b")]); await render();
    await act(async () => { result?.nextGallery("gallery-a"); });
    expect(result?.galleries[0]?.pending).toBe(true);
    await act(async () => { result?.nextGallery("gallery-a"); result?.nextGallery("gallery-b"); await Promise.resolve(); });
    expect(mocks.writeGalleryControlState).toHaveBeenCalledTimes(2);
    await act(async () => { resolveFirst?.(record({ targetIndex: 1 })); await Promise.resolve(); });
    expect(result?.galleries[0]).toMatchObject({ targetIndex: 1, pending: false });
  });

  it("keeps previous desired state on failure, reports it, and clears the error before the next command", async () => {
    mocks.writeGalleryControlState.mockRejectedValueOnce(new Error("offline"));
    await act(async () => { result?.nextGallery("gallery-a"); await Promise.resolve(); await Promise.resolve(); });
    expect(result?.galleries[0]).toMatchObject({ targetIndex: 0, pending: false }); expect(result?.sendFailed).toBe(true);
    let resolveNext: ((value: ReturnType<typeof record>) => void) | undefined;
    mocks.writeGalleryControlState.mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    await act(async () => { result?.nextGallery("gallery-a"); });
    expect(result?.sendFailed).toBe(false);
    await act(async () => { resolveNext?.(record({ targetIndex: 1 })); await Promise.resolve(); });
  });

  it("drops old desired state on live identity changes and accepts later root snapshot updates", async () => {
    await emit({ 0: record({ targetIndex: 2, expanded: true }) });
    input.live = { ...LIVE, currentVersionId: "version-2", revision: 3 }; await render();
    expect(result?.galleries[0]).toMatchObject({ targetIndex: 0, expanded: false });
    await emit({ 0: record({ activationRevision: 3, currentVersionId: "version-2", targetIndex: 1, expanded: true }) });
    expect(result?.galleries[0]).toMatchObject({ targetIndex: 1, expanded: true });
  });
});
