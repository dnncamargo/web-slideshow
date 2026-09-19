// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(
  element: Record<string, unknown>,
  linkedStyles: readonly Record<string, unknown>[] = [],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "element-setting-history",
    title: "Element setting history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [element],
    }],
    ...(linkedStyles.length === 0 ? {} : { linkedStyles }),
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

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLTextAreaElement.value setter");
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
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

  async function mountWithLinkedStyles(
    element: Record<string, unknown>,
    linkedStyles: readonly Record<string, unknown>[],
  ): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={presentation(element, linkedStyles)}
          />
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

  it("tracks Container direction as one undoable layout setting", async () => {
    await mount({
      type: "container",
      id: "container-layout-history",
      hidden: false,
      children: [],
      layout: { children: { direction: "column" } },
    });

    const direction = container.querySelector<HTMLSelectElement>("#container-direction");
    if (!direction) throw new Error("container direction control was not rendered");
    await act(async () => changeSelect(direction, "row"));
    expect(direction.value).toBe("row");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#container-direction")?.value).toBe("column");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#container-direction")?.value).toBe("row");
  });

  it("tracks Container Pattern presets atomically and preserves background siblings", async () => {
    await mount({
      type: "container",
      id: "container-pattern-history",
      hidden: false,
      children: [],
      style: { background: { color: "#101820", gradient: { type: "linear", angle: 135, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }] } } },
    });
    const pattern = container.querySelector<HTMLSelectElement>("#container-background-pattern")!;
    await act(async () => changeSelect(pattern, "grid"));
    expect(pattern.value).toBe("grid");
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#101820");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-background-pattern")?.value).toBe("none");
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#101820");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-background-pattern")?.value).toBe("grid");
  });

  it("tracks a same-visible linked Container Pattern as a local override", async () => {
    const grid = { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "32px 32px", repeat: "repeat" };
    await mountWithLinkedStyles(
      { type: "container", id: "container-linked-pattern-history", hidden: false, linkedStyleId: "linked-pattern", children: [] },
      [{ id: "linked-pattern", name: "Linked Pattern", style: { background: { pattern: grid } } }],
    );
    const pattern = container.querySelector<HTMLSelectElement>("#container-background-pattern")!;
    expect(pattern.value).toBe("grid");
    await act(async () => changeSelect(pattern, "grid"));

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-background-pattern")?.value).toBe("grid");
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-background-pattern")?.value).toBe("grid");
  });

  it("keeps Custom Pattern drafts local, then tracks one Apply and restores it", async () => {
    await mount({
      type: "container",
      id: "container-custom-pattern-history",
      hidden: false,
      children: [],
      style: { background: { color: "#101820", gradient: { type: "linear", angle: 135, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }] } } },
      effect: { opacity: 0.6 },
    });
    const pattern = container.querySelector<HTMLSelectElement>("#container-background-pattern")!;
    await act(async () => changeSelect(pattern, "custom"));
    await act(async () => changeTextarea(container.querySelector<HTMLTextAreaElement>("#container-custom-pattern-css")!, "background-color: #223344; background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 20px 20px; background-repeat: repeat;"));
    const draftUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(draftUndo));
    expect(draftUndo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#101820");

    await act(async () => container.querySelector<HTMLButtonElement>("#container-apply-background-pattern")!.click());
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#223344");
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#101820");
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#223344");
  });

  it("does not track a Custom Pattern Apply that preserves the existing local color", async () => {
    await mount({
      type: "container",
      id: "container-equivalent-pattern-history",
      hidden: false,
      children: [],
      style: { background: { color: "#223344", pattern: { image: "radial-gradient(circle, #fff 1px, transparent 1px)", size: "20px 20px", repeat: "repeat" } } },
    });
    await act(async () => changeSelect(container.querySelector<HTMLSelectElement>("#container-background-pattern")!, "custom"));
    await act(async () => changeTextarea(container.querySelector<HTMLTextAreaElement>("#container-custom-pattern-css")!, "background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 20px 20px; background-repeat: repeat;"));
    await act(async () => container.querySelector<HTMLButtonElement>("#container-apply-background-pattern")!.click());
    const noOpUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(noOpUndo));
    expect(noOpUndo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#container-background")?.value).toBe("#223344");
  });

  it("tracks Structured Table Suggest Alternate as one appearance action", async () => {
    await mount({
      type: "table",
      id: "table-appearance-history",
      mode: "structured",
      showHeader: true,
      hidden: false,
      columns: [{ id: "column-1", header: { id: "header-1", children: [{ type: "text", id: "header-text-1", hidden: false, variant: "body", content: "Header" }] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [{ type: "text", id: "cell-text-1", hidden: false, variant: "body", content: "Cell" }] }] }],
      style: { background: { color: "#202020" }, headerBackground: "#303030" },
    });
    const suggest = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Suggest alternate")!;
    await act(async () => suggest.click());
    expect(container.querySelector<HTMLInputElement>("#table-body-row-alternate-background")?.value).toBe("#303030");
    expect(container.querySelector<HTMLInputElement>("#table-header-background")?.value).toBe("#303030");
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector("#table-body-row-alternate-background")).toBeNull();
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#table-body-row-alternate-background")?.value).toBe("#303030");
  });

  it("tracks a same-visible linked Container direction as a local override", async () => {
    await mountWithLinkedStyles(
      { type: "container", id: "container-linked-direction-history", hidden: false, linkedStyleId: "linked", children: [] },
      [{ id: "linked", name: "Linked", layout: { children: { direction: "row" } } }],
    );
    const direction = container.querySelector<HTMLSelectElement>("#container-direction");
    if (!direction) throw new Error("container direction control was not rendered");
    await act(async () => changeSelect(direction, "row"));
    expect(direction.value).toBe("row");
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-direction")?.value).toBe("row");
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-direction")?.value).toBe("row");
  });

  it("tracks Container absolute-to-flow as one atomic position action", async () => {
    await mount({
      type: "container",
      id: "container-position-history",
      hidden: false,
      children: [],
      layout: { position: "absolute", top: 12, right: 24, bottom: 36, left: 48 },
    });
    const mode = container.querySelector<HTMLSelectElement>("#container-position-mode");
    if (!mode) throw new Error("container position control was not rendered");
    await act(async () => changeSelect(mode, "flow"));
    expect(container.querySelector("#container-position-top")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#container-position-mode")?.value).toBe("absolute");
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.value).toBe("12");
    expect(container.querySelector<HTMLInputElement>("#container-position-right")?.value).toBe("24");
    expect(container.querySelector<HTMLInputElement>("#container-position-bottom")?.value).toBe("36");
    expect(container.querySelector<HTMLInputElement>("#container-position-left")?.value).toBe("48");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#container-position-mode")?.value).toBe("flow");
    expect(container.querySelector("#container-position-top")).toBeNull();
  });

  it("coalesces canonical position edges and preserves percentage representation", async () => {
    await mount({
      type: "image",
      id: "canonical-position-history",
      hidden: false,
      src: "/image.png",
      alt: "Image",
      layout: { position: "absolute", top: "10%", left: 4 },
    });

    const top = container.querySelector<HTMLInputElement>("#element-canonical-top")!;
    await act(async () => {
      top.focus();
      changeInput(top, "20%");
      changeInput(top, "30%");
      top.blur();
    });
    expect(top.value).toBe("30%");

    const undoTop = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoTop));
    expect(undoTop.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("10%");

    const redoTop = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoTop));
    expect(redoTop.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("30%");

    const left = container.querySelector<HTMLInputElement>("#element-canonical-left")!;
    await act(async () => {
      left.focus();
      changeInput(left, "9");
      left.blur();
    });
    const undoLeft = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoLeft));
    expect(undoLeft.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("30%");
    expect(container.querySelector<HTMLInputElement>("#element-canonical-left")?.value).toBe("4");

    const undoTopAgain = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoTopAgain));
    expect(undoTopAgain.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("10%");
  });

  it("does not create history for a locally-authored canonical position no-op", async () => {
    await mount({
      type: "image",
      id: "canonical-position-no-op",
      hidden: false,
      src: "/image.png",
      alt: "Image",
      layout: { position: "absolute", top: 10 },
    });

    const top = container.querySelector<HTMLInputElement>("#element-canonical-top")!;
    await act(async () => {
      top.focus();
      changeInput(top, "10");
      top.blur();
    });
    const nativeUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(nativeUndo));
    expect(nativeUndo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("10");
  });

  it("coalesces Container position edges and ignores a local same-value no-op", async () => {
    await mount({
      type: "container",
      id: "container-position-edge-history",
      hidden: false,
      children: [],
      layout: { position: "absolute", top: 10 },
    });

    const top = container.querySelector<HTMLInputElement>("#container-position-top")!;
    await act(async () => {
      top.focus();
      changeInput(top, "20");
      changeInput(top, "30");
      top.blur();
    });
    expect(top.value).toBe("30");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.value).toBe("10");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.value).toBe("30");

    const currentTop = container.querySelector<HTMLInputElement>("#container-position-top")!;
    await act(async () => {
      currentTop.focus();
      changeInput(currentTop, "30");
      currentTop.blur();
    });
    const undoAfterNoOp = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoAfterNoOp));
    expect(undoAfterNoOp.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.value).toBe("10");
    const nativeUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(nativeUndo));
    expect(nativeUndo.defaultPrevented).toBe(false);
  });

  it("tracks a same-visible linked Container position as a local override", async () => {
    await mountWithLinkedStyles(
      { type: "container", id: "container-linked-position-history", hidden: false, linkedStyleId: "linked-position", children: [] },
      [{ id: "linked-position", name: "Linked Position", layout: { position: "absolute", top: 20 } }],
    );

    const top = container.querySelector<HTMLInputElement>("#container-position-top")!;
    expect(top.value).toBe("20");
    await act(async () => {
      top.focus();
      changeInput(top, "21");
      changeInput(top, "20");
      top.blur();
    });
    expect(top.value).toBe("20");
    expect(top.closest("label")?.textContent).toContain("Local override");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.value).toBe("20");
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.closest("label")?.textContent).toContain("Linked");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.value).toBe("20");
    expect(container.querySelector<HTMLInputElement>("#container-position-top")?.closest("label")?.textContent).toContain("Local override");
  });

  it("tracks clearing an inherited Container edge that materializes local absolute positioning", async () => {
    await mountWithLinkedStyles(
      { type: "container", id: "container-linked-clear-position-history", hidden: false, linkedStyleId: "linked-clear-position", children: [] },
      [{ id: "linked-clear-position", name: "Linked Clear Position", layout: { position: "absolute", top: 20 } }],
    );

    const top = container.querySelector<HTMLInputElement>("#container-position-top")!;
    await act(async () => {
      top.focus();
      changeInput(top, "");
      top.blur();
    });
    expect(container.querySelector<HTMLSelectElement>("#container-position-mode")?.value).toBe("absolute");
    expect(container.querySelector<HTMLSelectElement>("#container-position-mode")?.closest("label")?.nextElementSibling?.textContent).toContain("Local override");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-position-mode")?.closest("label")?.nextElementSibling?.textContent).toContain("Linked");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#container-position-mode")?.closest("label")?.nextElementSibling?.textContent).toContain("Local override");
  });

  it("tracks Preserve size for a selected flow child Container", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation({
            type: "container",
            id: "container-preserve-parent-history",
            hidden: false,
            layout: { children: { mode: "flow" } },
            children: [{
              type: "container",
              id: "container-preserve-child-history",
              hidden: false,
              children: [],
            }],
          })} />
        </StudioI18nProvider>,
      );
    });
    const child = container.querySelector<HTMLElement>(
      '[data-powershow-id="container-preserve-child-history"]',
    );
    if (!child) throw new Error("nested Container was not rendered");
    await act(async () => child.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const preserve = container.querySelector<HTMLInputElement>("#container-preserve-size");
    if (!preserve) throw new Error("container preserve-size control was not rendered");
    expect(preserve.checked).toBe(false);
    await act(async () => preserve.click());
    expect(container.querySelector<HTMLInputElement>("#container-preserve-size")?.checked).toBe(true);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#container-preserve-size")?.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#container-preserve-size")?.checked).toBe(true);
  });

  it("tracks Container size presets atomically", async () => {
    await mount({
      type: "container",
      id: "container-size-history",
      hidden: false,
      children: [],
      layout: { width: "41%", height: "43%" },
    });
    const preset = container.querySelector<HTMLSelectElement>("#container-size-preset");
    if (!preset) throw new Error("container size preset control was not rendered");
    await act(async () => changeSelect(preset, "medium"));
    expect(container.querySelector<HTMLInputElement>("#container-width")?.value).toBe("70");
    expect(container.querySelector<HTMLInputElement>("#container-height")?.value).toBe("60");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#container-width")?.value).toBe("41");
    expect(container.querySelector<HTMLInputElement>("#container-height")?.value).toBe("43");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#container-width")?.value).toBe("70");
    expect(container.querySelector<HTMLInputElement>("#container-height")?.value).toBe("60");
  });

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

  it("tracks Topics kind normalization atomically", async () => {
    await mount({
      type: "topics",
      id: "topics-history",
      hidden: false,
      kind: "unordered",
      rootMarkerStyle: "square",
      items: [{
        id: "topic-1",
        content: {
          id: "slot-1",
          children: [{ type: "text", id: "topic-text-1", hidden: false, variant: "body", content: "Topic" }],
        },
        children: [],
      }],
    });

    const kind = container.querySelector<HTMLSelectElement>("#topics-kind")!;
    await act(async () => changeSelect(kind, "ordered"));
    expect(kind.value).toBe("ordered");
    expect(container.querySelector<HTMLSelectElement>("#topics-marker-style")?.value).toBe("decimal");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#topics-kind")?.value).toBe("unordered");
    expect(container.querySelector<HTMLSelectElement>("#topics-marker-style")?.value).toBe("square");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#topics-kind")?.value).toBe("ordered");
    expect(container.querySelector<HTMLSelectElement>("#topics-marker-style")?.value).toBe("decimal");
  });

  it("tracks a Topics kind override when the effective kind comes from a linked style", async () => {
    await mountWithLinkedStyles(
      {
        type: "topics",
        id: "linked-topics-history",
        hidden: false,
        linkedStyleId: "linked-topics",
        items: [{
          id: "topic-1",
          content: {
            id: "slot-1",
            children: [{ type: "text", id: "topic-text-1", hidden: false, variant: "body", content: "Topic" }],
          },
          children: [],
        }],
      },
      [{ target: "topics", id: "linked-topics", name: "Linked topics", kind: "ordered" }],
    );

    const kind = container.querySelector<HTMLSelectElement>("#topics-kind")!;
    expect(kind.value).toBe("ordered");
    await act(async () => changeSelect(kind, "ordered"));

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(kind.value).toBe("ordered");
  });

  it("tracks Topics root marker style and restores the local default", async () => {
    await mount({
      type: "topics",
      id: "topics-marker-history",
      hidden: false,
      kind: "unordered",
      items: [{
        id: "topic-1",
        content: {
          id: "slot-1",
          children: [{ type: "text", id: "topic-text-1", hidden: false, variant: "body", content: "Topic" }],
        },
        children: [],
      }],
    });

    const marker = container.querySelector<HTMLSelectElement>("#topics-marker-style")!;
    await act(async () => changeSelect(marker, "circle"));
    expect(marker.value).toBe("circle");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#topics-marker-style")?.value).toBe("");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#topics-marker-style")?.value).toBe("circle");
  });

  it("tracks Plot fitToAxes and showAxes as independent actions", async () => {
    await mount({ type: "plot", id: "plot-booleans-history", hidden: false, source: "y = x" });
    const fit = container.querySelector<HTMLInputElement>("#plot-fit-to-axes")!;
    const axes = container.querySelector<HTMLInputElement>("#plot-show-axes")!;

    await act(async () => fit.click());
    expect(fit.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(fit.checked).toBe(true);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(fit.checked).toBe(false);

    await act(async () => axes.click());
    expect(axes.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(axes.checked).toBe(true);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(axes.checked).toBe(false);
    expect(fit.checked).toBe(false);
  });

  it("tracks Plot Z color mode while preserving unrelated style", async () => {
    await mount({
      type: "plot",
      id: "plot-z-history",
      hidden: false,
      source: "z = x + y",
      style: { color: "#ff0000", background: { color: "#000000" } },
    });
    const mode = container.querySelector<HTMLSelectElement>("#plot-z-color-mode")!;
    await act(async () => changeSelect(mode, "z"));
    expect(mode.value).toBe("z");
    expect(container.querySelector("#plot-z-min-color")).not.toBeNull();
    expect(container.querySelector("#plot-z-max-color")).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#plot-z-color-mode")?.value).toBe("solid");
    expect(container.querySelector("#plot-z-min-color")).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLSelectElement>("#plot-z-color-mode")?.value).toBe("z");
    expect(container.querySelector("#plot-z-min-color")).not.toBeNull();
  });

  it("keeps Plot animation drafts local until Apply, then tracks one action", async () => {
    await mount({ type: "plot", id: "plot-animation-history", hidden: false, source: "y = x + t" });
    const enabled = container.querySelector<HTMLInputElement>("#plot-animation-enabled")!;
    await act(async () => enabled.click());
    const parameter = container.querySelector<HTMLInputElement>("#plot-animation-parameter")!;
    const from = container.querySelector<HTMLInputElement>("#plot-animation-from")!;
    const to = container.querySelector<HTMLInputElement>("#plot-animation-to")!;
    const duration = container.querySelector<HTMLInputElement>("#plot-animation-duration")!;
    await act(async () => {
      changeInput(parameter, "phase");
      changeInput(from, "-2");
      changeInput(to, "3");
      changeInput(duration, "2500");
    });
    const nativeUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(nativeUndo));
    expect(nativeUndo.defaultPrevented).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>("#plot-animation-apply")!.click());
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#plot-animation-parameter")?.value).toBe("phase");
  });

  it("tracks Plot animation removal and leaves equivalent Apply as a no-op", async () => {
    await mount({
      type: "plot",
      id: "plot-animation-remove-history",
      hidden: false,
      source: "y = x + t",
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
    });
    const enabled = container.querySelector<HTMLInputElement>("#plot-animation-enabled")!;
    const equivalentApply = container.querySelector<HTMLButtonElement>("#plot-animation-apply")!;
    await act(async () => equivalentApply.click());
    const noOpUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(noOpUndo));
    expect(noOpUndo.defaultPrevented).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);

    await act(async () => enabled.click());
    await act(async () => container.querySelector<HTMLButtonElement>("#plot-animation-apply")!.click());
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(false);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>("#plot-animation-apply")!.click());
    expect(container.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);
  });
});
