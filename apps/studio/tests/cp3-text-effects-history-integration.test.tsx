// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(overrides: Record<string, unknown> = {}, textStyles?: readonly Record<string, unknown>[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp3-text-effects-history",
    title: "CP3 Text Effects History",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{
        type: "text",
        id: "cp3-text",
        hidden: false,
        variant: "body",
        content: "Text",
        ...overrides,
      }],
    }],
    ...(textStyles === undefined ? {} : { textStyles }),
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

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP3 Text Fill, Shadow, Glow history", () => {
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

  async function mount(initial: Presentation): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} /></StudioI18nProvider>));
    const canvasElement = host.querySelector<HTMLElement>("[data-presentation-id='cp3-text']");
    if (!canvasElement) throw new Error("text element was not rendered");
    await act(async () => canvasElement.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function select(id: string): HTMLSelectElement {
    const control = host.querySelector<HTMLSelectElement>(`#${id}`);
    if (!control) throw new Error(`missing select ${id}`);
    return control;
  }

  function input(id: string): HTMLInputElement {
    const control = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!control) throw new Error(`missing input ${id}`);
    return control;
  }

  it("records Fill mode as one discrete action and Gradient angle as one coalesced action", async () => {
    await mount(presentation({ style: { color: "#123456" } }));

    await act(async () => changeSelect(select("text-fill-mode"), "gradient"));
    expect(select("text-fill-mode").value).toBe("gradient");

    const angle = input("text-fill-gradient-angle");
    await act(async () => {
      angle.focus();
      changeInput(angle, "180");
      changeInput(angle, "200");
      angle.blur();
    });
    expect(angle.value).toBe("200");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("text-fill-gradient-angle").value).toBe("135");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(select("text-fill-mode").value).toBe("color");
    expect(input("text-color-value").value).toBe("#123456");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(select("text-fill-mode").value).toBe("gradient");
    expect(input("text-fill-gradient-angle").value).toBe("135");
  });

  it("keeps Shadow and Glow independent while coalescing their numeric edits", async () => {
    await mount(presentation());

    await act(async () => changeSelect(select("text-shadow-mode"), "outer"));
    await act(async () => changeSelect(select("text-glow-mode"), "glow"));

    const shadowX = input("text-shadow-x");
    await act(async () => {
      shadowX.focus();
      changeInput(shadowX, "5");
      changeInput(shadowX, "6");
      shadowX.blur();
    });
    const glowBlur = input("text-glow-blur");
    await act(async () => {
      glowBlur.focus();
      changeInput(glowBlur, "18");
      changeInput(glowBlur, "20");
      glowBlur.blur();
    });

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("text-glow-blur").value).toBe("12");
    expect(input("text-shadow-x").value).toBe("6");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(select("text-glow-mode").value).toBe("glow");
    expect(select("text-shadow-mode").value).toBe("outer");
    expect(input("text-shadow-x").value).toBe("0");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(select("text-glow-mode").value).toBe("none");
    expect(select("text-shadow-mode").value).toBe("outer");
  });

  it("does not create History from displaying an inherited Gradient and coalesces the first stop edit", async () => {
    await mount(presentation({}, [{
      id: "body",
      style: { gradient: { type: "linear", angle: 90, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }] } },
    }]));

    expect(select("text-fill-mode").value).toBe("gradient");
    const mountUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(mountUndo));
    expect(mountUndo.defaultPrevented).toBe(false);
    expect(select("text-fill-mode").value).toBe("gradient");

    const position = input("text-fill-gradient-stop-0-position");
    await act(async () => {
      position.focus();
      changeInput(position, "10");
      changeInput(position, "20");
      position.blur();
    });
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("text-fill-gradient-stop-0-position").value).toBe("0");
    expect(select("text-fill-mode").value).toBe("gradient");
  });
});
