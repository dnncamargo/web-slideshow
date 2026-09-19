// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type EmbedElement,
  type Presentation,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function embedElement(
  overrides: Partial<Omit<EmbedElement, "type">> = {},
): EmbedElement {
  return {
    id: "embed-1",
    type: "embed",
    hidden: false,
    src: "https://example.com/",
    title: "Embedded content",
    ...overrides,
  };
}

function presentation(viewport: EmbedElement["viewport"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c1h-embed-viewport-history",
    title: "CP4C1H Embed viewport history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [embedElement({ viewport })],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C1H continuous Embed viewport history", () => {
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
    initial = presentation(undefined),
    onSave?: (snapshot: Presentation) => Promise<void>,
  ): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} onSave={onSave} />
      </StudioI18nProvider>,
    ));
  }

  async function selectEmbed(): Promise<void> {
    const element = host.querySelector<HTMLElement>(
      '[data-presentation-id="embed-1"]',
    );
    if (!element) throw new Error("Embed was not rendered");
    await act(async () => {
      element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
  }

  function input(field: "zoom" | "top" | "right" | "bottom" | "left"): HTMLInputElement {
    const result = host.querySelector<HTMLInputElement>(
      `#embed-viewport-${field}`,
    );
    if (!result) throw new Error(`Embed viewport ${field} input was not rendered`);
    return result;
  }

  async function editNumber(
    field: "zoom" | "top" | "right" | "bottom" | "left",
    values: string[],
  ): Promise<void> {
    const control = input(field);
    await act(async () => {
      control.focus();
      for (const value of values) changeInput(control, value);
      control.blur();
    });
  }

  async function authorDisplayedNumber(
    field: "zoom" | "top" | "right" | "bottom" | "left",
    value: string,
  ): Promise<void> {
    const control = input(field);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");

    await act(async () => {
      control.focus();
      const tracker = (control as HTMLInputElement & {
        _valueTracker?: { setValue: (value: string) => void };
      })._valueTracker;
      tracker?.setValue("");
      setter.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.blur();
    });
  }

  async function save(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  }

  function savedEmbed(snapshot: Presentation): EmbedElement {
    const element = snapshot.slides[0]?.elements.find(
      (candidate) => candidate.id === "embed-1",
    );
    if (element?.type !== "embed") throw new Error("saved Embed was not found");
    return element;
  }

  it("coalesces Zoom changes into one undoable action", async () => {
    await mount(presentation({ zoom: 0.75 }));
    await selectEmbed();

    await editNumber("zoom", ["80", "90"]);
    expect(input("zoom").value).toBe("90");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("zoom").value).toBe("75");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("zoom").value).toBe("90");
  });

  it("keeps viewport fields in separate transactions", async () => {
    await mount(presentation({ zoom: 0.75 }));
    await selectEmbed();

    await editNumber("zoom", ["90"]);
    await editNumber("top", ["20"]);

    const undoTop = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoTop));
    expect(undoTop.defaultPrevented).toBe(true);
    expect(input("zoom").value).toBe("90");
    expect(input("top").value).toBe("0");

    const undoZoom = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoZoom));
    expect(undoZoom.defaultPrevented).toBe(true);
    expect(input("zoom").value).toBe("75");
  });

  it("leaves native Undo alone for an ordinary canonical no-op", async () => {
    await mount(presentation({ zoom: 0.75, top: 20 }));
    await selectEmbed();

    await authorDisplayedNumber("zoom", "75");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(input("zoom").value).toBe("75");
    expect(input("top").value).toBe("20");
  });

  it("leaves an absent viewport unchanged when Zoom is explicitly authored as 100", async () => {
    await mount(presentation(undefined));
    await selectEmbed();

    await authorDisplayedNumber("zoom", "100");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(input("zoom").value).toBe("100");
  });

  it("leaves an absent viewport unchanged when Top is explicitly authored as 0", async () => {
    await mount(presentation(undefined));
    await selectEmbed();

    await authorDisplayedNumber("top", "0");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(input("top").value).toBe("0");
  });

  it("records whole-viewport normalization when an explicit default sibling is pruned", async () => {
    const saved: Presentation[] = [];
    await mount(
      presentation({ zoom: 1, top: 20 }),
      async (snapshot) => { saved.push(structuredClone(snapshot)); },
    );
    await selectEmbed();

    await authorDisplayedNumber("top", "20");
    await save();
    expect(savedEmbed(saved.at(-1)!)).toMatchObject({ viewport: { top: 20 } });
    expect(savedEmbed(saved.at(-1)!).viewport).not.toHaveProperty("zoom");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({ zoom: 1, top: 20 });

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({ top: 20 });
  });

  it("prunes default Zoom while preserving non-default siblings through Undo/Redo", async () => {
    const saved: Presentation[] = [];
    await mount(
      presentation({ zoom: 0.75, top: 20, left: 40 }),
      async (snapshot) => { saved.push(structuredClone(snapshot)); },
    );
    await selectEmbed();

    await authorDisplayedNumber("zoom", "100");
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({ top: 20, left: 40 });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({ zoom: 0.75, top: 20, left: 40 });

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({ top: 20, left: 40 });
  });

  it("collapses the final viewport property to undefined and replays exact Undo/Redo", async () => {
    const saved: Presentation[] = [];
    await mount(
      presentation({ top: 20 }),
      async (snapshot) => { saved.push(structuredClone(snapshot)); },
    );
    await selectEmbed();

    await authorDisplayedNumber("top", "0");
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toBeUndefined();

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({ top: 20 });

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toBeUndefined();
  });

  it("creates no canonical mutation or History action for blank and invalid values", async () => {
    await mount(presentation(undefined));
    await selectEmbed();

    await editNumber("top", [""]);
    await editNumber("zoom", ["401"]);
    await editNumber("top", ["-1"]);

    expect(input("zoom").value).toBe("100");
    expect(input("top").value).toBe("0");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("preserves non-default viewport siblings when editing Right", async () => {
    const saved: Presentation[] = [];
    await mount(
      presentation({ zoom: 0.75, top: 20, left: 40 }),
      async (snapshot) => { saved.push(structuredClone(snapshot)); },
    );
    await selectEmbed();

    await editNumber("right", ["30"]);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({
      zoom: 0.75,
      top: 20,
      right: 30,
      left: 40,
    });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({
      zoom: 0.75,
      top: 20,
      left: 40,
    });

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedEmbed(saved.at(-1)!).viewport).toEqual({
      zoom: 0.75,
      top: 20,
      right: 30,
      left: 40,
    });
  });
});
