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
    await act(async () => row("root-b").querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.textContent).toContain("Master slide · Root B");
    await openResources();
    await openRootDefinitions();
    expect(row("root-b").dataset.active).toBe("true");
    expect(initial.slides).toEqual(presentation().slides);
  });

  it("reopens a Root created through New from This Presentation", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    const newButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("New slide"));
    if (!newButton) throw new Error("New button not found");
    await act(async () => newButton.click());
    await act(async () => container.querySelector<HTMLInputElement>('input[value="root-definition"]')?.click());
    await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Root Definition name"]') && changeInput(container.querySelector<HTMLInputElement>('input[aria-label="Root Definition name"]')!, "Reopen me"));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Full"))?.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Create Root Definition")?.click());
    await save();
    const createdId = saved.at(-1)?.rootDefinitions?.find((definition) => definition.name === "Reopen me")?.id;
    expect(createdId).toBeTruthy();

    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Exit master editing"))?.click());
    await openResources();
    await openRootDefinitions();
    await act(async () => row(createdId!).querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.textContent).toContain("Master slide · Reopen me");
  });

  it("renames a Root through lifecycle history and preserves its ID and tree", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved, { kind: "root-definition", rootDefinitionId: "root-a" });
    await openResources();
    await openRootDefinitions();
    await act(async () => row("root-a").querySelector<HTMLButtonElement>('[data-root-definition-action="rename"]')?.click());
    const input = row("root-a").querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("rename input not found");
    await act(async () => changeInput(input, "  Renamed A  "));
    await act(async () => row("root-a").querySelector<HTMLButtonElement>('[data-root-definition-action="save-rename"]')?.click());
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
});
