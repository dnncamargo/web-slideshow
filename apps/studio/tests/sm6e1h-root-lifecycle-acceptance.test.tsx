// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6e1h-acceptance",
    title: "Lifecycle acceptance",
    slides: [{ id: "slide-1", title: "Original", elements: [] }],
  });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected input value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected textarea value setter");
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`expected button containing ${text}`);
  return button;
}

function exactButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`expected button ${text}`);
  return button;
}

describe("SM6E1H Root Definition lifecycle integration acceptance", () => {
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

  async function mount(initial: Presentation, saved: Presentation[]): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => saved.push(structuredClone(snapshot))}
        />
      </StudioI18nProvider>,
    ));
  }

  async function save(saved: Presentation[]): Promise<Presentation> {
    await act(async () => exactButton(container, "Save").click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("expected saved Presentation");
    return snapshot;
  }

  async function openNew(): Promise<void> {
    await act(async () => buttonByText(container, "New slide").click());
  }

  async function createRootDefinition(): Promise<void> {
    await act(async () => container.querySelector<HTMLInputElement>('input[value="root-definition"]')?.click());
    await act(async () => buttonByText(container, "Title + 2 Cols").click());
    const name = container.querySelector<HTMLInputElement>('input[aria-label="Root Definition name"]');
    if (!name) throw new Error("expected Root Definition name input");
    await act(async () => changeInput(name, "  Shared Root  "));
    await act(async () => exactButton(container, "Create Root Definition").click());
  }

  async function openResources(): Promise<void> {
    await act(async () => buttonByText(container, "Custom Resources").click());
  }

  async function openRootDefinitions(): Promise<HTMLElement> {
    const details = Array.from(container.querySelectorAll<HTMLDetailsElement>("details"))
      .find((candidate) => candidate.querySelector("summary")?.textContent?.includes("Root Definitions"));
    if (!details) throw new Error("expected Root Definitions section");
    if (!details.open) await act(async () => details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    return details;
  }

  it("proves the complete create, edit, authorize, associate, manage, and remount lifecycle", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved);

    await openNew();
    await createRootDefinition();
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.querySelector('[data-authoring-target="slide"]')).toBeNull();

    const createdText = container.querySelector<HTMLElement>('[data-presentation-id="root-definition-title"]');
    if (!createdText) throw new Error("expected generated Root Text");
    await act(async () => createdText.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = container.querySelector<HTMLTextAreaElement>("#text-content");
    if (!textarea) throw new Error("expected normal Text Inspector");
    await act(async () => changeTextarea(textarea, "Shared Root heading"));

    const rootContainer = container.querySelector<HTMLElement>('[data-presentation-id="root-definition-root"]');
    if (!rootContainer) throw new Error("expected canonical Root Container");
    await act(async () => rootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const receiver = container.querySelector<HTMLInputElement>("[data-root-local-content-receiver]");
    if (!receiver) throw new Error("expected Root receiver control");
    await act(async () => receiver.click());

    let snapshot = await save(saved);
    const createdRoot = snapshot.rootDefinitions?.[0];
    if (!createdRoot) throw new Error("expected created Root Definition");
    const createdRootId = createdRoot.id;
    expect(snapshot.rootDefinitions).toHaveLength(1);
    expect(snapshot.slides).toEqual(initial.slides);
    expect(createdRoot.name).toBe("Shared Root");
    expect(createdRoot.localChildTargetIds).toEqual(["root-definition-root"]);
    expect(createdRoot.root).toMatchObject({ id: "root-definition-root" });
    expect(JSON.stringify(createdRoot.root)).toContain("Shared Root heading");
    expect(snapshot.slides[0]?.elements).toEqual([]);
    expect(snapshot.slides[0]?.rootDefinitionId).toBeUndefined();
    expect(snapshot.slides[0]?.localRootChildren).toBeUndefined();

    await act(async () => buttonByText(container, "Exit master editing").click());
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();

    await openNew();
    expect(container.querySelector<HTMLInputElement>('input[value="slide"]')?.checked).toBe(true);
    await act(async () => buttonByText(container, "Blank").click());
    await act(async () => exactButton(container, "+ New").click());
    const newSlideIndex = 1;
    snapshot = await save(saved);
    expect(snapshot.slides).toHaveLength(2);
    expect(snapshot.slides[newSlideIndex]?.elements).toEqual([]);
    expect(snapshot.slides[newSlideIndex]?.rootDefinitionId).toBeUndefined();
    expect(snapshot.rootDefinitions?.[0]?.id).toBe(createdRootId);

    const association = container.querySelector<HTMLSelectElement>("[data-slide-root-definition]");
    if (!association) throw new Error("expected Slide Root Definition selector");
    await act(async () => {
      association.value = createdRootId;
      association.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('[data-presentation-id="root-definition-title"]')?.textContent).toContain("Shared Root heading");
    snapshot = await save(saved);
    const associatedSlide = snapshot.slides[newSlideIndex];
    expect(associatedSlide?.rootDefinitionId).toBe(createdRootId);
    expect(associatedSlide?.elements).toEqual([]);
    expect(associatedSlide?.localRootChildren).toBeUndefined();
    expect(PresentationSchema.safeParse(snapshot).success).toBe(true);

    await openResources();
    const rootSection = await openRootDefinitions();
    const row = rootSection.querySelector<HTMLElement>(`[data-root-definition-id="${createdRootId}"]`);
    if (!row) throw new Error("expected created Root in This Presentation");
    await act(async () => row.querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-definition-title"]')?.textContent).toContain("Shared Root heading");
    const reopenedRootContainer = container.querySelector<HTMLElement>('[data-presentation-id="root-definition-root"]');
    if (!reopenedRootContainer) throw new Error("expected reopened canonical Root Container");
    await act(async () => reopenedRootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(container.querySelector<HTMLInputElement>("[data-root-local-content-receiver]")?.checked).toBe(true);

    await openResources();
    await openRootDefinitions();
    const activeRow = container.querySelector<HTMLElement>(`[data-root-definition-id="${createdRootId}"]`);
    if (!activeRow) throw new Error("expected active Root row");
    await act(async () => activeRow.querySelector<HTMLButtonElement>('[data-root-definition-action="rename"]')?.click());
    const renameInput = activeRow.querySelector<HTMLInputElement>("input");
    if (!renameInput) throw new Error("expected Root rename input");
    await act(async () => changeInput(renameInput, "  Shared Layout  "));
    await act(async () => activeRow.querySelector<HTMLButtonElement>('[data-root-definition-action="save-rename"]')?.click());
    snapshot = await save(saved);
    expect(snapshot.rootDefinitions?.[0]?.name).toBe("Shared Layout");
    expect(snapshot.rootDefinitions?.[0]?.id).toBe(createdRootId);
    expect(snapshot.rootDefinitions?.[0]?.root).toEqual(createdRoot.root);
    expect(snapshot.rootDefinitions?.[0]?.localChildTargetIds).toEqual(createdRoot.localChildTargetIds);
    expect(snapshot.slides[newSlideIndex]?.rootDefinitionId).toBe(createdRootId);
    expect(container.textContent).toContain("Master slide · Shared Layout");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    snapshot = await save(saved);
    expect(snapshot.rootDefinitions?.[0]?.name).toBe("Shared Root");
    expect(snapshot.slides[newSlideIndex]?.rootDefinitionId).toBe(createdRootId);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    snapshot = await save(saved);
    expect(snapshot.rootDefinitions?.[0]?.name).toBe("Shared Layout");

    const referencedSection = await openRootDefinitions();
    expect(referencedSection.querySelector<HTMLButtonElement>(`[data-root-definition-id="${createdRootId}"] [data-root-definition-action="delete"]`)?.disabled).toBe(true);

    const finalSnapshot = saved.at(-1);
    if (!finalSnapshot) throw new Error("expected final saved snapshot");
    const parsedFinal = PresentationSchema.parse(finalSnapshot);
    expect(parsedFinal.rootDefinitions?.[0]?.root).toEqual(createdRoot.root);
    expect(parsedFinal.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["root-definition-root"]);
    expect(parsedFinal.slides[newSlideIndex]?.rootDefinitionId).toBe(createdRootId);
    expect(parsedFinal.slides[newSlideIndex]?.elements).toHaveLength(0);
    expect(parsedFinal.slides[newSlideIndex]?.localRootChildren).toBeUndefined();
    await openResources();
    await act(async () => buttonByText(container, "History").click());
    expect(container.textContent).toContain("Rename Root Definition");
    expect(container.textContent).toContain("Change local content receiver");
    expect(container.textContent).toContain("Change Root Definition");

    await act(async () => root.unmount());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await mount(parsedFinal, []);

    const slideButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) => button.className.includes("slideItem"));
    await act(async () => slideButtons.at(-1)?.click());
    expect(container.querySelector<HTMLSelectElement>("[data-slide-root-definition]")?.value).toBe(createdRootId);
    expect(container.querySelector('[data-presentation-id="root-definition-title"]')?.textContent).toContain("Shared Root heading");

    await openResources();
    const reloadedSection = await openRootDefinitions();
    expect(reloadedSection.querySelectorAll("[data-root-definition-id]")).toHaveLength(1);
    const reloadedRow = reloadedSection.querySelector<HTMLElement>(`[data-root-definition-id="${createdRootId}"]`);
    if (!reloadedRow) throw new Error("expected Root after remount");
    await act(async () => reloadedRow.querySelector<HTMLButtonElement>('[data-root-definition-action="open"]')?.click());
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-definition-title"]')?.textContent).toContain("Shared Root heading");
    const reloadedRootContainer = container.querySelector<HTMLElement>('[data-presentation-id="root-definition-root"]');
    if (!reloadedRootContainer) throw new Error("expected remounted canonical Root Container");
    await act(async () => reloadedRootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(container.querySelector<HTMLInputElement>("[data-root-local-content-receiver]")?.checked).toBe(true);
  });
});
