// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPresentationPaletteColor,
  removePresentationPaletteColor,
  PresentationSchema,
  type Color,
  type Presentation,
} from "@powershow/document-schema";

import type { CustomLibraryPaletteDraft } from "../src/features/custom-library/custom-library-palette";
import type { CustomLibraryPaletteRecord, CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { addCustomLibraryPaletteToPresentation } from "../src/features/custom-library/custom-library-palette-apply";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}

const master: CustomLibraryPaletteRecord = {
  id: "master",
  palette: {
    name: "Supernova",
    colors: [{ name: "Accent", value: "#facc15" }, { name: "Background", value: "#13040e" }],
  },
};

function makePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "resources-composition",
    title: "Resources",
    slides: [{ id: "slide-1", elements: [] }],
    palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
  });
}

function makeRepository(): CustomLibraryPaletteRepository {
  return {
    savePalette: vi.fn(async () => "not-used"),
    updatePalette: vi.fn(async () => undefined),
    listPalettes: vi.fn(async () => [master]),
    getPalette: vi.fn(async () => null),
    deletePalette: vi.fn(async () => undefined),
  };
}

function Harness({ repository }: { repository: CustomLibraryPaletteRepository }) {
  const [presentation, setPresentation] = useState(makePresentation);

  return (
    <CustomResourcesWorkspace
      customLibraryPaletteRepository={repository}
      presentationColors={presentation.palette?.colors ?? []}
      onAddLibraryPalette={(palette: CustomLibraryPaletteDraft) => {
        const result = addCustomLibraryPaletteToPresentation(presentation, palette);
        if (!result.ok) return { ok: false, reason: result.reason };
        setPresentation(result.presentation);
        return { ok: true };
      }}
      onAddPresentationColor={(name: string, value: Color) => {
        setPresentation((current) => {
          const result = addPresentationPaletteColor(current, name, value);
          return result.ok ? result.presentation : current;
        });
      }}
      onUpdatePresentationColor={(id: string, patch: { name: string; value: Color }) => {
        setPresentation((current) => ({
          ...current,
          palette: {
            colors: current.palette?.colors.map((color) =>
              color.id === id ? { ...color, ...patch } : color,
            ) ?? [],
          },
        }));
      }}
      onRemovePresentationColor={(id: string) => {
        setPresentation((current) => {
          const result = removePresentationPaletteColor(current, id);
          return result.ok ? result.presentation : current;
        });
      }}
    />
  );
}

describe("Custom Resources palette composition", () => {
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

  async function mount(repository = makeRepository()): Promise<CustomLibraryPaletteRepository> {
    await act(async () => root.render(<StudioI18nProvider><Harness repository={repository} /></StudioI18nProvider>));
    await act(async () => { await Promise.resolve(); });
    return repository;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
  }

  it("uses Add palette as a chooser and exposes no master CRUD actions", async () => {
    await mount();
    expect(container.textContent).not.toContain("New");
    expect(container.textContent).toContain("From Library");
    expect(container.textContent).toContain("This Presentation");
    expect(container.textContent).not.toContain("Custom Library");
    expect(container.textContent).not.toContain("Fonts");
    expect(container.textContent).not.toContain("Styles");
    expect(container.querySelector("details[open]")).not.toBeNull();
    expect(container.querySelector("[data-presentation-color-name-input]")).toBeNull();
    expect(container.textContent).not.toContain("Copy");
    expect(container.textContent).not.toContain("Delete");
    await act(async () => button("+ Add palette").click());
    expect(container.textContent).toContain("Supernova");
    expect(container.querySelector("[aria-label='Add Supernova']")).not.toBeNull();
    await act(async () => button("Close").click());
    expect(container.textContent).not.toContain("Supernova");
  });

  it("imports masters as flat local copies, permits collisions, and appends another master", async () => {
    await mount();
    await act(async () => button("+ Add palette").click());
    await act(async () => container.querySelector<HTMLButtonElement>("[aria-label='Add Supernova']")?.click());
    await act(async () => container.querySelector<HTMLButtonElement>("[aria-label='Add Supernova']")?.click());
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("[aria-label^='Name for']")).map((input) => input.value)).toEqual(["Accent", "Accent", "Background", "Accent", "Background"]);
    expect(container.querySelectorAll("[data-presentation-palette] [data-presentation-color-row]")).toHaveLength(5);
    expect(container.textContent).not.toContain("master");
  });

  it("adds individual literal colors without master writes and removes local colors", async () => {
    const repository = await mount();
    const addLocal = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "+ Add to Presentation");
    if (!addLocal) throw new Error("Add to Presentation button not found");
    await act(async () => addLocal.click());
    expect(container.textContent).not.toContain("Supernova");
    const nameInput = container.querySelector<HTMLInputElement>("[data-presentation-color-name-input]");
    if (!nameInput) throw new Error("color name input not found");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(nameInput, "RGBA color");
    act(() => {
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const valueInput = container.querySelector<HTMLInputElement>("#custom-resources-literal-color-value");
    if (!valueInput) throw new Error("literal color value input not found");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(valueInput, "rgba(10, 20, 30, 0.4)");
    act(() => valueInput.dispatchEvent(new Event("input", { bubbles: true })));
    await act(async () => button("Add").click());
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("[aria-label^='Name for']")).map((input) => input.value)).toContain("RGBA color");
    expect(container.querySelector("#custom-resources-literal-color-rgba-color-value")).not.toBeNull();
    expect(repository.savePalette).not.toHaveBeenCalled();
    expect(repository.updatePalette).not.toHaveBeenCalled();
    expect(repository.deletePalette).not.toHaveBeenCalled();
    const remove = container.querySelector<HTMLButtonElement>("button[aria-label='Remove RGBA color']");
    if (!remove) throw new Error("local color remove button not found");
    await act(async () => remove.click());
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("[aria-label^='Name for']")).map((input) => input.value)).not.toContain("RGBA color");
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("[aria-label^='Name for']")).map((input) => input.value)).toContain("Accent");
  });

  it("keeps local color editing inline and commits trimmed names", async () => {
    await mount();
    const nameInput = container.querySelector<HTMLInputElement>("[aria-label='Name for Accent']");
    if (!nameInput) throw new Error("local color edit name input not found");
    await act(async () => {
      setInputValue(nameInput, "  Very dark pink  ");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      nameInput.focus();
      nameInput.blur();
    });
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("[aria-label^='Name for']")).map((input) => input.value)).toContain("Very dark pink");
    expect(container.querySelector("button[aria-label='Edit Accent']")).toBeNull();
    expect(container.querySelector("[data-presentation-color-editor]")).toBeNull();
    expect(container.querySelector("#custom-resources-literal-color-accent-value")).not.toBeNull();
    expect(container.textContent).toContain("1 colors");
  });

  it("reverts blank local names without changing the canonical color", async () => {
    await mount();
    const nameInput = container.querySelector<HTMLInputElement>("[aria-label='Name for Accent']");
    if (!nameInput) throw new Error("local color name input not found");
    await act(async () => {
      setInputValue(nameInput, "   ");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      nameInput.focus();
      nameInput.blur();
    });
    expect(container.querySelector<HTMLInputElement>("[aria-label='Name for Accent']")?.value).toBe("Accent");
    expect(container.querySelector("#custom-resources-literal-color-accent-value")).not.toBeNull();
  });
});
