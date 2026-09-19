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
    id: "cp4c1e-spacing-history",
    title: "CP4C1E spacing history",
    linkedStyles: [
      {
        id: "linked-padding",
        name: "Linked padding",
        layout: { padding: 20 },
      },
      {
        id: "linked-gap",
        name: "Linked gap",
        layout: {
          children: { mode: "flow", direction: "row", gap: 12 },
        },
      },
      {
        id: "linked-clear",
        name: "Linked clear",
        layout: { margin: 24 },
      },
    ],
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          id: "spacing-element",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Element spacing",
          layout: { margin: 10 },
        },
        {
          id: "spacing-clear",
          type: "code",
          hidden: false,
          code: "clear",
          language: "text",
          showLineNumbers: true,
          highlightedLines: [],
          layout: { margin: 6 },
        },
        {
          id: "spacing-px",
          type: "image",
          hidden: false,
          src: "/image.png",
          alt: "px",
          fit: "contain",
          layout: { margin: "12px" },
        },
        {
          id: "spacing-noop",
          type: "terminal",
          hidden: false,
          lines: [],
          layout: { margin: 12 },
        },
        {
          id: "spacing-container-local",
          type: "container",
          hidden: false,
          children: [],
          layout: { padding: 10, margin: 10, children: { gap: 8 } },
        },
        {
          id: "spacing-linked-padding",
          type: "container",
          hidden: false,
          children: [],
          linkedStyleId: "linked-padding",
        },
        {
          id: "spacing-linked-gap",
          type: "container",
          hidden: false,
          children: [],
          linkedStyleId: "linked-gap",
        },
        {
          id: "spacing-linked-clear",
          type: "container",
          hidden: false,
          children: [],
          linkedStyleId: "linked-clear",
        },
      ],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C1E continuous spacing history", () => {
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

  async function mount(initial = presentation()): Promise<Presentation> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} /></StudioI18nProvider>));
    return initial;
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id: string): HTMLInputElement {
    const result = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!result) throw new Error(`input ${id} was not rendered`);
    return result;
  }

  function labelText(id: string): string {
    return input(id).closest("label")?.textContent ?? "";
  }

  function sourceText(id: string): string {
    return input(id).closest("label")?.nextElementSibling?.textContent ?? "";
  }

  async function editNumber(id: string, values: string[]): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      for (const value of values) changeInput(control, value);
      control.blur();
    });
  }

  it("coalesces Element margin changes into one action", async () => {
    await mount();
    await selectElement("spacing-element");

    await editNumber("text-margin", ["20", "30"]);
    expect(input("text-margin").value).toBe("30");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("text-margin").value).toBe("10");

    const secondUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(secondUndo));
    expect(secondUndo.defaultPrevented).toBe(false);

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("text-margin").value).toBe("30");
  });

  it("keeps Element shorthand and side fields in separate transactions", async () => {
    await mount();
    await selectElement("spacing-element");

    await editNumber("text-margin", ["20"]);
    await editNumber("text-margin-top", ["25"]);

    const undoSide = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoSide));
    expect(undoSide.defaultPrevented).toBe(true);
    expect(input("text-margin").value).toBe("20");
    expect(input("text-margin-top").value).toBe("");

    const undoMargin = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoMargin));
    expect(undoMargin.defaultPrevented).toBe(true);
    expect(input("text-margin").value).toBe("10");
  });

  it("preserves Element clear pruning through undo and redo", async () => {
    await mount();
    await selectElement("spacing-clear");

    await editNumber("code-margin", [""]);
    expect(input("code-margin").value).toBe("");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("code-margin").value).toBe("6");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("code-margin").value).toBe("");
  });

  it("treats authored 12px to numeric 12 as a canonical mutation", async () => {
    await mount();
    await selectElement("spacing-px");

    await editNumber("image-margin", ["13", "12"]);
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("image-margin").value).toBe("12");

    await editNumber("image-margin", ["13", "12"]);
    const secondUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(secondUndo));
    expect(secondUndo.defaultPrevented).toBe(true);
    expect(input("image-margin").value).toBe("12");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
  });

  it("leaves native Undo alone for an ordinary Element no-op", async () => {
    await mount();
    await selectElement("spacing-noop");

    await editNumber("terminal-margin", ["12"]);
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(input("terminal-margin").value).toBe("12");
  });

  it("coalesces local Container padding changes into one action", async () => {
    await mount();
    await selectElement("spacing-container-local");

    await editNumber("container-padding", ["20", "30"]);
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("container-padding").value).toBe("10");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("container-padding").value).toBe("30");
  });

  it("records a same-visible linked padding override and replays ownership", async () => {
    const initial = await mount();
    await selectElement("spacing-linked-padding");
    expect(input("container-padding").value).toBe("20");
    expect(labelText("container-padding")).toContain("Linked");

    await editNumber("container-padding", ["21", "20"]);
    expect(labelText("container-padding")).toContain("Local override");
    expect(initial.linkedStyles?.find((style) => style.id === "linked-padding")).toMatchObject({ layout: { padding: 20 } });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(labelText("container-padding")).toContain("Linked");
    expect(input("container-padding").value).toBe("20");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(labelText("container-padding")).toContain("Local override");
  });

  it("isolates a linked gap override to local children.gap", async () => {
    const initial = await mount();
    await selectElement("spacing-linked-gap");
    expect(input("container-gap").value).toBe("12");
    expect(labelText("container-gap")).toContain("Linked");

    await editNumber("container-gap", ["16", "12"]);
    expect(labelText("container-gap")).toContain("Local override");
    expect(sourceText("container-direction")).toContain("Linked");
    expect(initial.linkedStyles?.find((style) => style.id === "linked-gap")).toMatchObject({
      layout: { children: { mode: "flow", direction: "row", gap: 12 } },
    });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(labelText("container-gap")).toContain("Linked");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(labelText("container-gap")).toContain("Local override");
    expect(sourceText("container-direction")).toContain("Linked");
  });

  it("does not create a local override when clearing inherited spacing", async () => {
    await mount();
    await selectElement("spacing-linked-clear");
    expect(input("container-margin").value).toBe("24");
    expect(labelText("container-margin")).toContain("Linked");

    await editNumber("container-margin", [""]);
    expect(input("container-margin").value).toBe("24");
    expect(labelText("container-margin")).toContain("Linked");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("keeps Container padding and gap in separate transactions", async () => {
    await mount();
    await selectElement("spacing-container-local");

    await editNumber("container-padding", ["20"]);
    await editNumber("container-gap", ["12"]);

    const undoGap = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoGap));
    expect(undoGap.defaultPrevented).toBe(true);
    expect(input("container-padding").value).toBe("20");
    expect(input("container-gap").value).toBe("8");

    const undoPadding = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoPadding));
    expect(undoPadding.defaultPrevented).toBe(true);
    expect(input("container-padding").value).toBe("10");
  });
});
