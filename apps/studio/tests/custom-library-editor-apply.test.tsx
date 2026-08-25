// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PresentationSchema,
  type PowerShowElement,
  type Presentation,
} from "@powershow/document-schema";

import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../src/features/custom-library/custom-library-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function text(id: string, content: string): PowerShowElement {
  return { type: "text", id, hidden: false, variant: "body", content };
}

function image(id: string): PowerShowElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: `/assets/${id}.png`,
    alt: id,
    fit: "contain",
  };
}

function container(id: string, children: PowerShowElement[]): PowerShowElement {
  return { type: "container", id, hidden: false, children };
}

const textRecipe = {
  type: "text" as const,
  properties: [{ path: "content", value: "Applied text" }],
};
const imageRecipe = { type: "image" as const, properties: [] };
const containerRecipe = {
  type: "container" as const,
  properties: [],
  children: [{ type: "text" as const, properties: [{ path: "content", value: "Library child" }] }],
};
const chartRecipe = { type: "chart" as const, properties: [] };

const items: CustomLibraryItemRecord[] = [
  { id: "text-item", item: { name: "Text preset", root: textRecipe } },
  { id: "image-item", item: { name: "Image preset", root: imageRecipe } },
  { id: "container-item", item: { name: "Container composition", root: containerRecipe } },
  { id: "chart-item", item: { name: "Chart preset", root: chartRecipe } },
];

function topicsElement(): PowerShowElement {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items: [{
      id: "topic-1",
      content: { id: "slot-1", children: [text("topic-text", "Topic content")] },
      children: [],
    }],
  };
}

function makePresentation(elements: PowerShowElement[], secondSlide = false): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "custom-library-editor-apply",
    title: "Custom Library integration",
    description: "",
    aspectRatio: "16:9",
    slides: [
      {
        id: "slide-1",
        title: "First",
        summary: "",
        speakerNotes: "",
        elements,
      },
      ...(secondSlide
        ? [{ id: "slide-2", title: "Second", summary: "", speakerNotes: "", elements: [text("second-root", "Untouched")] }]
        : []),
    ],
  });
}

function fakeRepository(listItems: () => Promise<CustomLibraryItemRecord[]>): CustomLibraryRepository {
  return {
    saveItem: async () => "saved",
    listItems,
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
}

describe("Custom Library Editor integration", () => {
  let containerElement: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    containerElement = document.createElement("div");
    document.body.appendChild(containerElement);
    root = createRoot(containerElement);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mount(
    value: Presentation,
    saved: Presentation[],
  ): Promise<{ onSave: ReturnType<typeof vi.fn>; listItems: ReturnType<typeof vi.fn> }> {
    const listItems = vi.fn(async () => items);
    const onSave = vi.fn(async (next: Presentation) => {
      saved.push(structuredClone(next));
    });

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={value}
            customLibraryRepository={fakeRepository(listItems)}
            onSave={onSave}
          />
        </StudioI18nProvider>,
      );
    });

    return { onSave, listItems };
  }

  async function openElements(): Promise<void> {
    const button = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!button) throw new Error("Elements tab not found");
    await act(async () => button.click());
  }

  async function openPicker(): Promise<void> {
    const button = containerElement.querySelector<HTMLButtonElement>("[data-custom-library-apply]");
    if (!button) throw new Error("Custom Library Apply opener not found");
    await act(async () => button.click());
    await act(async () => undefined);
  }

  async function applyItem(name: string): Promise<void> {
    const itemButton = Array.from(
      containerElement.querySelectorAll<HTMLButtonElement>("[class*='customLibraryApplyItem']"),
    ).find((candidate) => candidate.textContent?.includes(name));
    if (!itemButton) throw new Error(`Custom Library item not found: ${name}`);
    await act(async () => itemButton.click());
    const applyButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Apply");
    if (!applyButton) throw new Error("Apply button not found");
    await act(async () => applyButton.click());
  }

  async function saveAfterApply(saved: Presentation[]): Promise<Presentation> {
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    const next = saved.at(-1);
    if (!next) throw new Error("Expected autosave snapshot");
    return next;
  }

  async function selectElement(label: string): Promise<void> {
    const button = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("[class*='elementTreeSelect']"))
      .find((candidate) => candidate.textContent?.includes(label));
    if (!button) throw new Error(`Tree element not found: ${label}`);
    await act(async () => button.click());
  }

  it("lazily creates a root Text and selects the applied element", async () => {
    const saved: Presentation[] = [];
    const mounted = await mount(makePresentation([text("existing", "Existing")]), saved);
    expect(mounted.listItems).not.toHaveBeenCalled();
    await openElements();
    await openPicker();
    expect(mounted.listItems).toHaveBeenCalledOnce();
    await applyItem("Text preset");

    const next = await saveAfterApply(saved);
    const slide = next.slides[0];
    expect(slide?.elements.map((element) => element.type)).toEqual(["text", "text"]);
    expect(slide?.elements[0]?.id).toBe("existing");
    expect(slide?.elements[1]?.type === "text" && slide.elements[1].content).toBe("Applied text");
    expect(slide?.elements[1]?.id).not.toBe("existing");
    expect(containerElement.querySelectorAll('[role="treeitem"][aria-selected="true"]')).toHaveLength(1);
    expect(containerElement.textContent).toContain(`Text · ${slide?.elements[1]?.id}`);
  });

  it("merges Text into the selected Text without creating a sibling", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("target-text", "Before")]), saved);
    await openElements();
    await selectElement("Text — Before");
    await openPicker();
    await applyItem("Text preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements).toHaveLength(1);
    expect(slide?.elements[0]?.id).toBe("target-text");
    expect(slide?.elements[0]?.type === "text" && slide.elements[0].content).toBe("Applied text");
    expect(containerElement.textContent).toContain("Text · target-text");
  });

  it("creates a different-type Image immediately after selected Text", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("target-text", "Before")]), saved);
    await openElements();
    await selectElement("Text — Before");
    await openPicker();
    await applyItem("Image preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements.map((element) => element.type)).toEqual(["text", "image"]);
    expect(slide?.elements[0]?.id).toBe("target-text");
    expect(slide?.elements[1]?.id).not.toBe("target-text");
    expect(containerElement.textContent).toContain(`Image · ${slide?.elements[1]?.id}`);
  });

  it("keeps Text sibling placement for a selected Container", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([container("container-a", [text("child-a", "Existing child")])]), saved);
    await openElements();
    await selectElement("Container");
    await openPicker();
    await applyItem("Text preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    const rootContainer = slide?.elements[0];
    expect(slide?.elements).toHaveLength(2);
    expect(rootContainer?.type).toBe("container");
    expect(rootContainer?.type === "container" && rootContainer.children.map((child) => child.id)).toEqual(["child-a"]);
    expect(slide?.elements[1]?.type).toBe("text");
  });

  it("merges Container composition into the selected Container", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([container("container-a", [text("child-a", "Existing child")])]), saved);
    await openElements();
    await selectElement("Container");
    await openPicker();
    await applyItem("Container composition");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements).toHaveLength(1);
    const rootContainer = slide?.elements[0];
    expect(rootContainer?.id).toBe("container-a");
    expect(rootContainer?.type === "container" && rootContainer.children.map((child) => child.type)).toEqual(["text", "text"]);
    expect(rootContainer?.type === "container" && rootContainer.children[1]?.type === "text" && rootContainer.children[1].content).toBe("Library child");
    expect(containerElement.textContent).toContain("Container · container-a");
  });

  it("treats structural Topic ContentSlot selection as root creation", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([topicsElement()]), saved);
    await openElements();
    await selectElement("Topic content");
    await openPicker();
    await applyItem("Text preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements.map((element) => element.type)).toEqual(["topics", "text"]);
    const topics = slide?.elements[0];
    expect(topics?.type === "topics" && topics.items[0]?.content.children.map((child) => child.id)).toEqual(["topic-text"]);
    expect(containerElement.textContent).toContain(`Text · ${slide?.elements[1]?.id}`);
    expect(containerElement.textContent).not.toContain("Content slot");
  });

  it("keeps Presentation and selection unchanged for unsupported Chart create", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("existing", "Existing")]), saved);
    await openElements();
    await openPicker();
    await applyItem("Chart preset");

    expect(containerElement.textContent).toContain("This item cannot be created in the Editor yet.");
    expect(saved).toHaveLength(0);
    expect(containerElement.textContent).toContain("No element selected.");
  });

  it("autosaves only the selected slide after Apply", async () => {
    const saved: Presentation[] = [];
    const initial = makePresentation([text("first-root", "First")], true);
    await mount(initial, saved);
    await openElements();
    await openPicker();
    await applyItem("Text preset");

    const next = await saveAfterApply(saved);
    expect(next.slides[0]?.elements).toHaveLength(2);
    expect(next.slides[1]).toEqual(initial.slides[1]);
  });
});
