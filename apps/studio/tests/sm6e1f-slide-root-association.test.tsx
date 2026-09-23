// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

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

  async function mount(initial: Presentation = presentation(), saved: Presentation[] = [], initialAuthoringTarget?: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string }): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          initialAuthoringTarget={initialAuthoringTarget}
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
    await selectRoot("root-a");
    expect(container.querySelector('[data-presentation-id="root-a-text"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="ordinary-text"]')).toBeNull();
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
    expect(section.querySelector<HTMLButtonElement>('[data-root-definition-id="root-a"] [data-root-definition-action="delete"]')?.disabled).toBe(true);
  });

  it("rejects populated Slide association without data loss or a History action", async () => {
    const initial = presentation(true);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectRoot("root-a");
    expect(container.querySelector<HTMLSelectElement>('[data-slide-root-definition]')?.value).toBe("");
    expect(container.textContent).toContain("This Slide has local root content");
    expect(container.querySelector('[data-presentation-id="ordinary-text"]')).not.toBeNull();
    expect(saved).toHaveLength(0);
  });

  it("associates a newly created Root to a newly created Slide through the normal flow", async () => {
    const saved: Presentation[] = [];
    await mount(PresentationSchema.parse({ schemaVersion: 1, id: "created-flow", title: "Created flow", slides: [{ id: "slide-1", elements: [] }] }), saved);
    const newButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("New slide"));
    if (!newButton) throw new Error("New button not found");
    await act(async () => newButton.click());
    await act(async () => container.querySelector<HTMLInputElement>('input[value="root-definition"]')?.click());
    const nameInput = container.querySelector<HTMLInputElement>('input[aria-label="Root Definition name"]');
    if (!nameInput) throw new Error("Root name input not found");
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    inputSetter?.call(nameInput, "Created Root");
    await act(async () => nameInput.dispatchEvent(new Event("input", { bubbles: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Full"))?.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Create Root Definition")?.click());
    await save();
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Exit master editing"))?.click());
    await act(async () => newButton.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Blank"))?.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "+ New")?.click());
    const createdRootId = saved.at(-1)?.rootDefinitions?.find((definition) => definition.name === "Created Root")?.id;
    if (!createdRootId) throw new Error("created Root was not saved");
    await selectRoot(createdRootId);
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-definition-title"]')).not.toBeNull();
  });
});
