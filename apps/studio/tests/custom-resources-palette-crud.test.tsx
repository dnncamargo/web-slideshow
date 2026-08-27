// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomLibraryPaletteRecord, CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const brand: CustomLibraryPaletteRecord = {
  id: "brand",
  palette: { name: "Brand", description: "Reusable", colors: [{ name: "Accent", value: "#facc15" }] },
};

function makeRepository(overrides: Partial<CustomLibraryPaletteRepository> = {}): CustomLibraryPaletteRepository {
  return {
    savePalette: vi.fn(async () => "created"),
    updatePalette: vi.fn(async () => undefined),
    listPalettes: vi.fn(async () => [brand]),
    getPalette: vi.fn(async () => null),
    deletePalette: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("Custom Resources palette CRUD", () => {
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

  async function mount(repository: CustomLibraryPaletteRepository): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><CustomResourcesWorkspace customLibraryPaletteRepository={repository} presentationColors={[{ id: "local", name: "Local", value: "#123456" }]} /></StudioI18nProvider>));
    await act(async () => { await Promise.resolve(); });
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
  }

  async function click(label: string): Promise<void> {
    await act(async () => button(label).click());
  }

  async function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("creates once, updates the local list, and does not reload", async () => {
    let resolveSave: ((id: string) => void) | undefined;
    const savePalette = vi.fn(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
    const repository = makeRepository({ savePalette });
    await mount(repository);
    await click("+ New");
    await setValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input")!, "  New palette  ");
    await click("+ Add color");
    const colorInputs = container.querySelectorAll<HTMLInputElement>("input");
    await setValue(colorInputs[1]!, "  Accent  ");
    await act(async () => button("Create").click());
    expect(savePalette).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Saving…");
    expect(button("Create").disabled).toBe(true);
    await act(async () => resolveSave?.("new-id"));
    expect(container.textContent).toContain("New palette");
    expect(container.textContent).not.toContain("Saving…");
    expect(repository.listPalettes).toHaveBeenCalledOnce();
    expect(repository.updatePalette).not.toHaveBeenCalled();
  });

  it("keeps a failed create open and allows retry", async () => {
    const savePalette = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("retry-id");
    const repository = makeRepository({ savePalette });
    await mount(repository);
    await click("+ New");
    await setValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input")!, "Retry palette");
    await click("+ Add color");
    await setValue(container.querySelectorAll<HTMLInputElement>("input")[1]!, "Accent");
    await act(async () => button("Create").click());
    expect(container.textContent).toContain("Could not save palette.");
    expect(container.querySelector("form")).not.toBeNull();
    await act(async () => button("Create").click());
    expect(savePalette).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Retry palette");
  });

  it("edits in place and copies into a new record", async () => {
    const savePalette = vi.fn(async () => "copy-id");
    const updatePalette = vi.fn(async () => undefined);
    const repository = makeRepository({ savePalette, updatePalette });
    await mount(repository);
    await click("Edit");
    await setValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input")!, "Edited");
    await act(async () => button("Save changes").click());
    expect(updatePalette).toHaveBeenCalledWith("brand", expect.objectContaining({ name: "Edited" }));
    expect(savePalette).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Edited");
    await click("Copy");
    await setValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input")!, "Copied");
    await act(async () => button("Create copy").click());
    expect(savePalette).toHaveBeenCalledWith(expect.objectContaining({ name: "Copied" }));
    expect(container.textContent).toContain("Copied");
    expect(container.textContent).toContain("Edited");
  });

  it("requires confirmation and removes only the confirmed record", async () => {
    const deletePalette = vi.fn(async () => undefined);
    const repository = makeRepository({ deletePalette });
    await mount(repository);
    await click("Delete");
    expect(deletePalette).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Delete "Brand"?');
    await click("Cancel");
    expect(container.textContent).toContain("Brand");
    await click("Delete");
    await click("Delete");
    expect(deletePalette).toHaveBeenCalledWith("brand");
    expect(container.textContent).not.toContain("Brand");
    expect(container.textContent).toContain("Local");
  });

  it("keeps delete confirmation open after failure and allows retry", async () => {
    const deletePalette = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const repository = makeRepository({ deletePalette });
    await mount(repository);
    await click("Delete");
    await click("Delete");
    expect(container.textContent).toContain("Could not delete palette.");
    expect(container.textContent).toContain('Delete "Brand"?');
    await click("Delete");
    expect(deletePalette).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Brand");
  });

  it("does not update visible state after an unmount during a pending save", async () => {
    let resolveSave: ((id: string) => void) | undefined;
    const savePalette = vi.fn(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
    const repository = makeRepository({ savePalette });
    await mount(repository);
    await click("+ New");
    await setValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input")!, "Unmounted");
    await click("+ Add color");
    await setValue(container.querySelectorAll<HTMLInputElement>("input")[1]!, "Accent");
    await act(async () => button("Create").click());
    await act(async () => root.unmount());
    await act(async () => resolveSave?.("never-visible"));
    expect(container.textContent).not.toContain("never-visible");
  });
});
