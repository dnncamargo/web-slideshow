// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type GalleryElement,
  type ImageElement,
  type Presentation,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const DEFAULT_GALLERY_ITEMS: GalleryElement["items"] = [
  { src: "/one.png", alt: "One", crop: { x: 10, y: 0, width: 90, height: 100 } },
  { src: "/two.png", alt: "Two", crop: { x: 0, y: 0, width: 70, height: 100 } },
];

function imageElement(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: "image-1",
    type: "image",
    hidden: false,
    src: "/image.png",
    alt: "Image",
    fit: "contain",
    ...overrides,
  };
}

function galleryElement(overrides: Partial<GalleryElement> = {}): GalleryElement {
  return {
    id: "gallery-1",
    type: "gallery",
    hidden: false,
    fit: "contain",
    items: DEFAULT_GALLERY_ITEMS,
    ...overrides,
  };
}

function presentation(
  imageOverrides: Partial<ImageElement> = {},
  galleryOverrides: Partial<GalleryElement> = {},
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c1g-media-history",
    title: "CP4C1G media history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [imageElement(imageOverrides), galleryElement(galleryOverrides)],
    }],
  });
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

describe("CP4C1G continuous media Crop/Focal history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
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
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id: string): HTMLInputElement {
    const result = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!result) throw new Error(`input ${id} was not rendered`);
    return result;
  }

  async function editNumber(id: string, values: string[]): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      for (const value of values) changeInput(control, value);
      control.blur();
    });
  }

  async function authorDisplayedNumber(id: string, value: string): Promise<void> {
    const control = input(id);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");
    await act(async () => {
      control.focus();
      const tracker = (control as HTMLInputElement & {
        _valueTracker?: { setValue: (value: string) => void };
      })._valueTracker;
      tracker?.setValue("");
      setter.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.blur();
    });
  }

  async function selectGalleryItem(index: number): Promise<void> {
    const button = host.querySelector<HTMLButtonElement>(`[data-powershow-gallery-select="true"][data-powershow-gallery-index="${index}"]`);
    if (!button) throw new Error(`Gallery item ${index} was not rendered`);
    await act(async () => button.click());
  }

  async function save(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent === "Save");
    if (!button) throw new Error("save button was not rendered");
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  }

  function savedImage(snapshot: Presentation): ImageElement {
    const element = snapshot.slides[0]?.elements.find((candidate) => candidate.id === "image-1");
    if (element?.type !== "image") throw new Error("saved Image was not found");
    return element;
  }

  function savedGallery(snapshot: Presentation): GalleryElement {
    const element = snapshot.slides[0]?.elements.find((candidate) => candidate.id === "gallery-1");
    if (element?.type !== "gallery") throw new Error("saved Gallery was not found");
    return element;
  }

  it("coalesces Image Crop X changes and owns the coupled width result", async () => {
    await mount(presentation({ crop: { x: 10, y: 0, width: 90, height: 100 } }));
    await selectElement("image-1");

    await editNumber("image-crop-x", ["20", "30"]);
    expect(input("image-crop-x").value).toBe("30");
    expect(input("image-crop-width").value).toBe("70");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("image-crop-x").value).toBe("10");
    expect(input("image-crop-width").value).toBe("90");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("image-crop-x").value).toBe("30");
    expect(input("image-crop-width").value).toBe("70");
  });

  it("keeps Crop fields in separate transactions", async () => {
    await mount(presentation({ crop: { x: 10, y: 0, width: 90, height: 100 } }));
    await selectElement("image-1");

    await editNumber("image-crop-x", ["20"]);
    await editNumber("image-crop-y", ["10"]);

    const undoY = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoY));
    expect(undoY.defaultPrevented).toBe(true);
    expect(input("image-crop-x").value).toBe("20");
    expect(input("image-crop-y").value).toBe("0");
    expect(input("image-crop-height").value).toBe("100");

    const undoX = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoX));
    expect(undoX.defaultPrevented).toBe(true);
    expect(input("image-crop-x").value).toBe("10");
    expect(input("image-crop-width").value).toBe("90");
  });

  it("leaves native Undo alone for a clamped Crop no-op", async () => {
    await mount(presentation({ crop: { x: 99, y: 0, width: 1, height: 100 } }));
    await selectElement("image-1");

    await editNumber("image-crop-x", ["120"]);
    expect(input("image-crop-x").value).toBe("99");
    expect(input("image-crop-width").value).toBe("1");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("collapses a full-frame Crop to absent and replays exact Undo/Redo", async () => {
    const saved: Presentation[] = [];
    await mount(
      presentation({ crop: { x: 0, y: 0, width: 90, height: 100 } }),
      async (snapshot) => { saved.push(structuredClone(snapshot)); },
    );
    await selectElement("image-1");

    await editNumber("image-crop-width", ["100"]);
    await save();
    expect(savedImage(saved.at(-1)!).crop).toBeUndefined();

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedImage(saved.at(-1)!).crop).toEqual({ x: 0, y: 0, width: 90, height: 100 });

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedImage(saved.at(-1)!).crop).toBeUndefined();
  });

  it("keeps an absent default Crop as a no-op", async () => {
    await mount(presentation());
    await selectElement("image-1");

    await authorDisplayedNumber("image-crop-x", "0");
    expect(input("image-crop-x").value).toBe("0");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("materializes the focal default and preserves exact canonical Undo/Redo", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), async (snapshot) => { saved.push(structuredClone(snapshot)); });
    await selectElement("image-1");

    await authorDisplayedNumber("image-focal-x", "50");
    await save();
    expect(savedImage(saved.at(-1)!).focalPoint).toEqual({ x: 50, y: 50 });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedImage(saved.at(-1)!).focalPoint).toBeUndefined();

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedImage(saved.at(-1)!).focalPoint).toEqual({ x: 50, y: 50 });
  });

  it("leaves native Undo alone for an ordinary authored Focal no-op", async () => {
    await mount(presentation({ focalPoint: { x: 50, y: 50 } }));
    await selectElement("image-1");

    await authorDisplayedNumber("image-focal-x", "50");
    const ordinaryUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(ordinaryUndo));
    expect(ordinaryUndo.defaultPrevented).toBe(false);
  });

  it("leaves native Undo alone for a clamped Focal no-op", async () => {
    await mount(presentation({ focalPoint: { x: 0, y: 100 } }));
    await selectElement("image-1");
    await editNumber("image-focal-x", ["-10"]);
    expect(input("image-focal-x").value).toBe("0");
    const clampedUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(clampedUndo));
    expect(clampedUndo.defaultPrevented).toBe(false);
  });

  it("keeps Focal X and Y in separate transactions", async () => {
    await mount(presentation({ focalPoint: { x: 20, y: 30 } }));
    await selectElement("image-1");

    await editNumber("image-focal-x", ["40"]);
    await editNumber("image-focal-y", ["60"]);

    const undoY = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoY));
    expect(undoY.defaultPrevented).toBe(true);
    expect(input("image-focal-x").value).toBe("40");
    expect(input("image-focal-y").value).toBe("30");

    const undoX = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoX));
    expect(undoX.defaultPrevented).toBe(true);
    expect(input("image-focal-x").value).toBe("20");
  });

  it("isolates Gallery item media and separates item History sessions", async () => {
    const saved: Presentation[] = [];
    await mount(
      presentation({}, { items: DEFAULT_GALLERY_ITEMS }),
      async (snapshot) => { saved.push(structuredClone(snapshot)); },
    );
    await selectElement("gallery-1");

    await editNumber("gallery-gallery-1-item-0-crop-x", ["20"]);
    await selectGalleryItem(1);
    await editNumber("gallery-gallery-1-item-1-crop-x", ["10"]);
    await save();

    const afterBoth = savedGallery(saved.at(-1)!);
    expect(afterBoth.items[0]?.crop).toEqual({ x: 20, y: 0, width: 80, height: 100 });
    expect(afterBoth.items[1]?.crop).toEqual({ x: 10, y: 0, width: 70, height: 100 });
    expect(afterBoth.fit).toBe("contain");

    const undoItemOne = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoItemOne));
    expect(undoItemOne.defaultPrevented).toBe(true);
    await selectGalleryItem(1);
    expect(input("gallery-gallery-1-item-1-crop-x").value).toBe("0");
    await selectGalleryItem(0);
    expect(input("gallery-gallery-1-item-0-crop-x").value).toBe("20");

    const undoItemZero = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoItemZero));
    expect(undoItemZero.defaultPrevented).toBe(true);
    await selectGalleryItem(0);
    expect(input("gallery-gallery-1-item-0-crop-x").value).toBe("10");
    expect(input("gallery-gallery-1-item-0-crop-width").value).toBe("90");
  });
});
