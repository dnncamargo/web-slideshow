// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type ElementLink,
  type Presentation,
} from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(slides = 2): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "history-integration",
    title: "History integration",
    slides: Array.from({ length: slides }, (_, index) => ({
      id: `slide-${index + 1}`,
      title: `Slide ${index + 1}`,
      elements: index === 0 ? [{
        type: "image",
        id: "image-1",
        hidden: false,
        src: "/image.png",
        alt: "Example",
      }] : [],
    })),
  });
}

function richTextPresentation(link?: ElementLink): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "rich-text-history",
    title: "Rich text history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{
        type: "text",
        id: "text-1",
        hidden: false,
        variant: "body",
        content: "A",
        typography: {
          fontFamily: "Arial",
          fontSize: "16px",
          lineHeight: 1.2,
          textAlign: "left",
        },
        ...(link === undefined ? {} : { link }),
      }],
    }],
  });
}

function richTextContextPresentation(): Presentation {
  const value = richTextPresentation();
  return { ...value, slides: [value.slides[0]!, { id: "slide-2", title: "Slide 2", summary: "", speakerNotes: "", elements: [] }] };
}

function sharedAppearancePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "shared-appearance-history",
    title: "Shared appearance history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{
        type: "image",
        id: "image-1",
        hidden: false,
        src: "/image.png",
        alt: "Example",
        layout: { position: "absolute", top: 11, right: 22, bottom: 33, left: 44 },
        style: { border: { width: 2, style: "solid", color: "#111111" } },
      }],
    }],
  });
}

function effectsHistoryPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "effects-history",
    title: "Effects history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          type: "text",
          id: "text-effects-1",
          hidden: false,
          variant: "body",
          content: "Effects",
          typography: { fontFamily: "Arial", fontSize: "16px", lineHeight: 1.2, textAlign: "left" },
          effect: { shadow: { x: 17, y: -9, blur: 23, spread: 4, color: "#123456" } },
        },
        {
          type: "image",
          id: "image-effects-1",
          hidden: false,
          src: "/image.png",
          alt: "Example",
          effect: { shadow: { x: 5, y: 6, blur: 7, spread: 2, color: "#654321" } },
        },
      ],
    }],
  });
}

function containerPreserveHistoryPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "container-preserve-history",
    title: "Container preserve history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        { type: "text", id: "a", hidden: false, variant: "body", content: "A", typography: { fontFamily: "Arial", fontSize: "16px", lineHeight: 1.2, textAlign: "left" } },
        {
          type: "container",
          id: "w",
          hidden: false,
          children: [
            { type: "text", id: "b", hidden: false, variant: "body", content: "B", typography: { fontFamily: "Arial", fontSize: "16px", lineHeight: 1.2, textAlign: "left" } },
            {
              type: "container",
              id: "inner",
              hidden: false,
              children: [{ type: "text", id: "c", hidden: false, variant: "body", content: "C", typography: { fontFamily: "Arial", fontSize: "16px", lineHeight: 1.2, textAlign: "left" } }],
            },
          ],
          layout: { width: "70%", padding: 12, children: { direction: "column", gap: 6 } },
          style: { background: { color: "#123456" }, border: { width: 2, style: "solid", color: "#abcdef" } },
          effect: { shadow: { x: 1, y: 2, blur: 3, spread: 0, color: "#000000" } },
        },
        { type: "text", id: "d", hidden: false, variant: "body", content: "D", typography: { fontFamily: "Arial", fontSize: "16px", lineHeight: 1.2, textAlign: "left" } },
      ],
    }],
  });
}

function key(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.includes(text),
  );
}

describe("EditorWorkspace history integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={presentation()} /></StudioI18nProvider>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("preserves a container's children as one undoable and redoable action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={containerPreserveHistoryPresentation()} /></StudioI18nProvider>));

    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="w"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("Delete")));
    const preserve = buttonByText(container, "Delete container, keep children");
    expect(preserve).toBeDefined();
    await act(async () => preserve!.click());

    expect(container.querySelector('[data-presentation-id="w"]')).toBeNull();
    expect(Array.from(container.querySelectorAll<HTMLElement>("[data-presentation-id]"), (element) => element.dataset.presentationId)).toEqual(["a", "b", "inner", "c", "d"]);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-presentation-id="w"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="b"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="inner"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="c"]')).not.toBeNull();

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-presentation-id="w"]')).toBeNull();
    expect(Array.from(container.querySelectorAll<HTMLElement>("[data-presentation-id]"), (element) => element.dataset.presentationId)).toEqual(["a", "b", "inner", "c", "d"]);

    const historyButton = buttonByText(container, "History");
    expect(historyButton).toBeDefined();
    await act(async () => historyButton!.click());
    expect(container.textContent).toContain("Delete container, keep children");
  });

  it("replays deletion and does not undo across an untracked mutation", async () => {
    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("Delete")));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((button) => button.textContent?.trim() === "Delete")!.click());
    expect(container.querySelector('[data-presentation-id="image-1"]')).toBeNull();

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-presentation-id="image-1"]')).not.toBeNull();

    const title = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')!;
    const noOpChange = new Event("input", { bubbles: true });
    await act(async () => title.dispatchEvent(noOpChange));
    const redoAfterNoOp = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoAfterNoOp));
    expect(redoAfterNoOp.defaultPrevented).toBe(true);
    expect(container.querySelector('[data-presentation-id="image-1"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-presentation-id="image-1"]')).not.toBeNull();
    await act(async () => {
      title.value = "Changed";
      title.dispatchEvent(new Event("input", { bubbles: true }));
      title.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const undo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-presentation-id="image-1"]')).not.toBeNull();
  });

  it("restores exact pasted IDs on redo", async () => {
    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("c", { ctrlKey: true })));
    await act(async () => window.dispatchEvent(key("v", { ctrlKey: true })));
    const idsAfterPaste = Array.from(container.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-presentation-id]"), (el) => el.dataset.presentationId);
    expect(idsAfterPaste).toHaveLength(2);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]")).toHaveLength(1);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(Array.from(container.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-presentation-id]"), (el) => el.dataset.presentationId)).toEqual(idsAfterPaste);
  });

  it("replays a pending cut without resurrecting Pending Cut", async () => {
    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("x", { ctrlKey: true })));
    const secondSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[1]!;
    await act(async () => secondSlide.click());
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]")).toHaveLength(0);
    await act(async () => window.dispatchEvent(key("v", { ctrlKey: true })));
    expect(container.querySelector('[data-presentation-id="image-1"]')).toBeNull();
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]")).toHaveLength(1);
    expect(container.querySelector(".studio-editor-pending-cut")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[0]!.click());
    expect(container.querySelector('[data-presentation-id="image-1"]')).not.toBeNull();
    expect(container.querySelector(".studio-editor-pending-cut")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[1]!.click());
    expect(container.querySelector('[data-presentation-id="image-1"]')).toBeNull();
    expect(container.querySelector(".studio-editor-pending-cut")).toBeNull();
  });

  it("replays slide add, delete, duplicate, and move actions", async () => {
    const openNewSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("New slide"))!;
    await act(async () => openNewSlide.click());
    const createNewSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ New")!;
    await act(async () => createNewSlide.click());
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(3);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(2);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(3);

    const duplicate = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Duplicate")!;
    await act(async () => duplicate.click());
    const duplicateIds = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"), (button) => button.textContent);
    expect(duplicateIds).toHaveLength(4);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(3);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(4);
    const deleteSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Delete")!;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => deleteSlide.click());
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(3);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(4);
    const up = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "↑ Up")!;
    const beforeMove = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"), (button) => button.textContent);
    await act(async () => up.click());
    const afterMove = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"), (button) => button.textContent);
    expect(afterMove).not.toEqual(beforeMove);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"), (button) => button.textContent)).toEqual(beforeMove);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"), (button) => button.textContent)).toEqual(afterMove);
  });

  it("keeps editable targets native and redoes with the modified shortcut", async () => {
    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("Delete")));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((button) => button.textContent?.trim() === "Delete")!.click());
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')!;
    const editableUndo = key("z", { ctrlKey: true });
    await act(async () => input.dispatchEvent(editableUndo));
    expect(editableUndo.defaultPrevented).toBe(false);
    const outsideUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(outsideUndo));
    expect(outsideUndo.defaultPrevented).toBe(true);
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector('[data-presentation-id="image-1"]')).toBeNull();
  });

  it("groups presentation title typing into one undoable session", async () => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')!;
    await act(async () => {
      input.focus();
      changeInput(input, "Changed");
      changeInput(input, "Changed again");
      input.blur();
    });

    expect(input.value).toBe("Changed again");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')?.value).toBe("History integration");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')?.value).toBe("Changed again");
  });

  it("groups RichText typing and keeps formatting as a separate action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    const canvasText = container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!;
    await act(async () => canvasText.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      textarea.focus();
      setter.call(textarea, "AB");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(textarea, "ABC");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.blur();
    });
    expect(textarea.value).toBe("ABC");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("A");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("ABC");
    const edited = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    await act(async () => {
      edited.focus();
      edited.setSelectionRange(0, 3);
      edited.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-presentation-inline-format="bold"]')!.click());
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("ABC");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("A");
  });

  it("groups EffectiveNumberInput changes into one line-height history action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const input = container.querySelector<HTMLInputElement>("#text-line-height")!;
    await act(async () => {
      input.focus();
      changeInput(input, "1.3");
      changeInput(input, "1.4");
      changeInput(input, "1.5");
      input.blur();
    });
    expect(input.value).toBe("1.5");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-line-height")?.value).toBe("1.2");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-line-height")?.value).toBe("1.5");
  });

  it("groups EffectiveLengthInput changes into one font-size history action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const input = container.querySelector<HTMLInputElement>("#text-font-size")!;
    await act(async () => {
      input.focus();
      changeInput(input, "17");
      changeInput(input, "18");
      changeInput(input, "19");
      input.blur();
    });
    expect(input.value).toBe("19");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("16");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("19");
  });

  it("tracks a typography select as one discrete history action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const alignment = container.querySelector<HTMLSelectElement>("#text-text-align")!;
    expect(alignment.value).toBe("left");
    await act(async () => changeSelect(alignment, "center"));
    expect(container.querySelector<HTMLSelectElement>("#text-text-align")?.value).toBe("center");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#text-text-align")?.value).toBe("left");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#text-text-align")?.value).toBe("center");
  });

  it("replays shared border paint and gradient type as discrete actions", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={sharedAppearancePresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const repeatedStyle = container.querySelector<HTMLSelectElement>("#image-border-style")!;
    await act(async () => changeSelect(repeatedStyle, "solid"));
    const noOpUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(noOpUndo));
    expect(noOpUndo.defaultPrevented).toBe(false);

    const paint = container.querySelector<HTMLSelectElement>("#image-border-paint")!;
    await act(async () => changeSelect(paint, "gradient"));
    expect(container.querySelector<HTMLSelectElement>("#image-border-gradient-type")?.value).toBe("linear");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#image-border-paint")?.value).toBe("color");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#image-border-paint")?.value).toBe("gradient");

    const gradientType = container.querySelector<HTMLSelectElement>("#image-border-gradient-type")!;
    await act(async () => changeSelect(gradientType, "radial"));
    expect(gradientType.value).toBe("radial");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#image-border-gradient-type")?.value).toBe("linear");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#image-border-gradient-type")?.value).toBe("radial");
  });

  it("preserves text shadow parameters across outer and inset history", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={effectsHistoryPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-effects-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const mode = container.querySelector<HTMLSelectElement>("#text-shadow-mode")!;
    await act(async () => changeSelect(mode, "inset"));
    expect(mode.value).toBe("inset");
    const shadowInputs = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="number"]')).slice(-4);
    expect(shadowInputs().map((input) => input.value)).toEqual(["17", "-9", "23", "4"]);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(mode.value).toBe("outer");
    expect(shadowInputs().map((input) => input.value)).toEqual(["17", "-9", "23", "4"]);
    expect(container.querySelector<HTMLInputElement>("#text-shadow-color-value")?.value).toBe("#123456");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(mode.value).toBe("inset");
    expect(container.querySelector<HTMLInputElement>("#text-shadow-color-value")?.value).toBe("#123456");

    await act(async () => changeSelect(mode, "outer"));
    expect(mode.value).toBe("outer");
  });

  it("tracks image shadow enable/remove and text stroke mode as discrete actions", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={effectsHistoryPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="image-effects-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const imageMode = container.querySelector<HTMLSelectElement>("#image-shadow-mode")!;
    await act(async () => changeSelect(imageMode, "outer"));
    const imageNoOpUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(imageNoOpUndo));
    expect(imageNoOpUndo.defaultPrevented).toBe(false);

    await act(async () => changeSelect(imageMode, "none"));
    expect(imageMode.value).toBe("none");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(imageMode.value).toBe("outer");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(imageMode.value).toBe("none");

    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-effects-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const strokeMode = container.querySelector<HTMLSelectElement>("#text-text-stroke-mode")!;
    await act(async () => changeSelect(strokeMode, "stroke"));
    expect(strokeMode.value).toBe("stroke");
    expect(container.querySelector<HTMLInputElement>("#text-text-stroke-width")?.value).toBe("1");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(strokeMode.value).toBe("none");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(strokeMode.value).toBe("stroke");
  });

  it("replays canonical position normalization as one discrete action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={sharedAppearancePresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
    await act(async () => changeSelect(mode, "flow"));
    expect(container.querySelector("#element-canonical-top")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")?.value).toBe("absolute");
    expect(container.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("11");
    expect(container.querySelector<HTMLInputElement>("#element-canonical-right")?.value).toBe("22");
    expect(container.querySelector<HTMLInputElement>("#element-canonical-bottom")?.value).toBe("33");
    expect(container.querySelector<HTMLInputElement>("#element-canonical-left")?.value).toBe("44");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")?.value).toBe("flow");
  });

  it("tracks one final font-family commit as a discrete history action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const family = container.querySelector<HTMLInputElement>("#text-font-family")!;
    expect(family.value).toBe("Arial");
    await act(async () => {
      family.focus();
      changeInput(family, "MS Sans Serif");
      family.blur();
    });
    expect(container.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("MS Sans Serif");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("Arial");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("MS Sans Serif");
  });

  it("keeps no-link target selection local to the Interaction form", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const target = container.querySelector<HTMLSelectElement>("#text-link-target")!;
    await act(async () => changeSelect(target, "new"));
    expect(target.value).toBe("new");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");
  });

  it("does not create History for unchanged canonical interaction commits", async () => {
    const href = "https://example.com/guide";
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation({ kind: "url", href, target: "_blank" })} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const url = container.querySelector<HTMLInputElement>("#text-link-url")!;
    await act(async () => {
      url.focus();
      url.blur();
    });
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");

    const unchangedTarget = container.querySelector<HTMLSelectElement>("#text-link-target")!;
    await act(async () => changeSelect(unchangedTarget, "new"));

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");
    expect(buttonByText(container, "Remove link")).toBeDefined();
  });

  it("tracks URL commits, target updates, and link removal as separate interaction actions", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const url = container.querySelector<HTMLInputElement>("#text-link-url")!;
    const href = "https://example.com/guide";
    await act(async () => changeInput(url, href));
    expect(buttonByText(container, "Remove link")).toBeUndefined();

    await act(async () => {
      url.focus();
      url.blur();
    });
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);
    expect(buttonByText(container, "Remove link")).toBeDefined();

    await act(async () => {
      const invalid = container.querySelector<HTMLInputElement>("#text-link-url")!;
      invalid.focus();
      changeInput(invalid, "javascript:alert(1)");
      invalid.blur();
    });
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe("");
    expect(buttonByText(container, "Remove link")).toBeUndefined();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);

    await act(async () => changeSelect(container.querySelector<HTMLSelectElement>("#text-link-target")!, "new"));
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("same");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");

    await act(async () => buttonByText(container, "Remove link")?.click());
    expect(buttonByText(container, "Remove link")).toBeUndefined();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe("");
    expect(buttonByText(container, "Remove link")).toBeUndefined();
  });

  it("keeps EffectiveLengthInput reset separate from numeric editing", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const input = container.querySelector<HTMLInputElement>("#text-font-size")!;
    const canvasText = () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!;
    await act(async () => {
      input.focus();
      changeInput(input, "20");
      input.blur();
    });
    expect(canvasText().getAttribute("style")).toContain("font-size:20px");

    const reset = input.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
    expect(reset).not.toBeNull();
    await act(async () => reset?.click());
    expect(canvasText().getAttribute("style")).not.toContain("font-size:20px");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(canvasText().getAttribute("style")).toContain("font-size:20px");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(canvasText().getAttribute("style")).not.toContain("font-size:20px");
  });

  it("keeps EffectiveLengthInput unit conversion as one discrete action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const input = container.querySelector<HTMLInputElement>("#text-font-size")!;
    const unit = container.querySelector<HTMLSelectElement>("#text-font-size-unit")!;
    expect(input.value).toBe("16");
    expect(unit.value).toBe("px");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(unit, "rem");
      unit.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const convertedValue = input.value;
    expect(unit.value).toBe("rem");
    expect(convertedValue).not.toBe("16");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input.value).toBe("16");
    expect(unit.value).toBe("px");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input.value).toBe(convertedValue);
    expect(unit.value).toBe("rem");
  });

  it("leaves native RichText Undo shortcuts untouched", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    const canvasText = container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!;
    await act(async () => canvasText.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    const nativeUndo = key("z", { ctrlKey: true });
    await act(async () => textarea.dispatchEvent(nativeUndo));
    expect(nativeUndo.defaultPrevented).toBe(false);
  });

  it("groups inline picker previews into one color history action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    await act(async () => {
      textarea.focus();
      textarea.setSelectionRange(0, 1);
      textarea.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-presentation-inline-color="true"]')!.click());
    const picker = container.querySelector<HTMLInputElement>("#text-inline-color")!;
    const baselineMarkup = container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML;
    await act(async () => {
      changeInput(picker, "#112233");
      changeInput(picker, "#223344");
      changeInput(picker, "#334455");
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const finalMarkup = container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML;
    expect(finalMarkup).not.toBe(baselineMarkup);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-controls="text-inline-color-palette-chooser"]')!.click());
    expect(container.querySelector('[data-presentation-picked-colors] button[aria-label*="#334455"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML).toBe(baselineMarkup);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML).toBe(finalMarkup);
  });

  it("groups inline color text edits and ignores invalid drafts", async () => {
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    await act(async () => { textarea.focus(); textarea.setSelectionRange(0, 1); textarea.dispatchEvent(new Event("select", { bubbles: true })); });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-presentation-inline-color="true"]')!.click());
    const field = container.querySelector<HTMLInputElement>("#text-inline-color-value")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(field, "#112233"); field.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(field, "not-a-color"); field.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(field, "#334455"); field.dispatchEvent(new Event("input", { bubbles: true }));
      field.blur();
    });
    const finalMarkup = container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML;
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    const baselineMarkup = container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML;
    expect(baselineMarkup).not.toBe(finalMarkup);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.innerHTML).toBe(finalMarkup);
  });

  it("finalizes RichText when switching slide context", async () => {
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextContextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { textarea.focus(); setter.call(textarea, "AB"); textarea.dispatchEvent(new Event("input", { bubbles: true })); setter.call(textarea, "ABC"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']")[1]!.click());
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']")[0]!.click());
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("A");
  });

  it("groups slide title typing and finalizes when changing slide context", async () => {
    const secondSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[1]!;
    await act(async () => secondSlide.click());
    const input = container.querySelector<HTMLInputElement>('input[placeholder]')!;
    await act(async () => {
      input.focus();
      changeInput(input, "Renamed");
      changeInput(input, "Renamed twice");
    });

    expect(input.value).toBe("Renamed twice");
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[0]!.click());
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[1]!.click());
    expect(container.querySelector<HTMLInputElement>('input[placeholder]')?.value).toBe("Slide 2");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>('input[placeholder]')?.value).toBe("Renamed twice");
  });

  it("keeps a title session separate from a tracked Add Slide action", async () => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')!;
    await act(async () => {
      input.focus();
      changeInput(input, "Renamed");
      changeInput(input, "Renamed twice");
    });

    const openNewSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("New slide"))!;
    await act(async () => openNewSlide.click());
    const createNewSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ New")!;
    await act(async () => createNewSlide.click());
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(3);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelectorAll("[class*='slideItem']")).toHaveLength(2);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')?.value).toBe("History integration");
  });

  it("leaves native Undo alone while a title transaction is active", async () => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')!;
    await act(async () => {
      input.focus();
      changeInput(input, "Changed");
    });
    const nativeUndo = key("z", { ctrlKey: true });
    await act(async () => input.dispatchEvent(nativeUndo));
    expect(nativeUndo.defaultPrevented).toBe(false);
  });
});
