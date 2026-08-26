// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationPaletteManager } from "../src/features/editor/inspector/sections/presentation-palette-manager";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("PresentationPaletteManager", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  it("delegates add, rename, value edit, and remove operations", () => {
    const onAdd = vi.fn();
    const onRename = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();

    act(() => root.render(
      <StudioI18nProvider>
        <PresentationPaletteManager
          colors={[{ id: "accent", name: "Accent", value: "#ffffff" }]}
          onAdd={onAdd}
          onRename={onRename}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </StudioI18nProvider>,
    ));

    const inputs = container.querySelectorAll<HTMLInputElement>("input");
    const addName = inputs[0];
    const addValue = inputs[1];
    expect(addName).toBeDefined();
    expect(addValue).toBeDefined();

    act(() => {
      setInputValue(addName, "  Highlight  ");
      addName.dispatchEvent(new Event("input", { bubbles: true }));
      setInputValue(addValue, "#112233");
      addValue.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onAdd).toHaveBeenCalledWith("Highlight", "#112233");

    const rowName = container.querySelector<HTMLInputElement>("input[aria-label='Accent name']");
    const rowValue = container.querySelector<HTMLInputElement>("input[aria-label='Accent value']");
    expect(rowName?.value).toBe("Accent");
    expect(rowValue?.value).toBe("#ffffff");

    act(() => {
      if (rowName) {
        setInputValue(rowName, "Brand Accent");
        rowName.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    act(() => {
      rowName?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    act(() => {
      if (rowValue) {
        setInputValue(rowValue, "#010203");
        rowValue.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onRename).toHaveBeenCalledWith("accent", "Brand Accent");
    expect(onUpdate).toHaveBeenCalledWith("accent", "#010203");

    act(() => {
      const buttons = container.querySelectorAll<HTMLButtonElement>("button");
      Array.from(buttons).find((button) => button.textContent === "Remove")?.click();
    });
    expect(onRemove).toHaveBeenCalledWith("accent");
  });

  it("opens Save to Library only for a non-empty palette and writes a draft", async () => {
    const savePalette = vi.fn(async () => "palette-id");
    const repository = { savePalette, listPalettes: async () => [], getPalette: async () => null, deletePalette: async () => undefined };
    const common = { onAdd: vi.fn(), onRename: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn() };
    act(() => root.render(<StudioI18nProvider><PresentationPaletteManager colors={[]} {...common} /></StudioI18nProvider>));
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save to Library")?.disabled).toBe(true);

    act(() => root.render(<StudioI18nProvider><PresentationPaletteManager palette={{ colors: [{ id: "accent", name: "Accent", value: "#112233" }] }} colors={[{ id: "accent", name: "Accent", value: "#112233" }]} customLibraryPaletteRepository={repository} {...common} /></StudioI18nProvider>));
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save to Library")?.click());
    const name = container.querySelector<HTMLInputElement>("form input");
    expect(name).toBeTruthy();
    act(() => { if (name) { setInputValue(name, "Shared"); name.dispatchEvent(new Event("input", { bubbles: true })); } });
    await act(async () => container.querySelector<HTMLButtonElement>("button[type=submit]")?.click());
    expect(savePalette).toHaveBeenCalledWith({ name: "Shared", colors: [{ name: "Accent", value: "#112233" }] });
  });
});

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
}
