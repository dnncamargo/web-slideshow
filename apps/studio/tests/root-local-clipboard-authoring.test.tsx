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

function crossOwnerPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "clipboard-root-definition-boundaries",
    title: "Clipboard owner boundaries",
    slides: [
      {
        id: "ordinary-slide-a",
        title: "Ordinary A",
        summary: "",
        speakerNotes: "",
        elements: [container("source-holder", [text("slide-source", "Slide source")])],
      },
      {
        id: "ordinary-slide-b",
        title: "Ordinary B",
        summary: "",
        speakerNotes: "",
        elements: [container("destination-holder", [text("slide-destination", "Destination")])],
      },
    ],
    rootDefinitions: [{
      id: "clipboard-root",
      name: "Clipboard Root",
      root: container("canonical-root", [
        text("root-source", "Root source"),
        container("root-destination"),
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

function crossOwnerNavigationPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard-cross-owner-navigation",
    title: "Root local Clipboard cross-owner navigation",
    slides: [
      {
        id: "ordinary-source",
        title: "Ordinary source",
        summary: "",
        speakerNotes: "",
        elements: [container("ordinary-wrapper", [text("child-a"), text("child-b")])],
      },
      {
        id: "root-receiver",
        title: "Root receiver",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
      },
      {
        id: "root-source",
        title: "Root source",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
        localRootChildren: [{
          targetContainerId: "receiver-container",
          children: [container("root-wrapper", [text("root-child-a"), text("root-child-b")])],
        }],
      },
      {
        id: "ordinary-receiver",
        title: "Ordinary receiver",
        summary: "",
        speakerNotes: "",
        elements: [container("ordinary-receiver-container")],
      },
    ],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-container"],
      root: container("root-container", [container("receiver-container")]),
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

  async function openRootDefinition(id = "clipboard-root"): Promise<void> {
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Custom Resources")?.click();
    });
    const section = Array.from(host.querySelectorAll<HTMLDetailsElement>("details"))
      .find((candidate) => candidate.querySelector("summary")?.textContent?.includes("Root Definitions"));
    if (!section) throw new Error("Expected Root Definitions section");
    if (!section.open) await act(async () => section.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const row = host.querySelector<HTMLElement>(`[data-root-definition-id="${id}"]`);
    if (!row) throw new Error(`Expected Root Definition ${id}`);
    const disclosure = row.querySelector<HTMLButtonElement>("[data-root-definition-disclosure]");
    if (disclosure?.getAttribute("aria-expanded") !== "true") await act(async () => disclosure?.click());
    const open = row.querySelector<HTMLButtonElement>('[data-root-definition-action="open"]');
    if (!open) throw new Error("Expected Open Root Definition action");
    await act(async () => open.click());
  }

  async function exitRootDefinition(): Promise<void> {
    const exit = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Exit master editing"));
    if (!exit) throw new Error("Expected Exit master editing button");
    await act(async () => exit.click());
  }

  async function openClipboardPanel(): Promise<void> {
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
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

  it("moves ordinary Slide content into a Root Definition as one undoable, reloadable action", async () => {
    const initial = crossOwnerPresentation();
    await mount(initial, async (value) => { saved.push(structuredClone(value)); });

    select(host, "source-holder");
    await pressKey("x", { ctrlKey: true });
    await openRootDefinition();
    select(host, "root-destination");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const moved = saved.at(-1);
    const definition = moved?.rootDefinitions?.find((item) => item.id === "clipboard-root");
    expect(moved?.slides[0]?.elements ?? []).toEqual([]);
    expect(definition?.root.id).toBe("canonical-root");
    expect(definition?.root.children.find((element) => element.id === "root-destination")?.type).toBe("container");
    const destination = definition?.root.children.find((element) => element.id === "root-destination");
    const movedHolder = destination?.type === "container" ? destination.children[0] : undefined;
    expect(movedHolder?.type).toBe("container");
    expect(movedHolder?.type === "container" ? movedHolder.children.map((element) => element.type === "text" ? element.content : element.type) : undefined).toEqual(["Slide source"]);

    await pressKey("z", { ctrlKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.elements).toEqual(initial.slides[0]?.elements);
    expect(saved.at(-1)?.rootDefinitions).toEqual(initial.rootDefinitions);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.elements).toEqual(moved?.slides[0]?.elements);
    expect(saved.at(-1)?.rootDefinitions).toEqual(moved?.rootDefinitions);

    await mount(saved.at(-1)!, async (value) => { saved.push(structuredClone(value)); });
    expect(host.querySelector('[data-presentation-id="slide-source"]')).toBeNull();
    await openRootDefinition();
    expect(host.textContent).toContain("Slide source");
    expect(host.querySelector('[data-presentation-id="canonical-root"]')).not.toBeNull();
  });

  it("moves Root Definition content to an ordinary Slide and preserves IDs within the moved tree", async () => {
    const initial = crossOwnerPresentation();
    await mount(initial, async (value) => { saved.push(structuredClone(value)); });
    await openRootDefinition();
    select(host, "root-source");
    await pressKey("x", { ctrlKey: true });
    await exitRootDefinition();
    select(host, "source-holder");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const moved = saved.at(-1);
    expect(moved?.rootDefinitions?.[0]?.root.id).toBe("canonical-root");
    expect(moved?.rootDefinitions?.[0]?.root.children.map((element) => element.id)).toEqual(["root-destination"]);
    const destination = moved?.slides[0]?.elements[0];
    expect(destination?.type === "container" ? destination.children.map((element) => element.type === "text" ? element.content : element.type) : undefined).toEqual(["Slide source", "Root source"]);
    expect(destination?.type === "container" ? new Set(destination.children.map((element) => element.id)).size : 0).toBe(2);
  });

  it("preserves Pending Cut on entry and exit from Root Definition editing", async () => {
    await mount(crossOwnerPresentation(), async (value) => { saved.push(structuredClone(value)); });
    select(host, "slide-source");
    await pressKey("x", { ctrlKey: true });
    await openRootDefinition();
    await openClipboardPanel();
    expect(host.textContent).toContain("Pending Cut");
    await exitRootDefinition();
    await openClipboardPanel();
    expect(host.textContent).toContain("Pending Cut");
    expect(host.querySelector('[data-presentation-id="slide-source"]')).not.toBeNull();
  });

  it("keeps an invalid cross-owner Paste non-destructive and protects the canonical Root Container", async () => {
    const invalid = forbiddenTopicsPresentation();
    await mount(invalid, async (value) => { saved.push(structuredClone(value)); });
    await openRootDefinition("root-1");
    select(host, "master-topics");
    await pressKey("x", { ctrlKey: true });
    await exitRootDefinition();
    select(host, "target-item-text");
    await pressKey("v", { ctrlKey: true });
    await openClipboardPanel();
    expect(host.textContent).toContain("Pending Cut");
    expect(host.querySelector('[data-presentation-id="master-topics"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="target-item-text"]')).not.toBeNull();
    expect(host.textContent).not.toContain("element.move");
    expect(save(host).disabled).toBe(true);
    expect(saved).toHaveLength(0);
    const cancelPendingCut = host.querySelector<HTMLButtonElement>('button[aria-label^="Pending Cut"]');
    if (!cancelPendingCut) throw new Error("Expected Pending Cut cancel action");
    await act(async () => cancelPendingCut.click());

    await openRootDefinition("root-1");
    select(host, "root");
    await pressKey("x", { ctrlKey: true });
    await openClipboardPanel();
    expect(host.textContent).not.toContain("Pending Cut");
    expect(host.querySelector('[data-presentation-id="root"]')).not.toBeNull();
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

  it("preserves an ordinary Cut while entering a Root-backed Slide and replays the cross-owner move", async () => {
    const initial = crossOwnerNavigationPresentation();
    await mount(initial, async (value) => { saved.push(structuredClone(value)); });

    select(host, "ordinary-wrapper");
    await pressKey("x", { ctrlKey: true });
    await openClipboard(host);
    expect(host.textContent).toContain("Pending Cut");

    const rootReceiverSlide = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Root receiver"));
    expect(rootReceiverSlide).toBeDefined();
    await act(async () => rootReceiverSlide?.click());
    expect(host.textContent).toContain("Pending Cut");

    select(host, "receiver-container");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const moved = saved.at(-1);
    expect(moved?.slides[0]?.elements).toEqual([]);
    expect(moved?.slides[1]?.localRootChildren?.[0]?.targetContainerId).toBe("receiver-container");
    const movedWrapper = moved?.slides[1]?.localRootChildren?.[0]?.children[0];
    expect(movedWrapper?.type).toBe("container");
    if (movedWrapper?.type !== "container") throw new Error("Expected moved Container");
    expect(movedWrapper.children.map((element) => element.id)).toEqual(["child-a-copy", "child-b-copy"]);
    expect(movedWrapper.children.map((element) => element.type === "text" ? element.content : null)).toEqual(["child-a", "child-b"]);
    expect(moved?.rootDefinitions).toEqual(initial.rootDefinitions);
    expect(host.textContent).not.toContain("Pending Cut");

    await pressKey("z", { ctrlKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)).toEqual(initial);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.elements).toEqual([]);
    expect(saved.at(-1)?.slides[1]?.localRootChildren?.[0]?.children[0]?.id).toBe("ordinary-wrapper-copy");
  });

  it("moves a Root-backed Cut to an ordinary Slide in the EditorWorkspace", async () => {
    const initial = crossOwnerNavigationPresentation();
    await mount(initial, async (value) => { saved.push(structuredClone(value)); });

    const rootSourceSlide = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Root source"));
    expect(rootSourceSlide).toBeDefined();
    await act(async () => rootSourceSlide?.click());
    select(host, "root-wrapper");
    await pressKey("x", { ctrlKey: true });
    await openClipboard(host);
    expect(host.textContent).toContain("Pending Cut");

    const ordinaryReceiverSlide = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Ordinary receiver"));
    expect(ordinaryReceiverSlide).toBeDefined();
    await act(async () => ordinaryReceiverSlide?.click());
    expect(host.textContent).toContain("Pending Cut");
    select(host, "ordinary-receiver-container");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const moved = saved.at(-1);
    expect(moved?.slides[2]?.localRootChildren).toBeUndefined();
    const movedWrapper = moved?.slides[3]?.elements[0]?.type === "container"
      ? moved.slides[3].elements[0].children[0]
      : undefined;
    expect(movedWrapper?.type).toBe("container");
    if (movedWrapper?.type !== "container") throw new Error("Expected moved Container");
    expect(movedWrapper.children.map((element) => element.id)).toEqual(["root-child-a-copy", "root-child-b-copy"]);
    expect(moved?.rootDefinitions).toEqual(initial.rootDefinitions);
    expect(host.textContent).not.toContain("Pending Cut");

    await pressKey("z", { ctrlKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)).toEqual(initial);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => save(host).click());
    const redone = saved.at(-1);
    const redoneReceiver = redone?.slides[3]?.elements[0];
    expect(redone?.slides[2]?.localRootChildren).toBeUndefined();
    expect(redoneReceiver?.type).toBe("container");
    if (redoneReceiver?.type !== "container") throw new Error("Expected ordinary receiver");
    expect(redoneReceiver.children[0]?.id).toBe("root-wrapper-copy");
  });
});
