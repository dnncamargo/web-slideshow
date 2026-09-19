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
    id: "cp4c1b-opacity-history",
    title: "CP4C1B opacity history",
    linkedStyles: [{
      id: "cp4c1b-container-style",
      name: "Opacity style",
      effect: { opacity: 0.4 },
    }],
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          type: "text",
          id: "cp4c1b-text",
          hidden: false,
          variant: "body",
          content: "Text",
          typography: { fontFamily: "Arial", fontSize: "16px", lineHeight: 1.2, textAlign: "left" },
          effect: { opacity: 0.4 },
        },
        {
          type: "image",
          id: "cp4c1b-image",
          hidden: false,
          src: "/image.png",
          alt: "Image",
          effect: { opacity: 0.5 },
        },
        {
          type: "code",
          id: "cp4c1b-code",
          hidden: false,
          code: "const value = 1;",
          language: "typescript",
          showLineNumbers: true,
          highlightedLines: [],
        },
        {
          type: "table",
          id: "cp4c1b-table",
          mode: "structured",
          showHeader: true,
          hidden: false,
          style: {
            background: { color: "#111111" },
            headerBackground: "#222222",
            bodyRowAlternateBackground: "#333333",
            dividerOpacity: 0.7,
          },
          effect: { opacity: 0.6 },
          columns: [{
            id: "cp4c1b-column",
            header: { id: "cp4c1b-header", children: [] },
          }],
          rows: [{
            id: "cp4c1b-row",
            cells: [{ id: "cp4c1b-cell", children: [] }],
          }],
        },
        {
          type: "container",
          id: "cp4c1b-container",
          hidden: false,
          linkedStyleId: "cp4c1b-container-style",
          children: [],
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

describe("CP4C1B continuous opacity history", () => {
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

  it("coalesces a real Text opacity session to baseline and final values", async () => {
    await mount();
    await selectElement("cp4c1b-text");

    await editNumber("text-opacity", ["60", "80"]);
    expect(input("text-opacity").value).toBe("80");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("text-opacity").value).toBe("40");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("text-opacity").value).toBe("80");
  });

  it("coalesces the Image opacity path independently", async () => {
    await mount();
    await selectElement("cp4c1b-image");

    await editNumber("image-opacity", ["70", "20"]);
    expect(input("image-opacity").value).toBe("20");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("image-opacity").value).toBe("50");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("image-opacity").value).toBe("20");
  });

  it("keeps Ctrl/Cmd+Z native after an authored opacity no-op", async () => {
    await mount();
    await selectElement("cp4c1b-image");

    await editNumber("image-opacity", ["50"]);
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));

    expect(undo.defaultPrevented).toBe(false);
    expect(input("image-opacity").value).toBe("50");
  });

  it("tracks explicit authorship when an unauthored opacity displays 100", async () => {
    await mount();
    await selectElement("cp4c1b-code");
    expect(input("code-opacity").value).toBe("100");

    await editNumber("code-opacity", ["99", "100"]);
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("code-opacity").value).toBe("100");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("code-opacity").value).toBe("100");
  });

  it("keeps Structured Table element and divider opacity actions independent", async () => {
    await mount();
    await selectElement("cp4c1b-table");

    await editNumber("table-opacity", ["30"]);
    await editNumber("table-divider-opacity", ["20"]);
    expect(input("table-background-value").value).toBe("#111111");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("table-opacity").value).toBe("30");
    expect(input("table-divider-opacity").value).toBe("70");
    expect(input("table-background-value").value).toBe("#111111");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("table-opacity").value).toBe("60");
    expect(input("table-divider-opacity").value).toBe("70");
    expect(input("table-background-value").value).toBe("#111111");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("table-opacity").value).toBe("30");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("table-divider-opacity").value).toBe("20");
    expect(input("table-background-value").value).toBe("#111111");
  });

  it("records a same-visible-value linked Container opacity override without mutating the resource", async () => {
    const initial = presentation();
    await mount(initial);
    await selectElement("cp4c1b-container");
    expect(input("container-opacity").value).toBe("40");

    await editNumber("container-opacity", ["41", "40"]);
    expect(host.textContent).toContain("Local override");
    expect(initial.linkedStyles?.[0]?.effect?.opacity).toBe(0.4);

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("container-opacity").value).toBe("40");
    expect(host.textContent).toContain("Linked");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("container-opacity").value).toBe("40");
    expect(host.textContent).toContain("Local override");
    expect(initial.linkedStyles?.[0]?.effect?.opacity).toBe(0.4);
  });
});
