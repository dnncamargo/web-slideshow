// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function text(id: string, content = id): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function container(id: string, children: PresentationElement[] = []): Extract<PresentationElement, { type: "container" }> {
  return { id, type: "container", hidden: false, children };
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d3-presentation",
    title: "SM6D3",
    slides: [{ id: "slide-1", title: "Retained", elements: [text("slide-text", "Slide")] }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching master",
      root: container("root-container", [
        container("child-container", [text("child-a", "A"), text("child-b", "B")]),
        text("root-text", "Root text"),
      ]),
    }],
  });
}

describe("SM6D3 Root Definition CRUD authoring", () => {
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

  async function mount(initial = presentation(), onSave = vi.fn()): Promise<void> {
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
  }

  function crud(): HTMLFormElement {
    const form = host.querySelector<HTMLFormElement>("form[class*='elementCrud']");
    if (!form) throw new Error("expected Element CRUD controls");
    return form;
  }

  function addButton(): HTMLButtonElement {
    const button = crud().querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("expected Add button");
    return button;
  }

  function crudButton(label: string): HTMLButtonElement {
    const found = Array.from(crud().querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`expected CRUD button ${label}`);
    return found;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`expected button ${label}`);
    return found;
  }

  function dialogButton(label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`expected dialog button ${label}`);
    return found;
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`expected element ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function chooseAddType(type: string): Promise<void> {
    const select = crud().querySelector<HTMLSelectElement>("select");
    if (!select) throw new Error("expected Add type select");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected select value setter");
    await act(async () => {
      setter.call(select, type);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function add(type: string): Promise<void> {
    await chooseAddType(type);
    await act(async () => addButton().click());
  }

  function saveButton(): HTMLButtonElement {
    return button("Save");
  }

  function key(keyValue: string, options: KeyboardEventInit = {}): KeyboardEvent {
    return new KeyboardEvent("keydown", { key: keyValue, bubbles: true, cancelable: true, ...options });
  }

  it("adds with no selection inside the canonical root and replays history", async () => {
    const source = presentation();
    await mount(source);

    expect(crud().textContent).toContain("Adds inside the root container.");
    await add("image");
    expect(host.querySelector('[data-presentation-id="root-container"] [data-presentation-id="image-element"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"]')?.getAttribute("data-presentation-id")).toBe("root-container");
    expect(saveButton().disabled).toBe(false);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(host.querySelector('[data-presentation-id="image-element"]')).toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"]')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector('[data-presentation-id="root-container"] [data-presentation-id="image-element"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"]')?.getAttribute("data-presentation-id")).toBe("root-container");
    expect(saveButton().disabled).toBe(false);

    await act(async () => button("Exit master editing").click());
    expect(host.querySelector('[data-presentation-id="slide-text"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-text"]')).toBeNull();
    expect(host.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
  });

  it("keeps root-selected, descendant container, and ordinary descendant insertion semantics", async () => {
    await mount();

    await selectElement("root-container");
    await add("divider");
    expect(host.querySelector('[data-presentation-id="root-container"] [data-presentation-id="divider-element"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"] > [data-presentation-id="divider-element"]')).not.toBeNull();

    await selectElement("child-container");
    await add("image");
    expect(host.querySelector('[data-presentation-id="child-container"] [data-presentation-id="image-element"]')).not.toBeNull();

    await selectElement("root-text");
    await add("divider");
    const root = host.querySelector('[data-presentation-id="root-container"]');
    const ids = Array.from(root?.querySelectorAll<HTMLElement>(":scope > [data-presentation-id]") ?? [])
      .map((element) => element.dataset.presentationId);
    expect(ids.indexOf("divider-element-2")).toBe(ids.indexOf("root-text") + 1);
  });

  it("adds Table and Topics with global preparation while retaining Slides", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    await mount(source, onSave);

    await add("table");
    await add("topics");
    expect(host.querySelector('[data-presentation-type="table"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-type="topics"]')).not.toBeNull();

    await act(async () => saveButton().click());
    const saved = onSave.mock.calls[0]?.[0];
    if (!saved) throw new Error("expected saved presentation");
    expect(saved.slides).toEqual(source.slides);
    expect(saved.rootDefinitions?.[0]?.root.id).toBe("root-container");
    expect(saved.rootDefinitions?.[0]?.root.children.some((element) => element.type === "table")).toBe(true);
    expect(saved.rootDefinitions?.[0]?.root.children.some((element) => element.type === "topics")).toBe(true);
    expect(saved.textStyles?.map((style) => style.id)).toEqual([
      SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
      SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
      SYSTEM_TOPICS_TEXT_STYLE_ID,
    ]);
  });

  it("duplicates a descendant container as an immediate sibling with recursive IDs and history", async () => {
    await mount();
    await selectElement("child-container");
    await act(async () => crudButton("Duplicate").click());

    expect(host.querySelector('[data-presentation-id="child-container-copy"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="child-container-copy"] [data-presentation-id="child-a"]')).toBeNull();
    expect(host.querySelector('[data-presentation-id="child-container-copy"] [data-presentation-id="child-a-copy"]')).not.toBeNull();
    expect(crudButton("Duplicate").disabled).toBe(false);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(host.querySelector('[data-presentation-id="child-container-copy"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector('[data-presentation-id="child-container-copy"]')).not.toBeNull();
  });

  it("protects the canonical root container through UI and keyboard seams", async () => {
    const source = presentation();
    await mount(source);
    await selectElement("root-container");

    expect(crudButton("Duplicate").disabled).toBe(true);
    expect(crudButton("Delete").disabled).toBe(true);
    await act(async () => window.dispatchEvent(key("Delete")));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"]')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it("deletes a root descendant with captured target ownership and undo/redo", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    await mount(source, onSave);
    await selectElement("root-text");
    await act(async () => window.dispatchEvent(key("Delete")));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => dialogButton("Delete").click());

    expect(host.querySelector('[data-presentation-id="root-text"]')).toBeNull();
    expect(saveButton().disabled).toBe(false);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(host.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector('[data-presentation-id="root-text"]')).toBeNull();
    expect(source.slides).toEqual(presentation().slides);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves descendant container children in order and keeps root identity", async () => {
    await mount();
    await selectElement("child-container");
    await act(async () => window.dispatchEvent(key("Delete")));
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("keep its children");
    await act(async () => dialogButton("Delete container, keep children").click());

    expect(host.querySelector('[data-presentation-id="child-container"]')).toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"] [data-presentation-id="child-a"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"] [data-presentation-id="child-b"]')).not.toBeNull();
    const rootChildren = () => Array.from(
      host.querySelector<HTMLElement>('[data-presentation-id="root-container"]')
        ?.querySelectorAll<HTMLElement>(":scope > [data-presentation-id]") ?? [],
      (element) => element.dataset.presentationId,
    );
    expect(rootChildren()).toEqual(["child-a", "child-b", "root-text"]);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(host.querySelector('[data-presentation-id="child-container"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(host.querySelector('[data-presentation-id="child-container"]')).toBeNull();
    expect(host.querySelector('[data-presentation-id="root-container"]')).not.toBeNull();
    expect(rootChildren()).toEqual(["child-a", "child-b", "root-text"]);
  });

  it("closes a pending root deletion when exiting the owner before confirmation", async () => {
    await mount();
    await selectElement("root-text");
    await act(async () => window.dispatchEvent(key("Delete")));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => button("Exit master editing").click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('[data-presentation-id="slide-text"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-text"]')).toBeNull();
  });
});
