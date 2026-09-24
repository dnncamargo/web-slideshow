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
    id: "cp4c1i-pattern-history",
    title: "Pattern history",
    slides: [{
      id: "slide",
      title: "Slide",
      elements: [{
        id: "pattern-history",
        type: "container",
        hidden: false,
        children: [],
        style: {
          color: "#111111",
          background: {
            color: "#f8fafc",
            gradient: { type: "linear", stops: [{ color: "#fff", position: 0 }, { color: "#000", position: 100 }] },
            pattern: {
              image: "linear-gradient(var(--presentation-pattern-color-1) 1px, transparent 1px), linear-gradient(90deg, var(--presentation-pattern-color-1) 1px, transparent 1px)",
              size: "32px 32px",
              repeat: "repeat",
              colors: ["#cbd5e1"],
              rotation: 12,
            },
          },
        },
      }],
    }],
  });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

describe("Container Pattern parameter history", () => {
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

  it("coalesces Size and Rotation separately and restores them with Undo", async () => {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={presentation()} /></StudioI18nProvider>));
    const element = host.querySelector<HTMLElement>('[data-presentation-id="pattern-history"]');
    expect(element).not.toBeNull();
    await act(async () => element?.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const size = host.querySelector<HTMLInputElement>("#container-background-pattern-size")!;
    const rotation = host.querySelector<HTMLInputElement>("#container-background-pattern-rotation")!;
    await act(async () => {
      size.focus();
      changeInput(size, "40");
      changeInput(size, "44");
      size.blur();
    });
    await act(async () => {
      rotation.focus();
      changeInput(rotation, "20");
      changeInput(rotation, "30");
      rotation.blur();
    });

    const undoRotation = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoRotation));
    expect(undoRotation.defaultPrevented).toBe(true);
    expect(rotation.value).toBe("12");
    expect(size.value).toBe("44");

    const undoSize = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoSize));
    expect(undoSize.defaultPrevented).toBe(true);
    expect(size.value).toBe("32");
    expect(rotation.value).toBe("12");
  });
});
