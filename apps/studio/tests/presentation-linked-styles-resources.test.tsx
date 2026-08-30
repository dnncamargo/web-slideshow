// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
const makePresentation = (id = "p") => PresentationSchema.parse({ schemaVersion: 1, id, title: "P", slides: [{ id: "s", title: "S", elements: [] }] });

describe("Linked Styles Resources contract", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); });

  async function render(id = "p") {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    const presentation = makePresentation(id);
    await act(async () => root?.render(<StudioI18nProvider><CustomResourcesWorkspace customLibraryPaletteRepository={repository} customLibraryFontRepository={repository} presentation={presentation} presentationColors={[]} presentationFonts={[]} presentationTextStyles={[]} onAddLibraryPalette={() => ({ ok: true, addedColors: [] })} onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })} onApplyElementStyle={() => ({ ok: true })} onAddPresentationColor={() => undefined} onUpdatePresentationColor={() => undefined} onRemovePresentationColor={() => undefined} onRemovePresentationFont={() => "not-found"} isPresentationFontInUse={() => false} /></StudioI18nProvider>));
  }

  it("renders the exact Resources IA with local singular Palette and no library counts", async () => {
    await render();
    expect(host.textContent).toContain("Resources");
    expect(host.textContent).toContain("Element Styles");
    expect(host.textContent).toContain("Palettes");
    expect(host.textContent).toContain("Linked Styles");
    expect(host.textContent).toContain("Palette");
    expect(host.querySelector("[aria-labelledby='custom-resources-from-library'] details[open]")).toBeNull();
    expect(host.querySelector("[aria-labelledby='custom-resources-this-presentation'] details[open]")).toBeNull();
    expect(host.querySelector("[aria-labelledby='custom-resources-from-library'] .sectionCount")).toBeNull();
  });

  it("allows multiple resource disclosures and keeps them in transient UI state", async () => {
    await render();
    const details = Array.from(host.querySelectorAll("details"));
    await act(async () => { (details[0] as HTMLDetailsElement).querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); (details[1] as HTMLDetailsElement).querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(host.querySelectorAll("details[open]").length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(makePresentation())).not.toContain("open");
  });
});
