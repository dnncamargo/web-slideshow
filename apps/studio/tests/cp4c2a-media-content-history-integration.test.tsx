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

const INITIAL_GALLERY_ITEMS: GalleryElement["items"] = [
  {
    src: "/one.png",
    alt: "One",
    fit: "cover",
    crop: { x: 10, y: 0, width: 90, height: 100 },
    focalPoint: { x: 20, y: 30 },
  },
  {
    src: "/two.png",
    alt: "Two",
    fit: "fill",
    crop: { x: 0, y: 0, width: 70, height: 100 },
    focalPoint: { x: 70, y: 80 },
  },
];

function imageElement(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: "image-1",
    type: "image",
    hidden: false,
    src: "/original.png",
    alt: "Original image",
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
    items: INITIAL_GALLERY_ITEMS,
    ...overrides,
  };
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c2a-media-content-history",
    title: "CP4C2A media content history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [imageElement(), galleryElement()],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function setTextAreaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("expected HTMLTextAreaElement.value setter");
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C2A media content history", () => {
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
    const element = host.querySelector<HTMLElement>(
      `[data-presentation-id="${id}"]`,
    );
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function selectGalleryItem(index: number): Promise<void> {
    const button = host.querySelector<HTMLButtonElement>(
      `[data-presentation-gallery-select="true"][data-presentation-gallery-index="${index}"]`,
    );
    if (!button) throw new Error(`Gallery item ${index} was not rendered`);
    await act(async () => button.click());
  }

  function textArea(id: string): HTMLTextAreaElement {
    const result = host.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (!result) throw new Error(`textarea ${id} was not rendered`);
    return result;
  }

  function galleryTextArea(
    index: number,
    field: "src" | "alt",
  ): HTMLTextAreaElement {
    return textArea(`gallery-gallery-1-item-${index}-${field}`);
  }

  async function editText(control: HTMLTextAreaElement, values: string[]): Promise<void> {
    await act(async () => {
      control.focus();
      for (const value of values) setTextAreaValue(control, value);
      control.blur();
    });
  }

  async function undo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  it("coalesces Image src changes into one undoable action", async () => {
    await mount();
    await selectElement("image-1");

    await editText(textArea("image-src"), ["/a.png", "/b.png"]);
    expect(textArea("image-src").value).toBe("/b.png");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(textArea("image-src").value).toBe("/original.png");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(textArea("image-src").value).toBe("/b.png");
  });

  it("keeps Image src and alt in separate transactions", async () => {
    await mount();
    await selectElement("image-1");

    await editText(textArea("image-src"), ["/changed.png"]);
    await editText(textArea("image-alt"), ["Changed image"]);

    await undo();
    expect(textArea("image-src").value).toBe("/changed.png");
    expect(textArea("image-alt").value).toBe("Original image");

    await undo();
    expect(textArea("image-src").value).toBe("/original.png");
    expect(textArea("image-alt").value).toBe("Original image");
  });

  it("does not create Image history for same-value text mutations", async () => {
    await mount();
    await selectElement("image-1");

    await editText(textArea("image-src"), ["/original.png"]);
    await editText(textArea("image-alt"), ["Original image"]);

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    expect(textArea("image-src").value).toBe("/original.png");
    expect(textArea("image-alt").value).toBe("Original image");
  });

  it("coalesces a Gallery item src session and preserves its sibling", async () => {
    await mount();
    await selectElement("gallery-1");

    await editText(galleryTextArea(0, "src"), ["/a.png", "/b.png"]);
    expect(galleryTextArea(0, "src").value).toBe("/b.png");

    await undo();
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/one.png");
    await redo();
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/b.png");

    await selectGalleryItem(1);
    expect(galleryTextArea(1, "src").value).toBe("/two.png");
  });

  it("keeps a Gallery item src and alt in separate transactions", async () => {
    await mount();
    await selectElement("gallery-1");

    await editText(galleryTextArea(0, "src"), ["/changed.png"]);
    await editText(galleryTextArea(0, "alt"), ["Changed"]);

    await undo();
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/changed.png");
    expect(galleryTextArea(0, "alt").value).toBe("One");

    await undo();
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/one.png");
    expect(galleryTextArea(0, "alt").value).toBe("One");
  });

  it("isolates Gallery item transactions across selected items", async () => {
    await mount();
    await selectElement("gallery-1");

    await editText(galleryTextArea(0, "src"), ["/one-edited.png"]);
    await selectGalleryItem(1);
    await editText(galleryTextArea(1, "src"), ["/two-edited.png"]);

    await undo();
    await selectGalleryItem(1);
    expect(galleryTextArea(1, "src").value).toBe("/two.png");
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/one-edited.png");

    await undo();
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/one.png");
    expect(host.querySelector<HTMLSelectElement>("#gallery-fit")?.value).toBe("contain");
    expect(host.querySelector<HTMLSelectElement>("#gallery-gallery-1-item-0-fit")?.value).toBe("cover");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-0-crop-x")?.value).toBe("10");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-0-focal-x")?.value).toBe("20");

    await selectGalleryItem(1);
    expect(galleryTextArea(1, "src").value).toBe("/two.png");
    expect(galleryTextArea(1, "alt").value).toBe("Two");
    expect(host.querySelector<HTMLSelectElement>("#gallery-gallery-1-item-1-fit")?.value).toBe("fill");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-crop-x")?.value).toBe("0");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-focal-x")?.value).toBe("70");
  });

  it("does not create Gallery history for a same-value text mutation", async () => {
    await mount();
    await selectElement("gallery-1");

    await editText(galleryTextArea(0, "src"), ["/one.png"]);
    const undoEvent = await undo();

    expect(undoEvent.defaultPrevented).toBe(false);
    expect(galleryTextArea(0, "src").value).toBe("/one.png");
  });
});
