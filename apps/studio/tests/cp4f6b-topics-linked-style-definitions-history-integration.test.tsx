// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function presentation(overrides: Partial<Omit<Presentation, "slides">> & { slides?: unknown } = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f6b",
    title: "CP4F6B",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{ id: "topics-1", type: "topics", hidden: false, linkedStyleId: "topics-style", items: [] }],
    }],
    linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", layout: { margin: 4 }, itemGap: 8, markerColor: "#ff0000", kind: "unordered", rootMarkerStyle: "square" }],
    ...overrides,
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected input value setter");
  setter.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected select value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CP4F6B Topics Linked Style definition history", () => {
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
  });

  async function renderWorkspace(initial: Presentation, saved?: Presentation[]): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
          {...(saved === undefined ? {} : { onSave: async (snapshot: Presentation) => { saved.push(structuredClone(snapshot)); } })}
        />
      </StudioI18nProvider>,
    ));
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources button was not rendered");
    await act(async () => resources.click());
  }

  async function save(saved: Presentation[]): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
  }

  async function openRow(): Promise<HTMLElement> {
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='topics-style']");
    if (!row) throw new Error("Topics Linked Style row was not rendered");
    await act(async () => row.querySelector<HTMLButtonElement>("button")?.click());
    return host.querySelector<HTMLElement>("[data-linked-style-id='topics-style']")!;
  }

  it("tracks rename as one action and ignores draft typing and same-name blur", async () => {
    const initial = presentation();
    await renderWorkspace(initial);
    const row = await openRow();
    const name = row.querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("Topics name input was not rendered");
    await act(async () => { name.focus(); setInputValue(name, "Renamed"); });
    expect(row.textContent).toContain("Topics");
    await act(async () => name.blur());
    expect(row.textContent).toContain("Renamed");
    await act(async () => { name.focus(); setInputValue(name, "Renamed"); name.blur(); });
    await undo();
    expect(host.querySelector("[data-linked-style-id='topics-style']")?.textContent).toContain("Topics");
    await redo();
    expect(host.querySelector("[data-linked-style-id='topics-style']")?.textContent).toContain("Renamed");
  });

  it("coalesces margin and itemGap independently, then separates a kind action", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const margin = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-margin");
    const itemGap = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap");
    if (!margin || !itemGap) throw new Error("Topics numeric controls were not rendered");
    await act(async () => { margin.focus(); setInputValue(margin, "6"); setInputValue(margin, "9"); margin.blur(); });
    await undo();
    expect(row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-margin")?.value).toBe("4");
    await redo();
    await act(async () => { itemGap.focus(); setInputValue(itemGap, "10"); setInputValue(itemGap, "12"); itemGap.blur(); });
    await undo();
    expect(row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap")?.value).toBe("8");
    await redo();
    const kind = row.querySelector<HTMLSelectElement>("#linked-topics-style-topics-style-kind");
    if (!kind) throw new Error("Topics kind control was not rendered");
    expect(kind.value).toBe("unordered");
    const beforeKind = await save(saved);
    expect(beforeKind.linkedStyles?.find((style) => "target" in style && style.target === "topics" && style.id === "topics-style")).toMatchObject({ kind: "unordered", rootMarkerStyle: "square" });
    await act(async () => setSelectValue(kind, "ordered"));
    const afterKind = await save(saved);
    const afterKindStyle = afterKind.linkedStyles?.find((style) => style.id === "topics-style");
    expect(afterKindStyle).toMatchObject({ kind: "ordered" });
    expect(afterKindStyle).not.toHaveProperty("rootMarkerStyle");
    await undo();
    const undoneKind = await save(saved);
    expect(undoneKind).toEqual(beforeKind);
    expect(undoneKind.linkedStyles?.find((style) => "target" in style && style.target === "topics" && style.id === "topics-style")).toMatchObject({ kind: "unordered", rootMarkerStyle: "square" });
    expect(row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap")?.value).toBe("12");
    await redo();
    const redoneKind = await save(saved);
    expect(redoneKind).toEqual(afterKind);
    expect(redoneKind.linkedStyles?.find((style) => "target" in style && style.target === "topics" && style.id === "topics-style")).toMatchObject({ kind: "ordered" });
    expect(redoneKind.linkedStyles?.find((style) => "target" in style && style.target === "topics" && style.id === "topics-style")).not.toHaveProperty("rootMarkerStyle");
    expect(row.querySelector<HTMLSelectElement>("#linked-topics-style-topics-style-kind")?.value).toBe("ordered");
  });

  it("tracks add/remove, kind-marker compatibility, and ColorControl without a duplicate action", async () => {
    const initial = presentation({ linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8 }] });
    await renderWorkspace(initial);
    let row = await openRow();
    const add = row.querySelector<HTMLButtonElement>("[data-topics-linked-style-property-chooser] > button");
    if (!add) throw new Error("Topics property chooser was not rendered");
    await act(async () => add.click());
    const chooser = row.querySelector<HTMLElement>("[data-topics-linked-style-property-chooser] > div");
    if (!chooser) throw new Error("Topics property chooser was not opened");
    await act(async () => Array.from(chooser.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Marker color")?.click());
    expect(row.querySelector("[data-linked-topics-property='markerColor']")).not.toBeNull();
    await undo();
    expect(host.querySelector("[data-linked-topics-property='markerColor']")).toBeNull();
    await redo();
    row = host.querySelector<HTMLElement>("[data-linked-style-id='topics-style']")!;
    const color = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-marker-color");
    if (!color) throw new Error("Topics marker ColorControl was not rendered");
    await act(async () => { color.focus(); setInputValue(color, "#00ff00"); color.blur(); });
    await undo();
    expect(row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-marker-color")?.value).not.toBe("#00ff00");
    await redo();
    const remove = row.querySelector<HTMLButtonElement>("[data-linked-topics-property='markerColor'] [data-resource-action='remove']");
    if (!remove) throw new Error("Topics marker removal was not rendered");
    await act(async () => remove.click());
    expect(row.querySelector("[data-linked-topics-property='markerColor']")).toBeNull();
  });

  it("changes only the shared definition for multiple usages and replays unused removal", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "topics-1", type: "topics", hidden: false, linkedStyleId: "topics-style", items: [], layout: { marginTop: 11 } },
        { id: "topics-2", type: "topics", hidden: false, linkedStyleId: "topics-style", items: [], markerColor: "#123456" },
      ] }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const elements = structuredClone(initial.slides[0]!.elements);
    const row = await openRow();
    const margin = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-margin");
    if (!margin) throw new Error("Topics margin control was not rendered");
    await act(async () => { margin.focus(); setInputValue(margin, "16"); margin.blur(); });
    const changed = await save(saved);
    expect(changed.slides[0]?.elements).toEqual(elements);
    await undo();
    expect((await save(saved)).slides[0]?.elements).toEqual(elements);
    await redo();
    expect((await save(saved)).slides[0]?.elements).toEqual(elements);

    const unused = presentation({ slides: [{ id: "slide-1", title: "Slide 1", elements: [] }], linkedStyles: [{ target: "topics", id: "unused", name: "Unused", itemGap: 4 }] });
    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);
    const unusedSaved: Presentation[] = [];
    await renderWorkspace(unused, unusedSaved);
    const unusedRow = host.querySelector<HTMLElement>("[data-linked-style-id='unused']");
    if (!unusedRow) throw new Error("Unused Topics row was not rendered");
    await act(async () => unusedRow.querySelector<HTMLButtonElement>("button")?.click());
    const expandedUnusedRow = host.querySelector<HTMLElement>("[data-linked-style-id='unused']")!;
    await act(async () => Array.from(expandedUnusedRow.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove")?.click());
    expect(host.querySelector("[data-linked-style-id='unused']")).toBeNull();
    expect((await save(unusedSaved)).linkedStyles).toBeUndefined();
    await undo();
    expect(host.querySelector("[data-linked-style-id='unused']")).not.toBeNull();
    await redo();
    expect(host.querySelector("[data-linked-style-id='unused']")).toBeNull();
  });

  it("protects the final authored property and nested referenced resources", async () => {
    const finalProperty = presentation({ linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8 }] });
    await renderWorkspace(finalProperty);
    const finalRow = await openRow();
    expect(finalRow.querySelector<HTMLButtonElement>("[data-resource-action='remove']")?.disabled).toBe(true);

    const nested = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "container-1", type: "container", hidden: false, children: [{ id: "nested-topics", type: "topics", hidden: false, linkedStyleId: "topics-style", items: [] }] }] }],
    });
    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);
    await renderWorkspace(nested);
    const nestedRow = await openRow();
    expect(Array.from(nestedRow.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove")?.disabled).toBe(true);
  });

  it("preserves palette-reference color values through one ColorControl action", async () => {
    const initial = presentation({
      palette: { colors: [{ id: "accent", name: "Accent", value: "#112233" }, { id: "accent-2", name: "Accent 2", value: "#445566" }] },
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8, markerColor: { kind: "palette", colorId: "accent" } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const usePalette = Array.from(row.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Use palette");
    if (!usePalette) throw new Error("ColorControl palette action was not rendered");
    await act(async () => usePalette.click());
    const chooser = row.querySelector<HTMLElement>("#linked-topics-style-topics-style-marker-color-palette-chooser");
    if (!chooser) throw new Error("ColorControl palette chooser was not rendered");
    const accentTwo = chooser.querySelector<HTMLButtonElement>("[aria-label='Apply palette color Accent 2']");
    if (!accentTwo) throw new Error("second palette color was not rendered");
    await act(async () => accentTwo.click());
    const changed = await save(saved);
    expect(changed.linkedStyles?.find((style) => style.id === "topics-style")).toMatchObject({ markerColor: { kind: "palette", colorId: "accent-2" } });
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });

  it("keeps definition and Topics relationship history independent", async () => {
    const initial = presentation();
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const margin = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-margin");
    if (!margin) throw new Error("Topics margin control was not rendered");
    await act(async () => { margin.focus(); setInputValue(margin, "16"); margin.blur(); });
    const definitionEdited = await save(saved);
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources button was not rendered");
    await act(async () => resources.click());
    const canvasElement = host.querySelector<HTMLElement>("[data-presentation-id='topics-1']");
    if (!canvasElement) throw new Error("Topics element was not rendered");
    await act(async () => canvasElement.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const inspector = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Inspector");
    if (!inspector) throw new Error("Inspector tab was not rendered");
    await act(async () => inspector.click());
    const relationship = host.querySelector<HTMLSelectElement>("#topics-linked-style");
    if (!relationship) throw new Error("Topics relationship control was not rendered");
    await act(async () => setSelectValue(relationship, ""));
    const relationshipEdited = await save(saved);
    expect(relationshipEdited.linkedStyles).toEqual(definitionEdited.linkedStyles);
    await undo();
    expect(await save(saved)).toEqual(definitionEdited);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(definitionEdited);
    await redo();
    expect(await save(saved)).toEqual(relationshipEdited);
  });

  it("propagates a clean itemGap master edit and remove across linked Topics with exact Undo/Redo", async () => {
    const items = [{ id: "item", content: { id: "slot", children: [{ id: "text", type: "text" as const, hidden: false, content: "Keep me" }] }, children: [{ id: "nested", content: { id: "nested-slot", children: [] }, children: [] }] }];
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 20, items },
        { id: "topics-b", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 40, items: structuredClone(items) },
        { id: "topics-other", type: "topics", hidden: false, linkedStyleId: "other-style", itemGap: 99, items: [] },
        { id: "topics-free", type: "topics", hidden: false, itemGap: 77, items: [] },
      ] }],
      linkedStyles: [
        { target: "topics", id: "topics-style", name: "Topics", itemGap: 8, markerColor: "#ff0000" },
        { target: "topics", id: "other-style", name: "Other", itemGap: 4 },
      ],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const itemGap = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap");
    if (!itemGap) throw new Error("Topics itemGap control was not rendered");
    await act(async () => { itemGap.focus(); setInputValue(itemGap, "12"); itemGap.blur(); });
    const edited = await save(saved);
    expect(edited.slides[0]?.elements[0]).not.toHaveProperty("itemGap");
    expect(edited.slides[0]?.elements[1]).not.toHaveProperty("itemGap");
    expect(edited.slides[0]?.elements[2]).toHaveProperty("itemGap", 99);
    expect(edited.slides[0]?.elements[3]).toHaveProperty("itemGap", 77);
    expect(edited.slides[0]?.elements[0]).toHaveProperty("items", initial.slides[0]?.elements[0]?.type === "topics" ? initial.slides[0].elements[0].items : undefined);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(edited);

    await act(async () => row.querySelector<HTMLButtonElement>("[data-linked-topics-property='itemGap'] [data-resource-action='remove']")?.click());
    const removed = await save(saved);
    expect(removed.linkedStyles?.find((style) => style.id === "topics-style")).not.toHaveProperty("itemGap");
    expect(removed.slides[0]?.elements[0]).not.toHaveProperty("itemGap");
    expect(removed.slides[0]?.elements[1]).not.toHaveProperty("itemGap");
    expect(removed.slides[0]?.elements[0]).toHaveProperty("items", initial.slides[0]?.elements[0]?.type === "topics" ? initial.slides[0].elements[0].items : undefined);
    await undo();
    expect(await save(saved)).toEqual(edited);
    await redo();
    expect(await save(saved)).toEqual(removed);
  });

  it("claims a previously omitted itemGap through Add Property and replays the local clears", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 20, items: [] },
        { id: "topics-b", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 40, items: [] },
      ] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    await act(async () => row.querySelector<HTMLButtonElement>("[data-topics-linked-style-property-chooser] > button")?.click());
    const itemGapOption = Array.from(row.querySelectorAll<HTMLButtonElement>("[data-topics-linked-style-property-chooser] button")).find((button) => button.textContent?.trim() === "Topic spacing");
    if (!itemGapOption) throw new Error("Topics itemGap Add Property option was not rendered");
    await act(async () => itemGapOption.click());
    const added = await save(saved);
    expect(added.linkedStyles?.find((style) => style.id === "topics-style")).toHaveProperty("itemGap", 6);
    expect(added.slides[0]?.elements[0]).not.toHaveProperty("itemGap");
    expect(added.slides[0]?.elements[1]).not.toHaveProperty("itemGap");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(added);
  });

  it("removes a clean itemGap master and local pair without materializing either old value", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 20, items: [] },
        { id: "topics-b", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 40, items: [] },
      ] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8, markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    await act(async () => row.querySelector<HTMLButtonElement>("[data-linked-topics-property='itemGap'] [data-resource-action='remove']")?.click());
    const removed = await save(saved);
    expect(removed.linkedStyles?.find((style) => style.id === "topics-style")).not.toHaveProperty("itemGap");
    expect(removed.slides[0]?.elements[0]).not.toHaveProperty("itemGap");
    expect(removed.slides[0]?.elements[1]).not.toHaveProperty("itemGap");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(removed);
  });

  it("does not clear a local margin override for a semantically equivalent master Length", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", layout: { marginTop: 30 }, items: [] }] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", layout: { marginTop: "12px" }, itemGap: 8, markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const marginTop = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-marginTop");
    if (!marginTop) throw new Error("Topics marginTop control was not rendered");
    await act(async () => { marginTop.focus(); setInputValue(marginTop, "12.0"); marginTop.blur(); });
    const unchanged = await save(saved);
    expect(unchanged.linkedStyles?.find((style) => style.id === "topics-style")).toHaveProperty("layout.marginTop", 12);
    expect(unchanged.slides[0]?.elements[0]).toHaveProperty("layout.marginTop", 30);
  });

  it("clears local itemGap once across one continuous master transaction", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 20, items: [] },
        { id: "topics-b", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 40, items: [] },
      ] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8, markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const itemGap = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap");
    if (!itemGap) throw new Error("Topics itemGap control was not rendered");
    await act(async () => { itemGap.focus(); setInputValue(itemGap, "10"); setInputValue(itemGap, "12"); setInputValue(itemGap, "16"); itemGap.blur(); });
    const edited = await save(saved);
    expect(edited.linkedStyles?.find((style) => style.id === "topics-style")).toHaveProperty("itemGap", 16);
    expect(edited.slides[0]?.elements[0]).not.toHaveProperty("itemGap");
    expect(edited.slides[0]?.elements[1]).not.toHaveProperty("itemGap");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(edited);
  });

  it("clears local kind and incompatible root marker together while preserving content", async () => {
    const items = [{ id: "item", content: { id: "slot", children: [{ id: "text", type: "text" as const, hidden: false, content: "Keep" }] }, children: [] }];
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", kind: "unordered", rootMarkerStyle: "circle", itemGap: 22, items }] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", kind: "unordered", rootMarkerStyle: "square", itemGap: 8, markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const kind = row.querySelector<HTMLSelectElement>("#linked-topics-style-topics-style-kind");
    if (!kind) throw new Error("Topics kind control was not rendered");
    await act(async () => setSelectValue(kind, "ordered"));
    const edited = await save(saved);
    expect(edited.linkedStyles?.find((style) => style.id === "topics-style")).toMatchObject({ kind: "ordered" });
    expect(edited.linkedStyles?.find((style) => style.id === "topics-style")).not.toHaveProperty("rootMarkerStyle");
    expect(edited.slides[0]?.elements[0]).not.toHaveProperty("kind");
    expect(edited.slides[0]?.elements[0]).not.toHaveProperty("rootMarkerStyle");
    expect(edited.slides[0]?.elements[0]).toMatchObject({ itemGap: 22, items });
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(edited);
  });

  it("propagates through a nested Topics hierarchy without changing content or ids", async () => {
    const nestedItems = [{ id: "item", content: { id: "slot", children: [{ id: "text", type: "text" as const, hidden: false, content: "Nested" }] }, children: [{ id: "child", content: { id: "child-slot", children: [] }, children: [] }] }];
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "container", type: "container", hidden: false, children: [{ id: "nested-topics", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 20, markerColor: "#123456", items: nestedItems }] }] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8, markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const itemGap = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap");
    if (!itemGap) throw new Error("Topics itemGap control was not rendered");
    await act(async () => { itemGap.focus(); setInputValue(itemGap, "16"); itemGap.blur(); });
    const edited = await save(saved);
    const container = edited.slides[0]?.elements[0];
    if (container?.type !== "container") throw new Error("Nested container was not preserved");
    const nested = container.children[0];
    if (nested?.type !== "topics") throw new Error("Nested Topics was not preserved");
    expect(nested).not.toHaveProperty("itemGap");
    expect(nested).toMatchObject({ id: "nested-topics", linkedStyleId: "topics-style", markerColor: "#123456", items: nestedItems });
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(edited);
  });

  it("preserves a local override through rename and a canonical no-op edit", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "topics-a", type: "topics", hidden: false, linkedStyleId: "topics-style", itemGap: 20, items: [] }] }],
      linkedStyles: [{ target: "topics", id: "topics-style", name: "Topics", itemGap: 8, markerColor: "#ff0000" }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const row = await openRow();
    const name = row.querySelector<HTMLInputElement>("input");
    const itemGap = row.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap");
    if (!name || !itemGap) throw new Error("Topics authoring controls were not rendered");
    await act(async () => { name.focus(); setInputValue(name, "Renamed"); name.blur(); });
    const renamed = await save(saved);
    expect(renamed.slides[0]?.elements[0]).toHaveProperty("itemGap", 20);
    await act(async () => { itemGap.focus(); setInputValue(itemGap, "8"); itemGap.blur(); });
    const noop = await save(saved);
    expect(noop.slides[0]?.elements[0]).toHaveProperty("itemGap", 20);
  });
});
