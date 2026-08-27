// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomLibraryPaletteAddPicker } from "../src/features/custom-library/custom-library-palette-add-picker";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const record = { id: "stored-id", palette: { name: "Brand", description: "Shared", colors: [{ name: "Accent", value: "#112233" }] } };

describe("CustomLibraryPaletteAddPicker", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });

  it("loads only when opened, selects a record, and delegates its palette", async () => {
    const listPalettes = vi.fn(async () => [record]);
    const onAdd = vi.fn(() => ({ ok: true as const }));
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen={false} repository={{ savePalette: async () => "id", updatePalette: async () => undefined, listPalettes, getPalette: async () => null, deletePalette: async () => undefined }} onAdd={onAdd} onCancel={vi.fn()} /></StudioI18nProvider>));
    expect(listPalettes).not.toHaveBeenCalled();
    const onCancel = vi.fn();
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen repository={{ savePalette: async () => "id", updatePalette: async () => undefined, listPalettes, getPalette: async () => null, deletePalette: async () => undefined }} onAdd={onAdd} onCancel={onCancel} /></StudioI18nProvider>));
    await act(async () => undefined);
    expect(listPalettes).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Brand");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Brand"))?.click());
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Add to Presentation"))?.click());
    expect(onAdd).toHaveBeenCalledWith(record.palette);
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Close")?.click());
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows a retry action after listing fails", async () => {
    const listPalettes = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([record]);
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen repository={{ savePalette: async () => "id", updatePalette: async () => undefined, listPalettes, getPalette: async () => null, deletePalette: async () => undefined }} onAdd={vi.fn(() => ({ ok: true as const }))} onCancel={vi.fn()} /></StudioI18nProvider>));
    await act(async () => undefined);
    expect(container.textContent).toContain("Could not load Custom Library palettes");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Retry")?.click());
    await act(async () => undefined);
    expect(listPalettes).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Brand");
  });

  it("resets on reopen and selects duplicate names by record id", async () => {
    const first = { ...record, id: "first", palette: { ...record.palette, colors: [{ name: "First", value: "#111111" }] } };
    const second = { ...record, id: "second", palette: { ...record.palette, colors: [{ name: "Second", value: "#222222" }] } };
    const listPalettes = vi.fn(async () => [first, second]);
    const onAdd = vi.fn(() => ({ ok: true as const }));
    const props = { repository: { savePalette: async () => "id", updatePalette: async () => undefined, listPalettes, getPalette: async () => null, deletePalette: async () => undefined }, onAdd, onCancel: vi.fn() };
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen {...props} /></StudioI18nProvider>));
    await act(async () => undefined);
    const items = container.querySelectorAll<HTMLButtonElement>("[aria-pressed]");
    act(() => items[1]?.click());
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Add to Presentation"))?.click());
    expect(onAdd).toHaveBeenCalledWith(second.palette);
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen={false} {...props} /></StudioI18nProvider>));
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen {...props} /></StudioI18nProvider>));
    await act(async () => undefined);
    expect(listPalettes).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Palette added to Presentation.");
  });

  it("shows failure feedback without hiding the picker", async () => {
    const onAdd = vi.fn(() => ({ ok: false as const, reason: "invalid-name" }));
    const onCancel = vi.fn();
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteAddPicker isOpen repository={{ savePalette: async () => "id", updatePalette: async () => undefined, listPalettes: async () => [record], getPalette: async () => null, deletePalette: async () => undefined }} onAdd={onAdd} onCancel={onCancel} /></StudioI18nProvider>));
    await act(async () => undefined);
    act(() => container.querySelector<HTMLButtonElement>("[aria-pressed]")?.click());
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Add to Presentation"))?.click());
    expect(container.textContent).toContain("Could not add palette to Presentation.");
    expect(onCancel).not.toHaveBeenCalled();
  });
});
