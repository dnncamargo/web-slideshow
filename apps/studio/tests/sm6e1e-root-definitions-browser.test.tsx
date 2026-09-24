// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(options: { referenced?: boolean } = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6e1e-root-browser",
    title: "Root browser",
    ...(options.referenced ? { defaultRootDefinitionId: "root-a" } : {}),
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      ...(options.referenced ? { rootDefinitionId: "root-a" } : {}),
      elements: [],
    }, {
      id: "slide-2",
      title: "Slide 2",
      elements: [],
    }],
    rootDefinitions: [
      {
        id: "root-a",
        name: "Root A",
        root: { id: "root-a-container", type: "container", hidden: false, children: [{ id: "root-a-text", type: "text", hidden: false, variant: "body", content: "A" }] },
      },
      {
        id: "root-b",
        name: "Root B",
        root: { id: "root-b-container", type: "container", hidden: false, children: [{ id: "root-b-text", type: "text", hidden: false, variant: "body", content: "B" }] },
      },
    ],
  });
}

function usagePresentation(): Presentation {
  return PresentationSchema.parse({
    ...presentation(),
    defaultRootDefinitionId: "root-a",
    slides: [
      { id: "slide-explicit-a", title: "Explicit A", rootDefinitionId: "root-a", elements: [] },
      { id: "slide-default-a", title: "Default A", elements: [] },
      { id: "slide-explicit-b", title: "Explicit B", rootDefinitionId: "root-b", elements: [] },
    ],
  });
}

function defaultReferenceOnlyPresentation(): Presentation {
  return PresentationSchema.parse({
    ...presentation(),
    defaultRootDefinitionId: "root-a",
    slides: [{ id: "slide-explicit-b", title: "Explicit B", rootDefinitionId: "root-b", elements: [] }],
  });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected input value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SM6E1E This Presentation Root Definitions browser", () => {
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

  function row(id: string): HTMLElement {
    const result = container.querySelector<HTMLElement>(`[data-root-definition-id="${id}"]`);
    if (!result) throw new Error(`Root row not found: ${id}`);
    return result;
  }

  async function expandRoot(id: string): Promise<HTMLElement> {
    const rootRow = row(id);
    const disclosure = rootRow.querySelector<HTMLButtonElement>('[data-root-definition-disclosure]');
    if (!disclosure) throw new Error("Root disclosure not found");
    if (disclosure.getAttribute("aria-expanded") !== "true") await act(async () => disclosure.click());
    return rootRow;
  }

  async function save(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button not found");
    await act(async () => button.click());
  }

  it("lists Roots under This Presentation and opens Root B directly from a Slide", async () => {
    await mount();
    await openResources();
    const section = await openRootDefinitions();
    expect(section.textContent).toContain("Root A");
    expect(section.textContent).toContain("Root B");
    expect(section.querySelectorAll("[data-root-definition-id]")).toHaveLength(2);

    await expandRoot("root-b");
    await act(async () => row("root-b").querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.textContent).toContain("Master slide · Root B");
    expect(container.querySelector('[data-presentation-id="root-b-text"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-a-text"]')).toBeNull();
  });

  it("switches directly from Root A to Root B without changing the retained Slides", async () => {
    const initial = presentation();
    await mount(initial, [], { kind: "root-definition", rootDefinitionId: "root-a" });
    await openResources();
    await openRootDefinitions();
    await expandRoot("root-b");
    await act(async () => row("root-b").querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.textContent).toContain("Master slide · Root B");
    await openResources();
    await openRootDefinitions();
    expect(row("root-b").dataset.active).toBe("true");
    expect(initial.slides).toEqual(presentation().slides);
  });

  it("reopens a Root created through the layout picker from This Presentation", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    const newButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("New slide"));
    if (!newButton) throw new Error("New button not found");
    await act(async () => newButton.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-layout-action="root-definition"]')?.click());
    await save();
    const createdId = saved.at(-1)?.rootDefinitions?.at(-1)?.id;
    expect(createdId).toBeTruthy();

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Exit master editing"))?.click());
    await openResources();
    await openRootDefinitions();
    await expandRoot(createdId!);
    await act(async () => row(createdId!).querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.textContent).toContain("Master slide · Root Definition 1");
  });

  it("renames a Root through lifecycle history and preserves its ID and tree", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved, { kind: "root-definition", rootDefinitionId: "root-a" });
    await openResources();
    await openRootDefinitions();
    await expandRoot("root-a");
    await act(async () => row("root-a").querySelector<HTMLButtonElement>('[data-root-definition-action="rename"]')?.click());
    const input = row("root-a").querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("rename input not found");
    await act(async () => changeInput(input, "  Renamed A  "));
    await act(async () => row("root-a").querySelector<HTMLButtonElement>('[data-root-definition-action="save-rename"]')?.click());
    expect(row("root-a").querySelector<HTMLButtonElement>('[data-root-definition-disclosure]')?.getAttribute("aria-expanded")).toBe("true");
    await save();
    const renamed = saved.at(-1)?.rootDefinitions?.find((definition) => definition.id === "root-a");
    expect(renamed?.name).toBe("Renamed A");
    expect(renamed?.root).toEqual(initial.rootDefinitions?.[0]?.root);
    expect(saved.at(-1)?.slides).toEqual(initial.slides);
    expect(container.textContent).toContain("Master slide · Renamed A");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    await save();
    expect(saved.at(-1)?.rootDefinitions?.[0]?.name).toBe("Root A");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    await save();
    expect(saved.at(-1)?.rootDefinitions?.[0]?.name).toBe("Renamed A");
  });

  it("deletes an unused Root with confirmation and restores it through Undo/Redo", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await openResources();
    await openRootDefinitions();
    await expandRoot("root-b");
    await act(async () => row("root-b").querySelector<HTMLButtonElement>('[data-root-definition-action="delete"]')?.click());
    expect(container.textContent).toContain('Delete Root Definition "Root B"?');
    const dialog = container.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("delete confirmation not found");
    await act(async () => Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Delete")?.click());
    await save();
    expect(saved.at(-1)?.rootDefinitions?.map((definition) => definition.name)).toEqual(["Root A"]);
    expect(saved.at(-1)?.slides).toEqual(initial.slides);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    await save();
    expect(saved.at(-1)?.rootDefinitions?.[1]).toEqual(initial.rootDefinitions?.[1]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    await save();
    expect(saved.at(-1)?.rootDefinitions).toHaveLength(1);
  });

  it("blocks deletion of a referenced Root before confirmation", async () => {
    const initial = presentation({ referenced: true });
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await openResources();
    const section = await openRootDefinitions();
    await expandRoot("root-a");
    const deleteButton = section.querySelector<HTMLButtonElement>('[data-root-definition-id="root-a"] [data-root-definition-action="delete"]');
    expect(deleteButton?.disabled).toBe(true);
    expect(container.querySelector("[data-studio-danger-confirm-dialog]")).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it("deletes the active unused Root and safely returns to the retained Slide", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved, { kind: "root-definition", rootDefinitionId: "root-b" });
    await openResources();
    await openRootDefinitions();
    await expandRoot("root-b");
    await act(async () => row("root-b").querySelector<HTMLButtonElement>('[data-root-definition-action="delete"]')?.click());
    const dialog = container.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("delete confirmation not found");
    await act(async () => Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Delete")?.click());
    await save();
    expect(saved.at(-1)?.rootDefinitions?.map((definition) => definition.id)).toEqual(["root-a"]);
    expect(saved.at(-1)?.slides).toEqual(initial.slides);
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-b-text"]')).toBeNull();
  });

  it("orders Root Definitions before Linked Styles and preserves section disclosure state", async () => {
    await mount();
    await openResources();
    const presentationSection = container.querySelector<HTMLElement>('[aria-labelledby="custom-resources-this-presentation"]');
    if (!presentationSection) throw new Error("This Presentation section not found");
    const titles = Array.from(presentationSection.querySelectorAll<HTMLElement>("details > summary"), (summary) => summary.textContent?.trim());
    expect(titles.slice(0, 5)).toEqual(["Root Definitions2", "Linked Styles0", "Text Styles4", "Palette", "Fonts"]);

    const rootSection = Array.from(presentationSection.querySelectorAll<HTMLDetailsElement>("details"))
      .find((details) => details.querySelector("summary")?.textContent?.includes("Root Definitions"));
    if (!rootSection) throw new Error("Root Definitions section not found");
    expect(row("root-a").textContent).toContain("Used by 0 slides");
    if (!rootSection.open) await act(async () => rootSection.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(rootSection.open).toBe(true);
    await act(async () => rootSection.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(rootSection.open).toBe(false);
  });

  it("shows effective explicit and default Slide usage without counting a different explicit Root", async () => {
    await mount(usagePresentation());
    await openResources();
    await openRootDefinitions();

    expect(row("root-a").textContent).toContain("Used by 2 slides");
    expect(row("root-b").textContent).toContain("Used by 1 slide");

    const rootA = await expandRoot("root-a");
    expect(rootA.querySelectorAll("[data-root-definition-usage-slide]")).toHaveLength(2);
    expect(rootA.querySelector('[data-root-definition-usage-source="explicit"]')).not.toBeNull();
    expect(rootA.querySelector('[data-root-definition-usage-source="default"]')).not.toBeNull();
    expect(rootA.textContent).toContain("Explicit A");
    expect(rootA.textContent).toContain("Default A");
    expect(rootA.textContent).not.toContain("Explicit B");
  });

  it("navigates to a listed Root Definition Slide usage", async () => {
    await mount(usagePresentation(), [], { kind: "root-definition", rootDefinitionId: "root-a" });
    await openResources();
    await openRootDefinitions();
    const rootA = await expandRoot("root-a");
    await act(async () => rootA.querySelector<HTMLButtonElement>('[data-root-definition-usage-slide="1"]')?.click());
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.textContent).toContain("Default A");
  });

  it("keeps Delete protected by the Presentation default even with zero effective Slide usage", async () => {
    await mount(defaultReferenceOnlyPresentation());
    await openResources();
    const section = await openRootDefinitions();
    expect(row("root-a").textContent).toContain("Used by 0 slides");
    await expandRoot("root-a");
    expect(section.querySelector<HTMLButtonElement>('[data-root-definition-id="root-a"] [data-root-definition-action="delete"]')?.disabled).toBe(true);
  });
});
