// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function pointer(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: pointerId },
  });
  return event;
}

function findElement(elements: readonly PresentationElement[], id: string): PresentationElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === "container") {
      const nested = findElement(element.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function rootElement(presentation: Presentation, id: string): PresentationElement {
  const root = presentation.rootDefinitions?.[0]?.root;
  const element = root ? findElement([root], id) : undefined;
  if (!element) throw new Error(`Expected Root element ${id}`);
  return element;
}

function presentation(): Presentation {
  const image = {
    type: "image" as const,
    id: "shared-image",
    hidden: false,
    src: "/root-image.png",
    alt: "Root image",
    fit: "contain" as const,
    link: { kind: "url" as const, href: "https://example.com/root-image" },
    crop: { x: 10, y: 20, width: 70, height: 60 },
    focalPoint: { x: 20, y: 30 },
    layout: { position: "absolute" as const, left: 40, top: 40, width: 400, height: 300 },
  };
  const gallery = {
    type: "gallery" as const,
    id: "shared-gallery",
    hidden: false,
    fit: "contain" as const,
    items: [
      { src: "/root-one.png", alt: "Root one", fit: "cover" as const, crop: { x: 5, y: 10, width: 80, height: 70 }, focalPoint: { x: 25, y: 35 } },
      { src: "/root-two.png", alt: "Root two", fit: "fill" as const, crop: { x: 15, y: 20, width: 60, height: 50 }, focalPoint: { x: 65, y: 75 } },
    ],
    layout: { position: "absolute" as const, left: 80, top: 80, width: 400, height: 300 },
  };

  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d6-presentation",
    title: "SM6D6",
    slides: [{
      id: "retained-slide",
      title: "Retained",
      elements: [image, gallery],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching root",
      root: {
        id: "root-container",
        type: "container",
        hidden: false,
        children: [image, gallery],
      },
    }],
  });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("Expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeTextArea(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) throw new Error("Expected HTMLTextAreaElement.value setter");
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SM6D6 Root Canvas/media authoring", () => {
  let host: HTMLDivElement;
  let root: Root;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    HTMLElement.prototype.getBoundingClientRect = function () {
      const id = this.dataset.presentationId;
      if (id === "root-container") {
        return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) };
      }
      if (id === "shared-image" || id === "shared-gallery" || this.dataset.presentationGalleryIndex !== undefined) {
        return { left: 100, top: 80, right: 500, bottom: 380, width: 400, height: 300, x: 100, y: 80, toJSON: () => ({}) };
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.restoreAllMocks();
  });

  async function mount(initial = presentation()): Promise<ReturnType<typeof vi.fn>> {
    const onSave = vi.fn(async (_snapshot: Presentation) => {});
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initial}
            initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-1" }}
            onSave={onSave}
          />
        </StudioI18nProvider>,
      );
    });
    return onSave;
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`Expected rendered element ${id}`);
    await act(async () => element.dispatchEvent(pointer("pointerdown", 150, 120)));
  }

  async function save(onSave: ReturnType<typeof vi.fn>): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Expected Save button");
    await act(async () => button.click());
    const snapshot = onSave.mock.calls.at(-1)?.[0] as Presentation | undefined;
    if (!snapshot) throw new Error("Expected saved Presentation");
    return snapshot;
  }

  async function replay(shiftKey = false): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey, bubbles: true })));
  }

  async function loadCropSource(): Promise<void> {
    const source = host.querySelector<HTMLImageElement>("[class*='canvasCropSourceLoader']");
    if (!source) throw new Error("Expected Canvas crop source loader");
    Object.defineProperty(source, "naturalWidth", { configurable: true, value: 1200 });
    Object.defineProperty(source, "naturalHeight", { configurable: true, value: 800 });
    await act(async () => source.dispatchEvent(new Event("load")));
  }

  it("enables Root Image Inspector writes and preserves the retained same-id Image", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-image");

    expect(host.querySelector("#image-src")).not.toBeNull();
    expect(host.textContent).not.toContain("Master content is read-only in this workspace.");

    await act(async () => changeTextArea(host.querySelector<HTMLTextAreaElement>("#image-src")!, "/updated-root.png"));
    await act(async () => changeTextArea(host.querySelector<HTMLTextAreaElement>("#image-alt")!, "Updated root alt"));
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#image-fit")!, "cover"));
    const saved = await save(onSave);

    expect(rootElement(saved, "shared-image")).toMatchObject({
      src: "/updated-root.png",
      alt: "Updated root alt",
      fit: "cover",
    });
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);
  });

  it("keeps the existing Root Image QR action owner-scoped", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-image");
    const qrButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("QR"));
    if (!qrButton) throw new Error("Expected Root Image QR action");
    await act(async () => qrButton.click());

    const saved = await save(onSave);
    const root = rootElement(saved, "root-container");
    expect(root.type).toBe("container");
    if (root.type === "container") {
      const imageIndex = root.children.findIndex((element) => element.id === "shared-image");
      expect(root.children[imageIndex + 1]?.type).toBe("image");
      expect(root.children.filter((element) => element.type === "container")).toHaveLength(0);
    }
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);
  });

  it("captures Root Image drag and resize owners and replays only the Root tree", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-image");
    const image = host.querySelector<HTMLElement>('[data-presentation-id="shared-image"]');
    const canvas = host.querySelector<HTMLElement>("[class*='slideCanvas']");
    if (!image || !canvas) throw new Error("Expected Root Image canvas");

    expect(image.classList.contains("studio-editor-draggable")).toBe(true);
    await act(async () => image.dispatchEvent(pointer("pointerdown", 150, 120)));
    await act(async () => canvas.dispatchEvent(pointer("pointermove", 210, 170)));
    await act(async () => canvas.dispatchEvent(pointer("pointerup", 210, 170)));
    let saved = await save(onSave);
    const dragged = rootElement(saved, "shared-image");
    expect(dragged).not.toEqual(rootElement(source, "shared-image"));
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);

    await replay();
    saved = await save(onSave);
    expect(rootElement(saved, "shared-image")).toEqual(rootElement(source, "shared-image"));
    await replay(true);
    saved = await save(onSave);
    expect(rootElement(saved, "shared-image")).toEqual(dragged);

    const handle = host.querySelector<HTMLButtonElement>("[class*='canvasResizeHandleSE']");
    if (!handle) throw new Error("Expected Root Image resize handle");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 500, 380)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 560, 440)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 560, 440)));
    saved = await save(onSave);
    const resized = rootElement(saved, "shared-image");
    expect(resized.type).toBe("image");
    expect(dragged.type).toBe("image");
    if (resized.type !== "image" || dragged.type !== "image") throw new Error("Expected resized Root Image");
    expect(resized.layout).not.toEqual(dragged.layout);
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);

    await replay();
    saved = await save(onSave);
    const undoneResize = rootElement(saved, "shared-image");
    expect(undoneResize.type).toBe("image");
    if (undoneResize.type !== "image") throw new Error("Expected Root Image after resize Undo");
    expect(undoneResize.layout).toEqual(dragged.layout);
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);

    await replay(true);
    saved = await save(onSave);
    const redoneResize = rootElement(saved, "shared-image");
    expect(redoneResize.type).toBe("image");
    if (redoneResize.type !== "image") throw new Error("Expected Root Image after resize Redo");
    expect(redoneResize.layout).toEqual(resized.layout);
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);
  });

  it("routes Root Image Canvas crop and focal commits through the owned media target", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-image");
    const editButtons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.textContent?.includes("Edit on Canvas"));
    if (editButtons.length < 2) throw new Error("Expected Image crop and focal Canvas actions");

    await act(async () => editButtons[0]?.click());
    await loadCropSource();
    const cropHandle = host.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!cropHandle) throw new Error("Expected Root Image crop handle");
    await act(async () => cropHandle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => cropHandle.dispatchEvent(pointer("pointerup", 360, 180)));
    let saved = await save(onSave);
    const cropped = rootElement(saved, "shared-image");
    expect(cropped).not.toEqual(rootElement(source, "shared-image"));
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);

    await replay();
    saved = await save(onSave);
    expect(rootElement(saved, "shared-image")).toEqual(rootElement(source, "shared-image"));
    await replay(true);
    saved = await save(onSave);

    const focalButtons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.textContent?.includes("Edit on Canvas"));
    const focalButton = focalButtons.at(-1);
    if (!focalButton) throw new Error("Expected Root Image focal Canvas action");
    await act(async () => focalButton.click());
    const marker = host.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    if (!marker) throw new Error("Expected Root Image focal marker");
    const beforeFocal = rootElement(await save(onSave), "shared-image");
    if (beforeFocal.type !== "image") throw new Error("Expected Root Image before focal gesture");
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 180, 170)));
    await act(async () => marker.dispatchEvent(pointer("pointerup", 300, 250)));
    saved = await save(onSave);
    const focused = rootElement(saved, "shared-image");
    expect(focused.type).toBe("image");
    if (focused.type !== "image") throw new Error("Expected Root Image after focal gesture");
    expect(focused.focalPoint).not.toEqual(beforeFocal.focalPoint);
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);

    await replay();
    saved = await save(onSave);
    const undoneFocal = rootElement(saved, "shared-image");
    expect(undoneFocal.type).toBe("image");
    if (undoneFocal.type !== "image") throw new Error("Expected Root Image after focal Undo");
    expect(undoneFocal.focalPoint).toEqual(beforeFocal.focalPoint);
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);

    await replay(true);
    saved = await save(onSave);
    const redoneFocal = rootElement(saved, "shared-image");
    expect(redoneFocal.type).toBe("image");
    if (redoneFocal.type !== "image") throw new Error("Expected Root Image after focal Redo");
    expect(redoneFocal.focalPoint).toEqual(focused.focalPoint);
    expect(saved.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);
  });

  it("enables Root Gallery item authoring and isolates selected item media, crop, and focal writes", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-gallery");
    const selectItem = host.querySelector<HTMLButtonElement>('[data-presentation-gallery-select][data-presentation-gallery-index="1"]');
    if (!selectItem) throw new Error("Expected Gallery item selection");
    await act(async () => selectItem.click());

    expect(host.querySelector("#gallery-shared-gallery-item-1-src")).not.toBeNull();
    await act(async () => changeTextArea(host.querySelector<HTMLTextAreaElement>("#gallery-shared-gallery-item-1-src")!, "/updated-item.png"));
    await act(async () => changeTextArea(host.querySelector<HTMLTextAreaElement>("#gallery-shared-gallery-item-1-alt")!, "Updated item"));
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#gallery-shared-gallery-item-1-fit")!, "contain"));

    const editButtons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.textContent?.includes("Edit on Canvas"));
    if (editButtons.length < 2) throw new Error("Expected Gallery crop and focal Canvas actions");
    await act(async () => editButtons[0]?.click());
    await loadCropSource();
    const cropHandle = host.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!cropHandle) throw new Error("Expected Root Gallery item crop handle");
    await act(async () => cropHandle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => cropHandle.dispatchEvent(pointer("pointerup", 360, 180)));

    const focalButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.textContent?.includes("Edit on Canvas"))
      .at(-1);
    if (!focalButton) throw new Error("Expected Root Gallery item focal Canvas action");
    await act(async () => focalButton.click());
    const marker = host.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    if (!marker) throw new Error("Expected Root Gallery item focal marker");
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 360, 240)));
    await act(async () => marker.dispatchEvent(pointer("pointerup", 440, 300)));

    const beforeAddSnapshot = await save(onSave);
    const beforeAdd = rootElement(beforeAddSnapshot, "shared-gallery");
    if (beforeAdd.type !== "gallery") throw new Error("Expected Root Gallery before add");
    const add = host.querySelector<HTMLButtonElement>("[data-presentation-gallery-add]");
    if (!add) throw new Error("Expected Gallery add action");
    await act(async () => add.click());
    let saved = await save(onSave);
    const addedGallery = rootElement(saved, "shared-gallery");
    expect(addedGallery.type).toBe("gallery");
    if (addedGallery.type !== "gallery") throw new Error("Expected Root Gallery after add");
    expect(addedGallery.items).toHaveLength(3);
    expect(host.querySelector('[data-presentation-gallery-select][data-presentation-gallery-index="2"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(saved.slides[0]?.elements[1]).toEqual(source.slides[0]?.elements[1]);

    await replay();
    saved = await save(onSave);
    const undoneAdd = rootElement(saved, "shared-gallery");
    expect(undoneAdd.type).toBe("gallery");
    if (undoneAdd.type !== "gallery") throw new Error("Expected Root Gallery after add Undo");
    expect(undoneAdd.items).toHaveLength(2);
    expect(undoneAdd.items).toEqual(beforeAdd.items);
    expect(saved.slides[0]?.elements[1]).toEqual(source.slides[0]?.elements[1]);

    await replay(true);
    saved = await save(onSave);
    const redoneAdd = rootElement(saved, "shared-gallery");
    expect(redoneAdd.type).toBe("gallery");
    if (redoneAdd.type !== "gallery") throw new Error("Expected Root Gallery after add Redo");
    expect(redoneAdd.items).toEqual(addedGallery.items);
    expect(saved.slides[0]?.elements[1]).toEqual(source.slides[0]?.elements[1]);

    const reselectedAddedItem = host.querySelector<HTMLButtonElement>(
      '[data-presentation-gallery-select][data-presentation-gallery-index="2"]',
    );
    if (!reselectedAddedItem) throw new Error("Expected Gallery item selector after add Redo");
    await act(async () => reselectedAddedItem.click());
    const remove = host.querySelector<HTMLButtonElement>("[data-presentation-gallery-remove]");
    if (!remove) throw new Error("Expected Gallery remove action");
    await act(async () => remove.click());

    saved = await save(onSave);
    const rootGallery = rootElement(saved, "shared-gallery");
    expect(rootGallery.type).toBe("gallery");
    if (rootGallery.type === "gallery") {
      expect(rootGallery.items[1]).toMatchObject({ src: "/updated-item.png", alt: "Updated item", fit: "contain" });
      expect(rootGallery.items[1]?.crop).not.toEqual(source.slides[0]?.elements[1]?.type === "gallery" ? source.slides[0].elements[1].items[1]?.crop : undefined);
      expect(rootGallery.items[1]?.focalPoint).not.toEqual(source.slides[0]?.elements[1]?.type === "gallery" ? source.slides[0].elements[1].items[1]?.focalPoint : undefined);
      expect(rootGallery.items[0]).toEqual(source.slides[0]?.elements[1]?.type === "gallery" ? source.slides[0].elements[1].items[0] : undefined);
      expect(rootGallery.items).toHaveLength(2);
    }
    expect(saved.slides[0]?.elements[1]).toEqual(source.slides[0]?.elements[1]);
  });

  it("keeps the canonical Root Container outside Canvas drag and resize", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("root-container");
    const rootContainer = host.querySelector<HTMLElement>('[data-presentation-id="root-container"]');
    if (!rootContainer) throw new Error("Expected canonical Root Container");

    expect(rootContainer.classList.contains("studio-editor-draggable")).toBe(false);
    expect(host.querySelector("[class*='canvasResizeOverlay']")).toBeNull();
    expect(host.querySelector("#container-direction")).not.toBeNull();
    const saveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    expect(saveButton?.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    const beforeRootGesture = rootElement(source, "root-container");
    const canvas = host.querySelector<HTMLElement>("[class*='slideCanvas']");
    if (!canvas) throw new Error("Expected Root Canvas");
    await act(async () => rootContainer.dispatchEvent(pointer("pointerdown", 120, 100)));
    await act(async () => canvas.dispatchEvent(pointer("pointermove", 240, 190)));
    await act(async () => canvas.dispatchEvent(pointer("pointerup", 240, 190)));

    expect(rootElement(source, "root-container")).toEqual(beforeRootGesture);
    expect(host.querySelector("[class*='canvasResizeOverlay']")).toBeNull();
    expect(saveButton?.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(source.slides[0]?.elements).toEqual(presentation().slides[0]?.elements);
    expect(host.querySelector('[data-presentation-id="shared-image"]')).not.toBeNull();
  });

  it("cancels an active Root crop gesture when exiting master editing without dirtying or redirecting it", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-image");
    const editButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Edit on Canvas"));
    if (!editButton) throw new Error("Expected Root Image crop Canvas action");
    await act(async () => editButton.click());
    await loadCropSource();
    const cropHandle = host.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!cropHandle) throw new Error("Expected Root crop handle");
    const rootCropBefore = rootElement(source, "shared-image");
    const slideCropBefore = source.slides[0]?.elements[0];
    if (rootCropBefore.type !== "image" || slideCropBefore?.type !== "image") throw new Error("Expected same-id Images");

    await act(async () => cropHandle.dispatchEvent(pointer("pointerdown", 300, 180)));
    const exit = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("Expected Exit master editing action");
    await act(async () => exit.click());

    expect(host.querySelector('[data-authoring-target="root-definition"]')).toBeNull();
    expect(host.querySelector("[class*='canvasCropHandle']")).toBeNull();
    expect(host.querySelector("[class*='canvasCropSourceLoader']")).toBeNull();
    expect(host.querySelector('[data-presentation-id="shared-image"]')).not.toBeNull();
    const saveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    expect(saveButton?.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => cropHandle.dispatchEvent(pointer("pointerup", 360, 180)));
    expect(rootElement(source, "shared-image")).toEqual(rootCropBefore);
    expect(source.slides[0]?.elements[0]).toEqual(slideCropBefore);
    expect(saveButton?.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();

    const historyTab = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "History");
    if (!historyTab) throw new Error("Expected History panel tab");
    await act(async () => historyTab.click());
    expect(host.textContent).toContain("History is not populated yet.");
  });
});
