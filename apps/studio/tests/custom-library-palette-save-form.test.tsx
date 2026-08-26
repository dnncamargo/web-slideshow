// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PresentationPalette } from "@powershow/document-schema";
import { CustomLibraryPaletteSaveForm } from "../src/features/custom-library/custom-library-palette-save-form";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const palette: PresentationPalette = {
  colors: [{ id: "accent", name: "Accent", value: "#112233" }],
};

describe("CustomLibraryPaletteSaveForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });

  it("saves the domain draft and reports success", async () => {
    const savePalette = vi.fn(async () => "record-id");
    const onSaved = vi.fn();
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteSaveForm palette={palette} repository={{ savePalette, listPalettes: async () => [], getPalette: async () => null, deletePalette: async () => undefined }} onSaved={onSaved} onCancel={vi.fn()} /></StudioI18nProvider>));
    const inputs = container.querySelectorAll<HTMLInputElement>("input");
    act(() => { setInputValue(inputs[0], "  Shared Brand  "); inputs[0].dispatchEvent(new Event("input", { bubbles: true })); });
    const description = container.querySelector<HTMLTextAreaElement>("textarea");
    act(() => { if (description) { setInputValue(description, "  reusable  "); description.dispatchEvent(new Event("input", { bubbles: true })); } });
    act(() => { container.querySelector<HTMLButtonElement>("button[type=submit]")?.click(); });
    await act(async () => undefined);
    expect(savePalette).toHaveBeenCalledWith({ name: "Shared Brand", description: "reusable", colors: [{ name: "Accent", value: "#112233" }] });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("allows retry after a repository failure", async () => {
    const savePalette = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("record-id");
    const onSaved = vi.fn();
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteSaveForm palette={palette} repository={{ savePalette, listPalettes: async () => [], getPalette: async () => null, deletePalette: async () => undefined }} onSaved={onSaved} onCancel={vi.fn()} /></StudioI18nProvider>));
    const name = container.querySelector<HTMLInputElement>("input");
    act(() => { if (name) { setInputValue(name, "Shared"); name.dispatchEvent(new Event("input", { bubbles: true })); } });
    await act(async () => { container.querySelector<HTMLButtonElement>("button[type=submit]")?.click(); });
    expect(container.textContent).toContain("Could not save palette");
    await act(async () => { container.querySelector<HTMLButtonElement>("button[type=submit]")?.click(); });
    expect(savePalette).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("prevents duplicate submissions while the repository is pending", async () => {
    let resolveSave: ((id: string) => void) | undefined;
    const savePalette = vi.fn(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteSaveForm palette={palette} repository={{ savePalette, listPalettes: async () => [], getPalette: async () => null, deletePalette: async () => undefined }} onSaved={vi.fn()} onCancel={vi.fn()} /></StudioI18nProvider>));
    const name = container.querySelector<HTMLInputElement>("input");
    act(() => { if (name) { setInputValue(name, "Shared"); name.dispatchEvent(new Event("input", { bubbles: true })); } });
    act(() => { const submit = container.querySelector<HTMLButtonElement>("button[type=submit]"); submit?.click(); submit?.click(); });
    expect(savePalette).toHaveBeenCalledOnce();
    await act(async () => { resolveSave?.("id"); await Promise.resolve(); });
  });
});

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
}
