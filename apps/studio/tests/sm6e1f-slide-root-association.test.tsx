// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../src/features/custom-library/custom-library-repository";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(populated = false): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6e1f-slide-association",
    title: "Slide association",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: populated ? [{ id: "ordinary-text", type: "text", hidden: false, variant: "body", content: "Keep me" }] : [],
    }],
    rootDefinitions: [{
      id: "root-a",
      name: "Root A",
      root: { id: "root-a-container", type: "container", hidden: false, children: [{ id: "root-a-text", type: "text", hidden: false, variant: "body", content: "Root A content" }] },
    }, {
      id: "root-b",
      name: "Root B",
      root: { id: "root-b-container", type: "container", hidden: false, children: [{ id: "root-b-text", type: "text", hidden: false, variant: "body", content: "Root B content" }] },
    }, {
      id: "root-c",
      name: "Root C",
      root: { id: "root-c-container", type: "container", hidden: false, children: [{ id: "root-c-text", type: "text", hidden: false, variant: "body", content: "Root C content" }] },
    }],
  });
}

function localContentPresentation(): Presentation {
  return PresentationSchema.parse({
    ...presentation(),
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      rootDefinitionId: "root-a",
      elements: [],
      localRootChildren: [{
        targetContainerId: "root-a-container",
        children: [{ id: "local-text", type: "text", hidden: false, variant: "body", content: "Local content" }],
      }],
    }],
    rootDefinitions: (presentation().rootDefinitions ?? []).map((definition) =>
      definition.id === "root-a" ? { ...definition, localChildTargetIds: ["root-a-container"] } : definition),
  });
}

function elementStyleRepository(items: CustomLibraryItemRecord[]): CustomLibraryRepository & { listItems: ReturnType<typeof vi.fn> } {
  return {
    saveItem: async () => "unused",
    listItems: vi.fn(async () => items),
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
}

describe("SM6E1F Slide Root association", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial: Presentation = presentation(), saved: Presentation[] = [], initialAuthoringTarget?: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string }, customLibraryRepository?: CustomLibraryRepository): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          initialAuthoringTarget={initialAuthoringTarget}
          customLibraryRepository={customLibraryRepository}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
        />
      </StudioI18nProvider>,
    ));
  }

  async function selectRoot(value: string): Promise<void> {
    const select = container.querySelector<HTMLSelectElement>("[data-slide-root-definition]");
    if (!select) throw new Error("Slide Root Definition selector not found");
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function save(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button not found");
    await act(async () => button.click());
  }

  async function openHistory(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "History");
    if (!button) throw new Error("History button not found");
    await act(async () => button.click());
  }

  async function openResources(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!button) throw new Error("Custom Resources button not found");
    await act(async () => button.click());
  }

  async function openRootDefinitions(): Promise<HTMLElement> {
    const details = Array.from(container.querySelectorAll<HTMLDetailsElement>("details"))
      .find((candidate) => candidate.querySelector("summary")?.textContent?.includes("Root Definitions"));
    if (!details) throw new Error("Root Definitions section not found");
    if (!details.open) await act(async () => details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    return details;
  }

  it("lists all Roots on Slides, attaches Root A, renders it, and saves only the reference", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved);
    const select = container.querySelector<HTMLSelectElement>("[data-slide-root-definition]");
    expect(Array.from(select?.options ?? [], (option) => option.textContent)).toEqual(["No Root Definition", "Root A", "Root B", "Root C"]);
    expect(select?.disabled).toBe(false);
    await selectRoot("root-a");
    expect(container.querySelector<HTMLSelectElement>("[data-slide-root-definition]")?.disabled).toBe(false);
    expect(container.querySelector('[data-presentation-id="root-a-text"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="ordinary-text"]')).toBeNull();
    await openHistory();
    expect(container.textContent).toContain("Change Root Definition");
    await save();
    expect(saved.at(-1)?.slides[0]).toMatchObject({ id: "slide-1", rootDefinitionId: "root-a", elements: [] });
    expect(saved.at(-1)?.rootDefinitions).toEqual(initial.rootDefinitions);
  });

  it("switches, unlinks, and restores the Slide association with Undo/Redo", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectRoot("root-a");
    await selectRoot("root-b");
    expect(container.querySelector('[data-presentation-id="root-b-text"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(container.querySelector('[data-presentation-id="root-a-text"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    expect(container.querySelector('[data-presentation-id="root-b-text"]')).not.toBeNull();
    await selectRoot("");
    expect(container.querySelector('[data-presentation-id="root-b-text"]')).toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(container.querySelector('[data-presentation-id="root-b-text"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    expect(container.querySelector<HTMLSelectElement>('[data-slide-root-definition]')?.value).toBe("");
    await save();
    expect(saved.at(-1)?.slides[0]).toMatchObject({ elements: [] });
    expect(saved.at(-1)?.slides[0]).not.toHaveProperty("rootDefinitionId");
    expect(initial.slides[0]?.elements).toEqual([]);
  });

  it("does not expose Slide association controls in Root mode and keeps referenced deletion blocked", async () => {
    await mount(PresentationSchema.parse({ ...presentation(), defaultRootDefinitionId: "root-a" }), [], { kind: "root-definition", rootDefinitionId: "root-a" });
    expect(container.querySelector("[data-slide-root-definition]")).toBeNull();
    await openResources();
    const section = await openRootDefinitions();
    const row = section.querySelector<HTMLElement>('[data-root-definition-id="root-a"]');
    if (!row) throw new Error("Root A row not found");
    const disclosure = row.querySelector<HTMLButtonElement>("[data-root-definition-disclosure]");
    if (!disclosure) throw new Error("Root A disclosure not found");
    if (disclosure.getAttribute("aria-expanded") !== "true") {
      await act(async () => disclosure.click());
    }
    expect(row.querySelector<HTMLButtonElement>('[data-root-definition-action="delete"]')?.disabled).toBe(true);
  });

  it("disables Root association for ordinary Slide content without data loss or a History action", async () => {
    const initial = presentation(true);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    expect(container.querySelector<HTMLSelectElement>('[data-slide-root-definition]')?.disabled).toBe(true);
    expect(container.textContent).toContain("ordinary content");
    await selectRoot("root-a");
    expect(container.querySelector<HTMLSelectElement>('[data-slide-root-definition]')?.value).toBe("");
    expect(container.querySelector('[data-presentation-id="ordinary-text"]')).not.toBeNull();
    expect(saved).toHaveLength(0);
  });

  it("keeps a Root-backed Slide locked while local content exists and re-enables after pruning it", async () => {
    const saved: Presentation[] = [];
    await mount(localContentPresentation(), saved);
    const select = container.querySelector<HTMLSelectElement>('[data-slide-root-definition]');
    expect(select?.value).toBe("root-a");
    expect(select?.disabled).toBe(true);
    expect(container.textContent).toContain("local root content");

    const localText = container.querySelector<HTMLElement>('[data-presentation-id="local-text"]');
    if (!localText) throw new Error("expected local content");
    await act(async () => localText.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
    const deleteButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((button) => button.textContent?.trim() === "Delete");
    if (!deleteButton) throw new Error("expected local content delete action");
    await act(async () => deleteButton.click());

    expect(container.querySelector('[data-presentation-id="local-text"]')).toBeNull();
    expect(container.querySelector<HTMLSelectElement>('[data-slide-root-definition]')?.disabled).toBe(false);
  });

  it("applies Element Styles to local Root content without writing slide.elements", async () => {
    const source = localContentPresentation();
    const saved: Presentation[] = [];
    const item: CustomLibraryItemRecord = {
      id: "local-element-style",
      item: {
        name: "Local text style",
        root: { type: "text", properties: [{ path: "content", value: "Styled local content" }] },
      },
    };
    const repository = elementStyleRepository([item]);
    await mount(source, saved, { kind: "slide", slideIndex: 0 }, repository);

    const localText = container.querySelector<HTMLElement>('[data-presentation-id="local-text"]');
    if (!localText) throw new Error("expected local content");
    await act(async () => localText.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await openResources();
    const browse = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add saved element");
    if (!browse) throw new Error("expected Element Style browse control");
    expect(browse.disabled).toBe(false);
    await act(async () => browse.click());
    await act(async () => undefined);
    const itemButton = Array.from(container.querySelectorAll<HTMLButtonElement>("[class*='customLibraryApplyItem']"))
      .find((candidate) => candidate.textContent?.includes("Local text style"));
    if (!itemButton) throw new Error("expected local Element Style item");
    await act(async () => itemButton.click());
    const apply = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Apply to selected");
    if (!apply) throw new Error("expected Element Style apply action");
    await act(async () => apply.click());
    await save();

    const changed = saved.at(-1);
    expect(changed?.slides[0]?.elements).toEqual([]);
    expect(changed?.slides[0]?.localRootChildren?.[0]?.children[0]).toMatchObject({ id: "local-text", content: "Styled local content" });
    expect(changed?.rootDefinitions).toEqual(source.rootDefinitions);

    const resourcesToggle = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!resourcesToggle) throw new Error("expected Custom Resources action");
    await act(async () => resourcesToggle.click());
    const elements = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!elements) throw new Error("expected Elements panel action");
    await act(async () => elements.click());
    expect(container.querySelectorAll('[role="treeitem"][aria-selected="true"]')).toHaveLength(1);
    expect(container.querySelector('[role="treeitem"][aria-selected="true"]')?.textContent).toContain("Styled local content");

    await openHistory();
    expect(container.textContent).toContain("Custom library apply");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    await save();
    expect(saved.at(-1)?.slides[0]?.localRootChildren?.[0]?.children[0]).toMatchObject({ id: "local-text", content: "Local content" });
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    await save();
    const redone = saved.at(-1);
    expect(redone?.slides[0]?.localRootChildren?.[0]?.children[0]).toMatchObject({ id: "local-text", content: "Styled local content" });

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(redone, [], { kind: "slide", slideIndex: 0 }, repository);
    expect(container.querySelector('[data-presentation-id="local-text"]')?.textContent).toContain("Styled local content");
    expect(redone?.slides[0]?.elements).toEqual([]);
    expect(redone?.rootDefinitions).toEqual(source.rootDefinitions);
  });

  it("blocks Element Styles for Root master content on a Root-backed Slide", async () => {
    const source = localContentPresentation();
    const repository = elementStyleRepository([{
      id: "blocked-element-style",
      item: { name: "Blocked style", root: { type: "text", properties: [{ path: "content", value: "Should not apply" }] } },
    }]);
    await mount(source, [], { kind: "slide", slideIndex: 0 }, repository);

    const masterText = container.querySelector<HTMLElement>('[data-presentation-id="root-a-text"]');
    if (!masterText) throw new Error("expected Root master content");
    await act(async () => masterText.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await openResources();
    const browse = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add saved element");
    if (!browse) throw new Error("expected Element Style browse control");
    expect(browse.disabled).toBe(true);
    await act(async () => browse.click());
    expect(repository.listItems).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Apply to selected");
  });

  it("does not lock association after canonical local-content pruning and preserves the Presentation default option", async () => {
    const initial = PresentationSchema.parse({
      ...presentation(),
      defaultRootDefinitionId: "root-a",
      slides: [{ id: "slide-1", rootDefinitionId: "root-a", elements: [] }],
    });
    await mount(initial);
    const select = container.querySelector<HTMLSelectElement>('[data-slide-root-definition]');
    expect(select?.disabled).toBe(false);
    expect(select?.options[0]?.textContent).toBe("Use Presentation default — Root A");
  });

  it("associates a newly created Root to a newly created Slide through the normal flow", async () => {
    const saved: Presentation[] = [];
    await mount(PresentationSchema.parse({ schemaVersion: 1, id: "created-flow", title: "Created flow", slides: [{ id: "slide-1", elements: [] }] }), saved);
    const newButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("New slide"));
    if (!newButton) throw new Error("New button not found");
    await act(async () => newButton.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-layout-action="root-definition"]')?.click());
    await save();
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Exit master editing"))?.click());
    await act(async () => newButton.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Blank"))?.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "+ New")?.click());
    const createdRootId = saved.at(-1)?.rootDefinitions?.[0]?.id;
    if (!createdRootId) throw new Error("created Root was not saved");
    await selectRoot(createdRootId);
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-definition-root"]')).not.toBeNull();
  });
});
