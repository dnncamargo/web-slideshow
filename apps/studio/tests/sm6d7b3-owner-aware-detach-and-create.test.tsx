// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { updateAuthoringElements } from "../src/features/editor/authoring-target";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d7b3",
    title: "Owner-aware detach and create",
    textStyles: [{ id: "quote", name: "Quote", role: "body", typography: { fontSize: 26 }, style: { color: "#224466" } }],
    linkedStyles: [
      { id: "cards", name: "Cards", layout: { margin: 4 }, style: { color: "#224466" } },
      { target: "topics", id: "topic-style", name: "Topic style", itemGap: 8 },
    ],
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        { id: "slide-text", type: "text", hidden: false, variant: "quote", content: "Slide" },
        { id: "slide-container", type: "container", hidden: false, linkedStyleId: "cards", children: [] },
      ],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching master",
      root: {
        id: "root-owner",
        type: "container",
        hidden: false,
        children: [
          { id: "root-text", type: "text", hidden: false, variant: "quote", content: "Root" },
          { id: "root-container", type: "container", hidden: false, linkedStyleId: "cards", children: [] },
          { id: "root-container-source", type: "container", hidden: false, layout: { margin: 12 }, children: [] },
          { id: "root-topics-source", type: "topics", hidden: false, kind: "ordered", itemGap: 12, items: [] },
        ],
      },
    }],
  });
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

function rootElement(snapshot: Presentation, id: string): PresentationElement {
  const root = snapshot.rootDefinitions?.[0]?.root;
  const result = root ? findElement([root], id) : undefined;
  if (!result) throw new Error(`Root element was not found: ${id}`);
  return result;
}

function slideElement(snapshot: Presentation, id: string): PresentationElement {
  const result = findElement(snapshot.slides[0]?.elements ?? [], id);
  if (!result) throw new Error(`Slide element was not found: ${id}`);
  return result;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("SM6D7B3 owner-aware detach and create-from-selected", () => {
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
          initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-1" }}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
        />
      </StudioI18nProvider>,
    ));
  }

  async function openResources(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!button) throw new Error("Custom Resources button was not rendered");
    await act(async () => button.click());
  }

  async function openSection(label: string): Promise<void> {
    const details = Array.from(host.querySelectorAll<HTMLDetailsElement>("details"))
      .find((candidate) => candidate.querySelector("summary")?.textContent?.includes(label));
    if (!details) throw new Error(`Resource section was not rendered: ${label}`);
    if (!details.open) await act(async () => details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
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

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  }

  async function select(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`Rendered element was not found: ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function createFromSelected(name: string, buttonLabel: "Add to Text Styles" | "Add to Linked Styles"): Promise<void> {
    const open = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === buttonLabel);
    if (!open) throw new Error(`${buttonLabel} command was not rendered`);
    await act(async () => open.click());
    const input = Array.from(host.querySelectorAll<HTMLInputElement>("input"))
      .find((candidate) => candidate.closest("label")?.textContent?.toLowerCase().includes("style name"));
    if (!input) throw new Error("Create-from-selected name input was not rendered");
    await act(async () => setInputValue(input, name));
    const submitLabel = buttonLabel === "Add to Text Styles" ? "+ Add Style" : buttonLabel;
    const create = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === submitLabel);
    if (!create) throw new Error(`${submitLabel} submit button was not rendered`);
    await act(async () => create.click());
  }

  async function confirmDetach(): Promise<void> {
    const dialog = host.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("Detach confirmation was not rendered");
    const confirm = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Detach");
    if (!confirm) throw new Error("Detach confirmation button was not rendered");
    await act(async () => confirm.click());
  }

  it("detaches a Root Text Style usage atomically and preserves the retained Slide", async () => {
    const initial = presentation();
    await mount(initial);
    await openResources();
    await openSection("Text Styles");
    const row = host.querySelector<HTMLElement>("[data-text-style-id='quote']");
    if (!row) throw new Error("Text Style row was not rendered");
    await act(async () => row.querySelector<HTMLButtonElement>("button[aria-controls]")?.click());
    const detach = Array.from(row.querySelectorAll<HTMLButtonElement>("[data-resource-action='detach']"))
      .find((button) => button.parentElement?.textContent?.includes("root-text"));
    if (!detach) throw new Error("Root Text Style detach was not rendered");
    await act(async () => detach.click());
    await confirmDetach();

    const changed = await save();
    expect(rootElement(changed, "root-text")).toMatchObject({ styleDetached: true, variant: "body", typography: { fontSize: 26 } });
    expect(slideElement(changed, "slide-text")).toEqual(slideElement(initial, "slide-text"));
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("detaches a Root Container Linked Style usage atomically and preserves the retained Slide", async () => {
    const initial = presentation();
    await mount(initial);
    await openResources();
    await openSection("Linked Styles");
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='cards']");
    if (!row) throw new Error("Linked Style row was not rendered");
    await act(async () => row.querySelector<HTMLButtonElement>(":scope > button")?.click());
    const detach = Array.from(row.querySelectorAll<HTMLButtonElement>("[data-resource-action='detach']"))
      .find((button) => button.parentElement?.textContent?.includes("root-container"));
    if (!detach) throw new Error("Root Container Linked Style detach was not rendered");
    await act(async () => detach.click());
    await confirmDetach();

    const changed = await save();
    expect(rootElement(changed, "root-container")).toMatchObject({ layout: { margin: 4 }, style: { color: "#224466" } });
    expect(rootElement(changed, "root-container")).not.toHaveProperty("linkedStyleId");
    expect(slideElement(changed, "slide-container")).toEqual(slideElement(initial, "slide-container"));
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("creates a Text Style from a Root Text in one undoable action", async () => {
    const initial = presentation();
    await mount(initial);
    await select("root-text");
    await openResources();
    await createFromSelected("Root capture", "Add to Text Styles");
    const changed = await save();
    expect(changed.textStyles?.at(-1)).toMatchObject({ id: "root-capture", name: "Root capture" });
    expect(rootElement(changed, "root-text")).toMatchObject({ variant: "root-capture" });
    expect(slideElement(changed, "slide-text")).toEqual(slideElement(initial, "slide-text"));
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("creates Container and Topics Linked Styles from Root selections with exact shared semantics", async () => {
    const initial = presentation();
    await mount(initial);

    await select("root-container-source");
    await openResources();
    await createFromSelected("Root card", "Add to Linked Styles");
    const afterContainer = await save();
    expect(afterContainer.linkedStyles?.find((style) => style.id === "root-card")).toMatchObject({ id: "root-card", layout: { margin: 12 } });
    expect(rootElement(afterContainer, "root-container-source")).toMatchObject({ linkedStyleId: "root-card" });

    await select("root-topics-source");
    await createFromSelected("Root topics", "Add to Linked Styles");
    const changed = await save();
    expect(changed.linkedStyles?.find((style) => style.id === "root-topics")).toMatchObject({ target: "topics", itemGap: 12, kind: "ordered" });
    expect(rootElement(changed, "root-topics-source")).toMatchObject({ linkedStyleId: "root-topics" });
    expect(slideElement(changed, "slide-container")).toEqual(slideElement(initial, "slide-container"));
    await undo();
    expect(await save()).toEqual(afterContainer);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(afterContainer);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("does not fall back to the retained Slide when a captured Root owner is stale", () => {
    const current = presentation();
    const staleTarget = { kind: "root-definition", rootDefinitionId: "removed-root" } as const;
    const result = updateAuthoringElements(current, staleTarget, (elements) => elements.map((element) => ({ ...element, hidden: true })));
    expect(result).toBe(current);
    expect(slideElement(result, "slide-text")).toEqual(slideElement(current, "slide-text"));
  });
});
