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

const CONTAINER_ID = "cp4f1-container";
const NESTED_CONTAINER_ID = "cp4f1-nested-container";
const TOPICS_ID = "cp4f1-topics";

const CONTAINER_STYLE_A = {
  id: "container-a",
  name: "Container A",
  layout: { children: { gap: 20 }, padding: 100 },
  style: { color: "#222222", borderRadius: 8 },
  typography: { fontSize: 22 },
  effect: { opacity: 0.8 },
} as const;

const CONTAINER_STYLE_B = {
  id: "container-b",
  name: "Container B",
  layout: { children: { gap: 4 }, padding: 12 },
  style: { color: "#333333", borderRadius: 16 },
  typography: { fontSize: 28 },
  effect: { opacity: 0.6 },
} as const;

const TOPICS_STYLE = {
  target: "topics",
  id: "topics-style",
  name: "Topics Style",
  kind: "ordered",
  layout: { margin: 12 },
  rootMarkerStyle: "square",
  markerColor: "#112233",
  itemGap: 10,
} as const;

function text(id: string, content: string): PresentationElement {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function topicItem(id: string, children: PresentationElement[], nested: TopicItem[] = []): TopicItem {
  return { id, content: { id: `slot-${id}`, children }, children: nested };
}

function topicsElement(overrides: Partial<TopicsElement> = {}): TopicsElement {
  return {
    id: TOPICS_ID,
    type: "topics",
    hidden: false,
    kind: "unordered",
    items: [topicItem("topic-1", [text("topic-text", "Keep this content")])],
    ...overrides,
  };
}

function containerElement(overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    id: CONTAINER_ID,
    type: "container",
    hidden: false,
    children: [text("container-text", "Keep this child")],
    ...overrides,
  };
}

function presentation(
  elements: PresentationElement[],
  linkedStyles: readonly object[] = [],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f1-linked-style-history",
    title: "CP4F1 linked style history",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
    linkedStyles,
  });
}

function key(options: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "z",
    bubbles: true,
    cancelable: true,
    ...options,
  });
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

function containerFrom(document: Presentation, id = CONTAINER_ID): ContainerElement {
  const find = (elements: readonly PresentationElement[]): ContainerElement | undefined => {
    for (const element of elements) {
      if (element.id === id && element.type === "container") {
        return element;
      }
      if (element.type === "container") {
        const nested = find(element.children);
        if (nested) return nested;
      }
    }
    return undefined;
  };
  const result = find(document.slides[0]?.elements ?? []);
  if (!result) throw new Error(`Container was not found: ${id}`);
  return result;
}

function topicsFrom(document: Presentation): TopicsElement {
  const element = document.slides[0]?.elements.find((candidate) => candidate.id === TOPICS_ID);
  if (!element || element.type !== "topics") throw new Error("Topics element was not found");
  return element;
}

describe("CP4F1 linked style attachment history", () => {
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
        />
      </StudioI18nProvider>,
    ));
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`Element was not rendered: ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
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

  it("tracks Container attach through the Inspector and preserves unrelated local state", async () => {
    const initial = presentation([
      containerElement({
        role: "main",
        layout: { padding: 24, width: "80%" },
        style: { className: "local-class", color: "#111111" },
        typography: { fontSize: 18 },
        children: [text("container-text", "Keep this child")],
      }),
    ], [CONTAINER_STYLE_A]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement(CONTAINER_ID);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "container-a"));
    const attached = await save(saved);
    const attachedContainer = containerFrom(attached);

    expect(attachedContainer).toMatchObject({ linkedStyleId: "container-a", role: "main", style: { className: "local-class" }, children: initial.slides[0]!.elements[0]!.type === "container" ? initial.slides[0]!.elements[0]!.children : [] });
    expect(attachedContainer.layout).toEqual({ width: "80%" });
    expect(attachedContainer).not.toHaveProperty("style.color");
    expect(attachedContainer).not.toHaveProperty("typography");
    expect(attached.linkedStyles).toEqual(initial.linkedStyles);

    await undo();
    const undone = await save(saved);
    expect(undone).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(attached);
  });

  it("tracks Container detach as one materializing action and keeps the resource immutable", async () => {
    const initial = presentation([
      containerElement({
        linkedStyleId: "container-a",
        style: { className: "local-class", background: { color: "#445566" } },
        effect: { opacity: 0.5 },
      }),
    ], [CONTAINER_STYLE_A]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement(CONTAINER_ID);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, ""));
    const detached = await save(saved);
    const detachedContainer = containerFrom(detached);
    expect(detachedContainer).not.toHaveProperty("linkedStyleId");
    expect(detachedContainer).toMatchObject({
      layout: { children: { gap: 20 }, padding: 100 },
      style: { className: "local-class", color: "#222222", borderRadius: 8, background: { color: "#445566" } },
      typography: { fontSize: 22 },
      effect: { opacity: 0.5 },
    });
    expect(detached.linkedStyles).toEqual(initial.linkedStyles);

    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(detached);
  });

  it("switches Container styles in one action and replays A to B exactly", async () => {
    const initial = presentation([
      containerElement({ linkedStyleId: "container-a", layout: { width: "80%" } }),
    ], [CONTAINER_STYLE_A, CONTAINER_STYLE_B]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement(CONTAINER_ID);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "container-b"));
    const switched = await save(saved);
    expect(containerFrom(switched)).toMatchObject({ linkedStyleId: "container-b", layout: { width: "80%" } });

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(switched);
  });

  it("keeps attach and detach as separate actions, including nested Containers", async () => {
    const initial = presentation([
      containerElement({
        children: [containerElement({
          id: NESTED_CONTAINER_ID,
          layout: { children: { gap: 3 } },
        })],
      }),
    ], [CONTAINER_STYLE_A]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement(NESTED_CONTAINER_ID);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "container-a"));
    const attached = await save(saved);
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, ""));
    const detached = await save(saved);

    await undo();
    expect(containerFrom(await save(saved), NESTED_CONTAINER_ID).linkedStyleId).toBe("container-a");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(attached);
    await redo();
    expect(await save(saved)).toEqual(detached);
  });

  it("separates a continuous Container edit from a Linked Style relationship action", async () => {
    const initial = presentation([containerElement({ layout: { children: { gap: 8 } } })], [CONTAINER_STYLE_A]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement(CONTAINER_ID);

    const gap = host.querySelector<HTMLInputElement>("#container-gap");
    if (!gap) throw new Error("Container gap input was not rendered");
    await act(async () => {
      gap.focus();
      changeInput(gap, "24");
      gap.blur();
    });
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "container-a"));

    await undo();
    expect(containerFrom(await save(saved)).linkedStyleId).toBeUndefined();
    expect(containerFrom(await save(saved)).layout?.children?.gap).toBe(24);
    await undo();
    expect(containerFrom(await save(saved)).layout?.children?.gap).toBe(8);
  });

  it("tracks Topics attach and detach without changing content or unrelated properties", async () => {
    const initial = presentation([
      topicsElement({
        layout: { top: 4, margin: 20, position: "absolute" },
        markerColor: "#ffffff",
        itemGap: 12,
        style: { color: "#445566" },
        typography: { fontSize: 18 },
      }),
    ], [TOPICS_STYLE]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElement(TOPICS_ID);
    const initialTopics = topicsFrom(initial);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#topics-linked-style")!, "topics-style"));
    const attached = await save(saved);
    const attachedTopics = topicsFrom(attached);
    expect(attachedTopics).toMatchObject({ linkedStyleId: "topics-style", layout: { top: 4, position: "absolute" } });
    expect(attachedTopics).not.toHaveProperty("markerColor");
    expect(attachedTopics).not.toHaveProperty("kind");
    expect(attachedTopics).not.toHaveProperty("itemGap");
    expect(attachedTopics.items).toEqual(initialTopics.items);
    expect(attached.linkedStyles).toEqual(initial.linkedStyles);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#topics-linked-style")!, ""));
    const detached = await save(saved);
    const detachedTopics = topicsFrom(detached);
    expect(detachedTopics).not.toHaveProperty("linkedStyleId");
    expect(detachedTopics).toMatchObject({ kind: "ordered", layout: { top: 4, margin: 12, position: "absolute" }, rootMarkerStyle: "square", markerColor: "#112233", itemGap: 10 });
    expect(detachedTopics.items).toEqual(initialTopics.items);
    expect(detached.linkedStyles).toEqual(initial.linkedStyles);

    await undo();
    expect(await save(saved)).toEqual(attached);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(attached);
    await redo();
    expect(await save(saved)).toEqual(detached);
  });

  it("does not create history for same-style, missing-resource, or no-relationship requests", async () => {
    const sameStyleInitial = presentation([containerElement({ linkedStyleId: "container-a" })], [CONTAINER_STYLE_A]);
    const sameStyleSaved: Presentation[] = [];
    await mount(sameStyleInitial, sameStyleSaved);
    await selectElement(CONTAINER_ID);
    const sameStyleEvent = key({ ctrlKey: true });
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "container-a"));
    await act(async () => window.dispatchEvent(sameStyleEvent));
    expect(sameStyleEvent.defaultPrevented).toBe(false);

    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);

    const missingAttachInitial = presentation([containerElement()], [CONTAINER_STYLE_A]);
    const missingAttachSaved: Presentation[] = [];
    await mount(missingAttachInitial, missingAttachSaved);
    await selectElement(CONTAINER_ID);
    const missingAttachEvent = key({ ctrlKey: true });
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>("#container-linked-style");
      if (!select) throw new Error("Container linked style select was not rendered");
      changeSelect(select, "missing-resource");
      window.dispatchEvent(missingAttachEvent);
    });
    expect(missingAttachEvent.defaultPrevented).toBe(false);

    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);

    const noRelationshipInitial = presentation([containerElement()]);
    const noRelationshipSaved: Presentation[] = [];
    await mount(noRelationshipInitial, noRelationshipSaved);
    await selectElement(CONTAINER_ID);
    const noRelationshipEvent = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(noRelationshipEvent));
    expect(noRelationshipEvent.defaultPrevented).toBe(false);
  });
});
