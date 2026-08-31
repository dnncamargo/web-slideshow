import { describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({ onChildAdded: vi.fn(), onChildChanged: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => ({ onChildAdded: mocks.onChildAdded, onChildChanged: mocks.onChildChanged, ref: mocks.ref }));
import { GALLERY_CONTROL_ROOT_PATH, parseLiveGalleryControlState, subscribeLiveGalleryControl } from "../src/live-gallery-control";

function presentation() {
  return PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "Presentation", description: "", aspectRatio: "16:9", slides: [{ id: "page", title: "", summary: "", speakerNotes: "", elements: [{ id: "container", type: "container", children: [{ id: "a", type: "gallery", items: [{ src: "a", alt: "" }, { src: "b", alt: "" }] }, { id: "b", type: "gallery", items: [{ src: "a", alt: "" }, { src: "b", alt: "" }, { src: "c", alt: "" }] }] }] }] });
}
function record(overrides: Record<string, unknown> = {}) { return { activationRevision: 2, currentVersionId: "v", revision: 1, pageId: "page", elementId: "a", targetIndex: 1, expanded: true, ...overrides }; }

describe("live Gallery control", () => {
  it("strictly parses while preserving an arbitrary canonical element id", () => {
    expect(parseLiveGalleryControlState(record({ elementId: " gallery / #% " }))).toMatchObject({ elementId: " gallery / #% " });
    expect(parseLiveGalleryControlState({ ...record(), extra: true })).toBeNull();
  });
  it("applies a valid changed child index-first and cleans up", () => {
    let changed: ((snapshot: { key: string; val(): unknown }) => void) | undefined;
    const unsubscribeAdded = vi.fn(); const unsubscribeChanged = vi.fn();
    mocks.ref.mockReturnValue({ path: GALLERY_CONTROL_ROOT_PATH }); mocks.onChildAdded.mockReturnValue(unsubscribeAdded);
    mocks.onChildChanged.mockImplementation((_ref, callback) => { changed = callback; return unsubscribeChanged; });
    const controller = { getCurrentIndex: vi.fn(() => 0), setGalleryActiveIndex: vi.fn(), setGalleryExpanded: vi.fn() };
    const cleanup = subscribeLiveGalleryControl({} as never, 2, "v", presentation(), controller as never);
    changed?.({ key: "0", val: () => record() });
    expect(controller.setGalleryActiveIndex).toHaveBeenCalledWith("a", 1);
    expect(controller.setGalleryExpanded).toHaveBeenCalledWith("a", true);
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
    expect(controller.setGalleryActiveIndex).toHaveBeenCalledWith("a", 0);
  });
});
