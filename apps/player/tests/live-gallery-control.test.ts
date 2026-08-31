import { describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({ onChildAdded: vi.fn(), onChildChanged: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => ({ onChildAdded: mocks.onChildAdded, onChildChanged: mocks.onChildChanged, ref: mocks.ref }));
import { GALLERY_CONTROL_ROOT_PATH, parseLiveGalleryControlState, subscribeLiveGalleryControl } from "../src/live-gallery-control";

function presentation() {
  return PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "Presentation", description: "", aspectRatio: "16:9", slides: [{ id: "page", title: "", summary: "", speakerNotes: "", elements: [{ id: "container", type: "container", children: [{ id: " gallery / #% ", type: "gallery", items: [{ src: "a", alt: "" }, { src: "b", alt: "" }] }, { id: "b", type: "gallery", items: [{ src: "a", alt: "" }, { src: "b", alt: "" }, { src: "c", alt: "" }] }] }] }] });
}
function record(overrides: Record<string, unknown> = {}) { return { activationRevision: 2, currentVersionId: "v", revision: 1, pageId: "page", elementId: " gallery / #% ", targetIndex: 1, expanded: true, ...overrides }; }

describe("live Gallery control", () => {
  it("strictly parses while preserving an arbitrary canonical element id", () => {
    expect(parseLiveGalleryControlState(record({ elementId: " gallery / #% " }))).toMatchObject({ elementId: " gallery / #% " });
    expect(parseLiveGalleryControlState({ ...record(), extra: true })).toBeNull();
    expect(parseLiveGalleryControlState(record({ elementId: " " }))).toMatchObject({ elementId: " " });
  });
  it("applies a valid changed child index-first and cleans up", () => {
    let changed: ((snapshot: { key: string; val(): unknown }) => void) | undefined;
    const unsubscribeAdded = vi.fn(); const unsubscribeChanged = vi.fn();
    mocks.ref.mockReturnValue({ path: GALLERY_CONTROL_ROOT_PATH }); mocks.onChildAdded.mockReturnValue(unsubscribeAdded);
    mocks.onChildChanged.mockImplementation((_ref, callback) => { changed = callback; return unsubscribeChanged; });
    const controller = { getCurrentIndex: vi.fn(() => 0), setGalleryActiveIndex: vi.fn(), setGalleryExpanded: vi.fn() };
    const cleanup = subscribeLiveGalleryControl({} as never, 2, "v", presentation(), controller as never);
    changed?.({ key: "0", val: () => record() });
    expect(controller.setGalleryActiveIndex).toHaveBeenCalledWith(" gallery / #% ", 1);
    expect(controller.setGalleryExpanded).toHaveBeenCalledWith(" gallery / #% ", true);
    expect(controller.setGalleryActiveIndex.mock.invocationCallOrder[0]).toBeLessThan(controller.setGalleryExpanded.mock.invocationCallOrder[0] ?? Infinity);
    controller.setGalleryActiveIndex.mockClear(); changed?.({ key: "1", val: () => record({ targetIndex: 9 }) });
    expect(controller.setGalleryActiveIndex).not.toHaveBeenCalled();
    cleanup(); expect(unsubscribeAdded).toHaveBeenCalledOnce(); expect(unsubscribeChanged).toHaveBeenCalledOnce();
  });
  it("does not reapply Gallery B when only Gallery A changes", () => {
    let changed: ((snapshot: { key: string; val(): unknown }) => void) | undefined;
    mocks.ref.mockReturnValue({ path: GALLERY_CONTROL_ROOT_PATH }); mocks.onChildAdded.mockReturnValue(vi.fn()); mocks.onChildChanged.mockImplementation((_ref, callback) => { changed = callback; return vi.fn(); });
    const controller = { getCurrentIndex: vi.fn(() => 0), setGalleryActiveIndex: vi.fn(), setGalleryExpanded: vi.fn() };
    subscribeLiveGalleryControl({} as never, 2, "v", presentation(), controller as never);
    changed?.({ key: "0", val: () => record({ targetIndex: 0 }) });
    expect(controller.setGalleryActiveIndex).toHaveBeenCalledTimes(1);
    expect(controller.setGalleryActiveIndex).toHaveBeenCalledWith(" gallery / #% ", 0);
  });

  it("applies a current-page persisted child-added baseline", () => {
    let added: ((snapshot: { key: string; val(): unknown }) => void) | undefined;
    mocks.ref.mockReturnValue({ path: GALLERY_CONTROL_ROOT_PATH }); mocks.onChildAdded.mockImplementation((_ref, callback) => { added = callback; return vi.fn(); }); mocks.onChildChanged.mockReturnValue(vi.fn());
    const controller = { getCurrentIndex: vi.fn(() => 0), setGalleryActiveIndex: vi.fn(), setGalleryExpanded: vi.fn() };
    subscribeLiveGalleryControl({} as never, 2, "v", presentation(), controller as never);
    added?.({ key: "0", val: () => record() });
    expect(controller.setGalleryActiveIndex).toHaveBeenCalledWith(" gallery / #% ", 1);
    expect(controller.setGalleryExpanded).toHaveBeenCalledWith(" gallery / #% ", true);
    expect(controller.setGalleryActiveIndex.mock.invocationCallOrder[0]).toBeLessThan(controller.setGalleryExpanded.mock.invocationCallOrder[0] ?? Infinity);
  });
  it.each([record({ activationRevision: 3 }), record({ currentVersionId: "old" }), record({ pageId: "other" }), record({ elementId: "missing" }), record({ elementId: " gallery / #% ", targetIndex: 2 }), { ...record(), expanded: "yes" }])("ignores guarded or malformed records", (value) => {
    let changed: ((snapshot: { key: string; val(): unknown }) => void) | undefined; mocks.onChildAdded.mockReturnValue(vi.fn()); mocks.onChildChanged.mockImplementation((_r, callback) => { changed = callback; return vi.fn(); }); mocks.ref.mockReturnValue({}); const controller = { getCurrentIndex: vi.fn(() => 0), setGalleryActiveIndex: vi.fn(), setGalleryExpanded: vi.fn() }; subscribeLiveGalleryControl({} as never, 2, "v", presentation(), controller as never); changed?.({ key: "0", val: () => value }); expect(controller.setGalleryActiveIndex).not.toHaveBeenCalled(); expect(controller.setGalleryExpanded).not.toHaveBeenCalled();
  });
  it("rejects an ordinal mismatch and preserves another Gallery's local divergence", () => {
    let added: ((snapshot: { key: string; val(): unknown }) => void) | undefined; let changed: ((snapshot: { key: string; val(): unknown }) => void) | undefined; mocks.ref.mockReturnValue({}); mocks.onChildAdded.mockImplementation((_r, callback) => { added = callback; return vi.fn(); }); mocks.onChildChanged.mockImplementation((_r, callback) => { changed = callback; return vi.fn(); }); const controller = { getCurrentIndex: vi.fn(() => 0), setGalleryActiveIndex: vi.fn(), setGalleryExpanded: vi.fn() }; subscribeLiveGalleryControl({} as never, 2, "v", presentation(), controller as never); changed?.({ key: "1", val: () => record() }); expect(controller.setGalleryActiveIndex).not.toHaveBeenCalled(); added?.({ key: "0", val: () => record({ targetIndex: 0 }) }); added?.({ key: "1", val: () => record({ elementId: "b", targetIndex: 2 }) }); expect(controller.setGalleryActiveIndex).toHaveBeenCalledTimes(2); controller.setGalleryActiveIndex.mockClear(); controller.setGalleryExpanded.mockClear(); changed?.({ key: "0", val: () => record({ targetIndex: 1 }) }); expect(controller.setGalleryActiveIndex).toHaveBeenCalledExactlyOnceWith(" gallery / #% ", 1); expect(controller.setGalleryExpanded).toHaveBeenCalledExactlyOnceWith(" gallery / #% ", true);
  });
});
