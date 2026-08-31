// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
const makePresentation = (id = "p") => PresentationSchema.parse({ schemaVersion: 1, id, title: "P", slides: [{ id: "s", title: "S", elements: [
  { id: "linked", type: "container", hidden: false, linkedStyleId: "gap", children: [] },
  { id: "match-a", type: "container", hidden: false, layout: { children: { gap: 16 } }, children: [] },
  { id: "match-b", type: "container", hidden: false, layout: { children: { gap: 16 } }, children: [] },
  { id: "mismatch", type: "container", hidden: false, layout: { children: { gap: 12 } }, children: [] },
] }, { id: "s2", title: "Second", elements: [] }], linkedStyles: [{ id: "gap", name: "Gap", layout: { children: { gap: 16 } } }] });

describe("Linked Styles Resources contract", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); });

  async function render(value = makePresentation(), onUpdateLinkedStyle = () => undefined) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(<StudioI18nProvider><CustomResourcesWorkspace customLibraryPaletteRepository={repository} customLibraryFontRepository={repository} presentation={value} presentationColors={[]} presentationFonts={[]} presentationTextStyles={[]} onAddLibraryPalette={() => ({ ok: true, addedColors: [] })} onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })} onApplyElementStyle={() => ({ ok: true })} onAddPresentationColor={() => undefined} onUpdatePresentationColor={() => undefined} onRemovePresentationColor={() => undefined} onRemovePresentationFont={() => "not-found"} isPresentationFontInUse={() => false} onUpdateLinkedStyle={onUpdateLinkedStyle} /></StudioI18nProvider>));
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

  it("shows authored matching counts, attach action, and linked locations", async () => {
    await render();
    const linkedSection = Array.from(host.querySelectorAll("details")).find((detail) => detail.textContent?.includes("Linked Styles"));
    await act(async () => linkedSection?.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='gap']");
    expect(row?.textContent).toContain("Used by 1 element");
    expect(row?.textContent).toContain("Matching 2 elements");
    await act(async () => row?.querySelector("button")?.click());
    expect(row?.textContent).toContain("Attach 2 matching elements");
    expect(row?.textContent).toContain("Slide 1 · linked");
  });

  it("organizes the expanded definition editor into semantic static groups", async () => {
    const base = makePresentation();
    const value = PresentationSchema.parse({ ...base, linkedStyles: [...(base.linkedStyles ?? []), { id: "card", name: "Card", layout: { padding: 100, children: { gap: 16 } }, style: { background: { pattern: { image: "linear-gradient(#000, #fff)" } }, borderRadius: 8 }, effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } } }] });
    const onUpdate = vi.fn();
    await render(value, onUpdate);
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='card']");
    await act(async () => row?.querySelector("button")?.click());
    const sections = Array.from(host.querySelectorAll<HTMLElement>("[data-linked-style-section]"));
    expect(sections.map((section) => section.dataset.linkedStyleSection)).toEqual(["layout", "spacing", "appearance", "effects", "reuse"]);
    expect(sections[0]?.textContent).toContain("Gap");
    expect(sections[1]?.textContent).toContain("Padding");
    expect(sections[2]?.textContent).toContain("Pattern");
    expect(sections[2]?.textContent).toContain("Rounded corners");
    expect(sections[3]?.textContent).toContain("Opacity");
    expect(sections[3]?.textContent).toContain("Shadow");
    expect(sections[3]?.querySelector("details")).toBeNull();
    expect(sections[3]?.textContent).not.toContain("Local override");
    expect(sections[4]?.textContent).toContain("Changes affect");
    expect(sections.every((section) => section.tagName.toLowerCase() !== "details")).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#linked-style-card-border-radius")?.value).toBe("8");
    expect(sections[0]?.querySelector<HTMLInputElement>("input[type='number']")?.value).toBe("16");
    expect(host.textContent).not.toContain("Create from selected Container");
    expect(host.querySelector("[data-linked-style-section='typography']")).toBeNull();
  });

  it("shows legacy typography as compatibility-only and removes it through the update boundary", async () => {
    const base = makePresentation();
    const value = PresentationSchema.parse({ ...base, linkedStyles: [...(base.linkedStyles ?? []), { id: "legacy", name: "Legacy", layout: { padding: 12 }, typography: { fontFamily: "Arial", fontSize: 20 } }] });
    const onUpdate = vi.fn();
    await render(value, onUpdate);
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='legacy']");
    await act(async () => row?.querySelector("button")?.click());
    const legacy = host.querySelector<HTMLElement>("[data-linked-style-section='legacy-typography']")!;
    expect(legacy.textContent).toContain("legacy typography");
    expect(legacy.querySelector("input")).toBeNull();
    await act(async () => legacy.querySelector("button")?.click());
    expect(onUpdate).toHaveBeenCalledWith("legacy", { typography: undefined });
  });

  it("disables removal when legacy typography is the sole authored property", async () => {
    const base = makePresentation();
    const value = PresentationSchema.parse({ ...base, linkedStyles: [...(base.linkedStyles ?? []), { id: "legacy-only", name: "Legacy only", typography: { fontSize: 20 } }] });
    const onUpdate = vi.fn();
    await render(value, onUpdate);
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='legacy-only']");
    await act(async () => row?.querySelector("button")?.click());
    const remove = host.querySelector<HTMLElement>("[data-linked-style-section='legacy-typography'] button") as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
