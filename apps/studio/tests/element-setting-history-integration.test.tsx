// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(element: Record<string, unknown>): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "element-setting-history",
    title: "Element setting history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [element],
    }],
  });
}

function key(keyValue: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: keyValue,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("element setting history integration", () => {
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

  async function mount(element: Record<string, unknown>): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation(element)} />
        </StudioI18nProvider>,
      );
    });
    const canvasElement = container.querySelector<HTMLElement>(
      `[data-powershow-id="${String(element.id)}"]`,
    );
    if (!canvasElement) throw new Error(`element was not rendered: ${String(element.id)}`);
    await act(async () => {
      canvasElement.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
  }

  it("tracks Image fit through undo and redo", async () => {
    await mount({
      type: "image",
      id: "image-history",
      hidden: false,
      src: "/image.png",
      alt: "Image",
      fit: "contain",
    });

    const fit = container.querySelector<HTMLSelectElement>("#image-fit");
    if (!fit) throw new Error("image fit control was not rendered");
    await act(async () => changeSelect(fit, "cover"));
    expect(fit.value).toBe("cover");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#image-fit")?.value).toBe("contain");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#image-fit")?.value).toBe("cover");
  });

  it("tracks Gallery global fit and exact item inherit state", async () => {
    await mount({
      type: "gallery",
      id: "gallery-history",
      hidden: false,
      fit: "contain",
      items: [{ src: "/one.png", alt: "One", fit: "cover" }],
      layout: { width: 400, height: 300 },
    });

    const itemButton = container.querySelector<HTMLButtonElement>(
      '[data-powershow-gallery-select][data-powershow-gallery-index="0"]',
    );
    if (!itemButton) throw new Error("gallery item selector was not rendered");
    await act(async () => itemButton.click());

    const globalFit = container.querySelector<HTMLSelectElement>("#gallery-fit");
    if (!globalFit) throw new Error("gallery fit control was not rendered");

    await act(async () => changeSelect(globalFit, "fill"));
    expect(globalFit.value).toBe("fill");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#gallery-fit")?.value).toBe("contain");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#gallery-fit")?.value).toBe("fill");

    const currentItemButton = container.querySelector<HTMLButtonElement>(
      '[data-powershow-gallery-select][data-powershow-gallery-index="0"]',
    );
    if (!currentItemButton) throw new Error("gallery item selector was not rerendered");
    await act(async () => currentItemButton.click());
    const itemFit = container.querySelector<HTMLSelectElement>("#gallery-gallery-history-item-0-fit");
    if (!itemFit) throw new Error("gallery item fit control was not rendered");
    await act(async () => changeSelect(itemFit, ""));
    const inheritedImage = container.querySelector<HTMLImageElement>(
      '[data-powershow-gallery-index="0"] img',
    );
    expect(itemFit.value).toBe("");
    expect(inheritedImage?.style.objectFit).toBe("fill");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="0"]')?.click());
    expect(container.querySelector<HTMLSelectElement>("#gallery-gallery-history-item-0-fit")?.value).toBe("cover");
    expect(container.querySelector<HTMLImageElement>('[data-powershow-gallery-index="0"] img')?.style.objectFit).toBe("cover");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="0"]')?.click());
    expect(container.querySelector<HTMLSelectElement>("#gallery-gallery-history-item-0-fit")?.value).toBe("");
    expect(container.querySelector<HTMLImageElement>('[data-powershow-gallery-index="0"] img')?.style.objectFit).toBe("fill");
  });

  it("tracks Code show-line-numbers through undo and redo", async () => {
    await mount({
      type: "code",
      id: "code-history",
      hidden: false,
      code: "const value = 1;",
      language: "typescript",
      showLineNumbers: false,
      highlightedLines: [],
    });

    const checkbox = container.querySelector<HTMLInputElement>("#code-show-line-numbers");
    if (!checkbox) throw new Error("code line-number control was not rendered");
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(true);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#code-show-line-numbers")?.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#code-show-line-numbers")?.checked).toBe(true);
  });

  it("tracks Divider orientation and its width/height swap atomically", async () => {
    await mount({
      type: "divider",
      id: "divider-history",
      hidden: false,
      orientation: "horizontal",
      layout: { width: "50%", height: "6px" },
    });

    const orientation = container.querySelector<HTMLSelectElement>("#divider-orientation");
    if (!orientation) throw new Error("divider orientation control was not rendered");
    await act(async () => changeSelect(orientation, "vertical"));
    expect(orientation.value).toBe("vertical");
    expect(container.querySelector<HTMLInputElement>("#divider-width")?.value).toBe("6");
    expect(container.querySelector<HTMLInputElement>("#divider-height")?.value).toBe("50");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#divider-orientation")?.value).toBe("horizontal");
    expect(container.querySelector<HTMLInputElement>("#divider-width")?.value).toBe("50");
    expect(container.querySelector<HTMLInputElement>("#divider-height")?.value).toBe("6");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#divider-orientation")?.value).toBe("vertical");
    expect(container.querySelector<HTMLInputElement>("#divider-width")?.value).toBe("6");
    expect(container.querySelector<HTMLInputElement>("#divider-height")?.value).toBe("50");
  });

  it("tracks Terminal line type without changing line content", async () => {
    await mount({
      type: "terminal",
      id: "terminal-history",
      hidden: false,
      lines: [{ type: "command", content: "echo preserve" }],
    });

    const lineType = container.querySelector<HTMLSelectElement>("#terminal-terminal-history-line-0-type");
    const content = container.querySelector<HTMLTextAreaElement>("#terminal-terminal-history-line-0-content");
    if (!lineType || !content) throw new Error("terminal line controls were not rendered");
    await act(async () => changeSelect(lineType, "output"));
    expect(lineType.value).toBe("output");
    expect(content.value).toContain("echo preserve");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#terminal-terminal-history-line-0-type")?.value).toBe("command");
    expect(container.querySelector<HTMLTextAreaElement>("#terminal-terminal-history-line-0-content")?.value).toContain("echo preserve");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#terminal-terminal-history-line-0-type")?.value).toBe("output");
    expect(container.querySelector<HTMLTextAreaElement>("#terminal-terminal-history-line-0-content")?.value).toContain("echo preserve");
  });

  it("does not create history for an already-current fit selection", async () => {
    await mount({
      type: "image",
      id: "image-noop",
      hidden: false,
      src: "/image.png",
      alt: "Image",
      fit: "contain",
    });

    const fit = container.querySelector<HTMLSelectElement>("#image-fit");
    if (!fit) throw new Error("image fit control was not rendered");
    await act(async () => changeSelect(fit, "contain"));
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLSelectElement>("#image-fit")?.value).toBe("contain");
  });
});
