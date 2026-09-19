// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type PresentationElement, type Presentation, type TextElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = {
  listPalettes: async () => [],
  listFonts: async () => [],
} as never;

function text(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: "text",
    hidden: false,
    variant: "body",
    content: "Selected text",
    ...overrides,
  };
}

function presentation(elements: PresentationElement[], overrides: Partial<Presentation> = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f5-create-text-style-from-selected-history",
    title: "CP4F5",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
    ...overrides,
  });
}

function key(options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findElement(elements: readonly PresentationElement[], id: string): PresentationElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === "container") {
      const nested = findElement(element.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findText(snapshot: Presentation, id: string): TextElement {
  const slide = snapshot.slides[0];
  if (!slide) throw new Error("Slide was not found");
  const element = findElement(slide.elements, id);
  if (element?.type !== "text") throw new Error(`Text was not found: ${id}`);
  return element;
}

describe("CP4F5 create Text Style from selected Text history", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial: Presentation): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
        />
      </StudioI18nProvider>,
    ));
  }

  async function save(): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  async function undo(): Promise<KeyboardEvent> {
    const event = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function selectText(id: string): Promise<void> {
    const target = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!target) throw new Error(`Rendered Text was not found: ${id}`);
    await act(async () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function openResources(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!button) throw new Error("Custom Resources button was not rendered");
    await act(async () => button.click());
  }

  async function createFromSelected(name: string): Promise<void> {
    const addFromSelected = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Text Styles");
    if (!addFromSelected) throw new Error("Add to Text Styles button was not rendered");
    await act(async () => addFromSelected.click());

    const input = Array.from(host.querySelectorAll<HTMLInputElement>("input"))
      .find((candidate) => candidate.closest("label")?.textContent?.toLowerCase().includes("style name"));
    if (!input) throw new Error("Add to Text Styles name input was not rendered");
    await act(async () => setInputValue(input, name));

    const create = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add Style");
    if (!create) throw new Error("Add to Text Styles create button was not rendered");
    await act(async () => create.click());
  }

  it("creates one atomic action, captures effective appearance sparsely, and replays it exactly", async () => {
    const initial = presentation([text("selected", {
      content: { type: "rich-text", runs: [{ text: "Keep this content", marks: { bold: true } }] },
      variant: "body",
      typography: { fontWeight: 600, textDecorationLine: "underline", textDecorationColor: "#ff0000", textStroke: { width: 2, color: "#111111" } },
      style: { color: { kind: "palette", colorId: "primary" }, background: { color: "#eeeeee" }, className: "local-text" },
      layout: { position: "absolute", left: 11, top: 12 },
      effect: { opacity: 0.7 },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    })], {
      palette: { colors: [{ id: "primary", name: "Primary", value: "#336699" }] },
      textStyles: [{ id: "body", typography: { fontSize: 20 } }],
    });
    await mount(initial);
    await selectText("selected");
    await openResources();

    expect(Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Text Styles")?.disabled).toBe(false);
    expect(saved).toHaveLength(0);
    await createFromSelected("  Captured style  ");

    const created = await save();
    expect(created.textStyles).toEqual([
      { id: "body", typography: { fontSize: 20 } },
      {
        id: "captured-style",
        name: "Captured style",
        role: "body",
        style: { color: { kind: "palette", colorId: "primary" } },
        typography: { fontSize: 20, fontWeight: 600, textDecorationLine: "underline", textDecorationColor: "#ff0000", textStroke: { width: 2, color: "#111111" } },
      },
    ]);
    expect(findText(created, "selected")).toEqual({
      id: "selected",
      type: "text",
      hidden: false,
      variant: "captured-style",
      content: { type: "rich-text", runs: [{ text: "Keep this content", marks: { bold: true } }] },
      style: { background: { color: "#eeeeee" }, className: "local-text" },
      layout: { position: "absolute", left: 11, top: 12 },
      effect: { opacity: 0.7 },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    });

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(await save()).toEqual(initial);
    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(await save()).toEqual(created);
  });

  it("allocates a current unique id from a custom source and leaves the source unchanged", async () => {
    const source = { id: "captured-style", name: "Captured style", role: "caption", style: { color: "#663399" }, typography: { fontSize: 26 } } as const;
    const initial = presentation([text("selected", {
      variant: source.id,
      typography: { fontWeight: 700 },
      style: { background: { color: "#eeeeee" } },
    })], { textStyles: [source] });
    await mount(initial);
    await selectText("selected");
    await openResources();
    await createFromSelected("Captured style");

    const created = await save();
    expect(created.textStyles).toEqual([
      source,
      { id: "captured-style-2", name: "Captured style", role: "caption", style: { color: "#663399" }, typography: { fontSize: 26, fontWeight: 700 } },
    ]);
    expect(findText(created, "selected")).toMatchObject({ variant: "captured-style-2", style: { background: { color: "#eeeeee" } } });
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(created);
    expect(findText(created, "selected").variant).toBe("captured-style-2");
  });

  it("captures a detached source and restores its exact detached representation on undo", async () => {
    const initial = presentation([text("selected", {
      styleDetached: true,
      typography: { fontSize: 30, fontWeight: 500, textDecorationLine: "underline" },
      style: { color: "#123456", background: { color: "#eeeeee" }, className: "detached" },
    })]);
    await mount(initial);
    await selectText("selected");
    await openResources();
    await createFromSelected("Detached capture");

    const created = await save();
    expect(created.textStyles?.at(-1)).toEqual({
      id: "detached-capture",
      name: "Detached capture",
      role: "body",
      style: { color: "#123456" },
      typography: { fontSize: 30, fontWeight: 500, textDecorationLine: "underline" },
    });
    expect(findText(created, "selected")).toEqual({
      id: "selected",
      type: "text",
      hidden: false,
      variant: "detached-capture",
      content: "Selected text",
      style: { background: { color: "#eeeeee" }, className: "detached" },
    });
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(created);
  });

  it("keeps the form transient and separates a preceding continuous Text edit", async () => {
    const initial = presentation([text("selected")]);
    await mount(initial);
    await selectText("selected");
    await openResources();
    const addFromSelected = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Text Styles");
    if (!addFromSelected) throw new Error("Add to Text Styles button was not rendered");
    await act(async () => addFromSelected.click());
    const draft = host.querySelector<HTMLInputElement>("input");
    if (!draft) throw new Error("Add to Text Styles name input was not rendered");
    await act(async () => setInputValue(draft, "Draft only"));
    const close = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Close");
    if (!close) throw new Error("Add to Text Styles close button was not rendered");
    await act(async () => close.click());
    expect((await undo()).defaultPrevented).toBe(false);

    await act(async () => {
      const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
      resources?.click();
    });
    await selectText("selected");
    const fontSize = host.querySelector<HTMLInputElement>("#text-font-size");
    if (!fontSize) throw new Error("Text font size control was not rendered");
    await act(async () => setInputValue(fontSize, "1.5"));
    const afterTypography = await save();
    await openResources();
    await createFromSelected("After edit");
    const afterCreate = await save();

    await undo();
    expect(await save()).toEqual(afterTypography);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(afterTypography);
    await redo();
    expect(await save()).toEqual(afterCreate);
  });
});
