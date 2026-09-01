// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "gallery-workspace",
    title: "Gallery workspace",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [
        {
          type: "gallery",
          id: "gallery-1",
          hidden: false,
          fit: "contain",
          items: [
            { src: "/one.png", alt: "One", focalPoint: { x: 10, y: 20 }, crop: { x: 1, y: 2, width: 90, height: 80 } },
            { src: "/two.png", alt: "Two" },
            { src: "/three.png", alt: "Three" },
          ],
        },
        { type: "image", id: "image-1", hidden: false, src: "/other.png", layout: { width: 120, height: 80 } },
      ],
    }],
  });
}

function pointerDown(target: Element): void {
  target.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
}

describe("EditorWorkspace Gallery selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(value = presentation()): Promise<HTMLElement> {
    await act(async () => {
      root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={value} /></StudioI18nProvider>);
    });
    const gallery = container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]');
    if (!gallery) throw new Error("Gallery was not rendered");
    await act(async () => pointerDown(gallery));
    return gallery;
  }

  function item(index: number): HTMLElement {
    const result = container.querySelector<HTMLElement>(`[data-powershow-id="gallery-1"] [data-powershow-gallery-index="${index}"]`);
    if (!result) throw new Error(`Gallery item ${index} was not rendered`);
    return result;
  }

  function selector(index: number): HTMLButtonElement {
    const result = container.querySelector<HTMLButtonElement>(`[data-powershow-gallery-select][data-powershow-gallery-index="${index}"]`);
    if (!result) throw new Error(`Gallery selector ${index} was not rendered`);
    return result;
  }

  function buttonWithText(text: string): HTMLButtonElement {
    const result = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === text);
    if (!result) throw new Error(`Button ${text} was not rendered`);
    return result;
  }

  function treeButtonStartingWith(text: string): HTMLButtonElement {
    const result = Array.from(container.querySelectorAll<HTMLButtonElement>(
      'li[role="treeitem"] button[type="button"]',
    )).find((button) => button.textContent?.trim().startsWith(text));
    if (!result) throw new Error(`Tree button ${text} was not rendered`);
    return result;
  }

  it("initializes item 0 transiently without canonical selection metadata", async () => {
    await mount();
    expect(selector(0).getAttribute("aria-pressed")).toBe("true");
    expect(container.innerHTML).not.toMatch(/selectedIndex|activeIndex|currentIndex|selectedItem|gallerySelection/);
  });

  it("foregrounds a later item while preserving the unsized item-0 sizing owner", async () => {
    await mount();
    expect(item(0).style.position).toBe("relative");
    await act(async () => selector(1).click());

    expect(item(1).style.visibility).toBe("visible");
    expect(item(1).style.pointerEvents).toBe("auto");
    expect(item(1).classList.contains("powershow-gallery-item-active")).toBe(true);
    expect(item(1).getAttribute("aria-hidden")).toBe("false");
    expect(item(0).style.visibility).toBe("hidden");
    expect(item(0).style.display).not.toBe("none");
    expect(item(0).style.position).toBe("relative");
    expect(item(0).getAttribute("aria-hidden")).toBe("true");
  });

  it("converges tree Image selection through the existing Gallery selection path", async () => {
    await mount();

    await act(async () => buttonWithText("Elements").click());
    await act(async () => treeButtonStartingWith("2. Two").click());

    await act(async () => buttonWithText("Inspector").click());
    expect(selector(1).getAttribute("aria-pressed")).toBe("true");

    await act(async () => buttonWithText("Elements").click());
    await act(async () => treeButtonStartingWith("Gallery").click());
    await act(async () => buttonWithText("Inspector").click());
    expect(selector(0).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the Elements tree aligned when the Inspector changes Gallery items", async () => {
    await mount();

    await act(async () => selector(1).click());
    await act(async () => selector(2).click());
    await act(async () => buttonWithText("Elements").click());

    const image2 = treeButtonStartingWith("2. Two").closest('li[role="treeitem"]');
    const image3 = treeButtonStartingWith("3. Three").closest('li[role="treeitem"]');
    expect(image2?.getAttribute("aria-selected")).toBe("false");
    expect(image3?.getAttribute("aria-selected")).toBe("true");
  });

  it("clamps the transient selection when Gallery items shrink", async () => {
    await mount();
    await act(async () => selector(2).click());
    const remove = container.querySelector<HTMLButtonElement>("[data-powershow-gallery-remove]");
    if (!remove) throw new Error("Gallery remove button was not rendered");
    await act(async () => remove.click());
    const source = container.querySelector<HTMLTextAreaElement>("[data-powershow-gallery-src]");
    expect(source?.value).toBe("/two.png");
    expect(selector(1).getAttribute("aria-pressed")).toBe("true");
    expect(container.innerHTML).not.toMatch(/selectedIndex|activeIndex|currentIndex|selectedItem|gallerySelection/);
  });

  it("clears selection on top-level change and restarts at item 0", async () => {
    await mount();
    await act(async () => selector(1).click());
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
    if (!image) throw new Error("Image was not rendered");
    await act(async () => pointerDown(image));
    expect(container.querySelector("[data-powershow-gallery-select]")).toBeNull();
    const galleryAgain = container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]');
    if (!galleryAgain) throw new Error("Gallery was not rendered after reselection");
    await act(async () => pointerDown(galleryAgain));
    expect(selector(0).getAttribute("aria-pressed")).toBe("true");
  });
});
