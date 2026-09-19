// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type LinkedContainerStyle, type LinkedTopicsStyle, type PresentationElement } from "@web-slideshow/document-schema";
import { createLinkedStyleFromContainer, createLinkedStyleFromTopics, updateLinkedTopicsStyle } from "../src/features/editor/linked-style-authoring";
import { createLinkedStylePreviewContainer, CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { paletteColorCssVariableName } from "@web-slideshow/renderer";
import { StudioI18nProvider, useStudioI18n } from "../src/features/i18n/studio-i18n-context";

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
type LinkedStylePatch = { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] };
type LinkedTopicsStylePatch = Pick<LinkedTopicsStyle, "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">;
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

  async function render(value = makePresentation(), onUpdateLinkedStyle: (id: string, patch: LinkedStylePatch) => void = () => undefined, locale: "en" | "pt-BR" = "en", onRequestDetachLinkedStyle: (id: string, name: string, location: { slideIndex: number; elementId: string }) => void = () => undefined, onRenameLinkedStyle: (id: string, name: string) => void = () => undefined, selectedElement: PresentationElement | null = null, onCreateFromSelected: (name: string) => void = () => undefined, onUpdateLinkedTopicsStyle: (id: string, patch: LinkedTopicsStylePatch) => void = () => undefined, onRemoveLinkedStyle: (id: string) => void = () => undefined) {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(<StudioI18nProvider><LocaleSetter locale={locale} /><CustomResourcesWorkspace customLibraryPaletteRepository={repository} customLibraryFontRepository={repository} presentation={value} presentationColors={[]} presentationFonts={[]} presentationTextStyles={[]} onAddLibraryPalette={() => ({ ok: true, addedColors: [] })} onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })} onApplyElementStyle={() => ({ ok: true })} onAddPresentationColor={() => undefined} onUpdatePresentationColor={() => undefined} onRemovePresentationColor={() => undefined} onRemovePresentationFont={() => "not-found"} isPresentationFontInUse={() => false} onUpdateLinkedStyle={onUpdateLinkedStyle} onUpdateLinkedTopicsStyle={onUpdateLinkedTopicsStyle} onCreateLinkedStyleFromSelected={onCreateFromSelected} selectedElement={selectedElement} onRenameLinkedStyle={onRenameLinkedStyle} onRemoveLinkedStyle={onRemoveLinkedStyle} onRequestDetachLinkedStyle={onRequestDetachLinkedStyle} /></StudioI18nProvider>));
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
    await act(async () => row?.querySelector("button")?.click());
    expect(row?.textContent).toContain("Matching 2 elements");
    expect(row?.textContent).toContain("Attach 2 matching elements");
    expect(row?.textContent).toContain("Slide 1");
    expect(row?.textContent).toContain("linked");
    expect(row?.textContent).not.toContain("Detach here");
  });

  it("renders quiet detach icons only for linked usages with an accessible label", async () => {
    const request = vi.fn();
    await render(makePresentation(), () => undefined, "en", request);
    const linkedSection = Array.from(host.querySelectorAll("details")).find((detail) => detail.textContent?.includes("Linked Styles"));
    await act(async () => linkedSection?.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    const reuse = host.querySelector<HTMLElement>("[data-linked-style-section='reuse']")!;
    const detachRow = reuse.querySelector<HTMLButtonElement>("[data-resource-action='detach']")?.parentElement;
    const target = detachRow?.querySelector<HTMLButtonElement>("button:not([data-resource-action='detach'])");
    expect(target?.tagName).toBe("BUTTON");
    expect(target?.className).not.toContain("resourceAction");
    expect(target?.textContent).toContain("Slide 1");
    expect(target?.textContent).toContain("linked");
    const x = Array.from(reuse.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "×");
    expect(x).toBeDefined();
    expect(x?.className).toContain("resourceIconAction");
    expect(x?.dataset.resourceAction).toBe("detach");
    expect(x?.getAttribute("aria-label")).toBe("Detach this element from Gap");
    expect(request).not.toHaveBeenCalled();
    await act(async () => x?.click());
    expect(request).toHaveBeenCalledWith("gap", "Gap", { slideIndex: 0, elementId: "linked" });
  });

  it("renames a Linked Style through the existing update boundary", async () => {
    const value = makePresentation();
    const rename = vi.fn();
    await render(value, () => undefined, "en", () => undefined, rename);
    const linkedSection = Array.from(host.querySelectorAll("details")).find((detail) => detail.textContent?.includes("Linked Styles"));
    await act(async () => linkedSection?.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    const input = host.querySelector<HTMLInputElement>("[data-linked-style-id='gap'] input");
    expect(input?.value).toBe("Gap");
    await setInput(input!, "Spacing");
    await act(async () => input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(rename).toHaveBeenCalledWith("gap", "Spacing");
  });

  it("uses the compact shared action grammar and Text Styles disclosure structure", async () => {
    await render();
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='gap']")!;
    const disclosure = row.querySelector<HTMLButtonElement>("button")!;
    expect(disclosure.className).toContain("typographyStyleDisclosure");
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure.getAttribute("aria-controls")).toBe("linked-style-gap-editor");
    expect(disclosure.querySelector("span[class*='resourceItemDetails']")).not.toBeNull();
    expect(disclosure.querySelector("span[class*='resourceItemMeta']")?.textContent).toBe("Used by 1 element");
    const chevron = disclosure.querySelector("span[class*='resourceDisclosureChevron']");
    expect(chevron?.textContent).toBe("▸");
    const add = host.querySelector<HTMLButtonElement>("[data-presentation-linked-styles] > button")!;
    expect(add.className).toContain("resourceAction");
    expect(add.textContent).toBe("+ Add Linked Style");
    await act(async () => disclosure.click());
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(chevron?.textContent).toBe("▾");
    expect(host.querySelector("#linked-style-gap-editor [data-linked-style-section='reuse'] button.ps-ui-button--secondary")).not.toBeNull();
    const remove = Array.from(host.querySelectorAll<HTMLButtonElement>("#linked-style-gap-editor button")).find((button) => button.textContent?.includes("Remove"));
    expect(remove?.className).toContain("resourceAction");
    expect(remove?.className).not.toContain("ps-ui-button--danger");
    const addProperty = Array.from(host.querySelectorAll<HTMLButtonElement>("#linked-style-gap-editor button")).find((button) => button.textContent?.includes("Add property"));
    expect(addProperty?.className).toContain("resourceAction");
    expect(addProperty?.parentElement?.className).toContain("resourcePropertyChooser");
    expect(remove?.parentElement?.className).toContain("resourceStyleActions");
    expect(remove?.disabled).toBe(true);
  });

  it("keeps Preserve size checkbox before its text and preserves authored semantics", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Size", layout: { width: "50%", flexShrink: 0 } }] });
    const update = vi.fn();
    await openStyle(value, update);
    const row = host.querySelector<HTMLElement>("[data-linked-style-property='preserveSize']")!;
    const checkbox = row.querySelector<HTMLInputElement>("input[type='checkbox']")!;
    const text = row.querySelector("label span")!;
    expect(checkbox.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(checkbox.checked).toBe(true);
    await act(async () => { checkbox.click(); });
    expect(update).toHaveBeenLastCalledWith("gap", { layout: { width: "50%", flexShrink: undefined } });
  });

  it("groups the available property chooser without changing availability", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Layout", layout: { children: { direction: "row" } } }] });
    await openStyle(value);
    const addProperty = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='gap'] button")).find((button) => button.textContent?.includes("Add property"));
    expect(addProperty).toBeDefined();
    await act(async () => addProperty?.click());
    const chooser = host.querySelector("[data-linked-style-property-chooser]")!;
    expect(chooser.textContent).toContain("Position");
    expect(chooser.textContent).toContain("Spacing");
    expect(chooser.textContent).toContain("Appearance");
    expect(chooser.textContent).not.toContain("Fit");
    expect(chooser.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("keeps Add Property text under translation authority with one leading plus", async () => {
    const findAddProperty = () => Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='gap'] button")).find((button) => button.textContent?.includes("Add property"));
    await openStyle(makePresentation());
    expect(findAddProperty()?.textContent).toBe("+ Add property");
    await render(PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Propriedade", layout: { children: { gap: 16 } } }] }), () => undefined, "pt-BR");
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='gap'] button")).find((button) => button.textContent?.includes("Adicionar propriedade"))?.textContent).toBe("+ Adicionar propriedade");
  });

  it("owns unit controls and remove actions in the property row control track", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Dimensions", layout: { width: "100%", height: "100%", padding: 48 }, style: { borderRadius: 8 }, effect: { opacity: 0.5 } }] });
    await openStyle(value);
    for (const property of ["width", "height", "borderRadius", "padding", "opacity"]) {
      const row = host.querySelector<HTMLElement>(`[data-linked-style-property='${property}']`)!;
      expect(row.querySelector("[data-linked-style-property-control]")).not.toBeNull();
      expect(row.querySelector("[data-linked-style-property-remove]")).not.toBeNull();
    }
    expect(Array.from(host.querySelectorAll("[data-linked-style-property='width'] span")).some((span) => span.textContent === "%")).toBe(true);
    expect(Array.from(host.querySelectorAll("[data-linked-style-property='height'] span")).some((span) => span.textContent === "%")).toBe(true);
    expect(host.querySelector("[data-linked-style-property='borderRadius'] select")).not.toBeNull();
    const borderRadius = host.querySelector<HTMLElement>("[data-linked-style-property='borderRadius']")!;
    const borderRadiusHeader = Array.from(borderRadius.children).find((child) => child.className.includes("resourcePropertyHeader"));
    expect(borderRadiusHeader?.querySelector("span")?.textContent).toBe("Rounded corners");
    expect(Array.from(borderRadius.querySelectorAll("label > span")).find((span) => span.className.includes("resourcePropertyVisuallyHidden"))).toBeTruthy();
    expect(borderRadius.querySelector("#linked-style-gap-border-radius")?.closest("label")?.textContent).toContain("Rounded corners");
    expect(borderRadius.querySelector("#linked-style-gap-border-radius")?.closest("div")?.className).toContain("unitInput");
  });

  it("uses the shared resource property-card structure for authored properties", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Cards", layout: { children: { direction: "row", gap: 16 } } }] });
    await openStyle(value);
    const properties = Array.from(host.querySelectorAll<HTMLElement>("[data-linked-style-property]"));
    expect(properties.map((property) => property.dataset.linkedStyleProperty)).toEqual(["direction", "gap"]);
    for (const property of properties) {
      expect(property.className).toContain("resourcePropertyCard");
      const header = Array.from(property.children).find((child) => child.className.includes("resourcePropertyHeader")) as HTMLElement | undefined;
      expect(header).not.toBeNull();
      expect(header?.querySelector("span")).not.toBeNull();
      expect(header?.querySelector("[data-linked-style-property-remove]")).not.toBeNull();
      expect(property.querySelector("[data-linked-style-property-control]")?.className).toContain("resourcePropertyControl");
    }
    expect(properties.find((property) => property.dataset.linkedStyleProperty === "direction")?.querySelector("[data-linked-style-property-control] select")).not.toBeNull();
    expect(properties.find((property) => property.dataset.linkedStyleProperty === "gap")?.querySelector("[data-linked-style-property-control] input")).not.toBeNull();
    expect(host.querySelector("[data-linked-style-section='layout'] h3")?.textContent).toBe("Layout");
    expect(host.querySelector("[data-linked-style-preview='gap']")).not.toBeNull();
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
    const fixture = createLinkedStylePreviewContainer("gap");
    expect(fixture).toMatchObject({ id: "linked-style-preview-gap", linkedStyleId: "gap", hidden: false, children: expect.any(Array) });
    expect(fixture.layout).toBeUndefined();
    expect(fixture.style).toBeUndefined();
    expect(fixture.effect).toBeUndefined();
    expect(fixture.typography).toBeUndefined();
    expect(fixture.children).toHaveLength(3);
    expect(fixture.children.map((child) => child.type)).toEqual(["container", "container", "container"]);
    expect(fixture.children.map((child) => child.type === "container" ? child.children[0] : undefined)).toMatchObject([
      { type: "text", content: "A", styleDetached: true },
      { type: "text", content: "B", styleDetached: true },
      { type: "text", content: "C", styleDetached: true },
    ]);

    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Layout", layout: { padding: 20, children: { direction: "row", gap: 12 } } }] });
    await openStyle(value);
    const preview = host.querySelector<HTMLElement>("[data-linked-style-preview='gap']")!;
    const root = host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .presentation-container")!;
    expect(preview.className).toContain("linkedStylePreview");
    expect(root.dataset.presentationId).toBe("linked-style-preview-gap");
    expect(root.dataset.presentationType).toBe("container");
    expect(root.getAttribute("style")).toContain("padding:20px");
    expect(root.getAttribute("style")).toContain("gap:12px");
    expect(root.className).toContain("presentation-container");
    expect(root.querySelectorAll(":scope > .presentation-container")).toHaveLength(3);
  });

  it("keeps preview text capable of inheriting the Linked Style color", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Color", style: { color: "#ff0000" } }] });
    await openStyle(value);
    const root = host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .presentation-container")!;
    expect(root.getAttribute("style")).toContain("color:#ff0000");
    expect(Array.from(root.querySelectorAll(".presentation-text")).map((text) => text.textContent)).toEqual(["A", "B", "C"]);
    expect(Array.from(root.querySelectorAll(".presentation-text")).every((text) => !text.getAttribute("style")?.includes("color:"))).toBe(true);
  });

  it("renders Linked Style appearance through the renderer output", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Appearance", style: { background: { color: "#102030", gradient: { type: "linear", stops: [{ color: "#102030", position: 0 }, { color: "#405060", position: 100 }] }, pattern: { image: "linear-gradient(#000, #fff)" } }, border: { width: 1, style: "solid", color: "#fff" }, borderRadius: 8 }, effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000" } } }] });
    await openStyle(value);
    const preview = host.querySelector<HTMLElement>("[data-linked-style-preview='gap']")!;
    const root = preview.querySelector<HTMLElement>(".presentation-container")!;
    expect(preview.querySelector(".presentation-container-background-pattern")).not.toBeNull();
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
    expect(preview.querySelector<HTMLElement>(".presentation-container")?.getAttribute("style")).toContain(`color:var(${variable})`);
  });

  it("rerenders the preview from the updated Presentation definition", async () => {
    let value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Live", layout: { padding: 20 } }] });
    const update = vi.fn((id: string, patch: { layout?: LinkedContainerStyle["layout"] }) => {
      value = PresentationSchema.parse({ ...value, linkedStyles: value.linkedStyles?.map((style) => style.id === id ? { ...style, ...patch } : style) });
    });
    await render(value, update);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    expect(host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .presentation-container")?.getAttribute("style")).toContain("padding:20px");
    await setInput(host.querySelector<HTMLInputElement>("[data-linked-style-property='padding'] input")!, "40");
    await render(value, update);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='gap'] button")?.click());
    expect(update).toHaveBeenCalledWith("gap", { layout: { padding: 40 } });
    expect(host.querySelector<HTMLElement>("[data-linked-style-preview='gap'] .presentation-container")?.getAttribute("style")).toContain("padding:40px");
  });

  it("preserves canonical absolute positioning and Fit data in the preview", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Positioned", layout: { position: "absolute", top: 10, children: { fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 } } } }] });
    await openStyle(value);
    const preview = host.querySelector<HTMLElement>("[data-linked-style-preview='gap']")!;
    const root = preview.querySelector<HTMLElement>(".presentation-container")!;
    expect(root.getAttribute("style")).toContain("position:absolute");
    expect(root.getAttribute("style")).toContain("top:10px");
    const viewport = preview.querySelector<HTMLElement>("[data-presentation-container-fit='true']")!;
    expect(viewport.dataset.presentationContainerFitMode).toBe("contain");
    expect(viewport.dataset.presentationContainerFitSourceWidth).toBe("800");
    expect(viewport.dataset.presentationContainerFitSourceHeight).toBe("600");
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
    const value = PresentationSchema.parse({ ...makePresentation(), linkedStyles: [{ id: "gap", name: "Composite", style: { color: "#fff", background: { color: "#000", gradient: { type: "linear", angle: 0, stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] }, pattern: { image: "linear-gradient(#000, #fff)" } }, border: { width: 1, style: "solid", color: "#fff" }, borderRadius: 8 }, effect: { shadow: { x: 0, y: 2, blur: 4, color: "#000" } } }] });
    await openStyle(value);
    const editor = host.querySelector("[data-linked-style-id='gap']")!;
    for (const label of editor.querySelectorAll("label")) expect(label.querySelector("label")).toBeNull();
    for (const property of ["color", "gradient", "pattern", "border", "borderRadius", "shadow"]) {
      const row = editor.querySelector(`[data-linked-style-property='${property}']`);
      expect(row).not.toBeNull();
      expect(row?.querySelector("button")).not.toBeNull();
      expect(row?.querySelector("label label")).toBeNull();
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

  it("enables Add to Linked Styles only for canonically creatable selected elements", async () => {
    const action = () => host.querySelector<HTMLButtonElement>("[data-presentation-linked-styles] > button:last-of-type");
    await render(makePresentation(), () => undefined, "en", () => undefined, () => undefined, null);
    expect(action()?.textContent).toContain("Add to Linked Styles");
    expect(action()?.disabled).toBe(true);

    const unsupported = { id: "text", type: "text" as const, hidden: false, variant: "body" as const, content: "Text" };
    await render(makePresentation(), () => undefined, "en", () => undefined, () => undefined, unsupported);
    expect(action()?.disabled).toBe(true);

    const container = { id: "source", type: "container" as const, hidden: false, layout: { margin: 8 }, children: [] };
    await render(makePresentation(), () => undefined, "en", () => undefined, () => undefined, container);
    expect(action()?.disabled).toBe(false);

    const topics = { id: "topics", type: "topics" as const, hidden: false, kind: "unordered" as const, itemGap: 8, items: [] };
    await render(makePresentation(), () => undefined, "en", () => undefined, () => undefined, topics);
    expect(action()?.disabled).toBe(false);
    await render(makePresentation(), () => undefined, "en", () => undefined, () => undefined, { ...topics, linkedStyleId: "existing" });
    expect(action()?.disabled).toBe(true);
  });

  it("renders the typed Topics editor, preview, update boundary, and usage protection", async () => {
    const topics = { id: "topics", type: "topics" as const, hidden: false, kind: "unordered" as const, itemGap: 8, rootMarkerStyle: "disc" as const, markerColor: "#ff0000" as const, items: [] };
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [{ ...topics, kind: undefined, linkedStyleId: "topics-style" }] }], linkedStyles: [{ target: "topics", id: "topics-style", name: "Card", kind: "ordered", layout: { margin: 4 }, rootMarkerStyle: "none", markerColor: "#00ff00", itemGap: 12 }, { id: "container-style", name: "Card", layout: { padding: 4 } }] });
    const updateTopics = vi.fn();
    await render(value, () => undefined, "en", () => undefined, () => undefined, null, () => undefined, updateTopics);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    const editor = host.querySelector<HTMLElement>("[data-linked-topics-style-editor]")!;
    expect(editor.querySelector("#linked-topics-style-topics-style-margin")).not.toBeNull();
    expect(editor.textContent).toContain("First-level marker");
    expect(editor.querySelector("#linked-topics-style-topics-style-marker-color")).not.toBeNull();
    expect(editor.textContent).toContain("Topic spacing");
    expect(editor.querySelector<HTMLSelectElement>("#linked-topics-style-topics-style-kind")?.value).toBe("ordered");
    expect(editor.querySelector("[data-linked-style-property]" )).toBeNull();
    const preview = host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] [data-linked-style-preview]");
    expect(preview).not.toBeNull();
    expect(preview?.querySelector("ol")).not.toBeNull();
    const remove = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='topics-style'] button")).find((button) => button.textContent?.includes("Remove"))!;
    expect(remove.disabled).toBe(true);
    const gap = editor.querySelector<HTMLInputElement>("#linked-topics-style-topics-style-item-gap")!;
    await setInput(gap, "20");
    expect(updateTopics).toHaveBeenCalledWith("topics-style", expect.objectContaining({ itemGap: 20 }));
    await act(async () => {
      const kind = editor.querySelector<HTMLSelectElement>("#linked-topics-style-topics-style-kind")!;
      kind.value = "unordered";
      kind.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(updateTopics).toHaveBeenLastCalledWith("topics-style", { kind: undefined, rootMarkerStyle: "none" });
  });

  it("uses unordered fallback for a sparse Topics resource preview", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [{ id: "topics", type: "topics", hidden: false, items: [], linkedStyleId: "topics-style" }] }], linkedStyles: [{ target: "topics", id: "topics-style", name: "Sparse", itemGap: 8 }] });
    await render(value);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    const preview = host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] [data-linked-style-preview]");
    expect(preview?.querySelector("ul")).not.toBeNull();
  });

  it("keeps the Topics resource editor sparse and removes individual properties", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [{ id: "topics", type: "topics", hidden: false, kind: "unordered", items: [], linkedStyleId: "topics-style" }] }], linkedStyles: [{ target: "topics", id: "topics-style", name: "Sparse", itemGap: 8, markerColor: "#00ff00" }] });
    const updateTopics = vi.fn();
    await render(value, () => undefined, "en", () => undefined, () => undefined, null, () => undefined, updateTopics);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    const editor = host.querySelector<HTMLElement>("[data-linked-topics-style-editor]")!;
    expect(editor.querySelector("[data-linked-topics-property='margin']")).toBeNull();
    expect(editor.querySelector("[data-linked-topics-property='itemGap']")).not.toBeNull();
    expect(editor.querySelector("[data-linked-topics-property='markerColor']")).not.toBeNull();
    expect(editor.querySelector("[data-linked-topics-property-group='spacing'] h4")?.textContent).toBe("Spacing");
    expect(editor.querySelectorAll("[data-linked-topics-property-group='spacing'] h4")).toHaveLength(1);
    expect(editor.querySelectorAll("[data-linked-topics-property='itemGap'] [data-resource-action='remove']")).toHaveLength(1);
    await act(async () => editor.querySelector<HTMLButtonElement>("[data-linked-topics-property='itemGap'] [data-resource-action='remove']")?.click());
    expect(updateTopics).toHaveBeenCalledWith("topics-style", { itemGap: undefined });

    const afterRemoval = updateLinkedTopicsStyle(value, "topics-style", { itemGap: undefined });
    await render(afterRemoval, () => undefined, "en", () => undefined, () => undefined, null, () => undefined, updateTopics);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    expect(host.querySelector("[data-linked-topics-property='itemGap']")).toBeNull();
    expect(host.querySelector("[data-linked-topics-property='markerColor']")).not.toBeNull();
  });

  it("reuses the Text Styles add-property interaction without duplicate options", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [{ id: "topics", type: "topics", hidden: false, kind: "unordered", items: [], linkedStyleId: "topics-style" }] }], linkedStyles: [{ target: "topics", id: "topics-style", name: "Sparse", itemGap: 8 }] });
    const updateTopics = vi.fn();
    await render(value, () => undefined, "en", () => undefined, () => undefined, null, () => undefined, updateTopics);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    const editor = host.querySelector<HTMLElement>("[data-linked-topics-style-editor]")!;
    const addButton = editor.querySelector<HTMLButtonElement>("[data-topics-linked-style-property-chooser] > button")!;
    await act(async () => addButton.click());
    const chooser = editor.querySelector<HTMLElement>("[data-topics-linked-style-property-chooser] > div")!;
    expect(chooser.textContent).not.toContain("Topic spacing");
    expect(chooser.textContent).toContain("Margin");
    await act(async () => Array.from(chooser.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Margin")?.click());
    expect(updateTopics).toHaveBeenCalledWith("topics-style", { layout: { margin: 0 } });
  });

  it.each([
    ["itemGap", { itemGap: 8 }],
    ["markerColor", { markerColor: "#00ff00" }],
    ["rootMarkerStyle", { rootMarkerStyle: "square" }],
    ["layout margin", { layout: { margin: 12 } }],
  ] as const)("disables the final Topics property removal for %s", async (_property, authored) => {
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [{ id: "topics", type: "topics", hidden: false, kind: "unordered", items: [], linkedStyleId: "topics-style" }] }], linkedStyles: [{ target: "topics", id: "topics-style", name: "Sole", ...authored }] });
    await render(value);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    expect(host.querySelector<HTMLButtonElement>("[data-linked-topics-property] [data-resource-action='remove']")?.disabled).toBe(true);
  });

  it("enables removal with two Topics properties, then disables the remaining property", async () => {
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [{ id: "topics", type: "topics", hidden: false, kind: "unordered", items: [], linkedStyleId: "topics-style" }] }], linkedStyles: [{ target: "topics", id: "topics-style", name: "Pair", itemGap: 8, markerColor: "#00ff00" }] });
    const updateTopics = vi.fn();
    await render(value, () => undefined, "en", () => undefined, () => undefined, null, () => undefined, updateTopics);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    const editor = host.querySelector<HTMLElement>("[data-linked-topics-style-editor]")!;
    expect(Array.from(editor.querySelectorAll<HTMLButtonElement>("[data-resource-action='remove']")).every((button) => !button.disabled)).toBe(true);
    await act(async () => editor.querySelector<HTMLButtonElement>("[data-linked-topics-property='markerColor'] [data-resource-action='remove']")?.click());
    expect(updateTopics).toHaveBeenCalledWith("topics-style", { markerColor: undefined });
    const remaining = updateLinkedTopicsStyle(value, "topics-style", { markerColor: undefined });
    await render(remaining);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='topics-style'] button")?.click());
    expect(host.querySelector<HTMLButtonElement>("[data-linked-topics-property='itemGap'] [data-resource-action='remove']")?.disabled).toBe(true);
  });

  it("performs the Topics Add-to state transition without bulk-linking or name collisions", async () => {
    const source = { id: "topics-source", type: "topics" as const, hidden: false, kind: "ordered" as const, itemGap: 8, rootMarkerStyle: "decimal" as const, items: [{ id: "item", content: { id: "slot", children: [{ id: "text", type: "text" as const, hidden: false, variant: "body" as const, content: "Keep me" }] }, children: [] }] };
    const other = { id: "topics-other", type: "topics" as const, hidden: false, kind: "unordered" as const, itemGap: 8, items: [] };
    const before = structuredClone(source);
    let current = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [source, other] }], linkedStyles: [{ id: "shared", name: "Shared", layout: { margin: 2 } }] });
    const create = (name: string) => { current = createLinkedStyleFromTopics(current, 0, source.id, name); };
    await render(current, () => undefined, "en", () => undefined, () => undefined, source, create);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-presentation-linked-styles] > button:last-of-type")?.click());
    const nameInput = host.querySelector<HTMLInputElement>("[data-presentation-linked-styles] input")!;
    await setInput(nameInput, "Shared");
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("[data-presentation-linked-styles] button")).find((button) => button.textContent?.includes("Add to Linked Styles") && button !== host.querySelector("[data-presentation-linked-styles] > button:last-of-type"))?.click());
    const created = current.linkedStyles?.find((style) => style.id !== "shared");
    expect(current.linkedStyles).toHaveLength(2);
    expect(created).toMatchObject({ target: "topics", name: "Shared" });
    expect(created?.id).not.toBe("shared");
    expect(current.slides[0]?.elements[0]).toMatchObject({ id: source.id, linkedStyleId: created?.id });
    expect(current.slides[0]?.elements[1]).not.toHaveProperty("linkedStyleId");
    expect(created).toMatchObject({ kind: "ordered" });
    expect(created).not.toHaveProperty("rootMarkerStyle");
    expect(current.slides[0]?.elements[0]).not.toHaveProperty("kind");
    expect(current.slides[0]?.elements[0]).toMatchObject({ items: before.items });
    expect(current.slides[0]?.elements[0]).not.toHaveProperty("itemGap");
    expect(current.linkedStyles?.find((style) => style.id === "shared")).toMatchObject({ layout: { margin: 2 } });
  });

  it("performs the Container Add-to state transition for only the selected source", async () => {
    const source = { id: "container-source", type: "container" as const, hidden: false, layout: { margin: 8 }, children: [] };
    const other = { id: "container-other", type: "container" as const, hidden: false, layout: { margin: 8 }, children: [] };
    let current = PresentationSchema.parse({ ...makePresentation(), linkedStyles: undefined, slides: [{ id: "s", title: "S", elements: [source, other] }] });
    const create = (name: string) => { current = createLinkedStyleFromContainer(current, 0, source.id, name); };
    await render(current, () => undefined, "en", () => undefined, () => undefined, source, create);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-presentation-linked-styles] > button:last-of-type")?.click());
    const nameInput = host.querySelector<HTMLInputElement>("[data-presentation-linked-styles] input")!;
    await setInput(nameInput, "Container");
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("[data-presentation-linked-styles] button")).find((button) => button.textContent?.includes("Add to Linked Styles") && button !== host.querySelector("[data-presentation-linked-styles] > button:last-of-type"))?.click());
    const created = current.linkedStyles?.[0];
    expect(current.linkedStyles).toHaveLength(1);
    expect(created).toMatchObject({ name: "Container" });
    expect(current.slides[0]?.elements[0]).toMatchObject({ linkedStyleId: created?.id });
    expect(current.slides[0]?.elements[1]).not.toHaveProperty("linkedStyleId");
  });

  it("removes unused Topics resources but protects referenced ones", async () => {
    const topics = { id: "topics", type: "topics" as const, hidden: false, kind: "unordered" as const, linkedStyleId: "used", items: [] };
    const value = PresentationSchema.parse({ ...makePresentation(), slides: [{ id: "s", title: "S", elements: [topics] }], linkedStyles: [{ target: "topics", id: "unused", name: "Unused", itemGap: 4 }, { target: "topics", id: "used", name: "Used", itemGap: 4 }] });
    const remove = vi.fn();
    await render(value, () => undefined, "en", () => undefined, () => undefined, null, () => undefined, () => undefined, remove);
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='unused'] button")?.click());
    const unusedRemove = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='unused'] button")).find((button) => button.textContent?.includes("Remove"));
    expect(unusedRemove?.disabled).toBe(false);
    await act(async () => unusedRemove?.click());
    expect(remove).toHaveBeenCalledWith("unused");
    await act(async () => host.querySelector<HTMLElement>("[data-linked-style-id='used'] button")?.click());
    const usedRemove = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-linked-style-id='used'] button")).find((button) => button.textContent?.includes("Remove"));
    expect(usedRemove?.disabled).toBe(true);
    expect(remove).not.toHaveBeenCalledWith("used");
  });
});
