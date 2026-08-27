// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import type { CustomLibraryPaletteRecord } from "../src/features/custom-library/custom-library-palette-repository";

const defaultPaletteRepository = vi.hoisted(() => ({
  savePalette: vi.fn(async () => "saved"),
  updatePalette: vi.fn(async () => undefined),
  listPalettes: vi.fn(async () => [] as CustomLibraryPaletteRecord[]),
  getPalette: vi.fn(async () => null),
  deletePalette: vi.fn(async () => undefined),
}));

vi.mock("../src/features/persistence/custom-library-palette-repository-instance", () => ({
  getDefaultCustomLibraryPaletteRepository: () => defaultPaletteRepository,
}));

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function makePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "custom-resources-default-repository",
    title: "Custom Resources",
    slides: [{ id: "slide-1", title: "First", elements: [] }],
  });
}

describe("Custom Resources default repository integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    defaultPaletteRepository.listPalettes.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={makePresentation()} />
      </StudioI18nProvider>,
    ));
  }

  async function clickResources(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!button) throw new Error("Custom Resources button not found");
    await act(async () => button.click());
  }

  it("uses the default repository only when Resources opens", async () => {
    defaultPaletteRepository.listPalettes.mockResolvedValueOnce([{
      id: "brand",
      palette: {
        name: "Brand",
        colors: [{ name: "Accent", value: "#facc15" }, { name: "Secondary", value: "#2563eb" }],
      },
    }]);

    await mount();
    expect(defaultPaletteRepository.listPalettes).not.toHaveBeenCalled();

    await clickResources();
    expect(defaultPaletteRepository.listPalettes).toHaveBeenCalledOnce();
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain("Brand");
    expect(container.textContent).not.toContain("Could not load Custom Library palettes.");
  });

  it("ignores stale requests after closing Resources and loads a fresh request on reopen", async () => {
    let resolveFirst: ((records: CustomLibraryPaletteRecord[]) => void) | undefined;
    let resolveSecond: ((records: CustomLibraryPaletteRecord[]) => void) | undefined;
    const firstRequest = new Promise<CustomLibraryPaletteRecord[]>((resolve) => { resolveFirst = resolve; });
    const secondRequest = new Promise<CustomLibraryPaletteRecord[]>((resolve) => { resolveSecond = resolve; });
    defaultPaletteRepository.listPalettes
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest);

    await mount();
    await clickResources();
    expect(defaultPaletteRepository.listPalettes).toHaveBeenCalledOnce();
    await clickResources();
    resolveFirst?.([{
      id: "stale",
      palette: { name: "Stale", colors: [{ name: "Accent", value: "#facc15" }] },
    }]);
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).not.toContain("Stale");

    await clickResources();
    expect(defaultPaletteRepository.listPalettes).toHaveBeenCalledTimes(2);
    resolveSecond?.([{
      id: "fresh",
      palette: { name: "Fresh", colors: [{ name: "Secondary", value: "#2563eb" }] },
    }]);
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain("Fresh");
    expect(container.textContent).not.toContain("Stale");
  });
});
