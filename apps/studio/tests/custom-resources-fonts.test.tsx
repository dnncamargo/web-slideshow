// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type FontResource, type Presentation } from "@powershow/document-schema";

import type { CustomLibraryFontDraft, CustomLibraryFontRecord } from "../src/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const font: CustomLibraryFontRecord = {
  id: "library-font-id",
  font: {
    family: "Inter",
    faces: [
      { weight: 400, style: "normal", subset: "latin", source: { type: "url", url: "https://example.com/inter-400.woff2" } },
      { weight: 700, style: "normal", subset: "latin", source: { type: "url", url: "https://example.com/inter-700.woff2" } },
    ],
  },
};

const secondFont: CustomLibraryFontRecord = {
  id: "library-font-id-2",
  font: {
    family: "Roboto",
    faces: [
      { weight: 400, style: "normal", subset: "latin", source: { type: "url", url: "https://example.com/roboto-400.woff2" } },
    ],
  },
};

const paletteRepository: CustomLibraryPaletteRepository = {
  savePalette: vi.fn(async () => "palette"), updatePalette: vi.fn(async () => undefined),
  listPalettes: vi.fn(async () => []), getPalette: vi.fn(async () => null), deletePalette: vi.fn(async () => undefined),
};

function makePresentation(fonts?: FontResource[]): Presentation {
  return PresentationSchema.parse({ schemaVersion: 1, id: "presentation", title: "Test", slides: [{ id: "slide", title: "Slide", elements: [] }], ...(fonts ? { resources: { fonts } } : {}) });
}

function renderWorkspace({
  repository,
  fonts = [],
  onAddLibraryFont = vi.fn(() => ({ kind: "unchanged" as const, addedFaces: 0 })),
  onRemovePresentationFont = vi.fn(() => "not-found" as const),
  isPresentationFontInUse = vi.fn(() => false),
}: {
  repository: CustomLibraryFontRepository;
  fonts?: FontResource[];
  onAddLibraryFont?: (font: CustomLibraryFontDraft) => { kind: "added" | "merged" | "unchanged" | "conflict"; addedFaces: number };
  onRemovePresentationFont?: (id: string) => "removed" | "in-use" | "not-found";
  isPresentationFontInUse?: (family: string) => boolean;
}): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<StudioI18nProvider><CustomResourcesWorkspace
    customLibraryPaletteRepository={paletteRepository}
    customLibraryFontRepository={repository}
    presentationColors={[]}
    presentationFonts={fonts}
    onAddLibraryPalette={() => ({ ok: true, addedColors: [] })}
    onAddLibraryFont={onAddLibraryFont}
    onAddPresentationColor={() => undefined}
    onUpdatePresentationColor={() => undefined}
    onRemovePresentationColor={() => undefined}
    onRemovePresentationFont={onRemovePresentationFont}
    isPresentationFontInUse={isPresentationFontInUse}
  /></StudioI18nProvider>));
  return { container, root };
}

async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe("Custom Resources Fonts", () => {
  let root: Root | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
  });

  it("loads ready masters independently and passes only the draft to add", async () => {
    const listFonts = vi.fn(async () => [font]);
    const repository = { listFonts, saveFont: vi.fn(), updateFont: vi.fn(), getFont: vi.fn(), deleteFont: vi.fn() } as unknown as CustomLibraryFontRepository;
    const onAdd = vi.fn(() => ({ kind: "added" as const, addedFaces: 2 }));
    const rendered = renderWorkspace({ repository, onAddLibraryFont: onAdd }); root = rendered.root;
    await flush();
    expect(rendered.container.textContent).toContain("Palettes");
    expect(rendered.container.textContent).toContain("Fonts");
    await act(async () => Array.from(rendered.container.querySelectorAll("button")).find((button) => button.textContent === "+ Add font")?.click());
    const addFont = rendered.container.querySelector<HTMLButtonElement>("[aria-label='Add Inter']");
    expect(addFont).not.toBeNull();
    await act(async () => addFont?.click());
    expect(onAdd).toHaveBeenCalledWith(font.font);
  });

  it("shows loading, empty, and error retry states", async () => {
    let resolve: ((value: CustomLibraryFontRecord[]) => void) | undefined;
    const loadingRepository = { listFonts: vi.fn(() => new Promise<CustomLibraryFontRecord[]>((r) => { resolve = r; })) } as unknown as CustomLibraryFontRepository;
    const loading = renderWorkspace({ repository: loadingRepository }); root = loading.root;
    await act(async () => Array.from(loading.container.querySelectorAll("button")).find((button) => button.textContent === "+ Add font")?.click());
    expect(loading.container.textContent).toContain("Loading fonts…");
    resolve?.([]); await flush();
    expect(loading.container.textContent).toContain("No fonts in Custom Library.");
    await act(async () => loading.root.unmount());
    const errorRepository = { listFonts: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([font]) } as unknown as CustomLibraryFontRepository;
    const error = renderWorkspace({ repository: errorRepository }); root = error.root;
    await act(async () => Array.from(error.container.querySelectorAll("button")).find((button) => button.textContent === "+ Add font")?.click());
    await flush();
    expect(error.container.textContent).toContain("Could not load fonts.");
    const retry = Array.from(error.container.querySelectorAll("button")).find((button) => button.textContent === "Retry");
    await act(async () => retry?.click()); await flush();
    expect(errorRepository.listFonts).toHaveBeenCalledTimes(2);
    expect(error.container.textContent).toContain("Inter");
  });

  it("shows outcome feedback and presentation-local font rows", async () => {
    const repository = { listFonts: vi.fn(async () => [font]) } as unknown as CustomLibraryFontRepository;
    const outcomes = ["added", "merged", "unchanged", "conflict"] as const;
    for (const kind of outcomes) {
      const onAdd = vi.fn(() => ({ kind, addedFaces: kind === "merged" ? 3 : 0 }));
      const rendered = renderWorkspace({ repository, onAddLibraryFont: onAdd }); root = rendered.root;
      await flush();
      await act(async () => Array.from(rendered.container.querySelectorAll("button")).find((button) => button.textContent === "+ Add font")?.click());
      await act(async () => rendered.container.querySelector<HTMLButtonElement>("[aria-label='Add Inter']")?.click());
      expect(rendered.container.textContent).toContain(kind === "added" ? "Inter added" : kind === "merged" ? "Added 3 font faces" : kind === "unchanged" ? "already in this presentation" : "conflicts with an existing font face");
      await act(async () => rendered.root.unmount());
    }
    const unused = makePresentation([{ id: "exact-id", family: "Inter", faces: font.font.faces }]).resources?.fonts ?? [];
    const remove = vi.fn(() => "removed" as const);
    const local = renderWorkspace({ repository, fonts: unused, onRemovePresentationFont: remove }); root = local.root;
    expect(local.container.textContent).toContain("Inter");
    expect(local.container.textContent).toContain("2 faces");
    const removeButton = local.container.querySelector<HTMLButtonElement>("[aria-label='Remove Inter']");
    expect(removeButton?.disabled).toBe(false);
    await act(async () => removeButton?.click());
    expect(remove).toHaveBeenCalledWith("exact-id");
  });

  it("renders multiple library fonts as separate master rows", async () => {
    const repository = { listFonts: vi.fn(async () => [font, secondFont]) } as unknown as CustomLibraryFontRepository;
    const rendered = renderWorkspace({ repository }); root = rendered.root;
    await flush();
    await act(async () => Array.from(rendered.container.querySelectorAll("button")).find((button) => button.textContent === "+ Add font")?.click());

    const rows = rendered.container.querySelectorAll("[data-custom-resource-font]");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Inter");
    expect(rows[1]?.textContent).toContain("Roboto");
    expect(rows[0]?.parentElement).toBe(rows[1]?.parentElement);
  });

  it("protects in-use fonts and supports legacy one-face display", async () => {
    const repository = { listFonts: vi.fn(async () => []) } as unknown as CustomLibraryFontRepository;
    const remove = vi.fn(() => "in-use" as const);
    const rendered = renderWorkspace({
      repository,
      fonts: [{ id: "legacy-id", family: "Inter", source: font.font.faces[0]?.source ?? { type: "url", url: "https://example.com/inter.woff2" } }],
      onRemovePresentationFont: remove,
      isPresentationFontInUse: () => true,
    }); root = rendered.root;
    await flush();
    expect(rendered.container.textContent).toContain("1 face");
    expect(rendered.container.textContent).toContain("In use");
    const button = rendered.container.querySelector<HTMLButtonElement>("[aria-label='Remove Inter']");
    expect(button?.disabled).toBe(true);
    await act(async () => button?.click());
    expect(remove).not.toHaveBeenCalled();
    expect(rendered.container.textContent).not.toContain("Fontsource");
    expect(rendered.container.textContent).not.toContain("Google Fonts");
    expect(rendered.container.textContent).not.toContain("Manual");
  });
});
