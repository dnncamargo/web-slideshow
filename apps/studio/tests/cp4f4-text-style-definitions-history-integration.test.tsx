// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type ContainerElement, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = {
  listPalettes: async () => [],
  listFonts: async () => [],
} as never;

function basePresentation(overrides: Partial<Omit<Presentation, "slides">> & { slides?: unknown } = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f4",
    title: "CP4F4",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{ id: "text-1", type: "text", hidden: false, variant: "body", content: "Text" }],
    }],
    ...overrides,
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CP4F4 Text Style definition history", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function renderWorkspace(initial: Presentation): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
        />
      </StudioI18nProvider>,
    ));
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources button was not rendered");
    await act(async () => resources.click());
  }

  async function save(): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  function row(id: string): HTMLElement {
    const found = host.querySelector<HTMLElement>(`[data-text-style-id='${id}']`);
    if (!found) throw new Error(`Text Style row ${id} was not rendered`);
    return found;
  }

  async function openRow(id: string): Promise<HTMLElement> {
    const target = row(id);
    const disclosure = target.querySelector<HTMLButtonElement>("button[aria-controls]");
    if (!disclosure) throw new Error(`Text Style disclosure ${id} was not rendered`);
    await act(async () => disclosure.click());
    return row(id);
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
  }

  function addPropertyButton(target: HTMLElement): HTMLButtonElement {
    const button = Array.from(target.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add property");
    if (!button) throw new Error("Add property button was not rendered");
    return button;
  }

  async function addProperty(target: HTMLElement, label: string): Promise<void> {
    await act(async () => addPropertyButton(target).click());
    const property = Array.from(target.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!property) throw new Error(`property ${label} was not rendered`);
    await act(async () => property.click());
  }

  it("coalesces fundamental continuous edits into one exact undo/redo action", async () => {
    await renderWorkspace(basePresentation({ textStyles: [{ id: "body", typography: { fontSize: 20 } }] }));
    let body = await openRow("body");
    const input = body.querySelector<HTMLInputElement>("#text-style-body-font-size");
    if (!input) throw new Error("fundamental font size input was not rendered");

    await act(async () => {
      input.focus();
      setInputValue(input, "22");
      setInputValue(input, "24");
      input.blur();
    });
    expect(body.querySelector<HTMLInputElement>("#text-style-body-font-size")?.value).toBe("24");

    await undo();
    expect(row("body").querySelector<HTMLInputElement>("#text-style-body-font-size")?.value).toBe("20");
    await redo();
    expect(row("body").querySelector<HTMLInputElement>("#text-style-body-font-size")?.value).toBe("24");
  });

  it("authors and removes a sparse fundamental property independently", async () => {
    await renderWorkspace(basePresentation());
    let body = await openRow("body");
    await addProperty(body, "Font size");
    expect(row("body").querySelector("#text-style-body-font-size")).not.toBeNull();

    await undo();
    expect(row("body").querySelector("#text-style-body-font-size")).toBeNull();
    await redo();
    body = row("body");
    const remove = body.querySelector<HTMLButtonElement>("[aria-label='Remove Font size']");
    if (!remove) throw new Error("fundamental remove button was not rendered");
    await act(async () => remove.click());
    expect(row("body").querySelector("#text-style-body-font-size")).toBeNull();
    await undo();
    expect(row("body").querySelector("#text-style-body-font-size")).not.toBeNull();
    await redo();
    expect(row("body").querySelector("#text-style-body-font-size")).toBeNull();
  });

  it("master Add clears pre-existing local overrides and restores them as one history action", async () => {
    await renderWorkspace(basePresentation({
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "add-a", type: "text", hidden: false, variant: "body", content: "A", typography: { fontSize: 30 } },
        { id: "add-b", type: "text", hidden: false, variant: "body", content: "B", typography: { fontSize: 40 } },
        { id: "add-c", type: "text", hidden: false, variant: "body", content: "C" },
      ] }],
    }));
    const body = await openRow("body");
    await addProperty(body, "Font size");
    const addedInput = row("body").querySelector<HTMLInputElement>("#text-style-body-font-size");
    if (!addedInput) throw new Error("added font size input was not rendered");
    const addDefault = Number(addedInput.value);
    const added = await save();
    expect(added.textStyles).toEqual([{ id: "body", typography: { fontSize: addDefault } }]);
    expect(added.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(added.slides[0]!.elements[1]).not.toHaveProperty("typography.fontSize");
    expect(added.slides[0]!.elements[2]).not.toHaveProperty("typography.fontSize");

    const undoEvent = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(undoEvent));
    expect(undoEvent.defaultPrevented).toBe(true);
    const undone = await save();
    expect(undone.textStyles ?? []).toEqual([]);
    expect(undone.slides[0]!.elements[0]).toMatchObject({ typography: { fontSize: 30 } });
    expect(undone.slides[0]!.elements[1]).toMatchObject({ typography: { fontSize: 40 } });
    expect(undone.slides[0]!.elements[2]).not.toHaveProperty("typography.fontSize");

    const secondUndoEvent = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(secondUndoEvent));
    expect(secondUndoEvent.defaultPrevented).toBe(false);

    await redo();
    const redone = await save();
    expect(redone.textStyles).toEqual([{ id: "body", typography: { fontSize: addDefault } }]);
    expect(redone.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(redone.slides[0]!.elements[1]).not.toHaveProperty("typography.fontSize");
    expect(redone.slides[0]!.elements[2]).not.toHaveProperty("typography.fontSize");
  });

  it("propagates a continuous master edit once and restores exact local snapshots", async () => {
    const richContent = { type: "rich-text" as const, runs: [{ text: "Keep", marks: { bold: true } }] };
    await renderWorkspace(basePresentation({
      textStyles: [{ id: "body", typography: { fontSize: 20, textAlign: "center" } }, { id: "quote", name: "Quote", role: "body" }],
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        elements: [
          { id: "a", type: "text", hidden: false, variant: "body", content: richContent, typography: { fontSize: 30, textAlign: "right" } },
          { id: "b", type: "text", hidden: false, variant: "body", content: "B", typography: { fontSize: 40 } },
          { id: "c", type: "text", hidden: false, variant: "body", content: "C" },
          { id: "other", type: "text", hidden: false, variant: "quote", content: "Other", typography: { fontSize: 50 } },
          { id: "detached", type: "text", hidden: false, variant: "body", styleDetached: true, content: "Detached", typography: { fontSize: 60 } },
          { id: "nested-container", type: "container", hidden: false, children: [{ id: "nested", type: "text", hidden: false, variant: "body", content: "Nested", typography: { fontSize: 70 } }] },
        ],
      }],
    }));
    let body = await openRow("body");
    const input = body.querySelector<HTMLInputElement>("#text-style-body-font-size");
    if (!input) throw new Error("fundamental font size input was not rendered");

    await act(async () => {
      input.focus();
      setInputValue(input, "21");
      setInputValue(input, "22");
      setInputValue(input, "24");
      input.blur();
    });
    const edited = await save();
    const editedElements = edited.slides[0]!.elements;
    expect(edited.textStyles).toEqual([{ id: "quote", name: "Quote", role: "body" }, { id: "body", typography: { fontSize: 24, textAlign: "center" } }]);
    expect(editedElements[0]).toMatchObject({ content: richContent, typography: { textAlign: "right" } });
    expect(editedElements[0]).not.toHaveProperty("typography.fontSize");
    expect(editedElements[1]).not.toHaveProperty("typography.fontSize");
    expect(editedElements[2]).toEqual(expect.objectContaining({ id: "c", variant: "body", content: "C" }));
    expect(editedElements[3]).toMatchObject({ variant: "quote", typography: { fontSize: 50 } });
    expect(editedElements[4]).toMatchObject({ variant: "body", styleDetached: true, typography: { fontSize: 60 } });
    expect((editedElements[5] as Extract<typeof editedElements[number], { type: "container" }>).children[0]).not.toHaveProperty("typography.fontSize");

    await undo();
    const undone = await save();
    expect(undone.textStyles).toEqual([{ id: "body", typography: { fontSize: 20, textAlign: "center" } }, { id: "quote", name: "Quote", role: "body" }]);
    expect(undone.slides[0]!.elements[0]).toMatchObject({ content: richContent, typography: { fontSize: 30, textAlign: "right" } });
    expect(undone.slides[0]!.elements[1]).toMatchObject({ typography: { fontSize: 40 } });
    expect((undone.slides[0]!.elements[5] as ContainerElement).children[0]).toMatchObject({ typography: { fontSize: 70 } });

    await redo();
    const redone = await save();
    expect(redone.textStyles).toEqual([{ id: "quote", name: "Quote", role: "body" }, { id: "body", typography: { fontSize: 24, textAlign: "center" } }]);
    expect(redone.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(redone.slides[0]!.elements[1]).not.toHaveProperty("typography.fontSize");
  });

  it("clears local overrides on master add and remove without materializing removed values", async () => {
    await renderWorkspace(basePresentation({
      textStyles: [{ id: "body", typography: { fontSize: 24 } }],
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        { id: "a", type: "text", hidden: false, variant: "body", content: "A", typography: { fontSize: 30 } },
        { id: "b", type: "text", hidden: false, variant: "body", content: "B" },
      ] }],
    }));
    let body = await openRow("body");
    const remove = body.querySelector<HTMLButtonElement>("[aria-label='Remove Font size']");
    if (!remove) throw new Error("font size remove button was not rendered");
    await act(async () => remove.click());
    let removed = await save();
    expect(removed.textStyles ?? []).not.toContainEqual(expect.objectContaining({ typography: expect.objectContaining({ fontSize: expect.anything() }) }));
    expect(removed.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(removed.slides[0]!.elements[1]).not.toHaveProperty("typography.fontSize");
    await undo();
    const undone = await save();
    expect(undone.textStyles).toEqual([{ id: "body", typography: { fontSize: 24 } }]);
    expect(undone.slides[0]!.elements[0]).toMatchObject({ typography: { fontSize: 30 } });
    await redo();
    removed = await save();
    expect(removed.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");

    body = row("body");
    await addProperty(body, "Font size");
    const added = await save();
    expect(added.textStyles).toEqual([{ id: "body", typography: { fontSize: 18 } }]);
    expect(added.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    await undo();
    const addUndone = await save();
    expect(addUndone.textStyles ?? []).toEqual([]);
  });

  it("authors and removes margin definitions as discrete history actions", async () => {
    await renderWorkspace(basePresentation());
    let body = await openRow("body");
    await addProperty(body, "Margin top");
    expect(row("body").querySelector<HTMLInputElement>("#text-style-body-marginTop")?.value).toBe("0");
    await undo();
    expect(row("body").querySelector("#text-style-body-marginTop")).toBeNull();
    await redo();
    body = row("body");
    await act(async () => row("body").querySelector<HTMLButtonElement>("[aria-label='Remove Margin top']")?.click());
    expect(row("body").querySelector("#text-style-body-marginTop")).toBeNull();
    expect(row("body").textContent).toContain("Built-in");
    await undo();
    expect(row("body").querySelector<HTMLInputElement>("#text-style-body-marginTop")?.value).toBe("0");
    expect(row("body").textContent).toContain("Customized");
    await redo();
    expect(row("body").querySelector("#text-style-body-marginTop")).toBeNull();
    expect(row("body").textContent).toContain("Built-in");
  });

  it("resets every removed fundamental property across mixed linked Texts in one exact action", async () => {
    const richContent = { type: "rich-text" as const, runs: [{ text: "Keep", marks: { bold: true, italic: true } }] };
    const initial = basePresentation({
      textStyles: [
        { id: "body", typography: { fontSize: 20 }, style: { color: "#0000ff" }, layout: { marginTop: 8 } },
        { id: "quote", name: "Quote", role: "body" },
      ],
      slides: [{ id: "slide-1", title: "Slide 1", elements: [
        {
          id: "reset-a",
          type: "text",
          hidden: false,
          variant: "body",
          content: richContent,
          typography: { fontSize: 30, textAlign: "right" },
          style: { color: "#ff0000", background: { color: "#00ff00" }, border: { width: 1, style: "solid", color: "#000000" }, borderRadius: 4, className: "keep-local" },
          layout: { position: "absolute", top: 12, marginTop: 12 },
        },
        {
          id: "reset-b",
          type: "text",
          hidden: false,
          variant: "body",
          content: "B",
          style: { color: "#00ff00" },
        },
        { id: "reset-detached", type: "text", hidden: false, variant: "body", styleDetached: true, content: "Detached", typography: { fontSize: 60 }, style: { color: "#ff00ff" }, layout: { marginTop: 99 } },
        { id: "reset-other", type: "text", hidden: false, variant: "quote", content: "Other", typography: { fontSize: 70 } },
      ] }],
    });
    await renderWorkspace(initial);
    const body = await openRow("body");
    const reset = Array.from(body.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Reset");
    if (!reset) throw new Error("fundamental reset button was not rendered");
    await act(async () => reset.click());
    const cancel = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Cancel");
    if (!cancel) throw new Error("reset cancel button was not rendered");
    await act(async () => cancel.click());
    expect(row("body").querySelector("#text-style-body-font-size")).not.toBeNull();

    await act(async () => reset.click());
    const confirm = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Reset Body");
    if (!confirm) throw new Error("reset confirm button was not rendered");
    await act(async () => confirm.click());
    expect(row("body").querySelector("#text-style-body-font-size")).toBeNull();
    const resetSnapshot = await save();
    expect(resetSnapshot.textStyles).toEqual([{ id: "quote", name: "Quote", role: "body" }]);
    expect(resetSnapshot.slides[0]?.elements[0]).toEqual({
      id: "reset-a",
      type: "text",
      hidden: false,
      variant: "body",
      content: richContent,
      typography: { textAlign: "right" },
      style: { background: { color: "#00ff00" }, border: { width: 1, style: "solid", color: "#000000" }, borderRadius: 4, className: "keep-local" },
      layout: { position: "absolute", top: 12 },
    });
    expect(resetSnapshot.slides[0]?.elements[1]).toEqual({ id: "reset-b", type: "text", hidden: false, variant: "body", content: "B" });
    expect(resetSnapshot.slides[0]?.elements[2]).toEqual(initial.slides[0]?.elements[2]);
    expect(resetSnapshot.slides[0]?.elements[3]).toEqual(initial.slides[0]?.elements[3]);
    await undo();
    expect(row("body").querySelector("#text-style-body-font-size")).not.toBeNull();
    const resetUndone = await save();
    expect(resetUndone).toEqual(initial);
    await redo();
    expect(row("body").querySelector("#text-style-body-font-size")).toBeNull();
    const resetRedone = await save();
    expect(resetRedone).toEqual(resetSnapshot);
  });

  it("creates a custom style with a stable replayed id and separates name and role actions", async () => {
    await renderWorkspace(basePresentation());
    const addStyle = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add Style");
    if (!addStyle) throw new Error("Add Style button was not rendered");
    await act(async () => addStyle.click());
    const form = host.querySelector<HTMLElement>("[data-new-text-style]");
    if (!form) throw new Error("new Text Style form was not rendered");
    const name = form.querySelector<HTMLInputElement>("input");
    const role = form.querySelector<HTMLSelectElement>("select");
    if (!name || !role) throw new Error("new Text Style fields were not rendered");
    await act(async () => {
      setInputValue(name, "Quote");
      setSelectValue(role, "caption");
    });
    expect(host.querySelector("[data-text-style-id='quote']")).toBeNull();
    const create = Array.from(form.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add Style");
    if (!create) throw new Error("new Text Style create button was not rendered");
    await act(async () => create.click());
    expect(row("quote").textContent).toContain("Caption");
    await undo();
    expect(host.querySelector("[data-text-style-id='quote']")).toBeNull();
    await redo();
    expect(row("quote").textContent).toContain("Caption");

    const quote = await openRow("quote");
    const nameInput = quote.querySelector<HTMLInputElement>("input");
    const roleSelect = quote.querySelector<HTMLSelectElement>("select");
    if (!nameInput || !roleSelect) throw new Error("custom definition fields were not rendered");
    await act(async () => {
      nameInput.focus();
      setInputValue(nameInput, "Renamed");
      nameInput.blur();
    });
    await act(async () => setSelectValue(roleSelect, "title"));
    expect(row("quote").textContent).toContain("Title");
    await undo();
    expect(row("quote").textContent).toContain("Caption");
    await undo();
    expect(row("quote").querySelector<HTMLInputElement>("input")?.value).toBe("Quote");
  });

  it("uses shared color history and focused stroke-width history without leaking pending state", async () => {
    await renderWorkspace(basePresentation({
      palette: { colors: [{ id: "primary", name: "Primary", value: "#336699" }] },
      textStyles: [{ id: "quote", name: "Quote", role: "body", typography: { textStroke: { width: 1, color: "#111111" } } }],
    }));
    let quote = await openRow("quote");
    const width = quote.querySelector<HTMLInputElement>("#text-style-quote-stroke-width");
    if (!width) throw new Error("stroke width input was not rendered");
    await act(async () => {
      width.focus();
      setInputValue(width, "2");
      setInputValue(width, "3");
      width.blur();
    });
    expect(row("quote").querySelector<HTMLInputElement>("#text-style-quote-stroke-width")?.value).toBe("3");
    await undo();
    expect(row("quote").querySelector<HTMLInputElement>("#text-style-quote-stroke-width")?.value).toBe("1");
    await redo();
    expect(row("quote").querySelector<HTMLInputElement>("#text-style-quote-stroke-width")?.value).toBe("3");

    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);
    await renderWorkspace(basePresentation({
      palette: { colors: [{ id: "primary", name: "Primary", value: "#336699" }] },
      textStyles: [{ id: "quote", name: "Quote", role: "body" }],
    }));
    quote = await openRow("quote");
    await addProperty(quote, "Text color");
    expect(row("quote").querySelector("[data-text-style-property='color']")).not.toBeNull();
    const usePalette = Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Use palette");
    if (!usePalette) throw new Error("color palette button was not rendered");
    await act(async () => usePalette.click());
    const primary = row("quote").querySelector<HTMLButtonElement>("button[aria-label*='Primary']");
    if (!primary) throw new Error("palette color was not rendered");
    await act(async () => primary.click());
    await undo();
    expect(row("quote").querySelector("[data-text-style-property='color']")).toBeNull();
    await redo();
    expect(row("quote").querySelector("[data-text-style-property='color']")).not.toBeNull();
  });
});
