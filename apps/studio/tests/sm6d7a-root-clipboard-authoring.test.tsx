// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { duplicateElement } from "../src/features/editor/element-operations";
import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import { collectPresentationAuthoringIds } from "../src/features/editor/presentation-authoring-trees";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function divider(id: string): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content: id };
}

function textWithContent(id: string, content: string): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function container(id: string, children: PresentationElement[] = []): Extract<PresentationElement, { type: "container" }> {
  return { id, type: "container", hidden: false, children };
}

function rootPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d7a-root-clipboard",
    title: "Root Clipboard",
    rootDefinitions: [{
      id: "root-definition",
      name: "Root Definition",
      root: container("root-container", [
        divider("root-source"),
        container("root-receiver", [divider("root-receiver-text")]),
      ]),
    }],
    slides: [{
      id: "slide-1",
      title: "Retained Slide",
      summary: "",
      speakerNotes: "",
      elements: [divider("slide-element")],
    }],
  });
}

function contentSlotPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-slot-clipboard",
    title: "Root Slot Clipboard",
    rootDefinitions: [{
      id: "root-definition",
      name: "Root Definition",
      root: container("root-container", [
        divider("slot-source"),
        {
          id: "topics",
          type: "topics",
          hidden: false,
          kind: "unordered",
          items: [
            { id: "item-a", content: { id: "slot-a", children: [textWithContent("slot-a-label", "Slot A"), divider("slot-a-original")] }, children: [] },
            { id: "item-b", content: { id: "slot-b", children: [textWithContent("slot-b-label", "Slot B"), divider("slot-b-original")] }, children: [] },
          ],
        },
        container("root-sibling", [divider("sibling-child")]),
      ]),
    }],
    slides: [{
      id: "slide-1", title: "Retained Slide", summary: "", speakerNotes: "",
      elements: [divider("slide-element")],
    }],
  });
}

function saveButton(container: HTMLElement): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === "Save");
  if (!button) throw new Error("expected Save button");
  return button;
}

function clickButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`expected ${label} button`);
  return button;
}

function rootDefinition(presentation: Presentation) {
  const definition = presentation.rootDefinitions?.find((candidate) => candidate.id === "root-definition");
  if (!definition) throw new Error("expected canonical Root Definition");
  return definition;
}

function collectElementIds(element: PresentationElement): string[] {
  const ids = [element.id];
  if (element.type === "container") {
    for (const child of element.children) ids.push(...collectElementIds(child));
  } else if (element.type === "topics") {
    const visit = (items: typeof element.items): void => {
      for (const item of items) {
        ids.push(item.id, item.content.id);
        for (const child of item.content.children) ids.push(...collectElementIds(child));
        visit(item.children);
      }
    };
    visit(element.items);
  }
  return ids;
}

function renderIds(container: HTMLDivElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-presentation-id]"),
  ).map((element) => element.getAttribute("data-presentation-id") ?? "");
}

function findPresentationElement(container: HTMLDivElement, id: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `[data-presentation-id="${id}"]`,
  );
  if (!element) throw new Error(`expected element ${id}`);
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

describe("SM6D7A Root clipboard authoring", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    saved = [];
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={rootPresentation()}
            initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-definition" }}
            onSave={async (presentation) => { saved.push(structuredClone(presentation)); }}
          />
        </StudioI18nProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("pastes a Root snapshot inside the canonical Root Container", async () => {
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    expect(host.querySelector("[class*='clipboardEntry']")).toBeNull();

    await pressKey("v", { ctrlKey: true });
    const ids = renderIds(host);
    expect(ids.filter((id) => id === "root-container")).toHaveLength(1);
    expect(ids).toContain("root-source");
    expect(ids).toContain("root-source-copy");
    expect(ids).not.toContain("root-definition-workspace:root-definition");

    await pressKey("z", { ctrlKey: true });
    expect(renderIds(host)).not.toContain("root-source-copy");
    expect(renderIds(host)).toContain("root-source");
    await pressKey("z", { ctrlKey: true, shiftKey: true });
    expect(renderIds(host)).toContain("root-source-copy");
  });

  it("does not cut the canonical Root Container", async () => {
    const before = renderIds(host);
    expect(saveButton(host).disabled).toBe(true);
    await act(async () => clickButton(host, "History").click());
    expect(host.textContent).toContain("History is not populated yet.");
    await act(async () => findPresentationElement(host, "root-container").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("x", { ctrlKey: true });

    expect(renderIds(host)).toEqual(before);
    expect(host.querySelector(".studio-editor-pending-cut")).toBeNull();
    expect(saveButton(host).disabled).toBe(true);
    expect(host.textContent).toContain("History is not populated yet.");
  });

  it("copies the canonical Root Container as one nested fresh-id descendant", async () => {
    await act(async () => findPresentationElement(host, "root-container").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    await pressKey("v", { ctrlKey: true });

    await act(async () => saveButton(host).click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("expected saved Root copy");
    const canonicalRoot = rootDefinition(snapshot).root;
    expect(canonicalRoot.id).toBe("root-container");
    expect(canonicalRoot.children.filter((element) => element.id === "root-container-copy")).toHaveLength(1);
    expect(canonicalRoot.children.filter((element) => element.id === "root-container")).toHaveLength(0);

    const ids = renderIds(host);
    expect(ids.filter((id) => id === "root-container")).toHaveLength(1);
    expect(ids.filter((id) => id === "root-container-copy")).toHaveLength(1);
    expect(ids).toContain("root-source-copy");
    expect(ids).toContain("root-receiver-copy");
    expect(ids).toContain("root-receiver-text-copy");
    expect(ids).not.toContain("root-definition-workspace:root-definition");

    await pressKey("z", { ctrlKey: true });
    expect(renderIds(host)).not.toContain("root-container-copy");
    expect(renderIds(host).filter((id) => id === "root-container")).toHaveLength(1);
    await pressKey("z", { ctrlKey: true, shiftKey: true });
    expect(renderIds(host)).toContain("root-container-copy");
    expect(renderIds(host).filter((id) => id === "root-container")).toHaveLength(1);
  });

  it("allocates collision-free ids for a copied Root subtree against the retained Slide", async () => {
    const source = rootPresentation();
    const slide = source.slides[0];
    if (!slide) throw new Error("expected retained Slide");
    const reservedSlide = {
      ...source,
      slides: [{
        ...slide,
        elements: [
          ...slide.elements,
          divider("root-container-copy"),
          divider("root-source-copy"),
          divider("root-receiver-copy"),
          divider("root-receiver-text-copy"),
        ],
      }],
    };
    const fixtureIds = collectPresentationAuthoringIds(reservedSlide);
    const reservedIds = [
      "root-container-copy", "root-source-copy", "root-receiver-copy", "root-receiver-text-copy",
    ];
    expect(reservedIds.map((id) => fixtureIds.has(id))).toEqual([true, true, true, true]);
    const sourceRoot = rootDefinition(reservedSlide).root;
    const isolatedDuplicate = duplicateElement(sourceRoot, new Set(fixtureIds));
    const isolatedDuplicateIds = new Set<string>();
    collectAuthoringIds(isolatedDuplicate, isolatedDuplicateIds);
    expect([...isolatedDuplicateIds]).toEqual([
      "root-container-copy-2",
      "root-source-copy-2",
      "root-receiver-copy-2",
      "root-receiver-text-copy-2",
    ]);
    expect([...isolatedDuplicateIds].some((id) => fixtureIds.has(id))).toBe(false);

    // initialPresentation is consumed only on mount; replace the prior
    // EditorWorkspace instance so this exact fixture is the route's state.
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={reservedSlide}
          initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-definition" }}
          onSave={async (presentation) => { saved.push(structuredClone(presentation)); }}
        />
      </StudioI18nProvider>,
    ));
    await act(async () => findPresentationElement(host, "root-container").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    await pressKey("v", { ctrlKey: true });
    await act(async () => saveButton(host).click());

    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("expected saved collision proof");
    const canonical = rootDefinition(snapshot).root;
    const clone = canonical.children.find((element) => element.id !== "root-source" && element.id !== "root-receiver");
    if (clone?.type !== "container") throw new Error("expected copied Container descendant");
    expect(canonical.id).toBe("root-container");
    expect(canonical.children.filter((element) => element.id === "root-container")).toHaveLength(0);
    const cloneIds = collectElementIds(clone);
    const originalIds = collectElementIds(sourceRoot);
    expect(cloneIds.every((id) => !originalIds.includes(id))).toBe(true);
    expect(cloneIds.every((id) => !fixtureIds.has(id))).toBe(true);
    const presentationIds = [
      ...snapshot.slides.flatMap((entry) => entry.elements.flatMap(collectElementIds)),
      ...snapshot.rootDefinitions!.flatMap((definition) => collectElementIds(definition.root)),
    ];
    expect(new Set(presentationIds).size).toBe(presentationIds.length);
    expect(snapshot.slides[0]?.elements.slice(1).map((element) => element.id)).toEqual([
      "root-container-copy", "root-source-copy", "root-receiver-copy", "root-receiver-text-copy",
    ]);
  });

  it("pastes a Root snapshot into the selected Topics ContentSlot and replays exact slot state", async () => {
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={contentSlotPresentation()}
          initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-definition" }}
          onSave={async (presentation) => { saved.push(structuredClone(presentation)); }}
        />
      </StudioI18nProvider>,
    ));
    await act(async () => findPresentationElement(host, "slot-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    await act(async () => clickButton(host, "Elements").click());
    const slotA = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] [role="treeitem"] button'))
      .find((button) => button.textContent?.trim() === "Slot A");
    if (!slotA) throw new Error("expected Topic A ContentSlot Tree row");
    await act(async () => slotA.click());
    await pressKey("v", { ctrlKey: true });
    await act(async () => saveButton(host).click());

    const first = saved.at(-1);
    if (!first) throw new Error("expected saved ContentSlot paste");
    const rootA = rootDefinition(first).root;
    const topicsA = rootA.children.find((element) => element.id === "topics");
    if (topicsA?.type !== "topics") throw new Error("expected saved Topics element");
    expect(rootA.id).toBe("root-container");
    expect(rootA.children.filter((element) => element.id === "root-container")).toHaveLength(0);
    expect(rootA.children.map((element) => element.id)).toEqual(["slot-source", "topics", "root-sibling"]);
    expect(topicsA.items[0]?.content.children.map((element) => element.id)).toEqual(["slot-a-label", "slot-a-original", "slot-source-copy"]);
    expect(topicsA.items[1]?.content.children.map((element) => element.id)).toEqual(["slot-b-label", "slot-b-original"]);
    expect(first.slides).toEqual(contentSlotPresentation().slides);

    await pressKey("z", { ctrlKey: true });
    await act(async () => saveButton(host).click());
    const undone = saved.at(-1);
    if (!undone) throw new Error("expected saved ContentSlot undo");
    const undoneTopics = rootDefinition(undone).root.children.find((element) => element.id === "topics");
    if (undoneTopics?.type !== "topics") throw new Error("expected Topics after undo");
    expect(undoneTopics.items[0]?.content.children.map((element) => element.id)).toEqual(["slot-a-label", "slot-a-original"]);
    expect(undoneTopics.items[1]?.content.children.map((element) => element.id)).toEqual(["slot-b-label", "slot-b-original"]);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => saveButton(host).click());
    const redone = saved.at(-1);
    if (!redone) throw new Error("expected saved ContentSlot redo");
    const redoneTopics = rootDefinition(redone).root.children.find((element) => element.id === "topics");
    if (redoneTopics?.type !== "topics") throw new Error("expected Topics after redo");
    expect(redoneTopics.items[0]?.content.children.map((element) => element.id)).toEqual(["slot-a-label", "slot-a-original", "slot-source-copy"]);
    expect(redoneTopics.items[1]?.content.children.map((element) => element.id)).toEqual(["slot-b-label", "slot-b-original"]);
  });

  it("moves a Root descendant within the same Root Definition with fresh ids", async () => {
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("x", { ctrlKey: true });
    await act(async () => findPresentationElement(host, "root-receiver").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("v", { ctrlKey: true });

    const ids = renderIds(host);
    expect(ids).not.toContain("root-source");
    expect(ids).toContain("root-source-copy");
    expect(ids.filter((id) => id === "root-container")).toHaveLength(1);

    await pressKey("z", { ctrlKey: true });
    expect(renderIds(host)).toContain("root-source");
    expect(renderIds(host)).not.toContain("root-source-copy");
    await pressKey("z", { ctrlKey: true, shiftKey: true });
    expect(renderIds(host)).not.toContain("root-source");
    expect(renderIds(host)).toContain("root-source-copy");
    await act(async () => clickButton(host, "History").click());
    expect(host.textContent?.match(/Move element/g)).toHaveLength(1);
    expect(host.textContent).not.toContain("Paste Text");
  });

  it("carries a Root snapshot to the retained Slide without moving the Root source", async () => {
    const initial = rootPresentation();
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-definition" }}
          onSave={async (presentation) => { saved.push(structuredClone(presentation)); }}
        />
      </StudioI18nProvider>,
    ));
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    const exit = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("expected Root exit control");
    await act(async () => exit.click());
    await pressKey("v", { ctrlKey: true });
    await act(async () => saveButton(host).click());

    const afterPaste = saved.at(-1);
    if (!afterPaste) throw new Error("expected canonical saved Slide paste");
    const rootChildren = rootDefinition(afterPaste).root.children;
    const slideElements = afterPaste.slides[0]?.elements;
    expect(rootChildren.filter((element) => element.id === "root-source")).toHaveLength(1);
    expect(rootChildren.filter((element) => element.id === "root-source-copy")).toHaveLength(0);
    expect(slideElements?.map((element) => element.id)).toEqual(["slide-element", "root-source-copy"]);
    expect(slideElements?.[1]).toEqual({ ...rootChildren.find((element) => element.id === "root-source"), id: "root-source-copy" });
    expect(rootDefinition(afterPaste).root.id).toBe("root-container");
    await act(async () => clickButton(host, "History").click());
    expect(host.textContent?.match(/Paste Text/g)).toHaveLength(1);
    expect(host.textContent).not.toContain("Move element");

    const pastedStructure = structuredClone(slideElements?.[1]);
    await pressKey("z", { ctrlKey: true });
    expect(renderIds(host)).not.toContain("root-source-copy");
    await act(async () => saveButton(host).click());
    const undone = saved.at(-1);
    if (!undone) throw new Error("expected canonical saved Undo");
    expect(undone.slides[0]?.elements).toEqual(initial.slides[0]?.elements);
    expect(rootDefinition(undone).root).toEqual(rootDefinition(initial).root);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    expect(renderIds(host)).toContain("root-source-copy");
    await act(async () => saveButton(host).click());
    const redone = saved.at(-1);
    if (!redone) throw new Error("expected canonical saved Redo");
    expect(redone.slides[0]?.elements[1]).toEqual(pastedStructure);
    expect(rootDefinition(redone).root).toEqual(rootDefinition(initial).root);
  });

  it("cancels Root Cut on exit and never moves it into the retained Slide", async () => {
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("x", { ctrlKey: true });
    expect(findPresentationElement(host, "root-source").classList.contains("studio-editor-pending-cut")).toBe(true);

    const exit = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("expected Root exit control");
    act(() => exit.click());
    expect(host.querySelector(".studio-editor-pending-cut")).toBeNull();
    await pressKey("v", { ctrlKey: true });

    const ids = renderIds(host);
    expect(ids).toContain("slide-element");
    expect(ids).not.toContain("root-source-copy");
    expect(ids).not.toContain("root-source-moved");
    expect(ids).toEqual(["slide-element"]);
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "History")?.click());
    expect(host.textContent).not.toContain("Move element");
  });
});
