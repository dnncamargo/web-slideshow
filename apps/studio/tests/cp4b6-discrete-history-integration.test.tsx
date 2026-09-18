// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(focalPoint: { x: number; y: number } = { x: 25, y: 75 }): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4b6-discrete-history",
    title: "CP4B6 discrete history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          type: "image",
          id: "cp4b6-image",
          hidden: false,
          src: "/image.png",
          alt: "Image",
          crop: { x: 10, y: 20, width: 60, height: 50 },
          focalPoint,
        },
        {
          type: "gallery",
          id: "cp4b6-gallery",
          hidden: false,
          fit: "contain",
          items: [
            { src: "/one.png", alt: "One", crop: { x: 3, y: 4, width: 80, height: 70 }, focalPoint: { x: 10, y: 20 } },
            { src: "/two.png", alt: "Two", focalPoint: { x: 70, y: 80 } },
          ],
        },
        {
          type: "blocks",
          id: "cp4b6-blocks",
          hidden: false,
          source: "\\statement(move)",
        },
        {
          type: "table",
          id: "cp4b6-simple-table",
          hidden: false,
          columns: [{ key: "value", label: "Value" }, { key: "flag", label: "Flag" }],
          rows: [{ value: "42", flag: true }],
        },
        {
          type: "table",
          id: "cp4b6-structured-table",
          mode: "structured",
          showHeader: true,
          hidden: false,
          columns: [{
            id: "cp4b6-column",
            header: {
              id: "cp4b6-header",
              children: [{ type: "text", id: "cp4b6-header-text", hidden: false, variant: "body", content: "Header" }],
            },
          }],
          rows: [{
            id: "cp4b6-row",
            cells: [{
              id: "cp4b6-cell",
              children: [{ type: "text", id: "cp4b6-cell-text", hidden: false, variant: "body", content: "Cell" }],
            }],
          }],
        },
      ],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CP4B6 discrete authoring history", () => {
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

  async function mount(next = presentation()): Promise<void> {
    await act(async () => {
      root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={next} /></StudioI18nProvider>);
    });
  }

  async function selectElement(id: string): Promise<void> {
    const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function preset(label: string): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!button) throw new Error(`focal preset ${label} was not rendered`);
    return button;
  }

  function button(text: string): HTMLButtonElement {
    const result = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes(text));
    if (!result) throw new Error(`button ${text} was not rendered`);
    return result;
  }

  function input(id: string): HTMLInputElement {
    const result = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!result) throw new Error(`input ${id} was not rendered`);
    return result;
  }

  it("tracks Image focal presets, crop reset, focal reset, and exact replay", async () => {
    await mount();
    await selectElement("cp4b6-image");

    await act(async () => preset("Bottom right").click());
    expect(input("image-focal-x").value).toBe("100");
    expect(input("image-focal-y").value).toBe("100");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("image-focal-x").value).toBe("25");
    expect(input("image-focal-y").value).toBe("75");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("image-focal-x").value).toBe("100");
    expect(input("image-focal-y").value).toBe("100");

    await act(async () => button("Reset crop").click());
    expect(input("image-crop-x").value).toBe("0");
    expect(input("image-crop-y").value).toBe("0");
    expect(input("image-crop-width").value).toBe("100");
    expect(input("image-crop-height").value).toBe("100");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("image-crop-x").value).toBe("10");
    expect(input("image-crop-y").value).toBe("20");
    expect(input("image-crop-width").value).toBe("60");
    expect(input("image-crop-height").value).toBe("50");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("image-crop-width").value).toBe("100");

    await act(async () => button("Reset to center").click());
    expect(input("image-focal-x").value).toBe("50");
    expect(input("image-focal-y").value).toBe("50");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("image-focal-x").value).toBe("100");
    expect(input("image-focal-y").value).toBe("100");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("image-focal-x").value).toBe("50");
  });

  it("does not create history for an already-authored identical focal preset", async () => {
    await mount(presentation({ x: 100, y: 100 }));
    await selectElement("cp4b6-image");
    await act(async () => preset("Bottom right").click());
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("tracks focal presets through the selected Gallery item only", async () => {
    await mount();
    await selectElement("cp4b6-gallery");
    await act(async () => preset("Bottom right").click());
    expect(input("gallery-cp4b6-gallery-item-0-focal-x").value).toBe("100");
    expect(input("gallery-cp4b6-gallery-item-0-focal-y").value).toBe("100");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select="true"][data-powershow-gallery-index="1"]')?.click());
    expect(input("gallery-cp4b6-gallery-item-1-focal-x").value).toBe("70");
    expect(input("gallery-cp4b6-gallery-item-1-focal-y").value).toBe("80");
    expect(container.querySelector<HTMLTextAreaElement>('[data-powershow-gallery-src="true"]')?.value).toBe("/two.png");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select="true"][data-powershow-gallery-index="0"]')?.click());
    expect(input("gallery-cp4b6-gallery-item-0-focal-x").value).toBe("10");
    expect(input("gallery-cp4b6-gallery-item-0-focal-y").value).toBe("20");
    expect(input("gallery-cp4b6-gallery-item-0-crop-width").value).toBe("80");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select="true"][data-powershow-gallery-index="0"]')?.click());
    expect(input("gallery-cp4b6-gallery-item-0-focal-x").value).toBe("100");
    expect(input("gallery-cp4b6-gallery-item-0-focal-y").value).toBe("100");
  });

  it("tracks Blocks toolbar insertion while preserving insertion semantics", async () => {
    await mount();
    await selectElement("cp4b6-blocks");
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const original = textarea.value;
    textarea.setSelectionRange(original.length, original.length);
    await act(async () => button("EV").click());
    expect(textarea.value).toBe(`${original}\\start()`);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(original);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(`${original}\\start()`);
  });

  it("tracks Simple Table cell type and boolean value as separate actions", async () => {
    await mount();
    await selectElement("cp4b6-simple-table");
    const type = container.querySelector<HTMLSelectElement>("#table-cp4b6-simple-table-row-0-column-value-0-type")!;
    await act(async () => changeSelect(type, "number"));
    expect(type.value).toBe("number");
    expect(input("table-cp4b6-simple-table-row-0-column-value-0-value").value).toBe("42");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(type.value).toBe("string");
    expect(input("table-cp4b6-simple-table-row-0-column-value-0-value").value).toBe("42");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(type.value).toBe("number");

    const booleanType = container.querySelector<HTMLSelectElement>("#table-cp4b6-simple-table-row-0-column-flag-1-type")!;
    const booleanValue = container.querySelector<HTMLSelectElement>("#table-cp4b6-simple-table-row-0-column-flag-1-value")!;
    expect(booleanType.value).toBe("boolean");
    await act(async () => changeSelect(booleanValue, "false"));
    expect(booleanValue.value).toBe("false");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(booleanValue.value).toBe("true");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(booleanValue.value).toBe("false");
  });

  it("tracks Structured Table showHeader at the Workspace boundary", async () => {
    await mount();
    await selectElement("cp4b6-structured-table");
    const checkbox = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .find((candidate) => candidate.parentElement?.textContent?.includes("Show header"));
    if (!checkbox) throw new Error("showHeader checkbox was not rendered");
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(checkbox.checked).toBe(true);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(checkbox.checked).toBe(false);
  });
});
