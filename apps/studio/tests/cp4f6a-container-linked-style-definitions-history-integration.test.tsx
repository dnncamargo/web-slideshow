// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";
import { containerLinkedStyle } from "./linked-style-test-helpers";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function presentation(overrides: Partial<Omit<Presentation, "slides">> & { slides?: unknown } = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f6a",
    title: "CP4F6A",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{ id: "container-1", type: "container", hidden: false, linkedStyleId: "style-1", children: [] }],
    }],
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

describe("CP4F6A Container Linked Style definition history", () => {
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

  async function renderWorkspace(initial: Presentation, saved?: Presentation[], initialAuthoringTarget?: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string }): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          initialAuthoringTarget={initialAuthoringTarget}
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

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`Element was not rendered: ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
  }

  function row(id: string): HTMLElement {
    const value = host.querySelector<HTMLElement>(`[data-linked-style-id='${id}']`);
    if (!value) throw new Error(`Linked Style row ${id} was not rendered`);
    return value;
  }

  async function openRow(id: string): Promise<HTMLElement> {
    const target = row(id);
    const disclosure = target.querySelector<HTMLButtonElement>("button[aria-controls], button[aria-expanded]");
    if (!disclosure) throw new Error(`Linked Style disclosure ${id} was not rendered`);
    await act(async () => disclosure.click());
    return row(id);
  }

  function linkedStyle(overrides: Record<string, unknown> = {}): NonNullable<Presentation["linkedStyles"]> {
    return [{ id: "style-1", name: "Container", layout: { children: { gap: 4 } }, ...overrides }];
  }

  it("creates an ordinary Container style from the first property and replays the same id", async () => {
    await renderWorkspace(presentation({ slides: [{ id: "slide-1", title: "Slide 1", elements: [] }] }));
    const add = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ Add Linked Style");
    if (!add) throw new Error("ordinary Add Linked Style was not rendered");
    await act(async () => add.click());
    await act(async () => setSelectValue(host.querySelector<HTMLSelectElement>("[aria-label='Element type']")!, "container"));
    const name = Array.from(host.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === "");
    if (!name) throw new Error("ordinary add name input was not rendered");
    await act(async () => setInputValue(name, "Fresh"));
    expect(host.querySelector("[data-linked-style-id='fresh']")).toBeNull();
    const first = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add first property");
    if (!first) throw new Error("first property chooser was not rendered");
    await act(async () => first.click());
    const firstPropertyPanel = host.querySelector<HTMLElement>("[data-linked-style-property-chooser]");
    expect(firstPropertyPanel).not.toBeNull();
    expect(firstPropertyPanel?.querySelector("button.resourceAction")).toBeNull();
    expect(Array.from(firstPropertyPanel?.querySelectorAll("h4") ?? []).map((heading) => heading.textContent)).toEqual(["Layout", "Position", "Size", "Spacing", "Appearance", "Effects"]);
    const gap = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Gap");
    if (!gap) throw new Error("Gap property was not rendered");
    await act(async () => gap.click());
    const created = await openRow("fresh");
    expect(created.querySelector("[data-linked-style-property='gap']")).not.toBeNull();
    await undo();
    expect(host.querySelector("[data-linked-style-id='fresh']")).toBeNull();
    await redo();
    expect(row("fresh").querySelector("[data-linked-style-property='gap']")).not.toBeNull();
  });

  it("creates a target Code style through Resources and replays one atomic add action", async () => {
    const initial = presentation({ slides: [{ id: "slide-1", title: "Slide 1", elements: [] }], linkedStyles: [] });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);

    const beforeCreateUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(beforeCreateUndo));
    expect(beforeCreateUndo.defaultPrevented).toBe(false);

    const add = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ Add Linked Style");
    if (!add) throw new Error("Add Linked Style was not rendered");
    await act(async () => add.click());
    await act(async () => setSelectValue(host.querySelector<HTMLSelectElement>("[aria-label='Element type']")!, "code"));
    const name = Array.from(host.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === "");
    if (!name) throw new Error("Code style name input was not rendered");
    await act(async () => setInputValue(name, "History Code"));
    const first = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add first property");
    if (!first) throw new Error("Code first-property chooser was not rendered");
    await act(async () => first.click());
    const color = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Color");
    if (!color) throw new Error("Code Color property was not rendered");
    await act(async () => color.click());

    const changed = await save(saved);
    const created = changed.linkedStyles?.find((style) => style.name === "History Code");
    expect(created).toMatchObject({ target: "code", name: "History Code", style: { color: "#f8fafc" } });
    const id = created?.id;
    expect(id).toBeDefined();

    await undo();
    expect(await save(saved)).toEqual(initial);
    const secondUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(secondUndo));
    expect(secondUndo.defaultPrevented).toBe(false);

    await redo();
    const replayed = await save(saved);
    expect(replayed.linkedStyles?.find((style) => style.id === id)).toEqual(created);
  });

  it("tracks rename, raw numeric coalescing, and length unit as separate actions", async () => {
    await renderWorkspace(presentation({ linkedStyles: linkedStyle({ style: { borderRadius: 8 }, layout: { children: { gap: 4 } } }) }));
    let target = await openRow("style-1");
    const name = target.querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("Linked Style name input was not rendered");
    await act(async () => { name.focus(); setInputValue(name, "Renamed"); name.blur(); });
    expect(row("style-1").textContent).toContain("Renamed");
    await undo();
    expect(row("style-1").textContent).toContain("Container");
    await redo();
    target = row("style-1");
    const gap = target.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "8"); setInputValue(gap, "12"); gap.blur(); });
    await undo();
    expect(row("style-1").querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input")?.value).toBe("4");
    await redo();
    expect(row("style-1").querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input")?.value).toBe("12");
    const radius = row("style-1").querySelector<HTMLInputElement>("#linked-style-style-1-border-radius");
    const unit = row("style-1").querySelector<HTMLSelectElement>("#linked-style-style-1-border-radius + select");
    if (!radius || !unit) throw new Error("border radius length field was not rendered");
    await act(async () => { radius.focus(); setInputValue(radius, "10"); setInputValue(radius, "12"); radius.blur(); });
    await undo();
    expect(row("style-1").querySelector<HTMLInputElement>("#linked-style-style-1-border-radius")?.value).toBe("8");
    await redo();
    await act(async () => setSelectValue(row("style-1").querySelector<HTMLSelectElement>("#linked-style-style-1-border-radius + select")!, "rem"));
    await undo();
    expect(row("style-1").querySelector<HTMLSelectElement>("#linked-style-style-1-border-radius + select")?.value).toBe("px");
  });

  it("allocates ordinary-create ids from the current resource set and replays that id", async () => {
    await renderWorkspace(presentation({ slides: [{ id: "slide-1", title: "Slide 1", elements: [] }], linkedStyles: [{ id: "fresh", name: "Fresh", layout: { children: { gap: 2 } } }] }));
    const add = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ Add Linked Style");
    if (!add) throw new Error("ordinary Add Linked Style was not rendered");
    await act(async () => add.click());
    await act(async () => setSelectValue(host.querySelector<HTMLSelectElement>("[aria-label='Element type']")!, "container"));
    const name = Array.from(host.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === "");
    if (!name) throw new Error("ordinary add name input was not rendered");
    await act(async () => setInputValue(name, "Fresh"));
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add first property")?.click());
    const gap = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Gap");
    if (!gap) throw new Error("Gap property was not rendered");
    await act(async () => gap.click());
    expect(row("fresh")).toBeTruthy();
    expect(row("fresh-2")).toBeTruthy();
    await undo();
    expect(host.querySelector("[data-linked-style-id='fresh-2']")).toBeNull();
    await redo();
    expect(row("fresh-2")).toBeTruthy();
  });

  it("tracks select, checkbox, property add/remove, and protects the final property", async () => {
    await renderWorkspace(presentation({ linkedStyles: linkedStyle({ layout: { children: { distribution: "packed", gap: 4 }, flexShrink: 0 } }) }));
    let target = await openRow("style-1");
    const distribution = target.querySelector<HTMLSelectElement>("[data-linked-style-property='distribution'] select");
    if (!distribution) throw new Error("distribution select was not rendered");
    await act(async () => setSelectValue(distribution, "space-between"));
    await undo();
    expect(row("style-1").querySelector<HTMLSelectElement>("[data-linked-style-property='distribution'] select")?.value).toBe("packed");
    await redo();
    target = row("style-1");
    const preserve = target.querySelector<HTMLInputElement>("[data-linked-style-property='preserveSize'] input[type='checkbox']");
    if (!preserve) throw new Error("Preserve size checkbox was not rendered");
    await act(async () => preserve.click());
    await undo();
    expect(row("style-1").querySelector<HTMLInputElement>("[data-linked-style-property='preserveSize'] input")?.checked).toBe(true);
    await redo();
    target = row("style-1");
    const add = Array.from(target.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ Add property");
    if (!add) throw new Error("property add button was not rendered");
    await act(async () => add.click());
    const padding = Array.from(target.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Padding");
    if (!padding) throw new Error("Padding property was not rendered");
    await act(async () => padding.click());
    expect(row("style-1").querySelector("[data-linked-style-property='padding']")).not.toBeNull();
    await undo();
    expect(row("style-1").querySelector("[data-linked-style-property='padding']")).toBeNull();
    await redo();
    const remove = row("style-1").querySelector<HTMLButtonElement>("[data-linked-style-property='padding'] [data-resource-action='remove']");
    if (!remove) throw new Error("padding remove button was not rendered");
    await act(async () => remove.click());
    expect(row("style-1").querySelector("[data-linked-style-property='padding']")).toBeNull();
    const final = presentation({ linkedStyles: linkedStyle({ layout: { children: { gap: 4 } } }) });
    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);
    await renderWorkspace(final);
    target = await openRow("style-1");
    expect(target.querySelector<HTMLButtonElement>("[data-linked-style-property='gap'] [data-resource-action='remove']")?.disabled).toBe(true);
  });

  it("keeps unused removal replayable and protects referenced removal", async () => {
    await renderWorkspace(presentation({ slides: [{ id: "slide-1", title: "Slide 1", elements: [] }], linkedStyles: linkedStyle() }));
    let target = await openRow("style-1");
    const remove = Array.from(target.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove");
    if (!remove) throw new Error("style remove button was not rendered");
    await act(async () => remove.click());
    expect(host.querySelector("[data-linked-style-id='style-1']")).toBeNull();
    await undo();
    expect(row("style-1").textContent).toContain("Container");
    await redo();
    expect(host.querySelector("[data-linked-style-id='style-1']")).toBeNull();

    const referenced = presentation({ linkedStyles: linkedStyle() });
    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);
    await renderWorkspace(referenced);
    target = await openRow("style-1");
    expect(Array.from(target.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove")?.disabled).toBe(true);
  });

  it("keeps Container rename independently undoable after Topics history exists", async () => {
    await renderWorkspace(presentation({ linkedStyles: linkedStyle() }));
    const containerRow = await openRow("style-1");
    const name = containerRow.querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("Container name input was not rendered");
    await act(async () => { name.focus(); setInputValue(name, "Container renamed"); name.blur(); });
    expect(row("style-1").textContent).toContain("Container renamed");
    await undo();
    expect(row("style-1").textContent).toContain("Container");
    await redo();
    expect(row("style-1").textContent).toContain("Container renamed");
  });

  it("replays one shared ColorControl definition edit without a duplicate outer action", async () => {
    const initial = presentation({ linkedStyles: linkedStyle({ style: { color: "#111111" } }) });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const color = host.querySelector<HTMLInputElement>("#linked-style-style-1-color-value");
    if (!color) throw new Error("shared Linked Style ColorControl was not rendered");
    await act(async () => { color.focus(); setInputValue(color, "#222222"); color.blur(); });
    const changed = await save(saved);
    expect(containerLinkedStyle(changed.linkedStyles?.find((style) => style.id === "style-1"))?.style?.color).toBe("#222222");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });

  it("removes and replays legacy typography while preserving the normal definition", async () => {
    const initial = presentation({ linkedStyles: linkedStyle({ layout: { children: { gap: 4 } }, typography: { fontSize: 20 } }) });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const target = await openRow("style-1");
    const remove = Array.from(target.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove legacy typography");
    if (!remove) throw new Error("legacy typography remove button was not rendered");
    await act(async () => remove.click());
    const changed = await save(saved);
    const changedStyle = containerLinkedStyle(changed.linkedStyles?.find((style) => style.id === "style-1"));
    expect(changedStyle).toMatchObject({ layout: { children: { gap: 4 } } });
    expect(changedStyle?.typography).toBeUndefined();
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });

  it("changes only the shared definition when two Containers use it", async () => {
    const initial = presentation({
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        elements: [
          { id: "container-1", type: "container", hidden: false, linkedStyleId: "style-1", style: { background: { color: "#111111" } }, children: [] },
          { id: "container-2", type: "container", hidden: false, linkedStyleId: "style-1", layout: { padding: 8 }, children: [] },
        ],
      }],
      linkedStyles: linkedStyle(),
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const initialElements = structuredClone(initial.slides[0]?.elements);
    await openRow("style-1");
    const gap = host.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("shared definition gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "18"); gap.blur(); });
    const changed = await save(saved);
    expect(containerLinkedStyle(changed.linkedStyles?.find((style) => style.id === "style-1"))?.layout?.children?.gap).toBe(18);
    expect(changed.slides[0]?.elements).toEqual(initialElements);
    expect(changed.slides[0]?.elements.map((element) => element.type === "container" ? element.linkedStyleId : undefined)).toEqual(["style-1", "style-1"]);
    await undo();
    const undone = await save(saved);
    expect(undone).toEqual(initial);
    expect(undone.slides[0]?.elements).toEqual(initialElements);
    await redo();
    const redone = await save(saved);
    expect(redone).toEqual(changed);
    expect(redone.slides[0]?.elements).toEqual(initialElements);
  });

  it("keeps definition and Inspector relationship actions independently undoable", async () => {
    const initial = presentation({ linkedStyles: linkedStyle() });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const gap = host.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("definition gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "10"); setInputValue(gap, "12"); setInputValue(gap, "16"); gap.blur(); });
    const definitionEdited = await save(saved);

    const customResources = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    if (!customResources) throw new Error("Custom Resources toggle was not rendered");
    await act(async () => customResources.click());
    await selectElement("container-1");
    const inspector = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Inspector");
    if (!inspector) throw new Error("Inspector tab was not rendered");
    await act(async () => inspector.click());
    const relationship = host.querySelector<HTMLSelectElement>("#container-linked-style");
    if (!relationship) throw new Error("Container linked-style relationship control was not rendered");
    await act(async () => setSelectValue(relationship, ""));
    const relationshipEdited = await save(saved);
    expect(relationshipEdited.slides[0]?.elements[0]).not.toHaveProperty("linkedStyleId");
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

  it("clears only linked local gap overrides across matching Containers", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "container-a", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 20 }, marginBottom: 30 }, children: [] },
        { id: "container-b", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 40 } }, children: [] },
        { id: "container-c", type: "container", hidden: false, linkedStyleId: "style-2", layout: { children: { gap: 60 } }, children: [] },
        { id: "container-d", type: "container", hidden: false, layout: { children: { gap: 80 } }, children: [] },
      ] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } } }, { id: "style-2", name: "Two", layout: { children: { gap: 12 } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const gap = host.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("shared definition gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "16"); gap.blur(); });
    const changed = await save(saved);
    const elements = changed.slides[0]?.elements ?? [];
    expect(elements[0]).toMatchObject({ layout: { marginBottom: 30 } });
    expect(elements[0]).not.toHaveProperty("layout.children.gap");
    expect(elements[1]).not.toHaveProperty("layout.children.gap");
    expect(elements[2]).toEqual(initial.slides[0]?.elements[2]);
    expect(elements[3]).toEqual(initial.slides[0]?.elements[3]);
    expect(containerLinkedStyle(changed.linkedStyles?.find((style) => style.id === "style-1"))?.layout?.children?.gap).toBe(16);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });

  it("propagates master add and remove while preserving independent spacing locals", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "container-a", type: "container", hidden: false, linkedStyleId: "style-1", layout: { marginTop: 12, marginRight: 7 }, children: [] },
        { id: "container-b", type: "container", hidden: false, linkedStyleId: "style-1", layout: { marginTop: 24, marginRight: 9 }, children: [] },
      ] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const add = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='style-1'] button")).find((button) => button.textContent?.includes("Add property"));
    if (!add) throw new Error("Add property trigger was not rendered");
    await act(async () => add.click());
    const marginTop = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Margin top");
    if (!marginTop) throw new Error("Margin top option was not rendered");
    await act(async () => marginTop.click());
    const added = await save(saved);
    expect(containerLinkedStyle(added.linkedStyles?.find((style) => style.id === "style-1"))?.layout?.marginTop).toBe(0);
    expect(added.slides[0]?.elements[0]).toMatchObject({ layout: { marginRight: 7 } });
    expect(added.slides[0]?.elements[0]).not.toHaveProperty("layout.marginTop");
    expect(added.slides[0]?.elements[1]).not.toHaveProperty("layout.marginTop");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(added);

    const remove = row("style-1").querySelector<HTMLButtonElement>("[data-linked-style-property='marginTop'] [data-resource-action='remove']");
    if (!remove) throw new Error("Margin top remove action was not rendered");
    await act(async () => remove.click());
    const removed = await save(saved);
    expect(containerLinkedStyle(removed.linkedStyles?.find((style) => style.id === "style-1"))?.layout?.marginTop).toBeUndefined();
    expect(removed.slides[0]?.elements[0]).not.toHaveProperty("layout.marginTop");
    expect(removed.slides[0]?.elements[1]).not.toHaveProperty("layout.marginTop");
    expect(removed.slides[0]?.elements[0]).toMatchObject({ layout: { marginRight: 7 } });
    await undo();
    expect(await save(saved)).toEqual(added);
    await redo();
    expect(await save(saved)).toEqual(removed);
  });

  it("clears local overrides throughout one continuous master transaction", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "container-a", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 20 }, marginBottom: 30 }, children: [] },
        { id: "container-b", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 40 } }, children: [] },
      ] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const gap = host.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("continuous gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "10"); setInputValue(gap, "12"); setInputValue(gap, "16"); gap.blur(); });
    const changed = await save(saved);
    expect(containerLinkedStyle(changed.linkedStyles?.find((style) => style.id === "style-1"))?.layout?.children?.gap).toBe(16);
    expect(changed.slides[0]?.elements[0]).toMatchObject({ layout: { marginBottom: 30 } });
    expect(changed.slides[0]?.elements[0]).not.toHaveProperty("layout.children.gap");
    expect(changed.slides[0]?.elements[1]).not.toHaveProperty("layout.children.gap");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });

  it("propagates structured border edit and remove without materializing old values", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{
        id: "container-1", type: "container", hidden: false, linkedStyleId: "style-1",
        layout: { padding: 8 }, style: { border: { width: 3, style: "dashed", color: "#ff0000" }, background: { color: "#00ff00" }, borderRadius: 12 },
        effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } }, children: [{ id: "child", type: "text", hidden: false, content: "Keep me" }],
      }] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } }, style: { border: { width: 1, style: "solid", color: "#000000" } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const borderWidth = host.querySelector<HTMLInputElement>("#linked-style-style-1-border-width");
    if (!borderWidth) throw new Error("master border width input was not rendered");
    await act(async () => { borderWidth.focus(); setInputValue(borderWidth, "2"); borderWidth.blur(); });
    const edited = await save(saved);
    const editedElement = edited.slides[0]?.elements[0];
    expect(containerLinkedStyle(edited.linkedStyles?.find((style) => style.id === "style-1"))?.style?.border?.width).toBe(2);
    expect(editedElement).not.toHaveProperty("style.border");
    expect(editedElement).toMatchObject({ layout: { padding: 8 }, style: { background: { color: "#00ff00" }, borderRadius: 12 }, effect: { opacity: 0.5 }, children: [{ content: "Keep me" }] });
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(edited);

    const remove = row("style-1").querySelector<HTMLButtonElement>("[data-linked-style-property='border'] [data-resource-action='remove']");
    if (!remove) throw new Error("border remove action was not rendered");
    await act(async () => remove.click());
    const removed = await save(saved);
    expect(containerLinkedStyle(removed.linkedStyles?.find((style) => style.id === "style-1"))?.style?.border).toBeUndefined();
    expect(removed.slides[0]?.elements[0]).not.toHaveProperty("style.border");
    expect(removed.slides[0]?.elements[0]).toMatchObject({ style: { background: { color: "#00ff00" }, borderRadius: 12 }, children: [{ content: "Keep me" }] });
    await undo();
    expect(await save(saved)).toEqual(edited);
    await redo();
    expect(await save(saved)).toEqual(removed);
  });

  it("removes a pre-existing master and local border without replacing unrelated Container state", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{
        id: "container-1", type: "container", hidden: false, linkedStyleId: "style-1",
        layout: { padding: 8, marginBottom: 6 },
        style: { border: { width: 3, style: "dashed", color: "#ff0000" }, background: { color: "#00ff00" }, borderRadius: 12 },
        effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } },
        children: [{ id: "child", type: "text", hidden: false, content: "Keep me" }],
      }] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } }, style: { border: { width: 1, style: "solid", color: "#000000" } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const remove = row("style-1").querySelector<HTMLButtonElement>("[data-linked-style-property='border'] [data-resource-action='remove']");
    if (!remove) throw new Error("pre-existing master border remove action was not rendered");
    await act(async () => remove.click());
    const removed = await save(saved);
    const removedStyle = containerLinkedStyle(removed.linkedStyles?.find((style) => style.id === "style-1"));
    const removedElement = removed.slides[0]?.elements[0];
    expect(removedStyle?.style?.border).toBeUndefined();
    expect(removedElement).not.toHaveProperty("style.border");
    expect(removedElement).toMatchObject({ linkedStyleId: "style-1", layout: { padding: 8, marginBottom: 6 }, style: { background: { color: "#00ff00" }, borderRadius: 12 }, effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } }, children: [{ id: "child", type: "text", content: "Keep me" }] });
    expect(removedElement).not.toHaveProperty("style.border.width");
    expect(removedElement).not.toHaveProperty("style.border.color");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(removed);
  });

  it("propagates through nested Containers while preserving children and content", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "root", type: "container", hidden: false, children: [{ id: "nested", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 20 }, marginBottom: 30 }, children: [{ id: "child", type: "text", hidden: false, content: "Keep me" }] }] }] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const gap = host.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("nested gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "16"); gap.blur(); });
    const changed = await save(saved);
    const nested = changed.slides[0]?.elements[0];
    expect(nested).toMatchObject({ id: "root", children: [{ id: "nested", linkedStyleId: "style-1", layout: { marginBottom: 30 }, children: [{ id: "child", content: "Keep me" }] }] });
    expect(nested).not.toHaveProperty("children.0.layout.children.gap");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });

  it("keeps local overrides for rename-only and canonical no-op edits", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "container-1", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 20 } }, children: [] }] }],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    await openRow("style-1");
    const name = row("style-1").querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("style name input was not rendered");
    await act(async () => { name.focus(); setInputValue(name, "Renamed"); name.blur(); });
    const renamed = await save(saved);
    expect(renamed.linkedStyles?.find((style) => style.id === "style-1")?.name).toBe("Renamed");
    expect(renamed.slides[0]?.elements[0]).toHaveProperty("layout.children.gap", 20);
    const gap = row("style-1").querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("no-op gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "8"); gap.blur(); });
    const noOp = await save(saved);
    expect(noOp).toEqual(renamed);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(renamed);
  });

  it("covers the CP7 Container ownership lifecycle with exact snapshots", async () => {
    const initial = presentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{
        id: "cp7-container-root", type: "container", hidden: false,
        layout: { marginTop: 30, marginRight: 7 }, style: { className: "keep" },
        children: [{ id: "cp7-container-child", type: "text", hidden: false, content: "Keep selected child" }, {
          id: "cp7-container-nested", type: "container", hidden: false, linkedStyleId: "cp7-container-style",
          layout: { marginTop: 40, marginRight: 9 }, children: [{ id: "cp7-nested-child", type: "text", hidden: false, content: "Keep nested child" }],
        }],
      }] }],
      linkedStyles: [{ id: "cp7-container-style", name: "CP7 Container", layout: { marginTop: 12 }, style: { borderRadius: 8 } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved);
    const toggleResources = async (): Promise<void> => {
      const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Custom Resources");
      if (!button) throw new Error("Custom Resources button was not rendered");
      await act(async () => button.click());
    };
    await toggleResources();
    await selectElement("cp7-container-root");
    await act(async () => setSelectValue(host.querySelector<HTMLSelectElement>("#container-linked-style")!, "cp7-container-style"));
    const attached = await save(saved);
    const attachedRoot = attached.slides[0]?.elements[0];
    expect(attachedRoot).toMatchObject({ linkedStyleId: "cp7-container-style", layout: { marginRight: 7 }, style: { className: "keep" }, children: initial.slides[0]?.elements[0]?.type === "container" ? initial.slides[0].elements[0].children : undefined });
    expect(attachedRoot).not.toHaveProperty("layout.marginTop");
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(attached);

    const localInput = host.querySelector<HTMLInputElement>("#container-margin-top");
    if (!localInput) throw new Error("Container marginTop Inspector input was not rendered");
    await act(async () => { setInputValue(localInput, "30"); localInput.blur(); });
    const local = await save(saved);
    expect(local.slides[0]?.elements[0]).toHaveProperty("layout.marginTop", 30);
    expect(local.slides[0]?.elements[0]).toHaveProperty("layout.marginRight", 7);

    await toggleResources();
    const row = await openRow("cp7-container-style");
    const masterInput = row.querySelector<HTMLInputElement>("[data-linked-style-property='marginTop'] input");
    if (!masterInput) throw new Error(`Container master marginTop input was not rendered: ${row.textContent}`);
    await act(async () => { setInputValue(masterInput, "16"); masterInput.blur(); });
    const edited = await save(saved);
    expect(edited.slides[0]?.elements[0]).not.toHaveProperty("layout.marginTop");
    expect(edited.slides[0]?.elements[0]).toMatchObject({ layout: { marginRight: 7 }, style: { className: "keep" } });
    const editedChildren = (edited.slides[0]?.elements[0] as { children?: Array<{ id?: string; children?: unknown[] }> }).children;
    expect(editedChildren?.[0]).toMatchObject({ id: "cp7-container-child", content: "Keep selected child" });
    expect(editedChildren?.[1]).toMatchObject({ id: "cp7-container-nested", children: [{ id: "cp7-nested-child", content: "Keep nested child" }] });
    const editedNested = (edited.slides[0]?.elements[0] as { children?: unknown[] }).children?.[1] as { layout?: { marginTop?: unknown; marginRight?: unknown } };
    expect(editedNested.layout).toMatchObject({ marginRight: 9 });
    expect(editedNested.layout).not.toHaveProperty("marginTop");
    await undo();
    expect(await save(saved)).toEqual(local);
    await redo();
    expect(await save(saved)).toEqual(edited);

    await toggleResources();
    const localAgainInput = host.querySelector<HTMLInputElement>("#container-margin-top");
    if (!localAgainInput) throw new Error("Container marginTop Inspector input was not rendered after edit");
    await act(async () => { setInputValue(localAgainInput, "32"); localAgainInput.blur(); });
    const localAgain = await save(saved);
    expect(localAgain.slides[0]?.elements[0]).toHaveProperty("layout.marginTop", 32);

    await toggleResources();
    const editedRow = await openRow("cp7-container-style");
    const remove = editedRow.querySelector<HTMLButtonElement>("[data-linked-style-property='marginTop'] [data-resource-action='remove']");
    if (!remove) throw new Error("Container master marginTop remove action was not rendered");
    await act(async () => remove.click());
    const removed = await save(saved);
    expect(removed.linkedStyles?.find((style) => style.id === "cp7-container-style")).not.toHaveProperty("layout.marginTop");
    expect(removed.slides[0]?.elements[0]).not.toHaveProperty("layout.marginTop");
    expect(removed.slides[0]?.elements[0]).toMatchObject({ layout: { marginRight: 7 }, style: { className: "keep" } });
    expect((removed.slides[0]?.elements[0] as { children?: unknown[] }).children?.[1]).not.toHaveProperty("layout.marginTop");
    await undo();
    expect(await save(saved)).toEqual(localAgain);
    await redo();
    expect(await save(saved)).toEqual(removed);

    await toggleResources();
    const localAfterRemoveInput = host.querySelector<HTMLInputElement>("#container-margin-top");
    if (!localAfterRemoveInput) throw new Error("Container marginTop Inspector input was not rendered after remove");
    await act(async () => { setInputValue(localAfterRemoveInput, "34"); localAfterRemoveInput.blur(); });
    const localAfterRemove = await save(saved);
    expect(localAfterRemove.slides[0]?.elements[0]).toHaveProperty("layout.marginTop", 34);

    await toggleResources();
    const addRow = await openRow("cp7-container-style");
    const add = Array.from(addRow.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Add property"));
    if (!add) throw new Error("Container Add property action was not rendered");
    await act(async () => add.click());
    const marginTop = Array.from(addRow.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Margin top");
    if (!marginTop) throw new Error("Container Margin top Add property option was not rendered");
    await act(async () => marginTop.click());
    const added = await save(saved);
    const addedStyle = added.linkedStyles?.find((style) => style.id === "cp7-container-style");
    expect(addedStyle).toHaveProperty("layout.marginTop", 0);
    expect(added.slides[0]?.elements[0]).not.toHaveProperty("layout.marginTop");
    expect(added.slides[0]?.elements[0]).toMatchObject({ layout: { marginRight: 7 }, style: { className: "keep" } });
    expect((added.slides[0]?.elements[0] as { children?: unknown[] }).children?.[1]).not.toHaveProperty("layout.marginTop");
    await undo();
    expect(await save(saved)).toEqual(localAfterRemove);
    await redo();
    expect(await save(saved)).toEqual(added);

    await toggleResources();
    await act(async () => setSelectValue(host.querySelector<HTMLSelectElement>("#container-linked-style")!, ""));
    const detached = await save(saved);
    const detachedRoot = detached.slides[0]?.elements[0] as { linkedStyleId?: unknown; layout?: Record<string, unknown>; style?: Record<string, unknown>; children?: unknown[] };
    expect(detachedRoot).not.toHaveProperty("linkedStyleId");
    expect(detachedRoot.layout).toMatchObject({ marginTop: 0, marginRight: 7 });
    expect(detachedRoot.style).toMatchObject({ borderRadius: 8, className: "keep" });
    expect(detachedRoot.children).toEqual((added.slides[0]?.elements[0] as { children?: unknown[] }).children);
    expect((detached.slides[0]?.elements[0] as { children?: unknown[] }).children?.[1]).toHaveProperty("linkedStyleId", "cp7-container-style");
    expect(detached.linkedStyles).toEqual(added.linkedStyles);
    await undo();
    expect(await save(saved)).toEqual(added);
    await redo();
    expect(await save(saved)).toEqual(detached);
  });

  it("propagates a Container definition edit through Slide, Root, and local-root-child owners", async () => {
    const initial = presentation({
      slides: [
        { id: "slide-1", title: "Slide 1", elements: [{ id: "slide-container", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 20 }, marginBottom: 30 }, children: [] }] },
        { id: "slide-2", title: "Root slide", elements: [], rootDefinitionId: "root-1", localRootChildren: [{ targetContainerId: "root-container", children: [{ id: "local-container", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 40 }, marginBottom: 31 }, children: [] }] }] },
      ],
      linkedStyles: [{ id: "style-1", name: "One", layout: { children: { gap: 8 } } }],
      rootDefinitions: [{ id: "root-1", name: "Root", localChildTargetIds: ["root-container"], root: { id: "root-container", type: "container", hidden: false, children: [{ id: "root-container-child", type: "container", hidden: false, linkedStyleId: "style-1", layout: { children: { gap: 60 }, marginBottom: 32 }, children: [] }] } }],
    });
    const saved: Presentation[] = [];
    await renderWorkspace(initial, saved, { kind: "root-definition", rootDefinitionId: "root-1" });
    const row = await openRow("style-1");
    const gap = row.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("Container gap input was not rendered");
    await act(async () => { gap.focus(); setInputValue(gap, "16"); gap.blur(); });
    const changed = await save(saved);
    const slideContainer = changed.slides[0]!.elements[0]!;
    const localContainer = changed.slides[1]!.localRootChildren![0]!.children[0]!;
    const rootContainer = changed.rootDefinitions![0]!.root.children[0]!;
    for (const element of [slideContainer, localContainer, rootContainer]) {
      expect(element).not.toHaveProperty("layout.children.gap");
    }
    expect(slideContainer).toHaveProperty("layout.marginBottom", 30);
    expect(localContainer).toHaveProperty("layout.marginBottom", 31);
    expect(rootContainer).toHaveProperty("layout.marginBottom", 32);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(changed);
  });
});
