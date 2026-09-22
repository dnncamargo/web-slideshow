// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type ContainerElement, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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

function rootElement(presentation: Presentation, id: string): PresentationElement {
  const root = presentation.rootDefinitions?.[0]?.root;
  const element = root ? findElement([root], id) : undefined;
  if (!element) throw new Error(`Expected Root element ${id}`);
  return element;
}

function rootContainer(presentation: Presentation): ContainerElement {
  const root = presentation.rootDefinitions?.[0]?.root;
  if (!root) throw new Error("Expected Root Container");
  return root;
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d5-presentation",
    title: "SM6D5",
    slides: [{
      id: "retained-slide",
      title: "Retained",
      summary: "",
      speakerNotes: "",
      elements: [{
        id: "shared-container",
        type: "container",
        hidden: false,
        children: [],
        layout: { children: { direction: "column" } },
      }, {
        id: "root-text",
        type: "text",
        hidden: false,
        variant: "body",
        content: "Retained text",
        link: { kind: "url", href: "https://example.com/slide" },
      }, {
        id: "root-topics",
        type: "topics",
        hidden: false,
        kind: "unordered",
        items: [],
      }],
    }],
    linkedStyles: [{
      id: "container-style",
      name: "Root Container Style",
      layout: { children: { gap: 12, direction: "row" } },
      style: { background: { color: "#112233" } },
    }, {
      target: "topics",
      id: "topics-style",
      name: "Root Topics Style",
      kind: "ordered",
      itemGap: 10,
      markerColor: "#445566",
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching root",
      root: {
        id: "root-container",
        type: "container",
        hidden: false,
        children: [{
          id: "shared-container",
          type: "container",
          hidden: false,
          children: [],
          layout: { children: { direction: "column" } },
        }, {
          id: "root-text",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Root text",
          link: { kind: "url", href: "https://example.com/root" },
        }, {
          id: "root-topics",
          type: "topics",
          hidden: false,
          kind: "unordered",
          items: [],
        }],
        link: { kind: "url", href: "https://example.com/root-container" },
      },
    }],
  });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("Expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("SM6D5 Root specialized authoring", () => {
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
    vi.restoreAllMocks();
  });

  async function mount(initial = presentation()): Promise<ReturnType<typeof vi.fn>> {
    const onSave = vi.fn(async (_snapshot: Presentation) => {});
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initial}
            initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-1" }}
            onSave={onSave}
          />
        </StudioI18nProvider>,
      );
    });
    return onSave;
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`Expected rendered element ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function selectRootContainerFromTree(): Promise<void> {
    const elementsTab = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Elements");
    if (!elementsTab) throw new Error("Expected Elements tab");
    await act(async () => elementsTab.click());
    const rootRow = host.querySelector<HTMLElement>('[role="tree"] > li[role="treeitem"] > div');
    const rootButton = rootRow?.querySelectorAll<HTMLButtonElement>("button")[1];
    if (!rootButton) throw new Error("Expected Root Container tree row");
    await act(async () => rootButton.click());
    const inspectorTab = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Inspector");
    if (!inspectorTab) throw new Error("Expected Inspector tab");
    await act(async () => inspectorTab.click());
  }

  async function save(onSave: ReturnType<typeof vi.fn>): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Expected Save button");
    await act(async () => button.click());
    const snapshot = onSave.mock.calls.at(-1)?.[0] as Presentation | undefined;
    if (!snapshot) throw new Error("Expected saved Presentation");
    return snapshot;
  }

  async function replay(key: "z", shiftKey = false): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey, bubbles: true })));
  }

  it("shows the full Root Container Inspector and routes linked-style attach/detach through the Root owner", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-container");

    expect(host.querySelector("#container-direction")).not.toBeNull();
    expect(host.querySelector("#container-link-url")).not.toBeNull();
    expect(host.textContent).not.toContain("Master content is read-only in this workspace.");
    expect(host.querySelector('button[aria-label="Move up"]')).toBeNull();

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-direction")!, "row"));
    let saved = await save(onSave);
    const updatedShared = rootElement(saved, "shared-container");
    expect(updatedShared.type === "container" ? updatedShared.layout?.children?.direction : undefined).toBe("row");
    expect(saved.slides).toEqual(source.slides);

    await selectRootContainerFromTree();
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-direction")!, "row"));
    saved = await save(onSave);
    expect(rootContainer(saved).layout?.children?.direction).toBe("row");
    expect(saved.slides).toEqual(source.slides);

    await selectElement("shared-container");

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "container-style"));
    saved = await save(onSave);
    let shared = rootElement(saved, "shared-container");
    expect(shared.type).toBe("container");
    if (shared.type === "container") {
      expect(shared.linkedStyleId).toBe("container-style");
      expect(shared.layout?.children?.gap).toBeUndefined();
    }
    expect(saved.slides).toEqual(source.slides);

    await replay("z");
    saved = await save(onSave);
    const sharedAfterUndo = rootElement(saved, "shared-container");
    expect(sharedAfterUndo.type === "container" ? sharedAfterUndo.layout?.children?.direction : undefined).toBe("row");
    expect(sharedAfterUndo.type === "container" ? sharedAfterUndo.linkedStyleId : undefined).toBeUndefined();
    await replay("z", true);
    saved = await save(onSave);
    shared = rootElement(saved, "shared-container");
    expect(shared.type === "container" ? shared.linkedStyleId : undefined).toBe("container-style");

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, ""));
    saved = await save(onSave);
    shared = rootElement(saved, "shared-container");
    expect(shared.type).toBe("container");
    if (shared.type === "container") {
      expect(shared.linkedStyleId).toBeUndefined();
      expect(shared.layout?.children?.gap).toBe(12);
    }
    expect(saved.slides).toEqual(source.slides);
  });

  it("enables Root Topics linked-style relationships and isolates the retained Slide", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("root-topics");

    const relationship = host.querySelector<HTMLSelectElement>("#topics-linked-style");
    expect(relationship).not.toBeNull();
    expect(relationship?.disabled).toBe(false);
    await act(async () => changeSelect(relationship!, "topics-style"));
    let saved = await save(onSave);
    let topics = rootElement(saved, "root-topics");
    expect(topics.type === "topics" ? topics.linkedStyleId : undefined).toBe("topics-style");
    expect(saved.slides).toEqual(source.slides);

    await replay("z");
    saved = await save(onSave);
    expect(rootElement(saved, "root-topics")).toEqual(rootElement(source, "root-topics"));
    await replay("z", true);
    saved = await save(onSave);
    expect(rootElement(saved, "root-topics").type === "topics").toBe(true);

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#topics-linked-style")!, ""));
    saved = await save(onSave);
    topics = rootElement(saved, "root-topics");
    expect(topics.type === "topics" ? topics.linkedStyleId : undefined).toBeUndefined();
    expect(topics.type === "topics" ? topics.itemGap : undefined).toBe(10);
    expect(saved.slides).toEqual(source.slides);
  });

  it("keeps Root Text Style relationships on the generic target-aware boundary", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("root-text");

    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#text-variant")!, "title"));
    let saved = await save(onSave);
    expect(rootElement(saved, "root-text")).toMatchObject({ variant: "title" });
    expect(saved.slides).toEqual(source.slides);

    const detach = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Detach"));
    if (!detach) throw new Error("Expected Text Style detach action");
    await act(async () => detach.click());
    saved = await save(onSave);
    expect(rootElement(saved, "root-text")).toMatchObject({ variant: "title", styleDetached: true });

    await replay("z");
    saved = await save(onSave);
    expect(rootElement(saved, "root-text")).not.toHaveProperty("styleDetached");
    await replay("z", true);
    saved = await save(onSave);
    expect(rootElement(saved, "root-text")).toMatchObject({ styleDetached: true });

    const attach = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Attach"));
    if (!attach) throw new Error("Expected Text Style attach action");
    await act(async () => attach.click());
    saved = await save(onSave);
    expect(rootElement(saved, "root-text")).not.toHaveProperty("styleDetached");
    expect(saved.slides).toEqual(source.slides);
  });

  it("routes Root Container Fit, including measured activation and failure, without crossing owners", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("shared-container");
    const rendered = host.querySelector<HTMLElement>('[data-presentation-id="shared-container"]');
    if (!rendered) throw new Error("Expected rendered shared Container");
    Object.defineProperties(rendered, {
      clientWidth: { configurable: true, value: 840 },
      clientHeight: { configurable: true, value: 440 },
    });
    const fit = host.querySelector<HTMLSelectElement>("#container-children-fit");
    if (!fit) throw new Error("Expected Container Fit control");
    await act(async () => changeSelect(fit, "contain"));
    let saved = await save(onSave);
    let shared = rootElement(saved, "shared-container");
    expect(shared.type === "container" ? shared.layout?.children?.fit : undefined).toEqual({
      mode: "contain",
      sourceWidth: 840,
      sourceHeight: 440,
    });
    expect(saved.slides).toEqual(source.slides);

    await replay("z");
    saved = await save(onSave);
    const undoneShared = rootElement(saved, "shared-container");
    expect(undoneShared.type === "container" ? undoneShared.layout?.children?.fit : undefined).toBeUndefined();
    await replay("z", true);
    saved = await save(onSave);
    const redoneShared = rootElement(saved, "shared-container");
    expect(redoneShared.type === "container" ? redoneShared.layout?.children?.fit?.mode : undefined).toBe("contain");

    await act(async () => root.unmount());
    root = createRoot(host);
    const failedSource = presentation();
    const failedSave = await mount(failedSource);
    await selectElement("shared-container");
    const failedFit = host.querySelector<HTMLSelectElement>("#container-children-fit");
    if (!failedFit) throw new Error("Expected Container Fit control after remount");
    await act(async () => changeSelect(failedFit, "cover"));
    const failedSaveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    expect(failedSaveButton?.disabled).toBe(true);
    expect(failedSave).not.toHaveBeenCalled();
  });

  it("creates Root QR Images after editable sources, preserves selection/history, and blocks the canonical Root Container boundary", async () => {
    const source = presentation();
    const onSave = await mount(source);
    await selectElement("root-text");
    const qrButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("QR"));
    if (!qrButton) throw new Error("Expected Root Text QR action");
    await act(async () => qrButton.click());
    let saved = await save(onSave);
    const root = rootContainer(saved);
    const textIndex = root.children.findIndex((element) => element.id === "root-text");
    expect(root.children[textIndex + 1]?.type).toBe("image");
    expect(root.children[textIndex + 1]?.id).not.toBe("shared-container");
    expect(saved.slides).toEqual(source.slides);

    await replay("z");
    saved = await save(onSave);
    expect(rootContainer(saved).children.some((element) => element.type === "image" && element.alt.startsWith("QR code for"))).toBe(false);
    await replay("z", true);
    saved = await save(onSave);
    expect(rootContainer(saved).children[textIndex + 1]?.type).toBe("image");

    await selectElement("root-container");
    expect(host.querySelector("#container-direction")).not.toBeNull();
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>("button")).some((button) => button.textContent?.includes("QR"))).toBe(false);
    const blockedSave = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    expect(blockedSave?.disabled).toBe(true);
    expect(rootContainer(saved).children.filter((element) => element.type === "image")).toHaveLength(1);
  });
});
