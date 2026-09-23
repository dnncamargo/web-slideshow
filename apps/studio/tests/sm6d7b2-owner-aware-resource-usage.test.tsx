// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repository = {
  listPalettes: async () => [],
  listFonts: async () => [],
} as never;

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d7b2",
    title: "Owner-aware Resources",
    textStyles: [{ id: "quote", name: "Quote", role: "body" }],
    linkedStyles: [
      { id: "cards", name: "Cards", layout: { margin: 4 } },
      { target: "topics", id: "topics", name: "Topics", itemGap: 8 },
    ],
    slides: [{
      id: "slide-1",
      title: "Slide one",
      elements: [
        { id: "slide-text", type: "text", hidden: false, variant: "quote", content: "Slide text" },
        { id: "slide-container", type: "container", hidden: false, linkedStyleId: "cards", children: [] },
        { id: "slide-topics", type: "topics", hidden: false, kind: "unordered", linkedStyleId: "topics", items: [] },
      ],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching master",
      root: {
        id: "root-container",
        type: "container",
        hidden: false,
        children: [
          { id: "root-text", type: "text", hidden: false, variant: "quote", content: "Root text" },
          { id: "root-container-usage", type: "container", hidden: false, linkedStyleId: "cards", children: [] },
          { id: "root-topics", type: "topics", hidden: false, kind: "unordered", linkedStyleId: "topics", items: [] },
        ],
      },
    }],
  });
}

describe("SM6D7B2 owner-aware Resource usage", () => {
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

  async function mount(initialAuthoringTarget?: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string }): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={presentation()}
          initialAuthoringTarget={initialAuthoringTarget}
          customLibraryPaletteRepository={repository}
          customLibraryFontRepository={repository}
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

  async function openResourceSection(label: string): Promise<HTMLElement> {
    const details = Array.from(container.querySelectorAll<HTMLDetailsElement>("details"))
      .find((candidate) => candidate.querySelector("summary")?.textContent?.includes(label));
    if (!details) throw new Error(`Resource section not found: ${label}`);
    if (!details.open) await act(async () => details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    return details;
  }

  async function openTextStyle(id: string): Promise<HTMLElement> {
    const row = container.querySelector<HTMLElement>(`[data-text-style-id="${id}"]`);
    if (!row) throw new Error(`Text Style row not found: ${id}`);
    const disclosure = row.querySelector<HTMLButtonElement>("button[aria-controls]");
    if (!disclosure) throw new Error("Text Style disclosure not found");
    await act(async () => disclosure.click());
    return row;
  }

  async function openLinkedStyle(id: string): Promise<HTMLElement> {
    const row = container.querySelector<HTMLElement>(`[data-linked-style-id="${id}"]`);
    if (!row) throw new Error(`Linked Style row not found: ${id}`);
    await act(async () => row.querySelector<HTMLButtonElement>("button")?.click());
    return row;
  }

  it("shows both owners and survives Slide → Root → Slide selection transitions for Text Styles", async () => {
    await mount();
    await openResources();
    await openResourceSection("Text Styles");
    const row = await openTextStyle("quote");
    const usages = () => Array.from(row.querySelectorAll<HTMLButtonElement>("button[class*='resourceUsageTarget']"));
    expect(usages()).toHaveLength(2);
    expect(row.textContent).toContain("Slide 1");
    expect(row.textContent).toContain("Root Definition · Teaching master");

    await act(async () => usages().find((button) => button.textContent?.includes("Root Definition"))?.click());
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-text"]')?.classList.contains("studio-editor-selected")).toBe(true);
    expect(container.querySelector('[data-presentation-id="slide-text"]')).toBeNull();

    await act(async () => usages().find((button) => button.textContent?.includes("Slide 1"))?.click());
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="slide-text"]')?.classList.contains("studio-editor-selected")).toBe(true);
  });

  it("shows and navigates Slide and Root Container Linked Style usages", async () => {
    await mount({ kind: "root-definition", rootDefinitionId: "root-1" });
    await openResources();
    await openResourceSection("Linked Styles");
    const row = await openLinkedStyle("cards");
    expect(row.textContent).toContain("Used by 2 elements");
    expect(row.textContent).toContain("Slide 1");
    expect(row.textContent).toContain("Root Definition · Teaching master");

    const usages = () => Array.from(row.querySelectorAll<HTMLButtonElement>("button[class*='resourceUsageTarget']"));
    await act(async () => usages().find((button) => button.textContent?.includes("Slide 1"))?.click());
    expect(container.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="slide-container"]')?.classList.contains("studio-editor-selected")).toBe(true);

    await act(async () => usages().find((button) => button.textContent?.includes("Root Definition"))?.click());
    expect(container.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-container-usage"]')?.classList.contains("studio-editor-selected")).toBe(true);
  });

  it("counts Root-owned Topics Linked Style usage without adding a new navigation surface", async () => {
    await mount();
    await openResources();
    await openResourceSection("Linked Styles");
    const row = await openLinkedStyle("topics");
    expect(row.textContent).toContain("Used by 2 elements");
    expect(row.querySelector("[data-resource-action='detach']")).toBeNull();
  });
});
