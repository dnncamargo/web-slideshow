// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(slides = 2): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d-root-creation",
    title: "SM6D Root creation",
    slides: Array.from({ length: slides }, (_, index) => ({
      id: `slide-${index + 1}`,
      title: `Slide ${index + 1}`,
      elements: [],
    })),
  });
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`expected button containing ${text}`);
  return button;
}

function exactButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`expected button ${text}`);
  return button;
}

describe("SM6E1D Slide and Root Definition creation flow", () => {
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

  async function mount(
    initial: Presentation = presentation(),
    saved: Presentation[] = [],
  ): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initial}
            onSave={async (snapshot) => {
              saved.push(structuredClone(snapshot));
            }}
          />
        </StudioI18nProvider>,
      );
    });
  }

  async function openNew(): Promise<void> {
    await act(async () => buttonByText(container, "New slide").click());
  }

  async function chooseRoot(): Promise<void> {
    const rootTile = container.querySelector<HTMLButtonElement>('[data-layout-action="root-definition"]');
    if (!rootTile) throw new Error("expected Root Definition layout tile");
    await act(async () => rootTile.click());
  }

  async function save(): Promise<void> {
    await act(async () => exactButtonByText(container, "Save").click());
  }

  it("preserves the default Slide flow and inserts the selected preset", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    await openNew();

    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Root Definition name"]')).toBeNull();
    expect(container.querySelectorAll("[data-layout-action]")).toHaveLength(1);
    expect(container.querySelectorAll('button[class*="layoutPreset"]').length).toBe(7);
    await act(async () => buttonByText(container, "Two Columns").click());
    await act(async () => exactButtonByText(container, "+ New").click());
    await save();

    const snapshot = saved.at(-1);
    expect(snapshot?.slides).toHaveLength(3);
    expect(snapshot?.slides[1]?.elements[0]).toMatchObject({
      type: "container",
      layout: { children: { direction: "row", gap: 32 } },
    });
    expect(snapshot?.rootDefinitions).toBeUndefined();
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.querySelector('[class*="slideItemSelected"] [class*="slideNumber"]')?.textContent).toBe("2");
    expect(container.querySelector("[class*='layoutPicker']")).toBeNull();
  });

  it("creates a blank Root immediately from the eighth layout tile with one history action", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    await openNew();
    await chooseRoot();

    await save();
    const snapshot = saved.at(-1);
    const created = snapshot?.rootDefinitions?.[0];
    expect(snapshot?.slides).toHaveLength(2);
    expect(snapshot?.defaultRootDefinitionId).toBeUndefined();
    expect(snapshot?.slides.every((slide) => slide.rootDefinitionId === undefined)).toBe(true);
    expect(created?.name).toBe("Root Definition 1");
    expect(created?.root.type).toBe("container");
    expect(created?.root.children).toHaveLength(0);
    expect(created?.root.layout).toMatchObject({ width: "100%", height: "100%" });
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.textContent).toContain("Master slide · Root Definition 1");
    expect(container.querySelector("[class*='layoutPicker']")).toBeNull();

    await act(async () => exactButtonByText(container, "History").click());
    expect(container.textContent).toContain("Create Root Definition");
  });

  it("keeps the Root tile as a blank Root creation action", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await openNew();
    await chooseRoot();
    await save();

    const snapshot = saved.at(-1);
    const created = snapshot?.rootDefinitions?.[0];
    expect(created?.name).toBe("Root Definition 1");
    expect(created?.root).toMatchObject({ type: "container", layout: { width: "100%", height: "100%" }, children: [] });
    expect(snapshot?.slides).toEqual(initial.slides);
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
  });

  it("creates a blank Root, then undo removes it and redo restores the document", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    await openNew();
    await chooseRoot();
    await save();

    const created = saved.at(-1)?.rootDefinitions?.[0];
    expect(created?.name).toBe("Root Definition 1");
    expect(created?.root).toMatchObject({ type: "container", hidden: false, layout: { width: "100%", height: "100%" }, children: [] });

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    await save();
    expect(saved.at(-1)?.rootDefinitions).toBeUndefined();

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    await save();
    expect(saved.at(-1)?.rootDefinitions?.[0]).toEqual(created);
  });

  it("supports multiple Roots in Root mode and can create a Slide from Root mode", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    await openNew();
    await chooseRoot();
    await openNew();
    await chooseRoot();
    await save();

    const afterRoots = saved.at(-1);
    expect(afterRoots?.rootDefinitions).toHaveLength(2);
    expect(afterRoots?.rootDefinitions?.map((definition) => definition.name)).toEqual(["Root Definition 1", "Root Definition 2"]);
    expect(afterRoots?.rootDefinitions?.[0]?.id).not.toBe(afterRoots?.rootDefinitions?.[1]?.id);
    expect(container.textContent).toContain("Master slide · Root Definition 2");

    await openNew();
    await act(async () => exactButtonByText(container, "+ New").click());
    await save();

    const afterSlide = saved.at(-1);
    expect(afterSlide?.rootDefinitions).toHaveLength(2);
    expect(afterSlide?.slides).toHaveLength(3);
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
  });
});
