// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const font = {
  family: "Inter",
  faces: [{ weight: 400, style: "normal" as const, subset: "latin", source: { type: "url" as const, url: "https://example.com/inter.woff2" } }],
};

const paletteRepository: CustomLibraryPaletteRepository = {
  savePalette: vi.fn(async () => "palette"), updatePalette: vi.fn(async () => undefined),
  listPalettes: vi.fn(async () => []), getPalette: vi.fn(async () => null), deletePalette: vi.fn(async () => undefined),
};

function presentation(fonts?: Presentation["resources"] extends infer R ? R extends { fonts?: infer F } ? F : never : never, used = false): Presentation {
  return PresentationSchema.parse({ schemaVersion: 1, id: "editor-fonts", title: "Editor fonts", slides: [{ id: "slide", title: "Slide", elements: used ? [{ id: "text", type: "text", hidden: false, variant: "body", content: "Text", typography: { fontFamily: "Inter" } }] : [] }], ...(fonts ? { resources: { fonts } } : {}) });
}

function mount(initialPresentation: Presentation): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const fontRepository = { listFonts: vi.fn(async () => [{ id: "library-record-id", font }]) } as unknown as CustomLibraryFontRepository;
  act(() => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initialPresentation} customLibraryPaletteRepository={paletteRepository} customLibraryFontRepository={fontRepository} /></StudioI18nProvider>));
  return { container, root };
}

async function openFonts(container: HTMLDivElement): Promise<void> {
  const resources = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
  await act(async () => resources?.click());
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  const addFont = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ Add font");
  await act(async () => addFont?.click());
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe("EditorWorkspace presentation font resources", () => {
  let root: Root | undefined;

  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ""; root = undefined; });

  it("materializes a Library draft locally without its repository id", async () => {
    const rendered = mount(presentation()); root = rendered.root;
    await openFonts(rendered.container);
    await act(async () => rendered.container.querySelector<HTMLButtonElement>("[aria-label='Add Inter']")?.click());
    expect(rendered.container.textContent).toContain("Inter");
    expect(rendered.container.textContent).toContain("1 font");
    expect(rendered.container.textContent).not.toContain("library-record-id");
  });

  it("leaves a conflicting local family unchanged and removes only unused exact resources", async () => {
    const local = [{ id: "local-id", family: "Inter", faces: [{ ...font.faces[0], source: { ...font.faces[0].source, url: "https://example.com/local.woff2" } }] }];
    const rendered = mount(presentation(local)); root = rendered.root;
    await openFonts(rendered.container);
    await act(async () => rendered.container.querySelector<HTMLButtonElement>("[aria-label='Add Inter']")?.click());
    expect(rendered.container.textContent).toContain("conflicts with an existing font face");
    expect(rendered.container.textContent).toContain("1 face");
    const remove = rendered.container.querySelector<HTMLButtonElement>("[aria-label='Remove Inter']");
    await act(async () => remove?.click());
    expect(rendered.container.textContent).toContain("no fonts");

    const used = mount(presentation(local, true)); root = used.root;
    await openFonts(used.container);
    await act(async () => used.container.querySelector<HTMLButtonElement>("[aria-label='Remove Inter']")?.click());
    expect(used.container.querySelector<HTMLButtonElement>("[aria-label='Remove Inter']")?.disabled).toBe(true);
    expect(used.container.textContent).toContain("In use");
  });
});
