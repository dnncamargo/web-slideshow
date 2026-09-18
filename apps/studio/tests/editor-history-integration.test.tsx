// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";
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

function richTextPresentation(): Presentation {
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
          fontSize: "16px",
          lineHeight: 1.2,
        },
      }],
    }],
  });
}

function richTextContextPresentation(): Presentation {
  const value = richTextPresentation();
  return { ...value, slides: [value.slides[0]!, { id: "slide-2", title: "Slide 2", summary: "", speakerNotes: "", elements: [] }] };
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

  it("replays deletion and does not undo across an untracked mutation", async () => {
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("Delete")));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((button) => button.textContent?.trim() === "Delete")!.click());
    expect(container.querySelector('[data-powershow-id="image-1"]')).toBeNull();

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="image-1"]')).not.toBeNull();

    const title = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]')!;
    const noOpChange = new Event("input", { bubbles: true });
    await act(async () => title.dispatchEvent(noOpChange));
    const redoAfterNoOp = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoAfterNoOp));
    expect(redoAfterNoOp.defaultPrevented).toBe(true);
    expect(container.querySelector('[data-powershow-id="image-1"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="image-1"]')).not.toBeNull();
    await act(async () => {
      title.value = "Changed";
      title.dispatchEvent(new Event("input", { bubbles: true }));
      title.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const undo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-powershow-id="image-1"]')).not.toBeNull();
  });

  it("restores exact pasted IDs on redo", async () => {
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("c", { ctrlKey: true })));
    await act(async () => window.dispatchEvent(key("v", { ctrlKey: true })));
    const idsAfterPaste = Array.from(container.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-powershow-id]"), (el) => el.dataset.powershowId);
    expect(idsAfterPaste).toHaveLength(2);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-powershow-id]")).toHaveLength(1);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(Array.from(container.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-powershow-id]"), (el) => el.dataset.powershowId)).toEqual(idsAfterPaste);
  });

  it("replays a pending cut without resurrecting Pending Cut", async () => {
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(key("x", { ctrlKey: true })));
    const secondSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[1]!;
    await act(async () => secondSlide.click());
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-powershow-id]")).toHaveLength(0);
    await act(async () => window.dispatchEvent(key("v", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="image-1"]')).toBeNull();
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-powershow-id]")).toHaveLength(1);
    expect(container.querySelector(".powershow-editor-pending-cut")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[0]!.click());
    expect(container.querySelector('[data-powershow-id="image-1"]')).not.toBeNull();
    expect(container.querySelector(".powershow-editor-pending-cut")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']"))[1]!.click());
    expect(container.querySelector('[data-powershow-id="image-1"]')).toBeNull();
    expect(container.querySelector(".powershow-editor-pending-cut")).toBeNull();
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
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
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
    expect(container.querySelector('[data-powershow-id="image-1"]')).toBeNull();
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
    const canvasText = container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!;
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
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-inline-format="bold"]')!.click());
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("ABC");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("A");
  });

  it("groups EffectiveNumberInput changes into one line-height history action", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

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
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

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

  it("keeps EffectiveLengthInput reset separate from numeric editing", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const input = container.querySelector<HTMLInputElement>("#text-font-size")!;
    const canvasText = () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!;
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
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

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
    const canvasText = container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!;
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
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    await act(async () => {
      textarea.focus();
      textarea.setSelectionRange(0, 1);
      textarea.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-inline-color="true"]')!.click());
    const picker = container.querySelector<HTMLInputElement>("#text-inline-color")!;
    const baselineMarkup = container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML;
    await act(async () => {
      changeInput(picker, "#112233");
      changeInput(picker, "#223344");
      changeInput(picker, "#334455");
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const finalMarkup = container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML;
    expect(finalMarkup).not.toBe(baselineMarkup);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-controls="text-inline-color-palette-chooser"]')!.click());
    expect(container.querySelector('[data-powershow-picked-colors] button[aria-label*="#334455"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML).toBe(baselineMarkup);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML).toBe(finalMarkup);
  });

  it("groups inline color text edits and ignores invalid drafts", async () => {
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    await act(async () => { textarea.focus(); textarea.setSelectionRange(0, 1); textarea.dispatchEvent(new Event("select", { bubbles: true })); });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-inline-color="true"]')!.click());
    const field = container.querySelector<HTMLInputElement>("#text-inline-color-value")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(field, "#112233"); field.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(field, "not-a-color"); field.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(field, "#334455"); field.dispatchEvent(new Event("input", { bubbles: true }));
      field.blur();
    });
    const finalMarkup = container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML;
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    const baselineMarkup = container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML;
    expect(baselineMarkup).not.toBe(finalMarkup);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.innerHTML).toBe(finalMarkup);
  });

  it("finalizes RichText when switching slide context", async () => {
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={richTextContextPresentation()} /></StudioI18nProvider>));
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { textarea.focus(); setter.call(textarea, "AB"); textarea.dispatchEvent(new Event("input", { bubbles: true })); setter.call(textarea, "ABC"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']")[1]!.click());
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => container.querySelectorAll<HTMLButtonElement>("[class*='slideItem']")[0]!.click());
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="text-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
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
