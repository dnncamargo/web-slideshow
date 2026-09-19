// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const gradient = {
  type: "linear" as const,
  angle: 45,
  stops: [
    { color: "#111111", position: 0 },
    { color: "#eeeeee", position: 100 },
  ],
};

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c1c-history",
    title: "CP4C1C",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          type: "image",
          id: "image-1",
          hidden: false,
          src: "/image.png",
          alt: "Image",
          style: {
            background: { gradient },
            border: { width: 2, style: "solid", color: "#123456" },
          },
        },
        {
          type: "image",
          id: "border-gradient-image",
          hidden: false,
          src: "/image.png",
          alt: "Border gradient",
          style: {
            border: { width: 3, style: "solid", gradient },
          },
        },
        {
          type: "container",
          id: "linked-container",
          hidden: false,
          linkedStyleId: "card",
          children: [],
        },
        {
          type: "container",
          id: "linked-gradient-container",
          hidden: false,
          linkedStyleId: "gradient-card",
          children: [],
        },
      ],
    }],
    linkedStyles: [{
      id: "card",
      name: "Card",
      style: {
        background: { gradient },
        border: { width: 4, style: "solid", color: "#abcdef" },
      },
    }, {
      id: "gradient-card",
      name: "Gradient Card",
      style: {
        border: { width: 4, style: "solid", gradient },
      },
    }],
  });
}

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function shortcut(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
}

describe("CP4C1C border and gradient numeric history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={presentation()} /></StudioI18nProvider>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function selectElement(id: string): Promise<void> {
    await act(async () => host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`)?.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function edit(inputId: string, values: string[]): Promise<void> {
    const input = () => host.querySelector<HTMLInputElement>(`#${inputId}`)!;
    await act(async () => {
      input().focus();
      for (const value of values) setInput(input(), value);
      input().blur();
    });
  }

  it("coalesces ordinary Border width changes and preserves discrete fields", async () => {
    await selectElement("image-1");
    await edit("image-border-width", ["5", "7"]);

    expect(host.querySelector<HTMLInputElement>("#image-border-width")?.value).toBe("7");
    expect(host.querySelector<HTMLInputElement>("#image-border-color-value")?.value).toBe("#123456");

    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-border-width")?.value).toBe("2");
    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-border-width")?.value).toBe("7");
  });

  it("keeps ordinary Gradient angle and stop position as separate actions", async () => {
    await selectElement("image-1");
    await edit("image-background-gradient-angle", ["60", "75"]);
    await edit("image-background-gradient-stop-1-position", ["80", "85"]);

    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-background-gradient-stop-1-position")?.value).toBe("100");
    expect(host.querySelector<HTMLInputElement>("#image-background-gradient-angle")?.value).toBe("75");
    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-background-gradient-angle")?.value).toBe("45");
    expect(host.querySelector<HTMLInputElement>("#image-background-gradient-stop-0-color")?.value).toBe("#111111");

    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true, shiftKey: true })));
    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-background-gradient-angle")?.value).toBe("75");
    expect(host.querySelector<HTMLInputElement>("#image-background-gradient-stop-1-position")?.value).toBe("85");
  });

  it("tracks nested Border Gradient numeric edits", async () => {
    await selectElement("border-gradient-image");
    await edit("image-border-gradient-angle", ["90", "120"]);

    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-border-gradient-angle")?.value).toBe("45");
    await act(async () => window.dispatchEvent(shortcut("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector<HTMLInputElement>("#image-border-gradient-angle")?.value).toBe("120");
    expect(host.querySelector<HTMLInputElement>("#image-border-gradient-stop-0-color")?.value).toBe("#111111");
  });

  it("materializes and replays a same-visible linked Container Border override", async () => {
    await selectElement("linked-container");
    expect(host.querySelector<HTMLInputElement>("#container-border-width")?.value).toBe("4");

    await edit("container-border-width", ["5", "4"]);
    expect(host.querySelector<HTMLInputElement>("#container-border-width")?.value).toBe("4");

    const undo = shortcut("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#container-border-width")?.value).toBe("4");

    const redo = shortcut("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#container-border-width")?.value).toBe("4");
  });

  it("materializes and replays a same-visible linked background Gradient override", async () => {
    await selectElement("linked-container");
    await edit("container-gradient-angle", ["60", "45"]);

    const undo = shortcut("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#container-gradient-angle")?.value).toBe("45");

    const redo = shortcut("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#container-gradient-angle")?.value).toBe("45");
  });

  it("materializes and replays a same-visible linked Border Gradient override", async () => {
    await selectElement("linked-gradient-container");
    await edit("container-border-gradient-angle", ["60", "45"]);

    const undo = shortcut("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#container-border-gradient-angle")?.value).toBe("45");

    const redo = shortcut("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#container-border-gradient-angle")?.value).toBe("45");
  });

  it("does not create history for an ordinary numeric no-op", async () => {
    await selectElement("image-1");
    await edit("image-border-width", ["2"]);

    const undo = shortcut("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });
});
