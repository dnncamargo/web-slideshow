// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type LinkedContainerStyle } from "@powershow/document-schema";
import { createLinkedStylePreviewContainer, CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { paletteColorCssVariableName } from "@powershow/renderer";
import { StudioI18nProvider, useStudioI18n } from "../src/features/i18n/studio-i18n-context";

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
type LinkedStylePatch = { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] };
const makePresentation = (id = "p") => PresentationSchema.parse({ schemaVersion: 1, id, title: "P", slides: [{ id: "s", title: "S", elements: [
  { id: "linked", type: "container", hidden: false, linkedStyleId: "gap", children: [] },
  { id: "match-a", type: "container", hidden: false, layout: { children: { gap: 16 } }, children: [] },
  { id: "match-b", type: "container", hidden: false, layout: { children: { gap: 16 } }, children: [] },
  { id: "mismatch", type: "container", hidden: false, layout: { children: { gap: 12 } }, children: [] },
] }, { id: "s2", title: "Second", elements: [] }], linkedStyles: [{ id: "gap", name: "Gap", layout: { children: { gap: 16 } } }] });

function LocaleSetter({ locale }: { locale: "en" | "pt-BR" }) {
  const { setLocale } = useStudioI18n();
  useEffect(() => setLocale(locale), [locale, setLocale]);
  return null;
}

describe("Linked Styles Resources contract", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); root = undefined; host = undefined!; });

  async function render(value = makePresentation(), onUpdateLinkedStyle: (id: string, patch: LinkedStylePatch) => void = () => undefined, locale: "en" | "pt-BR" = "en") {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(<StudioI18nProvider><LocaleSetter locale={locale} /><CustomResourcesWorkspace customLibraryPaletteRepository={repository} customLibraryFontRepository={repository} presentation={value} presentationColors={[]} presentationFonts={[]} presentationTextStyles={[]} onAddLibraryPalette={() => ({ ok: true, addedColors: [] })} onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })} onApplyElementStyle={() => ({ ok: true })} onAddPresentationColor={() => undefined} onUpdatePresentationColor={() => undefined} onRemovePresentationColor={() => undefined} onRemovePresentationFont={() => "not-found"} isPresentationFontInUse={() => false} onUpdateLinkedStyle={onUpdateLinkedStyle} /></StudioI18nProvider>));
  }

  async function openStyle(value: ReturnType<typeof makePresentation>, onUpdate = vi.fn()) {
    await render(value, onUpdate);
    const linkedSection = Array.from(host.querySelectorAll("details")).find((detail) => detail.textContent?.includes("Linked Styles"));
    await act(async () => linkedSection?.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    return onUpdate;
  }

  async function setInput(input: HTMLInputElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
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

  it("commits real numeric property edits through the Resources update boundary", async () => {
    const make = (layout: Record<string, unknown>, effect?: Record<string, unknown>) => PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Numeric", layout, effect }] });
    const gapUpdate = await openStyle(make({ children: { gap: 16 } }));
    await setInput(host.querySelector<HTMLInputElement>("[data-linked-style-section='layout'] input[type='number']")!, "24");
    expect(gapUpdate).toHaveBeenLastCalledWith("gap", { layout: { children: { gap: 24 } } });

    const paddingUpdate = await openStyle(make({ padding: 100 }));
    await setInput(host.querySelector<HTMLInputElement>("[data-linked-style-section='spacing'] input[type='number']")!, "48");
    expect(paddingUpdate).toHaveBeenLastCalledWith("gap", { layout: { padding: 48 } });

    const topUpdate = await openStyle(make({ position: "absolute", top: 10 }));
    await setInput(host.querySelector<HTMLInputElement>("[data-linked-style-section='position'] input[type='number']")!, "30");
    expect(topUpdate).toHaveBeenLastCalledWith("gap", { layout: { position: "absolute", top: 30 } });

    const opacityUpdate = await openStyle(make({}, { opacity: 0.5 }));
    await setInput(host.querySelector<HTMLInputElement>("[data-linked-style-section='effects'] input[type='number']")!, "25");
    expect(opacityUpdate).toHaveBeenLastCalledWith("gap", { effect: { opacity: 0.25 } });
  });

  it("keeps packed distribution explicitly authored through real select changes", async () => {
    const update = await openStyle(PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Distribution", layout: { children: { distribution: "packed" } } }] }));
    const select = host.querySelector<HTMLSelectElement>("[data-linked-style-section='layout'] select")!;
    await act(async () => { select.value = "space-between"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(update).toHaveBeenLastCalledWith("gap", { layout: { children: { distribution: "space-between" } } });
    await act(async () => { select.value = "packed"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(update).toHaveBeenLastCalledWith("gap", { layout: { children: { distribution: "packed" } } });
  });

  it("renders the shared Linked Style preview only while expanded", async () => {
    await render();
    expect(host.querySelector("[data-linked-style-preview]")).toBeNull();
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='gap']")!;
    await act(async () => row.querySelector("button")?.click());
    expect(host.querySelectorAll("[data-linked-style-preview='gap']")).toHaveLength(1);
    await act(async () => row.querySelector("button")?.click());
    expect(host.querySelector("[data-linked-style-preview='gap']")).toBeNull();
  });

  it("keeps the synthetic preview root linked and delegates layout to the shared renderer", async () => {
    const preview = createLinkedStylePreviewContainer("gap");
    expect(preview).toMatchObject({ id: "linked-style-preview-gap", linkedStyleId: "gap", hidden: false, children: expect.any(Array) });
    expect(preview.layout).toBeUndefined();
    expect(preview.style).toBeUndefined();
    expect(preview.effect).toBeUndefined();
    expect(preview.typography).toBeUndefined();

    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Layout", layout: { padding: 20, children: { direction: "row", gap: 12 } } }] });
    await openStyle(value);
    const root = host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .powershow-container")!;
    expect(root.dataset.powershowId).toBe("linked-style-preview-gap");
    expect(root.dataset.powershowType).toBe("container");
    expect(root.getAttribute("style")).toContain("padding:20px");
    expect(root.getAttribute("style")).toContain("gap:12px");
    expect(root.className).toContain("powershow-container");
    expect(root.querySelectorAll(":scope > .powershow-container")).toHaveLength(3);
  });

  it("renders Linked Style appearance through the renderer output", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Appearance", style: { background: { color: "#102030", gradient: { type: "linear", stops: [{ color: "#102030", position: 0 }, { color: "#405060", position: 100 }] }, pattern: { image: "linear-gradient(#000, #fff)" } }, border: { width: 1, style: "solid", color: "#fff" }, borderRadius: 8 }, effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000" } } }] });
    await openStyle(value);
    const preview = host.querySelector<HTMLElement>("[data-linked-style-preview='gap']")!;
    const root = preview.querySelector<HTMLElement>(".powershow-container")!;
    expect(preview.querySelector(".powershow-container-background-pattern")).not.toBeNull();
    expect(root.getAttribute("style")).toContain("border-radius:8px");
    expect(root.getAttribute("style")).toContain("box-shadow:");
    expect(root.getAttribute("style")).toContain("opacity:0.5");
  });

  it("exposes presentation palette variables without resolving palette references locally", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), palette: { colors: [{ id: "accent", name: "Accent", value: "#2563eb" }] }, linkedStyles: [{ id: "gap", name: "Palette", style: { color: { kind: "palette", colorId: "accent" } } }] });
    await openStyle(value);
    const preview = host.querySelector<HTMLElement>("[data-linked-style-preview='gap']")!;
    const variable = paletteColorCssVariableName("accent");
    expect(preview.getAttribute("style")).toContain(`${variable}: #2563eb`);
    expect(preview.querySelector<HTMLElement>(".powershow-container")?.getAttribute("style")).toContain(`color:var(${variable})`);
  });

  it("rerenders the preview from the updated Presentation definition", async () => {
    let value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Live", layout: { padding: 20 } }] });
    const update = vi.fn((id: string, patch: { layout?: LinkedContainerStyle["layout"] }) => {
      value = PresentationSchema.parse({ ...value, linkedStyles: value.linkedStyles?.map((style) => style.id === id ? { ...style, ...patch } : style) });
    });
    await render(value, update);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    expect(host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .powershow-container")?.getAttribute("style")).toContain("padding:20px");
    await setInput(host.querySelector<HTMLInputElement>("[data-linked-style-property='padding'] input")!, "40");
    await render(value, update);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    expect(update).toHaveBeenCalledWith("gap", { layout: { padding: 40 } });
    expect(host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .powershow-container")?.getAttribute("style")).toContain("padding:40px");
  });

  it("preserves canonical absolute positioning and Fit data in the preview", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Positioned", layout: { position: "absolute", top: 10, children: { fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 } } } }] });
    await openStyle(value);
    const preview = host.querySelector<HTMLElement>("[data-linked-style-preview='gap']")!;
    const root = preview.querySelector<HTMLElement>(".powershow-container")!;
    expect(root.getAttribute("style")).toContain("position:absolute");
    expect(root.getAttribute("style")).toContain("top:10px");
    const viewport = preview.querySelector<HTMLElement>("[data-powershow-container-fit='true']")!;
    expect(viewport.dataset.powershowContainerFitMode).toBe("contain");
    expect(viewport.dataset.powershowContainerFitSourceWidth).toBe("800");
    expect(viewport.dataset.powershowContainerFitSourceHeight).toBe("600");
  });

  it("keeps preview rendering transient and does not mutate the canonical Presentation", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Transient", layout: { padding: 20 } }] });
    const before = JSON.stringify(value);
    await openStyle(value);
    expect(JSON.stringify(value)).toBe(before);
    expect(JSON.stringify(value)).not.toContain("linked-style-preview");
  });

  it("identifies every authored side property and its remove action exactly", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Sides", layout: { padding: 1, paddingTop: 2, paddingRight: 3, margin: 4, marginBottom: 5 } }] });
    await openStyle(value);
    expect(Array.from(host.querySelectorAll<HTMLElement>("[data-linked-style-property]" )).map((row) => row.dataset.linkedStyleProperty)).toEqual(["padding", "paddingTop", "paddingRight", "margin", "marginBottom"]);
    expect(host.querySelector("[data-linked-style-property='paddingTop']")?.textContent).toContain("Padding top");
    expect(host.querySelector("[data-linked-style-property='marginBottom']")?.querySelector("button")?.getAttribute("aria-label")).toBe("Remove Margin bottom");
  });

  it("localizes property labels and enum options in pt-BR", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Português", layout: { overflow: "visible", children: { mode: "flow", distribution: "packed" } } }] });
    await render(value, () => undefined, "pt-BR");
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    const layout = host.querySelector("[data-linked-style-section='layout']")!;
    expect(layout.textContent).toContain("Modo de layout");
    expect(layout.querySelector("select")?.options[0]?.textContent).toBe("Fluxo");
    expect(layout.textContent).toContain("Distribuição");
    expect(Array.from(layout.querySelectorAll("option")).some((option) => option.textContent === "Agrupado")).toBe(true);
    expect(Array.from(layout.querySelectorAll("option")).some((option) => option.textContent === "Visível")).toBe(true);
  });

  it("keeps composite property rows valid and independently removable", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Composite", style: { color: "#fff", background: { color: "#000", gradient: { type: "linear", angle: 0, stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] }, pattern: { image: "linear-gradient(#000, #fff)" } }, border: { width: 1, style: "solid", color: "#fff" } }, effect: { shadow: { x: 0, y: 2, blur: 4, color: "#000" } } }] });
    await openStyle(value);
    const editor = host.querySelector("[data-linked-style-id='gap']")!;
    for (const label of editor.querySelectorAll("label")) expect(label.querySelector("label")).toBeNull();
    for (const property of ["color", "gradient", "pattern", "border", "shadow"]) {
      const row = editor.querySelector(`[data-linked-style-property='${property}']`);
      expect(row).not.toBeNull();
      expect(row?.querySelector("button")).not.toBeNull();
    }
    expect(editor.querySelector("[data-linked-style-property='gradient'] select")?.textContent).not.toContain("None");
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
