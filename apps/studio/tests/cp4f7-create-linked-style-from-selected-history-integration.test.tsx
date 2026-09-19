// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ContainerElement,
  type PresentationElement,
  type Presentation,
  type TopicItem,
  type TopicsElement,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function text(id: string, content: string): PresentationElement {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function topicItem(id: string, children: PresentationElement[], nested: TopicItem[] = []): TopicItem {
  return { id, content: { id: `slot-${id}`, children }, children: nested };
}

function container(id: string, overrides: Partial<ContainerElement> = {}): ContainerElement {
  return { id, type: "container", hidden: false, children: [], ...overrides };
}

function topics(id: string, overrides: Partial<TopicsElement> = {}): TopicsElement {
  return {
    id,
    type: "topics",
    hidden: false,
    kind: "unordered",
    items: [topicItem(`${id}-item`, [text(`${id}-text`, "Keep topic content")])],
    ...overrides,
  };
}

function presentation(elements: PresentationElement[], linkedStyles: readonly object[] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f7-create-linked-style-from-selected-history",
    title: "CP4F7",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
    linkedStyles,
  });
}

function key(options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected input value setter");
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

function getElement(document: Presentation, id: string): PresentationElement {
  const element = findElement(document.slides[0]?.elements ?? [], id);
  if (!element) throw new Error(`Element was not found: ${id}`);
  return element;
}

describe("CP4F7 create Linked Style from selected element history", () => {
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

  async function mount(initial: Presentation, saved: Presentation[]): Promise<void> {
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

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`Element was not rendered: ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function openResources(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!button) throw new Error("Custom Resources button was not rendered");
    await act(async () => button.click());
  }

  async function createFromSelected(name: string): Promise<void> {
    const open = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Linked Styles");
    if (!open) throw new Error("Add to Linked Styles command was not rendered");
    await act(async () => open.click());

    const input = Array.from(host.querySelectorAll<HTMLInputElement>("input"))
      .find((candidate) => candidate.closest("label")?.textContent?.toLowerCase().includes("style name"));
    if (!input) throw new Error("Add to Linked Styles name input was not rendered");
    await act(async () => setInputValue(input, name));

    const create = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Linked Styles");
    if (!create) throw new Error("Add to Linked Styles create button was not rendered");
    await act(async () => create.click());
  }

  async function save(saved: Presentation[]): Promise<Presentation> {
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

  it("creates an atomic nested Container resource, preserves ownership boundaries, and replays the same ID", async () => {
    const nested = container("nested-source", {
      layout: { position: "absolute", top: 4, margin: 9, children: { gap: 12 } },
      style: { className: "local-class", color: "#123456" },
      typography: { fontSize: 22 },
      effect: { opacity: 0.7 },
      children: [text("nested-child", "Keep this child")],
    });
    const sibling = container("sibling", { layout: { margin: 9 }, children: [] });
    const initial = presentation([
      container("outer", { children: [nested] }),
      sibling,
    ], [{ target: "topics", id: "shared", name: "Shared", itemGap: 8 }]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElement("nested-source");
    await openResources();
    await createFromSelected("  Shared  ");

    const changed = await save(saved);
    const created = changed.linkedStyles?.find((style) => style.id === "shared-2");
    expect(created).toEqual({
      id: "shared-2",
      name: "Shared",
      layout: { position: "absolute", top: 4, margin: 9, children: { gap: 12 } },
      style: { color: "#123456" },
      typography: { fontSize: 22 },
      effect: { opacity: 0.7 },
    });
    expect(changed.linkedStyles?.[0]).toEqual(initial.linkedStyles?.[0]);
    expect(getElement(changed, "nested-source")).toEqual({
      id: "nested-source",
      type: "container",
      hidden: false,
      children: [text("nested-child", "Keep this child")],
      style: { className: "local-class" },
      linkedStyleId: "shared-2",
    });
    expect(getElement(changed, "sibling")).not.toHaveProperty("linkedStyleId");
    expect(host.querySelector<HTMLElement>('[data-powershow-id="nested-source"]')?.classList.contains("powershow-editor-selected")).toBe(true);

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(await save(saved)).toEqual(initial);
    expect(host.querySelector<HTMLElement>('[data-powershow-id="nested-source"]')?.classList.contains("powershow-editor-selected")).toBe(true);

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(await save(saved)).toEqual(changed);
    expect(getElement(changed, "nested-source")).toHaveProperty("linkedStyleId", "shared-2");
  });

  it("creates an atomic sparse Topics resource, preserves content and local fields, and changes only the selected source", async () => {
    const nestedTopic = topicItem("nested-topic", [text("nested-topic-text", "Nested content")]);
    const selected = topics("topics-source", {
      kind: "ordered",
      layout: { position: "absolute", top: 4, margin: 0, marginTop: "0px", marginRight: 12 },
      rootMarkerStyle: "square",
      markerColor: "#112233",
      itemGap: 8,
      style: { className: "topics-local", color: "#445566" },
      typography: { fontSize: 18 },
      items: [topicItem("topic-1", [text("topic-text", "Keep exact content")], [nestedTopic])],
    });
    const sibling = topics("topics-sibling", { itemGap: 8 });
    const initial = presentation([selected, sibling], [{ id: "shared", name: "Shared", layout: { margin: 4 } }]);
    const initialItems = structuredClone(selected.items);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElement("topics-source");
    await openResources();
    await createFromSelected("Shared");

    const changed = await save(saved);
    const created = changed.linkedStyles?.find((style) => style.id === "shared-2");
    expect(created).toEqual({
      target: "topics",
      id: "shared-2",
      name: "Shared",
      kind: "ordered",
      layout: { position: "absolute", top: 4, marginRight: 12 },
      rootMarkerStyle: "square",
      markerColor: "#112233",
      itemGap: 8,
    });
    expect(changed.linkedStyles?.[0]).toEqual(initial.linkedStyles?.[0]);
    expect(getElement(changed, "topics-source")).toEqual({
      id: "topics-source",
      type: "topics",
      hidden: false,
      style: { className: "topics-local", color: "#445566" },
      typography: { fontSize: 18 },
      items: initialItems,
      linkedStyleId: "shared-2",
    });
    expect((getElement(changed, "topics-sibling") as TopicsElement).linkedStyleId).toBeUndefined();
    expect((getElement(changed, "topics-source") as TopicsElement).items).toEqual(initialItems);

    await undo();
    expect(await save(saved)).toEqual(initial);
    expect((getElement(await save(saved), "topics-source") as TopicsElement).items).toEqual(initialItems);
    await redo();
    expect(await save(saved)).toEqual(changed);
    expect((getElement(changed, "topics-source") as TopicsElement).items).toEqual(initialItems);
  });

  it("keeps the form transient, rejects invalid sources, and separates a preceding continuous edit", async () => {
    const initial = presentation([
      container("selected", { layout: { children: { gap: 8 } }, children: [text("child", "Child")] }),
      container("invalid", { style: { className: "only-local" }, children: [] }),
    ]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement("selected");
    await openResources();

    const open = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Linked Styles");
    if (!open) throw new Error("Add to Linked Styles command was not rendered");
    await act(async () => open.click());
    const draft = host.querySelector<HTMLInputElement>("input");
    if (!draft) throw new Error("Transient name input was not rendered");
    await act(async () => setInputValue(draft, "Draft only"));
    const close = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Close");
    if (!close) throw new Error("Close button was not rendered");
    await act(async () => close.click());
    expect((await undo()).defaultPrevented).toBe(false);

    await openResources();
    await selectElement("selected");
    const gap = host.querySelector<HTMLInputElement>("#container-gap");
    if (!gap) throw new Error("Container gap input was not rendered");
    await act(async () => {
      gap.focus();
      setInputValue(gap, "24");
      gap.blur();
    });
    const afterEdit = await save(saved);
    await openResources();
    await createFromSelected("After edit");
    const afterCreate = await save(saved);

    await undo();
    expect(await save(saved)).toEqual(afterEdit);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(afterEdit);
    await redo();
    expect(await save(saved)).toEqual(afterCreate);

    await selectElement("invalid");
    const disabled = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add to Linked Styles");
    expect(disabled?.disabled).toBe(true);
    const invalidUndo = await undo();
    expect(invalidUndo.defaultPrevented).toBe(true);
    expect(await save(saved)).toEqual(afterEdit);
  });
});
