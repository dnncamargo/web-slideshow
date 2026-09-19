// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c1a-effect-number-history",
    title: "CP4C1A effect number history",
    linkedStyles: [{
      id: "linked-shadow",
      name: "Linked shadow",
      effect: { shadow: { x: 4, y: 5, blur: 6, color: "#123456" } },
    }],
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          type: "code",
          id: "cp4c1a-code",
          hidden: false,
          code: "const value = 1;",
          language: "typescript",
          showLineNumbers: true,
          highlightedLines: [],
          effect: { shadow: { x: 1, y: 2, blur: 3, spread: 4, color: "#111111" } },
        },
        {
          type: "image",
          id: "cp4c1a-image",
          hidden: false,
          src: "/image.png",
          alt: "Image",
          effect: { shadow: { x: 5, y: 6, blur: 7, spread: 8, color: "#222222" } },
        },
        {
          type: "text",
          id: "cp4c1a-text",
          hidden: false,
          variant: "body",
          content: "Text",
          typography: {
            fontFamily: "Arial",
            fontSize: "16px",
            lineHeight: 1.2,
            textAlign: "left",
            textStroke: { width: 2, color: "#abcdef" },
          },
          effect: { shadow: { x: 9, y: 10, blur: 11, spread: 12, color: "#333333" } },
        },
        {
          type: "container",
          id: "cp4c1a-container",
          hidden: false,
          children: [],
          linkedStyleId: "linked-shadow",
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

describe("CP4C1A continuous effect number history", () => {
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

  async function mount(initial = presentation()): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} /></StudioI18nProvider>));
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id: string): HTMLInputElement {
    const result = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!result) throw new Error(`input ${id} was not rendered`);
    return result;
  }

  async function editNumber(id: string, values: string[]): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      for (const value of values) changeInput(control, value);
      control.blur();
    });
  }

  it("coalesces a real shared-element shadow session and keeps fields separate", async () => {
    await mount();
    await selectElement("cp4c1a-code");

    await editNumber("code-shadow-x", ["5", "6"]);
    await editNumber("code-shadow-y", ["8"]);
    expect(input("code-shadow-x").value).toBe("6");
    expect(input("code-shadow-y").value).toBe("8");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("code-shadow-x").value).toBe("6");
    expect(input("code-shadow-y").value).toBe("2");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("code-shadow-x").value).toBe("1");
    expect(input("code-shadow-y").value).toBe("2");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("code-shadow-x").value).toBe("6");
  });

  it("coalesces Image shadow changes to one exact Undo/Redo pair", async () => {
    await mount();
    await selectElement("cp4c1a-image");

    await editNumber("image-shadow-blur", ["13", "14"]);
    expect(input("image-shadow-blur").value).toBe("14");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("image-shadow-blur").value).toBe("7");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("image-shadow-blur").value).toBe("14");
  });

  it("coalesces Text Stroke width while preserving mode and color", async () => {
    await mount();
    await selectElement("cp4c1a-text");

    await editNumber("text-text-stroke-width", ["3", "4"]);
    expect(input("text-text-stroke-width").value).toBe("4");
    expect(input("text-text-stroke-color-value").value).toBe("#abcdef");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("text-text-stroke-width").value).toBe("2");
    expect((host.querySelector<HTMLSelectElement>("#text-text-stroke-mode")!).value).toBe("stroke");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("text-text-stroke-width").value).toBe("4");
  });

  it("records a same-visible-value linked Container shadow override", async () => {
    const initial = presentation();
    await mount(initial);
    await selectElement("cp4c1a-container");

    expect(input("container-shadow-x").value).toBe("4");
    await editNumber("container-shadow-x", ["5", "4"]);
    expect(host.textContent).toContain("Local override");
    expect(initial.linkedStyles?.[0]?.effect?.shadow?.x).toBe(4);

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(host.textContent).toContain("Linked");
    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(host.textContent).toContain("Local override");
  });

  it("keeps Ctrl/Cmd+Z native after an authored numeric no-op", async () => {
    await mount();
    await selectElement("cp4c1a-code");

    await editNumber("code-shadow-x", ["1"]);
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(input("code-shadow-x").value).toBe("1");
  });
});
