// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type GalleryElement,
  type Presentation,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import {
  AuthoringHistoryContext,
  type AuthoringHistoryContextValue,
} from "../src/features/editor/authoring-history-context";
import { GalleryInspector } from "../src/features/editor/inspector/gallery-inspector";
import type { HistoryActionMeta } from "../src/features/editor/editor-history-state";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const DEFAULT_ITEM = { src: "/instance-demo.svg", alt: "" };

function galleryElement(items: GalleryElement["items"]): GalleryElement {
  return {
    id: "gallery-1",
    type: "gallery",
    hidden: true,
    layout: { width: 640, height: 360 },
    style: { className: "gallery-style" },
    effect: { opacity: 0.75 },
    fit: "cover",
    items,
  };
}

function presentation(items: GalleryElement["items"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d3a-gallery-item-structure-history",
    title: "CP4D3A Gallery item structure history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{ ...galleryElement(items), hidden: false }],
    }],
  });
}

const THREE_ITEMS: GalleryElement["items"] = [
  {
    src: "/a.png",
    alt: "A",
    fit: "contain",
  },
  {
    src: "/b.png",
    alt: "B",
    fit: "fill",
    crop: { x: 10, y: 20, width: 60, height: 50 },
    focalPoint: { x: 25, y: 70 },
  },
  {
    src: "/c.png",
    alt: "C",
    fit: "cover",
    crop: { x: 0, y: 5, width: 90, height: 80 },
    focalPoint: { x: 80, y: 30 },
  },
];

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

describe("CP4D3A Gallery item structure history", () => {
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

  function selector(index: number): HTMLButtonElement {
    const result = host.querySelector<HTMLButtonElement>(
      `[data-presentation-gallery-select][data-presentation-gallery-index="${index}"]`,
    );
    if (!result) throw new Error(`Gallery selector ${index} was not rendered`);
    return result;
  }

  function addButton(): HTMLButtonElement {
    const result = host.querySelector<HTMLButtonElement>("[data-presentation-gallery-add]");
    if (!result) throw new Error("Gallery add button was not rendered");
    return result;
  }

  function removeButton(): HTMLButtonElement {
    const result = host.querySelector<HTMLButtonElement>("[data-presentation-gallery-remove]");
    if (!result) throw new Error("Gallery remove button was not rendered");
    return result;
  }

  function galleryTextArea(index: number, field: "src" | "alt"): HTMLTextAreaElement {
    const result = host.querySelector<HTMLTextAreaElement>(
      `#gallery-gallery-1-item-${index}-${field}`,
    );
    if (!result) throw new Error(`Gallery item ${index} ${field} was not rendered`);
    return result;
  }

  function gallerySelect(index: number, field: "fit"): HTMLSelectElement {
    const result = host.querySelector<HTMLSelectElement>(
      `#gallery-gallery-1-item-${index}-${field}`,
    );
    if (!result) throw new Error(`Gallery item ${index} ${field} was not rendered`);
    return result;
  }

  async function mountWorkspace(items: GalleryElement["items"]): Promise<void> {
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={presentation(items)} />
      </StudioI18nProvider>,
    ));
    const gallery = host.querySelector<HTMLElement>('[data-presentation-id="gallery-1"]');
    if (!gallery) throw new Error("Gallery was not rendered");
    await act(async () => gallery.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function selectGalleryItem(index: number): Promise<void> {
    await act(async () => selector(index).click());
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

  async function editGalleryAlt(index: number, value: string): Promise<void> {
    const control = galleryTextArea(index, "alt");
    await act(async () => {
      control.focus();
      setTextAreaValue(control, value);
      control.blur();
    });
  }

  it("emits exact Add metadata, appends a fresh default, preserves Gallery fields, and selects it", async () => {
    let state = galleryElement([
      { src: "/one.png", alt: "One" },
      { src: "/two.png", alt: "Two", fit: "contain" },
    ]);
    let selectedItemIndex: number | null = 0;
    const metas: HistoryActionMeta[] = [];
    const history: AuthoringHistoryContextValue = {
      begin: () => undefined,
      update: (_key, callback) => callback(),
      finish: () => undefined,
      discrete: (meta, callback) => {
        metas.push(meta);
        callback();
      },
    };
    const render = () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={history}>
          <GalleryInspector
            element={state}
            selectedItemIndex={selectedItemIndex}
            onSelectedItemIndexChange={(index) => {
              selectedItemIndex = index;
              render();
            }}
            onUpdate={(update) => {
              const next = update(state);
              if (next.type === "gallery") {
                state = next;
                render();
              }
            }}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    );

    await act(async () => render());
    await act(async () => addButton().click());

    expect(metas).toEqual([{
      kind: "gallery.add",
      labelKey: "history.element.setting",
      labelParams: { setting: "gallery.add" },
    }]);
    expect(state.items).toEqual([
      { src: "/one.png", alt: "One" },
      { src: "/two.png", alt: "Two", fit: "contain" },
      DEFAULT_ITEM,
    ]);
    expect(state.id).toBe("gallery-1");
    expect(state.hidden).toBe(true);
    expect(state.fit).toBe("cover");
    expect(state.layout).toEqual({ width: 640, height: 360 });
    expect(state.style).toEqual({ className: "gallery-style" });
    expect(state.effect).toEqual({ opacity: 0.75 });
    expect(selectedItemIndex).toBe(2);
    expect(state.items[2]).not.toBe(DEFAULT_ITEM);
  });

  it("emits exact Remove metadata and removes only the selected middle item", async () => {
    let state = galleryElement(THREE_ITEMS);
    let selectedItemIndex: number | null = 1;
    const metas: HistoryActionMeta[] = [];
    const history: AuthoringHistoryContextValue = {
      begin: () => undefined,
      update: (_key, callback) => callback(),
      finish: () => undefined,
      discrete: (meta, callback) => {
        metas.push(meta);
        callback();
      },
    };
    const render = () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={history}>
          <GalleryInspector
            element={state}
            selectedItemIndex={selectedItemIndex}
            onSelectedItemIndexChange={(index) => {
              selectedItemIndex = index;
              render();
            }}
            onUpdate={(update) => {
              const next = update(state);
              if (next.type === "gallery") {
                state = next;
                render();
              }
            }}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    );

    await act(async () => render());
    await act(async () => removeButton().click());

    expect(metas).toEqual([{
      kind: "gallery.remove",
      labelKey: "history.element.setting",
      labelParams: { setting: "gallery.remove" },
    }]);
    expect(state.items).toEqual([THREE_ITEMS[0], THREE_ITEMS[2]]);
    expect(selectedItemIndex).toBe(1);
    expect(state.items[0]).toBe(THREE_ITEMS[0]);
    expect(state.items[1]).toBe(THREE_ITEMS[2]);
    expect(state.id).toBe("gallery-1");
    expect(state.hidden).toBe(true);
    expect(state.fit).toBe("cover");
    expect(state.layout).toEqual({ width: 640, height: 360 });
    expect(state.style).toEqual({ className: "gallery-style" });
    expect(state.effect).toEqual({ opacity: 0.75 });
  });

  it("works without an AuthoringHistory provider and keeps selection transient", async () => {
    let state = galleryElement([{ src: "/one.png", alt: "One" }]);
    let selectedItemIndex: number | null = 0;
    const render = () => root.render(
      <StudioI18nProvider>
        <GalleryInspector
          element={state}
          selectedItemIndex={selectedItemIndex}
          onSelectedItemIndexChange={(index) => {
            selectedItemIndex = index;
            render();
          }}
          onUpdate={(update) => {
            const next = update(state);
            if (next.type === "gallery") {
              state = next;
              render();
            }
          }}
        />
      </StudioI18nProvider>,
    );

    await act(async () => render());
    await act(async () => addButton().click());
    expect(state.items).toEqual([{ src: "/one.png", alt: "One" }, DEFAULT_ITEM]);
    expect(selectedItemIndex).toBe(1);
    await act(async () => removeButton().click());
    expect(state.items).toEqual([{ src: "/one.png", alt: "One" }]);
    expect(selectedItemIndex).toBe(0);
    expect(host.innerHTML).not.toMatch(/selectedIndex|activeIndex|currentIndex|selectedItem/);
  });

  it("replays Add as one append-only action with exact undo and redo", async () => {
    await mountWorkspace([
      { src: "/one.png", alt: "One" },
      { src: "/two.png", alt: "Two" },
    ]);

    await act(async () => addButton().click());
    expect(selector(2).getAttribute("aria-pressed")).toBe("true");
    expect(galleryTextArea(2, "src").value).toBe(DEFAULT_ITEM.src);
    expect(galleryTextArea(2, "alt").value).toBe("");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(host.querySelector('[data-presentation-gallery-index="2"]')).toBeNull();
    expect(selector(0)).not.toBeNull();
    const secondUndo = await undo();
    expect(secondUndo.defaultPrevented).toBe(false);

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(selector(2)).not.toBeNull();
    await selectGalleryItem(2);
    expect(galleryTextArea(2, "src").value).toBe(DEFAULT_ITEM.src);
    expect(galleryTextArea(2, "alt").value).toBe("");
  });

  it("replays middle Remove exactly, including rich media state, and clamps selection", async () => {
    await mountWorkspace(THREE_ITEMS);
    await selectGalleryItem(1);
    await act(async () => removeButton().click());

    expect(host.querySelector('[data-presentation-gallery-index="2"]')).toBeNull();
    expect(galleryTextArea(1, "src").value).toBe("/c.png");
    expect(galleryTextArea(1, "alt").value).toBe("C");
    expect(gallerySelect(1, "fit").value).toBe("cover");
    expect(selector(1).getAttribute("aria-pressed")).toBe("true");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    await selectGalleryItem(1);
    expect(galleryTextArea(1, "src").value).toBe("/b.png");
    expect(galleryTextArea(1, "alt").value).toBe("B");
    expect(gallerySelect(1, "fit").value).toBe("fill");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-crop-x")?.value).toBe("10");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-focal-x")?.value).toBe("25");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    await selectGalleryItem(1);
    expect(galleryTextArea(1, "src").value).toBe("/c.png");
    expect(galleryTextArea(1, "alt").value).toBe("C");
    expect(gallerySelect(1, "fit").value).toBe("cover");
  });

  it("supports Add to empty and Remove of the last item with exact replay", async () => {
    await mountWorkspace([]);
    await act(async () => addButton().click());
    expect(selector(0).getAttribute("aria-pressed")).toBe("true");
    expect(galleryTextArea(0, "src").value).toBe(DEFAULT_ITEM.src);
    expect((await undo()).defaultPrevented).toBe(true);
    expect(host.querySelector("[data-presentation-gallery-select]")).toBeNull();
    expect((await redo()).defaultPrevented).toBe(true);
    expect(selector(0)).not.toBeNull();

    await mountWorkspace([{
      src: "/authored.png",
      alt: "Authored",
      fit: "fill",
      crop: { x: 2, y: 3, width: 80, height: 70 },
      focalPoint: { x: 40, y: 60 },
    }]);
    await act(async () => removeButton().click());
    expect(host.querySelector("[data-presentation-gallery-select]")).toBeNull();
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "src").value).toBe("/authored.png");
    expect(gallerySelect(0, "fit").value).toBe("fill");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-0-crop-x")?.value).toBe("2");
    expect(host.querySelector<HTMLInputElement>("#gallery-gallery-1-item-0-focal-x")?.value).toBe("40");
    expect((await redo()).defaultPrevented).toBe(true);
    expect(host.querySelector("[data-presentation-gallery-select]")).toBeNull();
  });

  it("separates text then Add and text then Remove into distinct actions", async () => {
    await mountWorkspace(THREE_ITEMS);
    await editGalleryAlt(0, "A edited");
    await act(async () => addButton().click());
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "alt").value).toBe("A edited");
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "alt").value).toBe("A");

    await mountWorkspace(THREE_ITEMS);
    await editGalleryAlt(0, "A edited");
    await selectGalleryItem(1);
    await act(async () => removeButton().click());
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "alt").value).toBe("A edited");
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(0);
    expect(galleryTextArea(0, "alt").value).toBe("A");
  });

  it("keeps Add→Remove and consecutive structural actions separate", async () => {
    await mountWorkspace([{ src: "/a.png", alt: "A" }]);
    await act(async () => addButton().click());
    await act(async () => removeButton().click());
    expect((await undo()).defaultPrevented).toBe(true);
    expect(selector(1)).not.toBeNull();
    expect((await undo()).defaultPrevented).toBe(true);
    expect(host.querySelector('[data-presentation-gallery-index="1"]')).toBeNull();
    expect((await redo()).defaultPrevented).toBe(true);
    expect(selector(1)).not.toBeNull();
    expect((await redo()).defaultPrevented).toBe(true);
    expect(host.querySelector('[data-presentation-gallery-index="1"]')).toBeNull();

    await mountWorkspace([{ src: "/a.png", alt: "A" }]);
    await act(async () => addButton().click());
    await act(async () => addButton().click());
    expect((await undo()).defaultPrevented).toBe(true);
    expect(host.querySelector('[data-presentation-gallery-index="2"]')).toBeNull();
    expect(selector(1)).not.toBeNull();
    expect((await undo()).defaultPrevented).toBe(true);
    expect(host.querySelector('[data-presentation-gallery-index="1"]')).toBeNull();

    await mountWorkspace(THREE_ITEMS);
    await selectGalleryItem(2);
    await act(async () => removeButton().click());
    await act(async () => removeButton().click());
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(1);
    expect(galleryTextArea(1, "src").value).toBe("/b.png");
    expect((await undo()).defaultPrevented).toBe(true);
    await selectGalleryItem(2);
    expect(galleryTextArea(2, "src").value).toBe("/c.png");
  });
});
