// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ContainerElement,
  type Presentation,
} from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LINKED_FIT = { mode: "contain", sourceWidth: 800, sourceHeight: 600 } as const;

function containerElement(overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    id: "container-fit-history",
    type: "container",
    hidden: false,
    children: [],
    ...overrides,
  };
}

function presentation(
  element: ContainerElement,
  linkedStyles?: readonly Record<string, unknown>[],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4e4-container-fit-history",
    title: "CP4E4 Container Fit history",
    slides: [{ id: "slide-1", title: "Slide 1", elements: [element] }],
    ...(linkedStyles === undefined ? {} : { linkedStyles }),
  });
}

function key(options: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "z",
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
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

describe("CP4E4 Container Fit history integration", () => {
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
    initial: Presentation,
    saved: Presentation[],
  ): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initial}
            onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          />
        </StudioI18nProvider>,
      );
    });
  }

  async function selectContainer(): Promise<void> {
    const element = host.querySelector<HTMLElement>("[data-powershow-id='container-fit-history']");
    if (!element) throw new Error("Container was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function fitSelect(): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>("#container-children-fit");
    if (!select) throw new Error("Container Fit select was not rendered");
    return select;
  }

  function renderedContainer(): HTMLElement {
    const element = host.querySelector<HTMLElement>("[data-powershow-id='container-fit-history']");
    if (!element) throw new Error("Rendered Container was not found");
    return element;
  }

  function setMeasuredContent(
    width: number,
    height: number,
    padding: Partial<Record<"paddingLeft" | "paddingRight" | "paddingTop" | "paddingBottom", string>> = {},
  ): void {
    const element = renderedContainer();
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: width },
      clientHeight: { configurable: true, value: height },
    });
    Object.assign(element.style, padding);
  }

  async function save(saved: Presentation[]): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  function containerFrom(snapshot: Presentation): ContainerElement {
    const element = snapshot.slides[0]?.elements[0];
    if (element?.type !== "container") throw new Error("Container was not found");
    return element;
  }

  function resetFit(): HTMLButtonElement {
    const button = fitSelect().closest("label")?.nextElementSibling?.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("Container Fit Reset button was not rendered");
    return button;
  }

  it("authors first activation from measured content and replays the exact snapshot", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(containerElement()), saved);
    await selectContainer();
    setMeasuredContent(840, 440, {
      paddingLeft: "20px",
      paddingRight: "20px",
      paddingTop: "20px",
      paddingBottom: "20px",
    });

    await act(async () => changeSelect(fitSelect(), "contain"));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual({
      mode: "contain",
      sourceWidth: 800,
      sourceHeight: 400,
    });

    const undo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(containerFrom(await save(saved)).layout?.children?.fit).toBeUndefined();

    setMeasuredContent(1200, 900);
    const redo = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual({
      mode: "contain",
      sourceWidth: 800,
      sourceHeight: 400,
    });
  });

  it("rejects invalid first measurement without creating history", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(containerElement()), saved);
    await selectContainer();
    setMeasuredContent(40, 100, { paddingLeft: "40px" });

    await act(async () => changeSelect(fitSelect(), "contain"));
    expect(host.textContent).toContain("Container must have a measurable content size");
    expect(saved).toHaveLength(0);

    const undo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("tracks local mode switches, preserves source dimensions, and ignores a same-mode no-op", async () => {
    const saved: Presentation[] = [];
    const initial = presentation(containerElement({
      layout: { children: { fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 } } },
    }));
    await mount(initial, saved);
    await selectContainer();
    setMeasuredContent(1200, 900);

    await act(async () => changeSelect(fitSelect(), "contain"));
    const noOpUndo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(noOpUndo));
    expect(noOpUndo.defaultPrevented).toBe(false);

    await act(async () => changeSelect(fitSelect(), "cover"));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual({
      mode: "cover",
      sourceWidth: 800,
      sourceHeight: 400,
    });
    const undo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual({
      mode: "contain",
      sourceWidth: 800,
      sourceHeight: 400,
    });
    const redo = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(containerFrom(await save(saved)).layout?.children?.fit?.mode).toBe("cover");
  });

  it("removes local Fit while preserving sibling and unrelated Container fields", async () => {
    const saved: Presentation[] = [];
    const initialContainer = containerElement({
      hidden: false,
      role: "main",
      layout: {
        position: "absolute",
        width: 640,
        children: {
          mode: "flow",
          direction: "row",
          gap: 16,
          distribution: "space-between",
          horizontalAlign: "center",
          verticalAlign: "end",
          fit: { mode: "cover", sourceWidth: 800, sourceHeight: 400 },
        },
      },
      style: { color: "#ffffff" },
      typography: { fontSize: 20 },
      effect: { opacity: 0.8 },
      link: { kind: "url", href: "https://example.test" },
    });
    await mount(presentation(initialContainer), saved);
    await selectContainer();

    await act(async () => changeSelect(fitSelect(), ""));
    const removed = containerFrom(await save(saved));
    expect(removed.layout?.children).toEqual({
      mode: "flow",
      direction: "row",
      gap: 16,
      distribution: "space-between",
      horizontalAlign: "center",
      verticalAlign: "end",
    });
    expect(removed).toMatchObject({
      id: initialContainer.id,
      hidden: false,
      role: "main",
      style: initialContainer.style,
      typography: initialContainer.typography,
      effect: initialContainer.effect,
      link: initialContainer.link,
    });

    const undo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual(initialContainer.layout?.children?.fit);
    const redo = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toBeUndefined();
  });

  it("materializes a linked Fit override without measuring and keeps the linked style exact", async () => {
    const saved: Presentation[] = [];
    const linkedStyles = [{ id: "linked-fit", name: "Linked Fit", layout: { children: { fit: LINKED_FIT } } }];
    const initial = presentation(containerElement({ linkedStyleId: "linked-fit" }), linkedStyles);
    await mount(initial, saved);
    await selectContainer();

    await act(async () => changeSelect(fitSelect(), "cover"));
    const overridden = await save(saved);
    expect(containerFrom(overridden).layout?.children?.fit).toEqual({
      mode: "cover",
      sourceWidth: 800,
      sourceHeight: 600,
    });
    expect(overridden.linkedStyles?.[0]?.layout?.children?.fit).toEqual(LINKED_FIT);

    const undo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    const undone = await save(saved);
    expect(containerFrom(undone).layout?.children?.fit).toBeUndefined();
    expect(fitSelect().value).toBe("contain");
    expect(undone.linkedStyles?.[0]?.layout?.children?.fit).toEqual(LINKED_FIT);

    const redo = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual({
      mode: "cover",
      sourceWidth: 800,
      sourceHeight: 600,
    });
  });

  it("resets a linked local Fit override and replays it independently", async () => {
    const saved: Presentation[] = [];
    const linkedStyles = [{ id: "linked-fit", name: "Linked Fit", layout: { children: { fit: LINKED_FIT } } }];
    const initial = presentation(containerElement({
      linkedStyleId: "linked-fit",
      layout: { children: { fit: { mode: "cover", sourceWidth: 800, sourceHeight: 600 } } },
    }), linkedStyles);
    await mount(initial, saved);
    await selectContainer();

    await act(async () => resetFit().click());
    const reset = await save(saved);
    expect(containerFrom(reset).layout?.children?.fit).toBeUndefined();
    expect(fitSelect().value).toBe("contain");
    expect(reset.linkedStyles?.[0]?.layout?.children?.fit).toEqual(LINKED_FIT);

    const undo = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toEqual({
      mode: "cover",
      sourceWidth: 800,
      sourceHeight: 600,
    });
    const redo = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(containerFrom(await save(saved)).layout?.children?.fit).toBeUndefined();
  });

  it("separates a continuous Container edit from Fit and keeps consecutive Fit actions independent", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(containerElement({ layout: { children: { gap: 8 } } })), saved);
    await selectContainer();
    const gap = host.querySelector<HTMLInputElement>("#container-gap");
    if (!gap) throw new Error("Container gap input was not rendered");
    await act(async () => {
      gap.focus();
      changeInput(gap, "24");
      gap.blur();
    });

    setMeasuredContent(800, 400);
    await act(async () => changeSelect(fitSelect(), "contain"));
    await act(async () => changeSelect(fitSelect(), "cover"));
    await act(async () => changeSelect(fitSelect(), "fill"));
    expect(containerFrom(await save(saved)).layout?.children?.fit?.mode).toBe("fill");

    const undoFill = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undoFill));
    expect(containerFrom(await save(saved)).layout?.children).toMatchObject({ gap: 24, fit: { mode: "cover" } });
    const undoCover = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undoCover));
    expect(containerFrom(await save(saved)).layout?.children).toMatchObject({ gap: 24, fit: { mode: "contain" } });
    const undoContain = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undoContain));
    expect(containerFrom(await save(saved)).layout?.children).toEqual({ gap: 24 });
    const undoGap = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(undoGap));
    expect(containerFrom(await save(saved)).layout?.children).toEqual({ gap: 8 });
  });
});
