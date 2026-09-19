// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type GalleryElement,
  type ImageElement,
  type Presentation,
} from "@web-slideshow/document-schema";

const historyMetas = vi.hoisted(() => [] as Array<{
  kind: string;
  labelKey: string;
  labelParams?: Readonly<Record<string, string | number>>;
}>);

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return {
    ...actual,
    commitHistory: (state: Parameters<typeof actual.commitHistory>[0], next: Parameters<typeof actual.commitHistory>[1], meta: Parameters<typeof actual.commitHistory>[2]) => {
      historyMetas.push(meta);
      return actual.commitHistory(state, next, meta);
    },
  };
});

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CROP = { x: 10, y: 20, width: 60, height: 50 };
const FOCAL_POINT = { x: 25, y: 70 };

function galleryElement(items: GalleryElement["items"]): GalleryElement {
  return {
    id: "gallery-1",
    type: "gallery",
    hidden: true,
    layout: { width: 640, height: 360 },
    style: { className: "gallery-style" },
    effect: { opacity: 0.75 },
    fit: "contain",
    items,
  };
}

function imageElement(id: string, overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id,
    type: "image",
    hidden: false,
    src: `/${id}.png`,
    alt: id,
    fit: "contain",
    ...overrides,
  };
}

function presentation(elements: Presentation["slides"][number]["elements"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d3b-gallery-tree-structure-history",
    title: "CP4D3B Gallery tree structure history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements,
    }],
  });
}

function reorderPresentation(): Presentation {
  return presentation([
    galleryElement([
      { src: "/a.png", alt: "A" },
      { src: "/b.png", alt: "B" },
      { src: "/c.png", alt: "C" },
    ]),
  ]);
}

function conversionPresentation(): Presentation {
  return presentation([
    imageElement("image-element"),
    imageElement("image-element-2"),
    galleryElement([{
      src: "/photo.png",
      alt: "Photo",
      crop: CROP,
      focalPoint: FOCAL_POINT,
    }]),
    {
      id: "target-text",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Target",
    },
  ]);
}

function attachPresentation(): Presentation {
  return presentation([
    imageElement("source-image", {
      src: "/source.png",
      alt: "Source",
      fit: "cover",
      crop: CROP,
      focalPoint: FOCAL_POINT,
      layout: { width: 123, height: 77 },
    }),
    galleryElement([
      { src: "/a.png", alt: "A" },
      { src: "/b.png", alt: "B" },
    ]),
  ]);
}

function invalidDropPresentation(): Presentation {
  return presentation([
    galleryElement([
      { src: "/a.png", alt: "A" },
      { src: "/b.png", alt: "B" },
    ]),
    {
      id: "gallery-2",
      type: "gallery",
      hidden: false,
      fit: "contain",
      items: [{ src: "/x.png", alt: "X" }],
    },
  ]);
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function dragEvent(type: string, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: {
      effectAllowed: "move",
      setData: vi.fn(),
    },
  });
  return event;
}

describe("CP4D3B Gallery tree structure history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    historyMetas.length = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(
    value: Presentation,
    onSave?: (snapshot: Presentation) => Promise<void>,
  ): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={value} onSave={onSave} />
      </StudioI18nProvider>,
    ));
    await act(async () => elementsTab().click());
  }

  function elementsTab(): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!button) throw new Error("Elements tab was not rendered");
    return button;
  }

  function inspectorTab(): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Inspector");
    if (!button) throw new Error("Inspector tab was not rendered");
    return button;
  }

  function treeButtons(): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('li[role="treeitem"] > div button'));
  }

  function treeButtonStartingWith(label: string): HTMLButtonElement {
    const button = treeButtons().find((candidate) => candidate.textContent?.trim().startsWith(label));
    if (!button) throw new Error(`Tree button ${label} was not rendered`);
    return button;
  }

  function galleryItemButton(index: number): HTMLButtonElement {
    return treeButtonStartingWith(`${index + 1}.`);
  }

  function treeOrder(): string[] {
    return treeButtons()
      .map((button) => button.textContent?.trim() ?? "")
      .filter((label) => /^\d+\. /.test(label));
  }

  function moveButton(direction: "up" | "down"): HTMLButtonElement {
    const symbol = direction === "up" ? "▲" : "▼";
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === symbol);
    if (!button) throw new Error(`Move ${direction} button was not rendered`);
    return button;
  }

  async function footerMove(index: number, direction: "up" | "down"): Promise<void> {
    await act(async () => galleryItemButton(index).click());
    await act(async () => moveButton(direction).click());
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
  }

  async function drag(source: HTMLElement, target: HTMLElement, clientY: number): Promise<void> {
    await act(async () => source.dispatchEvent(dragEvent("dragstart", 0)));
    await act(async () => target.dispatchEvent(dragEvent("dragover", clientY)));
    await act(async () => target.dispatchEvent(dragEvent("drop", clientY)));
  }

  it("tracks footer reorder as gallery.move and replays exact order", async () => {
    await mount(reorderPresentation());

    await footerMove(1, "up");
    expect(treeOrder()).toEqual(["1. B", "2. A", "3. C"]);
    expect(historyMetas).toEqual([{
      kind: "gallery.move",
      labelKey: "history.element.setting",
      labelParams: { setting: "gallery.move" },
    }]);
    expect(galleryItemButton(0).closest('li')?.getAttribute("aria-selected")).toBe("true");

    await undo();
    expect(treeOrder()).toEqual(["1. A", "2. B", "3. C"]);
    await redo();
    expect(treeOrder()).toEqual(["1. B", "2. A", "3. C"]);
  });

  it("tracks forward and backward same-Gallery drops separately", async () => {
    await mount(reorderPresentation());

    await drag(galleryItemButton(0).parentElement!, galleryItemButton(2).parentElement!, 1);
    expect(treeOrder()).toEqual(["1. B", "2. C", "3. A"]);
    await drag(galleryItemButton(2).parentElement!, galleryItemButton(0).parentElement!, -1);
    expect(treeOrder()).toEqual(["1. A", "2. B", "3. C"]);
    expect(historyMetas.map((meta) => meta.kind)).toEqual(["gallery.move", "gallery.move"]);

    await undo();
    expect(treeOrder()).toEqual(["1. B", "2. C", "3. A"]);
    await undo();
    expect(treeOrder()).toEqual(["1. A", "2. B", "3. C"]);
  });

  it("detaches before an element with inherited fit and stable snapshot redo ID", async () => {
    const saved = { value: null as Presentation | null };
    await mount(conversionPresentation(), async (snapshot) => {
      saved.value = snapshot;
    });

    const source = galleryItemButton(0).parentElement!;
    const target = treeButtonStartingWith("Text").parentElement!;
    await drag(source, target, 1);
    await act(async () => inspectorTab().click());

    expect(historyMetas).toEqual([{
      kind: "gallery.detach",
      labelKey: "history.element.setting",
      labelParams: { setting: "gallery.detach" },
    }]);
    expect((host.querySelector("#image-src") as HTMLTextAreaElement).value).toBe("/photo.png");
    expect((host.querySelector("#image-alt") as HTMLTextAreaElement).value).toBe("Photo");
    expect((host.querySelector("#image-fit") as HTMLSelectElement).value).toBe("contain");
    expect((host.querySelector("#image-crop-x") as HTMLInputElement).value).toBe("10");
    expect((host.querySelector("#image-focal-x") as HTMLInputElement).value).toBe("25");

    await undo();
    await act(async () => elementsTab().click());
    expect(host.querySelector('[data-powershow-id="image-element-3"]')).toBeNull();
    expect(treeOrder()).toEqual(["1. Photo"]);
    await redo();
    const save = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!save) throw new Error("Save button was not rendered");
    await act(async () => save.click());
    expect(saved.value?.slides[0]?.elements.some((element) => element.id === "image-element-3")).toBe(true);
    expect(saved.value?.slides[0]?.elements.some((element) => element.id === "image-element-4")).toBe(false);
  });

  it("detaches inside a Container as one action", async () => {
    const value = presentation([
      galleryElement([{ src: "/photo.png", alt: "Photo" }]),
      {
        id: "container-1",
        type: "container",
        hidden: false,
        children: [],
      },
    ]);
    await mount(value);

    const source = galleryItemButton(0).parentElement!;
    const target = treeButtonStartingWith("Container").parentElement!;
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 100, height: 100 } as DOMRect);
    await drag(source, target, 50);

    expect(historyMetas.map((meta) => meta.kind)).toEqual(["gallery.detach"]);
    expect(treeButtonStartingWith("Image")).toBeTruthy();
    await undo();
    expect(treeOrder()).toEqual(["1. Photo"]);
  });

  it("attaches before, after, and inside Gallery while restoring the full Image on undo", async () => {
    await mount(attachPresentation());

    await drag(
      treeButtonStartingWith("Image").parentElement!,
      galleryItemButton(0).parentElement!,
      -1,
    );
    expect(treeOrder()).toEqual(["1. Source", "2. A", "3. B"]);
    expect(historyMetas.at(-1)).toEqual({
      kind: "gallery.attach",
      labelKey: "history.element.setting",
      labelParams: { setting: "gallery.attach" },
    });
    await undo();
    await act(async () => elementsTab().click());
    await act(async () => treeButtonStartingWith("Image").click());
    await act(async () => inspectorTab().click());
    expect((host.querySelector("#image-src") as HTMLTextAreaElement).value).toBe("/source.png");
    expect((host.querySelector("#image-fit") as HTMLSelectElement).value).toBe("cover");

    await act(async () => elementsTab().click());
    await drag(
      treeButtonStartingWith("Image").parentElement!,
      galleryItemButton(1).parentElement!,
      1,
    );
    expect(historyMetas.map((meta) => meta.kind)).toEqual(["gallery.attach", "gallery.attach"]);
    await undo();

    const galleryRow = treeButtonStartingWith("Gallery").parentElement!;
    vi.spyOn(galleryRow, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 100, height: 100 } as DOMRect);
    await drag(treeButtonStartingWith("Image").parentElement!, galleryRow, 50);
    expect(historyMetas.map((meta) => meta.kind)).toEqual(["gallery.attach", "gallery.attach", "gallery.attach"]);
    expect(treeOrder()).toEqual(["1. A", "2. B", "3. Source"]);
    await undo();
    await redo();
  });

  it("does not create history for invalid structural drops", async () => {
    await mount(invalidDropPresentation());
    const before = treeOrder();

    await act(async () => galleryItemButton(0).parentElement!.dispatchEvent(dragEvent("dragstart", 0)));
    const secondGalleryItem = treeButtons().filter((button) => button.textContent?.trim().startsWith("1."))[1];
    if (!secondGalleryItem) throw new Error("second Gallery item was not rendered");
    await act(async () => secondGalleryItem.parentElement!.dispatchEvent(dragEvent("dragover", -1)));
    await act(async () => secondGalleryItem.parentElement!.dispatchEvent(dragEvent("drop", -1)));

    expect(treeOrder()).toEqual(before);
    expect(historyMetas).toEqual([]);
  });

  it("separates text edit from reorder and keeps consecutive actions undoable", async () => {
    await mount(reorderPresentation());
    await act(async () => galleryItemButton(1).click());
    await act(async () => inspectorTab().click());
    const alt = host.querySelector<HTMLTextAreaElement>("#gallery-gallery-1-item-1-alt");
    if (!alt) throw new Error("Gallery alt control was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("textarea value setter was not found");
    await act(async () => {
      alt.focus();
      setter.call(alt, "Edited");
      alt.dispatchEvent(new Event("input", { bubbles: true }));
      alt.blur();
    });

    await act(async () => elementsTab().click());
    await footerMove(1, "up");
    expect(treeOrder()).toEqual(["1. Edited", "2. A", "3. C"]);
    await undo();
    expect(treeOrder()).toEqual(["1. A", "2. Edited", "3. C"]);
    await act(async () => galleryItemButton(1).click());
    await act(async () => inspectorTab().click());
    expect((host.querySelector("#gallery-gallery-1-item-1-alt") as HTMLTextAreaElement).value).toBe("Edited");
    await undo();
    await act(async () => elementsTab().click());
    await act(async () => galleryItemButton(1).click());
    await act(async () => inspectorTab().click());
    expect((host.querySelector("#gallery-gallery-1-item-1-alt") as HTMLTextAreaElement).value).toBe("B");
  });
});
