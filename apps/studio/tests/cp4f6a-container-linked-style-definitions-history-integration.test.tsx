// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

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

  async function renderWorkspace(initial: Presentation): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} customLibraryPaletteRepository={repositories} customLibraryFontRepository={repositories} />
      </StudioI18nProvider>,
    ));
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources button was not rendered");
    await act(async () => resources.click());
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
    const name = Array.from(host.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === "");
    if (!name) throw new Error("ordinary add name input was not rendered");
    await act(async () => setInputValue(name, "Fresh"));
    expect(host.querySelector("[data-linked-style-id='fresh']")).toBeNull();
    const first = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add first property");
    if (!first) throw new Error("first property chooser was not rendered");
    await act(async () => first.click());
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

  it("does not give Topics definition controls F6A history ownership", async () => {
    const topics = { target: "topics" as const, id: "topics-1", name: "Topics", itemGap: 8 };
    await renderWorkspace(presentation({ slides: [{ id: "slide-1", title: "Slide 1", elements: [] }], linkedStyles: [...linkedStyle(), topics] }));
    const topicsRow = await openRow("topics-1");
    const name = topicsRow.querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("Topics name input was not rendered");
    await act(async () => { name.focus(); setInputValue(name, "Topics renamed"); name.blur(); });
    await undo();
    expect(row("topics-1").textContent).toContain("Topics renamed");
  });
});
