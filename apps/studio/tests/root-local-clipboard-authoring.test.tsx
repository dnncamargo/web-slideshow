// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const text = (id: string, content = id): PresentationElement => ({
  id,
  type: "text",
  hidden: false,
  variant: "body",
  content,
});

const container = (
  id: string,
  children: PresentationElement[] = [],
): Extract<PresentationElement, { type: "container" }> => ({
  id,
  type: "container",
  hidden: false,
  children,
});

function topicItem(id: string, slotId: string, content = id) {
  return {
    id,
    content: {
      id: slotId,
      children: [text(`${id}-text`, content)],
    },
    children: [],
  };
}

function forbiddenTopicsPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard-topics",
    title: "Root local Clipboard Topics",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      summary: "",
      speakerNotes: "",
      elements: [],
      rootDefinitionId: "root-1",
      localRootChildren: [
        {
          targetContainerId: "receiver-a",
          children: [{
            id: "local-topics-source",
            type: "topics",
            hidden: false,
            kind: "unordered",
            items: [topicItem("source-item", "source-slot", "Source")],
          }],
        },
        {
          targetContainerId: "receiver-b",
          children: [{
            id: "local-topics-target",
            type: "topics",
            hidden: false,
            kind: "unordered",
            items: [topicItem("target-item", "target-slot", "Target")],
          }],
        },
      ],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-a", "receiver-b"],
      root: container("root", [
        {
          id: "master-topics",
          type: "topics",
          hidden: false,
          kind: "unordered",
          items: [topicItem("master-item", "master-slot", "Master")],
        },
        container("receiver-a"),
        container("receiver-b"),
      ]),
    }],
  });
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard-ui",
    title: "Root local Clipboard UI",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      summary: "",
      speakerNotes: "",
      elements: [],
      rootDefinitionId: "root-1",
      localRootChildren: [{
        targetContainerId: "receiver-a",
        children: [container("local-container", [text("local-child")])],
      }],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-a", "receiver-b"],
      root: container("root", [
        text("master-source"),
        container("receiver-a"),
        container("receiver-b"),
      ]),
    }],
  });
}

function crossSlidePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard-cross-slide",
    title: "Root local Clipboard cross-Slide",
    slides: [
      {
        id: "slide-a",
        title: "Slide A",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
        localRootChildren: [{
          targetContainerId: "receiver-container",
          children: [container("local-wrapper", [text("child-a"), text("child-b")])],
        }],
      },
      {
        id: "slide-b",
        title: "Slide B",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
      },
    ],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-container"],
      root: container("root-container", [
        text("master-content", "Master"),
        container("receiver-container"),
      ]),
    }],
  });
}

function findElement(host: HTMLDivElement, id: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
  if (!element) throw new Error(`Expected element ${id}`);
  return element;
}

async function pressKey(key: string, modifiers: Partial<KeyboardEventInit> = {}): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    }));
  });
}

function save(host: HTMLDivElement): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === "Save");
  if (!button) throw new Error("Expected Save button");
  return button;
}

function select(host: HTMLDivElement, id: string): void {
  act(() => findElement(host, id).dispatchEvent(new Event("pointerdown", { bubbles: true })));
}

async function openClipboard(host: HTMLDivElement): Promise<void> {
  await act(async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard")?.click();
  });
}

describe("Root-backed Slide local Clipboard authoring", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  async function mount(source: Presentation, onSave: (value: Presentation) => Promise<void>): Promise<void> {
    saved = [];
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            key={source.id}
            initialPresentation={source}
            onSave={onSave}
          />
        </StudioI18nProvider>,
      );
    });
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={presentation()}
            onSave={async (value) => { saved.push(structuredClone(value)); }}
          />
        </StudioI18nProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("copies local content into a selected authorized master receiver without mutating the Root", async () => {
    const initial = presentation();
    select(host, "local-child");
    await pressKey("c", { ctrlKey: true });
    select(host, "receiver-b");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const result = saved.at(-1);
    expect(result).toBeDefined();
    expect(result?.slides[0]?.elements).toEqual([]);
    expect(result?.slides[0]?.localRootChildren?.map((record) => record.targetContainerId)).toEqual([
      "receiver-a",
      "receiver-b",
    ]);
    expect(result?.slides[0]?.localRootChildren?.[1]?.children.map((element) => element.id)).toEqual([
      "local-child-copy",
    ]);
    expect(result?.rootDefinitions).toEqual(initial.rootDefinitions);
  });

  it("cuts local content across receiver records atomically and replays exact Undo/Redo", async () => {
    select(host, "local-child");
    await pressKey("x", { ctrlKey: true });
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    expect(host.textContent).toContain("Pending Cut");
    select(host, "receiver-b");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());
    const moved = saved.at(-1);
    expect(moved?.slides[0]?.localRootChildren?.map((record) => record.targetContainerId)).toEqual([
      "receiver-a",
      "receiver-b",
    ]);
    expect(moved?.slides[0]?.localRootChildren?.[0]?.children[0]?.type).toBe("container");
    expect(moved?.slides[0]?.localRootChildren?.[0]?.children[0]?.type === "container"
      ? moved.slides[0]?.localRootChildren?.[0]?.children[0]?.children
      : undefined).toEqual([]);
    expect(moved?.slides[0]?.localRootChildren?.[1]?.children[0]?.id).toBe("local-child-copy");

    await pressKey("z", { ctrlKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.localRootChildren).toEqual(presentation().slides[0]?.localRootChildren);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.localRootChildren?.[1]?.children[0]?.id).toBe("local-child-copy");
  });

  it("pastes into a selected local Container and enables Clipboard-panel Paste only for valid local destinations", async () => {
    select(host, "local-child");
    await pressKey("c", { ctrlKey: true });
    select(host, "local-container");
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    const card = host.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(card).not.toBeNull();
    await act(async () => card?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await act(async () => save(host).click());

    const result = saved.at(-1);
    const localContainer = result?.slides[0]?.localRootChildren?.[0]?.children[0];
    expect(localContainer?.type).toBe("container");
    if (localContainer?.type !== "container") throw new Error("Expected local Container");
    expect(localContainer.children.map((element) => element.id)).toEqual(["local-child", "local-child-copy"]);
  });

  it("keeps projected master Cut and non-Container Paste fail-closed", async () => {
    const initial = presentation();
    select(host, "master-source");
    await pressKey("x", { ctrlKey: true });
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    expect(host.textContent).not.toContain("Pending Cut");

    await pressKey("c", { ctrlKey: true });
    const card = host.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(card).not.toBeNull();
    await act(async () => card?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    expect(saved).toHaveLength(0);
    expect(host.querySelector('[data-presentation-id="local-child"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="receiver-b"]')).not.toBeNull();
    expect(initial.slides[0]?.elements).toEqual([]);
  });

  it("keeps an invalid Topics-to-TopicItem paste unavailable with no history mutation", async () => {
    const source = forbiddenTopicsPresentation();
    const onSave = vi.fn(async (_value: Presentation) => {});
    await mount(source, onSave);

    select(host, "master-topics");
    await pressKey("c", { ctrlKey: true });
    select(host, "target-item-text");
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });

    const card = host.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(card).not.toBeNull();
    await act(async () => card?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await pressKey("v", { ctrlKey: true });
    expect(host.textContent).not.toContain("element.paste");

    const saveButton = save(host);
    expect(saveButton.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(host.querySelector('[data-presentation-id="target-item-text"]')).not.toBeNull();
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "History")?.click();
    });
    expect(host.textContent).toContain("History is not populated yet.");
  });

  it("keeps a rejected Root-local Topics Cut pending and leaves both records unchanged", async () => {
    const source = forbiddenTopicsPresentation();
    const onSave = vi.fn(async (_value: Presentation) => {});
    await mount(source, onSave);

    select(host, "local-topics-source");
    await pressKey("x", { ctrlKey: true });
    select(host, "target-item-text");
    await pressKey("v", { ctrlKey: true });

    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    expect(host.textContent).toContain("Pending Cut");

    const saveButton = save(host);
    expect(saveButton.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(host.querySelector('[data-presentation-id="local-topics-source"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="local-topics-target"]')).not.toBeNull();
  });

  it("moves a multi-child local Container from one Root-backed Slide to another in one history action", async () => {
    const initial = crossSlidePresentation();
    await mount(initial, async (value) => { saved.push(structuredClone(value)); });

    select(host, "local-wrapper");
    await pressKey("x", { ctrlKey: true });
    await openClipboard(host);
    expect(host.textContent).toContain("Pending Cut");

    const slideB = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Slide B"));
    expect(slideB).toBeDefined();
    await act(async () => slideB?.click());
    select(host, "receiver-container");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const moved = saved.at(-1);
    expect(moved?.slides[0]?.localRootChildren).toBeUndefined();
    const movedWrapper = moved?.slides[1]?.localRootChildren?.[0]?.children[0];
    expect(moved?.slides[1]?.localRootChildren?.[0]?.targetContainerId).toBe("receiver-container");
    expect(movedWrapper?.type).toBe("container");
    if (movedWrapper?.type !== "container") throw new Error("Expected moved Container");
    expect(movedWrapper.children.map((element) => element.type)).toEqual(["text", "text"]);
    expect(movedWrapper.children.map((element) => element.id)).toEqual(["child-a-copy", "child-b-copy"]);
    expect(movedWrapper.children.map((element) => element.type === "text" ? element.content : null)).toEqual(["child-a", "child-b"]);
    expect(host.textContent).not.toContain("Pending Cut");

    await pressKey("z", { ctrlKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)).toEqual(initial);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[1]?.localRootChildren?.[0]?.children[0]?.id).toBe("local-wrapper-copy");
    expect(saved.at(-1)?.slides[1]?.localRootChildren?.[0]?.children[0]?.type).toBe("container");
  });

  it("keeps a cross-Slide local Root Cut pending after an invalid destination", async () => {
    await mount(crossSlidePresentation(), async (value) => { saved.push(structuredClone(value)); });

    select(host, "local-wrapper");
    await pressKey("x", { ctrlKey: true });
    await openClipboard(host);
    const slideB = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Slide B"));
    expect(slideB).toBeDefined();
    await act(async () => slideB?.click());
    select(host, "master-content");
    await pressKey("v", { ctrlKey: true });

    expect(host.textContent).toContain("Pending Cut");
    expect(saved).toHaveLength(0);

    const slideA = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Slide A"));
    expect(slideA).toBeDefined();
    await act(async () => slideA?.click());
    expect(host.querySelector('[data-presentation-id="local-wrapper"]')).not.toBeNull();

    select(host, "receiver-container");
    await pressKey("v", { ctrlKey: true });
    expect(host.textContent).not.toContain("Pending Cut");
  });
});
