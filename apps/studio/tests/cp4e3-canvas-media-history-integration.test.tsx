// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type GalleryElement, type ImageElement, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const IMAGE_SOURCE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

function imageElement(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: "image-1",
    type: "image",
    hidden: false,
    src: IMAGE_SOURCE,
    alt: "Image",
    fit: "contain",
    layout: { width: 400, height: 300 },
    ...overrides,
  };
}

function galleryElement(overrides: Partial<GalleryElement> = {}): GalleryElement {
  return {
    id: "gallery-1",
    type: "gallery",
    hidden: false,
    fit: "contain",
    style: { border: { width: 8, color: "#ff0000" }, borderRadius: 24 },
    layout: { width: 400, height: 300 },
    items: [
      { src: "/one.png", alt: "One", fit: "cover", focalPoint: { x: 10, y: 20 }, crop: { x: 1, y: 2, width: 90, height: 80 } },
      { src: "/two.png", alt: "Two", fit: "fill", focalPoint: { x: 30, y: 40 }, crop: { x: 20, y: 20, width: 50, height: 50 } },
    ],
    ...overrides,
  };
}

function presentation(
  imageOverrides: Partial<ImageElement> = {},
  galleryOverrides: Partial<GalleryElement> = {},
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4e3-canvas-media-history",
    title: "CP4E3 canvas media history",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [imageElement(imageOverrides), galleryElement(galleryOverrides)],
    }],
  });
}

function pointer(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: pointerId },
  });
  return event;
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4E3 canvas Crop/Focal history", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset.powershowId === "image-1" || this.dataset.powershowId === "gallery-1" || this.dataset.powershowGalleryIndex !== undefined) {
        return { left: 100, top: 80, right: 500, bottom: 380, width: 400, height: 300, x: 100, y: 80, toJSON: () => ({}) };
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  async function mount(
    initial = presentation(),
    onSave?: (snapshot: Presentation) => Promise<void>,
  ): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} onSave={onSave} />
      </StudioI18nProvider>,
    ));
  }

  async function selectElement(id: string): Promise<void> {
    const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(pointer("pointerdown", 150, 120)));
  }

  async function selectGalleryItem(index: number): Promise<void> {
    const button = container.querySelector<HTMLButtonElement>(`[data-powershow-gallery-select="true"][data-powershow-gallery-index="${index}"]`);
    if (!button) throw new Error(`Gallery item ${index} was not rendered`);
    await act(async () => button.click());
  }

  function canvasButton(index: number): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.textContent?.includes("Edit on Canvas"))[index];
    if (!button) throw new Error(`canvas button ${index} was not rendered`);
    return button;
  }

  async function enterCrop(): Promise<void> {
    await act(async () => canvasButton(0).click());
  }

  async function enterFocal(): Promise<void> {
    await act(async () => canvasButton(1).click());
  }

  async function loadCropSource(): Promise<void> {
    const source = container.querySelector<HTMLImageElement>("[class*='canvasCropSourceLoader']");
    if (!source) throw new Error("crop source loader was not rendered");
    Object.defineProperty(source, "naturalWidth", { configurable: true, value: 1200 });
    Object.defineProperty(source, "naturalHeight", { configurable: true, value: 800 });
    await act(async () => source.dispatchEvent(new Event("load")));
  }

  async function save(onSaveSnapshots: Presentation[]): Promise<Presentation> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    const snapshot = onSaveSnapshots.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  function imageFrom(snapshot: Presentation): ImageElement {
    const element = snapshot.slides[0]?.elements.find((candidate) => candidate.id === "image-1");
    if (element?.type !== "image") throw new Error("Image was not found");
    return element;
  }

  function galleryFrom(snapshot: Presentation): GalleryElement {
    const element = snapshot.slides[0]?.elements.find((candidate) => candidate.id === "gallery-1");
    if (element?.type !== "gallery") throw new Error("Gallery was not found");
    return element;
  }

  it("commits one Image Crop gesture, keeps preview/cancel untracked, and replays exact snapshots", async () => {
    const saved: Presentation[] = [];
    const initial = presentation({ crop: { x: 20, y: 20, width: 50, height: 50 } });
    await mount(initial, async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");
    await enterCrop();
    await loadCropSource();

    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 340, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("50");
    await act(async () => handle.dispatchEvent(pointer("pointercancel", 340, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("50");

    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 360, 180)));
    const changed = await save(saved);
    expect(imageFrom(changed).crop).toEqual({ x: 20, y: 20, width: 65, height: 50 });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    const undone = await save(saved);
    expect(imageFrom(undone).crop).toEqual({ x: 20, y: 20, width: 50, height: 50 });

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    const redone = await save(saved);
    expect(imageFrom(redone).crop).toEqual({ x: 20, y: 20, width: 65, height: 50 });
  });

  it("treats an absent full-frame Crop gesture as a canonical no-op", async () => {
    await mount(presentation());
    await selectElement("image-1");
    await enterCrop();
    await loadCropSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 500, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 500, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-x")?.value).toBe("0");
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("removes authored Crop at full frame and restores it through Undo/Redo", async () => {
    const saved: Presentation[] = [];
    const authored = { x: 0, y: 0, width: 90, height: 100 } as const;
    await mount(presentation({ crop: authored }), async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");
    await enterCrop();
    await loadCropSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 460, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 500, 180)));
    expect(imageFrom(await save(saved)).crop).toBeUndefined();

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(imageFrom(await save(saved)).crop).toEqual(authored);

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(imageFrom(await save(saved)).crop).toBeUndefined();
  });

  it("materializes the focal default and replays exact snapshots", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");
    await enterFocal();
    const marker = container.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    if (!marker) throw new Error("focal marker was not rendered");
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 300, 230)));
    await act(async () => marker.dispatchEvent(pointer("pointerup", 300, 230)));
    expect(imageFrom(await save(saved)).focalPoint).toEqual({ x: 50, y: 50 });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(imageFrom(await save(saved)).focalPoint).toBeUndefined();

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(imageFrom(await save(saved)).focalPoint).toEqual({ x: 50, y: 50 });
  });

  it("treats an authored focal center as a no-op", async () => {
    await mount(presentation({ focalPoint: { x: 50, y: 50 } }));
    await selectElement("image-1");
    await enterFocal();
    const marker = container.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    if (!marker) throw new Error("authored focal marker was not rendered");
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 300, 230)));
    await act(async () => marker.dispatchEvent(pointer("pointerup", 300, 230)));
    const noOpUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(noOpUndo));
    expect(noOpUndo.defaultPrevented).toBe(false);
  });

  it("isolates Gallery item Crop and preserves Gallery fields through Undo/Redo", async () => {
    const saved: Presentation[] = [];
    const initial = presentation();
    await mount(initial, async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("gallery-1");
    await selectGalleryItem(1);
    const before = galleryFrom(initial);
    await enterCrop();
    await loadCropSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 380, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 440, 180)));
    const changed = galleryFrom(await save(saved));
    expect(changed.items[0]).toEqual(before.items[0]);
    expect(changed.items[1]).toMatchObject({ crop: { x: 20, y: 20, width: 65, height: 50 } });
    expect(changed.fit).toBe(before.fit);
    expect(changed.style).toEqual(before.style);
    expect(changed.layout).toEqual(before.layout);

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(galleryFrom(await save(saved)).items[1]).toEqual(before.items[1]);
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(galleryFrom(await save(saved)).items[1]).toMatchObject({ crop: { x: 20, y: 20, width: 65, height: 50 } });
  });

  it("isolates Gallery item Focal commits from every other item", async () => {
    const saved: Presentation[] = [];
    const initial = presentation();
    await mount(initial, async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("gallery-1");
    await selectGalleryItem(1);
    const before = galleryFrom(initial);
    await enterFocal();
    const marker = container.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    if (!marker) throw new Error("focal marker was not rendered");
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 220, 200)));
    await act(async () => marker.dispatchEvent(pointer("pointerup", 300, 230)));
    const changed = galleryFrom(await save(saved));
    expect(changed.items[0]).toEqual(before.items[0]);
    expect(changed.items[1]).toMatchObject({ focalPoint: { x: 50, y: 50 } });
    expect(changed.fit).toBe(before.fit);
    expect(changed.style).toEqual(before.style);
    expect(changed.layout).toEqual(before.layout);
  });

  it("keeps Crop and Focal gestures as separate actions", async () => {
    const saved: Presentation[] = [];
    const initial = presentation({ crop: { x: 20, y: 20, width: 50, height: 50 } });
    await mount(initial, async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");
    await enterCrop();
    await loadCropSource();
    let handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 360, 180)));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    await enterFocal();
    let marker = container.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    if (!marker) throw new Error("focal marker was not rendered");
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 300, 230)));
    await act(async () => marker.dispatchEvent(pointer("pointerup", 340, 260)));
    expect(imageFrom(await save(saved))).toMatchObject({ crop: { width: 65 }, focalPoint: { x: 60, y: 60 } });

    const undoFocal = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoFocal));
    const afterFocalUndo = imageFrom(await save(saved));
    expect(afterFocalUndo.crop).toMatchObject({ width: 65 });
    expect(afterFocalUndo.focalPoint).toBeUndefined();
    const undoCrop = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoCrop));
    const afterCropUndo = imageFrom(await save(saved));
    expect(afterCropUndo.crop).toEqual({ x: 20, y: 20, width: 50, height: 50 });
    expect(afterCropUndo.focalPoint).toBeUndefined();
  });

  it("keeps consecutive Crop gestures independently undoable", async () => {
    const saved: Presentation[] = [];
    await mount(presentation({ crop: { x: 20, y: 20, width: 50, height: 50 } }), async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");
    await enterCrop();
    await loadCropSource();
    let handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("first east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 360, 180)));
    const secondHandle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!secondHandle) throw new Error("second east crop handle was not rendered");
    await act(async () => secondHandle.dispatchEvent(pointer("pointerdown", 360, 180)));
    await act(async () => secondHandle.dispatchEvent(pointer("pointerup", 380, 180)));
    expect(imageFrom(await save(saved)).crop).toMatchObject({ width: 70 });

    const undoSecond = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoSecond));
    expect(imageFrom(await save(saved)).crop).toMatchObject({ width: 65 });
    const undoFirst = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoFirst));
    expect(imageFrom(await save(saved)).crop).toMatchObject({ width: 50 });
  });

  it("separates an Inspector Crop transaction from a following canvas Crop gesture", async () => {
    const saved: Presentation[] = [];
    await mount(presentation({ crop: { x: 20, y: 20, width: 50, height: 50 } }), async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");
    const cropX = container.querySelector<HTMLInputElement>("#image-crop-x");
    if (!cropX) throw new Error("Crop X input was not rendered");
    await act(async () => {
      cropX.focus();
      changeInput(cropX, "30");
      cropX.blur();
    });
    await enterCrop();
    await loadCropSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 340, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 400, 180)));
    expect(imageFrom(await save(saved)).crop).toMatchObject({ x: 30, width: 65 });

    const undoCanvas = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoCanvas));
    expect(imageFrom(await save(saved)).crop).toMatchObject({ x: 30, width: 50 });
    const undoInspector = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoInspector));
    expect(imageFrom(await save(saved)).crop).toMatchObject({ x: 20, width: 50 });
  });
});
