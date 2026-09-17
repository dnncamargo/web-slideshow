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

function key(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
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
});
