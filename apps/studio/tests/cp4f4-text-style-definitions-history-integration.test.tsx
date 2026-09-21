// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

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
        <EditorWorkspace
          initialPresentation={initial}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
        />
      </StudioI18nProvider>,
    ));
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources button was not rendered");
    await act(async () => resources.click());
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

  it("keeps reset confirmation local and replays only the fundamental override", async () => {
    const initial = basePresentation({
      textStyles: [{ id: "body", typography: { fontSize: 20 } }],
      slides: [{ id: "slide-1", title: "Slide 1", elements: [{ id: "text-1", type: "text", hidden: false, variant: "body", content: "Text" }] }],
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
    expect(initial.slides[0]?.elements[0]).toMatchObject({ variant: "body", content: "Text" });
    await undo();
    expect(row("body").querySelector("#text-style-body-font-size")).not.toBeNull();
    await redo();
    expect(row("body").querySelector("#text-style-body-font-size")).toBeNull();
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
