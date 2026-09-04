// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema, type FontResource, type Presentation, type PresentationPaletteColor } from "@powershow/document-schema";
import { paletteColorCssVariableName } from "@powershow/renderer";
import { TEXT_VARIANT_TYPOGRAPHY_DEFAULTS } from "@powershow/theme/element-style-defaults";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { findElementById, updateElementById } from "../src/features/editor/element-tree";
import { detachTextStyle } from "../src/features/editor/text-typography-authoring";
import { addCustomTextStyle, isTextStyleUsed, removeUnusedCustomTextStyle, resetFundamentalTextStyleOverride, updateCustomTextStyle, upsertFundamentalTextStyleOverride } from "../src/features/editor/text-style-helpers";
import { StudioI18nProvider, useStudioI18n } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
const presentationFont: FontResource = {
  id: "presentation-inter",
  family: "Inter",
  faces: [{ weight: 400, style: "normal", subset: "latin", source: { type: "url", url: "https://example.com/inter-400.woff2" } }],
};

const fundamentalIds = ["title", "subtitle", "body", "caption"] as const;

const base = (): Presentation => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "", elements: [] }] });

function LocaleSetter({ locale }: { locale: "en" | "pt-BR" }) {
  const { setLocale } = useStudioI18n();
  useEffect(() => setLocale(locale), [locale, setLocale]);
  return null;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function Harness({
  initial = base(),
  presentationRef,
  paletteColors,
  onSelectTextStyleElement = () => undefined,
}: {
  initial?: Presentation;
  presentationRef?: { current: Presentation | undefined };
  paletteColors?: readonly PresentationPaletteColor[];
  onSelectTextStyleElement?: (location: { slideIndex: number; elementId: string }) => void;
}) {
  const [presentation, setPresentation] = useState(initial);
  presentationRef && (presentationRef.current = presentation);

  return <CustomResourcesWorkspace
    customLibraryPaletteRepository={repository}
    customLibraryFontRepository={repository}
    presentationColors={paletteColors ?? presentation.palette?.colors ?? []}
    presentation={paletteColors ? presentation : undefined}
    presentationFonts={[presentationFont]}
    onAddLibraryPalette={() => ({ ok: true, addedColors: [] })}
    onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })}
    onApplyElementStyle={() => ({ ok: true })}
    onAddPresentationColor={() => undefined}
    onUpdatePresentationColor={() => undefined}
    onRemovePresentationColor={() => undefined}
    onRemovePresentationFont={() => "not-found"}
    isPresentationFontInUse={() => false}
    presentationTextStyles={presentation.textStyles ?? []}
    onUpdateFundamentalTextStyle={(id, typography) => setPresentation((current) => upsertFundamentalTextStyleOverride(current, id, typography))}
    onResetFundamentalTextStyle={(id) => setPresentation((current) => resetFundamentalTextStyleOverride(current, id))}
    onAddTextStyle={(name, role) => setPresentation((current) => addCustomTextStyle(current, name, role))}
    onUpdateTextStyle={(id, patch) => setPresentation((current) => updateCustomTextStyle(current, id, patch))}
    onRemoveTextStyle={(id) => setPresentation((current) => removeUnusedCustomTextStyle(current, id) ?? current)}
    isTextStyleInUse={(id) => isTextStyleUsed(presentation, id)}
    onSelectTextStyleElement={onSelectTextStyleElement}
    onRequestDetachTextStyleElement={(styleId, _styleName, location) => setPresentation((current) => {
      const slide = current.slides[location.slideIndex];
      const target = slide ? findElementById(slide.elements, location.elementId) : null;
      if (target?.type !== "text" || target.variant !== styleId || target.styleDetached === true || !slide) return current;
      return { ...current, slides: current.slides.map((candidate, index) => index === location.slideIndex ? { ...candidate, elements: updateElementById(candidate.elements, location.elementId, (element) => element.type === "text" ? detachTextStyle(current, element) : element) } : candidate) };
    })}
  />;
}

describe("Custom Resources Text Styles", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    document.body.innerHTML = "";
    root = undefined;
  });

  async function render(initial?: Presentation, presentationRef?: { current: Presentation | undefined }, paletteColors?: readonly PresentationPaletteColor[], onSelectTextStyleElement?: (location: { slideIndex: number; elementId: string }) => void, locale: "en" | "pt-BR" = "en"): Promise<void> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<StudioI18nProvider><LocaleSetter locale={locale} /><Harness initial={initial} presentationRef={presentationRef} paletteColors={paletteColors} onSelectTextStyleElement={onSelectTextStyleElement} /></StudioI18nProvider>));
  }

  function requiredElement<T extends Element>(selector: string): T {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`Missing element ${selector}`);
    return found;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`Missing button ${label}`);
    return found;
  }

  function row(id: string): HTMLElement {
    return requiredElement<HTMLElement>(`[data-text-style-id='${id}']`);
  }

  function rowButton(id: string, label: string): HTMLButtonElement {
    const found = Array.from(row(id).querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`Missing ${label} button for ${id}`);
    return found;
  }

  function disclosure(id: string): HTMLButtonElement {
    const found = row(id).querySelector<HTMLButtonElement>("button[aria-controls]");
    if (!found) throw new Error(`Missing disclosure button for ${id}`);
    return found;
  }

  it("shows virtual fundamentals as built-in in This Presentation only", async () => {
    await render();

    for (const id of fundamentalIds) {
      const styleRow = row(id);
      expect(styleRow.textContent).toContain(id[0]?.toUpperCase() + id.slice(1));
      expect(styleRow.textContent).toContain("Built-in");
      expect(Array.from(styleRow.querySelectorAll("button")).map((candidate) => candidate.textContent?.trim())).not.toContain("Remove");
    }

    const thisPresentation = requiredElement<HTMLElement>("[aria-labelledby='custom-resources-this-presentation']");
    const fromLibrary = requiredElement<HTMLElement>("[aria-labelledby='custom-resources-from-library']");
    const textStyles = requiredElement<HTMLElement>("[data-presentation-text-styles]");
    expect(textStyles.tagName).toBe("SECTION");
    expect(textStyles.getAttribute("aria-labelledby")).toBe("presentation-text-styles-title");
    expect(textStyles.querySelector("#presentation-text-styles-title")?.textContent).toBe("Text Styles");
    const textStylesSection = Array.from(thisPresentation.querySelectorAll("details")).find((detail) => detail.querySelector("summary")?.textContent?.includes("Text Styles"));
    expect(textStylesSection?.querySelector("summary")?.textContent).toContain("4");
    expect(thisPresentation.contains(textStyles)).toBe(true);
    expect(fromLibrary.querySelector("[data-presentation-text-styles]")).toBeNull();
    expect(fromLibrary.textContent).not.toContain("Text Styles");
    expect(textStyles.textContent).not.toContain("Edit");

    for (const id of fundamentalIds) {
      expect(disclosure(id).getAttribute("aria-expanded")).toBe("false");
      expect(row(id).querySelector("#text-style-" + id + "-editor")).toBeNull();
    }
  });

  it("counts projected fundamental and custom styles, not only persisted overrides", async () => {
    const value = PresentationSchema.parse({ ...base(), textStyles: [{ id: "quote", name: "Quote", role: "body" }] });
    await render(value);
    const section = Array.from(requiredElement<HTMLElement>("[aria-labelledby='custom-resources-this-presentation']").querySelectorAll("details")).find((detail) => detail.querySelector("summary")?.textContent?.includes("Text Styles"));
    expect(section?.querySelector("summary")?.textContent).toContain("5");
  });

  it("edits a fundamental through the real typography control and resets the last override", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => disclosure("body").click());
    expect(row("body").textContent).toContain("No typography properties added");
    await act(async () => rowButton("body", "+ Add property").click());
    const fontSizeOption = Array.from(row("body").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font size");
    expect(fontSizeOption).toBeDefined();
    await act(async () => fontSizeOption?.click());
    expect(row("body").querySelector("#text-style-body-font-size")).not.toBeNull();
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("true");
    expect(presentationRef.current?.textStyles).toEqual([{ id: "body", typography: { fontSize: 18 } }]);
    expect(row("body").textContent).toContain("Customized");
    expect(row("body").textContent).not.toContain("Edit");

    await act(async () => row("body").querySelector<HTMLButtonElement>("[aria-label='Remove Font size']")?.click());
    expect(row("body").textContent).toContain("Built-in");
    expect(presentationRef.current).not.toHaveProperty("textStyles");
  });

  it("opens and closes one Text Style editor at a time", async () => {
    await render();

    expect(disclosure("body").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#text-style-body-editor")).toBeNull();

    await act(async () => disclosure("body").click());
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#text-style-body-editor")).not.toBeNull();

    await act(async () => disclosure("body").click());
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#text-style-body-editor")).toBeNull();

    await act(async () => disclosure("title").click());
    await act(async () => disclosure("body").click());
    expect(disclosure("title").getAttribute("aria-expanded")).toBe("false");
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll("[data-presentation-text-styles] [id$='-editor']")).toHaveLength(1);
  });

  it("renders a transient live preview from effective defaults and style values", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    expect(container.querySelector("[data-text-style-preview='body']")).toBeNull();
    await act(async () => disclosure("body").click());

    const bodyPreview = requiredElement<HTMLElement>("[data-text-style-preview='body']");
    const bodyPreviewText = () => requiredElement<HTMLElement>("[data-text-style-preview='body'] .powershow-text");
    expect(bodyPreview.getAttribute("aria-hidden")).toBe("true");
    expect(bodyPreview.textContent).toBe("Aa");
    expect(bodyPreviewText().getAttribute("style")).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize}px`);

    await act(async () => rowButton("body", "+ Add property").click());
    const addFontFamily = Array.from(row("body").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font family");
    await act(async () => addFontFamily?.click());
    const fontSelect = requiredElement<HTMLSelectElement>("#text-style-body-font-family");
    expect(presentationRef.current?.textStyles).toBeUndefined();
    await act(async () => {
      fontSelect.value = "Inter";
      fontSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(bodyPreviewText().getAttribute("style")).toContain('font-family:"Inter"');
    expect(JSON.stringify(presentationRef.current)).not.toContain("text-style-preview-");
    expect(JSON.stringify(presentationRef.current)).not.toContain("Aa");

    await act(async () => rowButton("body", "Reset").click());
    expect(bodyPreviewText().getAttribute("style")).not.toContain("Inter");
    expect(bodyPreviewText().getAttribute("style")).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize}px`);

    await act(async () => disclosure("body").click());
    expect(container.querySelector("[data-text-style-preview='body']")).toBeNull();
  });

  it("updates a custom Style preview when its role changes", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => button("+ Add Style").click());
    const nameInput = requiredElement<HTMLInputElement>("[data-new-text-style] input");
    await act(async () => setInputValue(nameInput, "Quote"));
    await act(async () => button("+ Add Style").click());
    await act(async () => disclosure("quote").click());

    const quotePreviewText = () => requiredElement<HTMLElement>("[data-text-style-preview='quote'] .powershow-text");
    const bodyFontSize = quotePreviewText().getAttribute("style");
    expect(bodyFontSize).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize}px`);

    const roleSelect = requiredElement<HTMLSelectElement>("[data-text-style-id='quote'] select");
    await act(async () => {
      roleSelect.value = "caption";
      roleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(quotePreviewText().getAttribute("style")).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.caption.fontSize}px`);
    expect(quotePreviewText().getAttribute("style")).not.toBe(bodyFontSize);
    expect(presentationRef.current?.textStyles).toMatchObject([{ id: "quote", role: "caption" }]);
  });

  it("creates a custom style with a default role, rejects blank names, and commits a real name edit", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => button("+ Add Style").click());
    const form = requiredElement<HTMLElement>("[data-new-text-style]");
    const nameInput = requiredElement<HTMLInputElement>("[data-new-text-style] input");
    const createButton = Array.from(form.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "+ Add Style");
    expect(createButton?.disabled).toBe(true);
    await act(async () => setInputValue(nameInput, "   "));
    expect(createButton?.disabled).toBe(true);

    await act(async () => setInputValue(nameInput, "Quote"));
    await act(async () => createButton?.click());
    expect(presentationRef.current?.textStyles).toEqual([{ id: "quote", name: "Quote", role: "body" }]);
    expect(row("quote").textContent).toContain("Body");

    await act(async () => disclosure("quote").click());
    const quoteRow = row("quote");
    const roleSelect = quoteRow.querySelector<HTMLSelectElement>("select");
    expect(roleSelect?.value).toBe("body");
    expect(Array.from(quoteRow.querySelectorAll("input")).some((input) => (input as HTMLInputElement).value === "quote")).toBe(false);

    const styleInput = requiredElement<HTMLInputElement>("[data-text-style-id='quote'] input");
    await act(async () => {
      styleInput.focus();
      setInputValue(styleInput, "Block ");
    });
    expect(styleInput.value).toBe("Block ");
    await act(async () => setInputValue(styleInput, "Block Quote"));
    expect(styleInput.value).toBe("Block Quote");
    await act(async () => styleInput.blur());

    expect(row("quote").querySelector("strong")?.textContent).toBe("Block Quote");
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ id: "quote", name: "Block Quote", role: "body" });

    const editedQuoteRow = row("quote");
    const editedRoleSelect = requiredElement<HTMLSelectElement>("[data-text-style-id='quote'] select");
    await act(async () => {
      editedRoleSelect.value = "caption";
      editedRoleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ id: "quote", role: "caption" });
    expect(editedQuoteRow.getAttribute("data-text-style-id")).toBe("quote");

    await act(async () => rowButton("quote", "+ Add property").click());
    const addQuoteFont = Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font family");
    await act(async () => addQuoteFont?.click());
    const quoteFontSelect = requiredElement<HTMLSelectElement>("#text-style-quote-font-family");
    expect(Array.from(quoteFontSelect.options).map((option) => option.value)).toEqual(["", "Inter"]);
    await act(async () => {
      quoteFontSelect.value = "Inter";
      quoteFontSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ id: "quote", typography: { fontFamily: "Inter" } });
    const quoteFontSelectAfterSave = requiredElement<HTMLSelectElement>("#text-style-quote-font-family");
    await act(async () => {
      quoteFontSelectAfterSave.value = "";
      quoteFontSelectAfterSave.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(presentationRef.current?.textStyles).toEqual([{ id: "quote", name: "Block Quote", role: "caption" }]);
    expect(presentationRef.current?.textStyles?.[0]).not.toHaveProperty("typography");
    expect(row("quote").textContent).not.toContain("Edit");
  });

  it("removes an unused custom style", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => button("+ Add Style").click());
    const nameInput = requiredElement<HTMLInputElement>("[data-new-text-style] input");
    await act(async () => setInputValue(nameInput, "Quote"));
    await act(async () => button("+ Add Style").click());
    expect(row("quote")).not.toBeNull();

    expect(row("quote").textContent).not.toContain("Remove");
    await act(async () => disclosure("quote").click());
    expect(rowButton("quote", "Remove").disabled).toBe(false);
    await act(async () => rowButton("quote", "Remove").click());
    expect(container.querySelector("[data-text-style-id='quote']")).toBeNull();
    expect(presentationRef.current).not.toHaveProperty("textStyles");
  });

  it("protects a used custom style and leaves its Text unchanged", async () => {
    const custom = addCustomTextStyle(base(), "Quote", "body");
    const usedPresentation = PresentationSchema.parse({
      ...custom,
      slides: [{ id: "s", title: "", elements: [{ id: "text", type: "text", hidden: false, variant: "quote", content: "unchanged" }] }],
    });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(usedPresentation, presentationRef, []);

    expect(row("quote").textContent).not.toContain("Remove");
    await act(async () => disclosure("quote").click());
    const removeButton = rowButton("quote", "Remove");
    expect(row("quote").textContent).toContain("Used by 1 element");
    expect(removeButton.disabled).toBe(true);
    await act(async () => removeButton.click());
    expect(presentationRef.current?.textStyles).toEqual(usedPresentation.textStyles);
    expect(presentationRef.current?.slides[0]?.elements[0]).toMatchObject({ type: "text", variant: "quote", content: "unchanged" });
  });

  it("detaches one Text usage in place without navigating and refreshes usage", async () => {
    const value = PresentationSchema.parse({
      ...base(),
      textStyles: [{ id: "quote", name: "Quote", role: "caption", typography: { fontSize: 24 } }],
      slides: [{ id: "s", title: "", elements: [
        { id: "first", type: "text", hidden: false, variant: "quote", content: "First" },
        { id: "second", type: "text", hidden: false, variant: "quote", content: "Second" },
      ] }],
    });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    const navigation = { count: 0 };
    await render(value, presentationRef, [], () => { navigation.count += 1; });
    await act(async () => disclosure("quote").click());

    expect(row("quote").textContent).toContain("Used by 2 elements");
    const detachButtons = Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).filter((candidate) => candidate.textContent?.trim() === "x");
    expect(detachButtons).toHaveLength(2);

    await act(async () => detachButtons[0]?.click());

    expect(navigation.count).toBe(0);
    expect(row("quote").textContent).toContain("Used by 1 element");
    expect(presentationRef.current?.slides[0]?.elements[0]).toMatchObject({
      id: "first",
      variant: "caption",
      styleDetached: true,
      typography: { fontSize: 24 },
    });
    expect(presentationRef.current?.slides[0]?.elements[1]).toMatchObject({
      id: "second",
      variant: "quote",
    });
    expect(presentationRef.current?.slides[0]?.elements[1]).not.toHaveProperty("styleDetached");
  });

  it("localizes the detach accessibility label and preserves the existing location action", async () => {
    const value = PresentationSchema.parse({
      ...base(),
      textStyles: [{ id: "quote", name: "Quote", role: "body" }],
      slides: [{ id: "s", title: "", elements: [{ id: "text", type: "text", hidden: false, variant: "quote", content: "Text" }] }],
    });
    let selected = 0;
    await render(value, undefined, [], () => { selected += 1; }, "pt-BR");
    await act(async () => disclosure("quote").click());
    const usage = row("quote").querySelector("[data-text-style-usage]")!;
    expect(usage.textContent).not.toContain("Desvincular aqui");
    expect(usage.querySelector<HTMLButtonElement>("button[aria-label]")?.getAttribute("aria-label")).toContain("Desvincular este elemento de Quote");
    await act(async () => usage.querySelector<HTMLButtonElement>("button")?.click());
    expect(selected).toBe(1);
  });

  it("adds one baseline property without materializing the other defaults", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(addCustomTextStyle(base(), "Quote", "caption"), presentationRef);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    const option = Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font weight");
    await act(async () => option?.click());

    expect(presentationRef.current?.textStyles).toEqual([{ id: "quote", name: "Quote", role: "caption", typography: { fontWeight: 400 } }]);
    expect(row("quote").querySelectorAll("[data-text-style-property]")).toHaveLength(1);
  });

  it("keeps an authored value when the custom role changes", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(addCustomTextStyle(base(), "Quote", "body"), presentationRef);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font size")?.click());
    expect(presentationRef.current?.textStyles?.[0]?.typography?.fontSize).toBe(18);
    const role = row("quote").querySelector<HTMLSelectElement>("select");
    await act(async () => { if (role) { role.value = "caption"; role.dispatchEvent(new Event("change", { bubbles: true })); } });
    expect(presentationRef.current?.textStyles?.[0]?.typography?.fontSize).toBe(18);
  });

  it("removes only the selected property and preserves deferred appearance", async () => {
    const initial = PresentationSchema.parse({ ...addCustomTextStyle(base(), "Quote", "body"), textStyles: [{ id: "quote", name: "Quote", role: "body", style: { color: "#111111" }, typography: { fontSize: 18, fontWeight: 500, textDecorationColor: "#222222", textStroke: { width: 1, color: "#333333" } } }] });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(initial, presentationRef);
    await act(async () => disclosure("quote").click());
    await act(async () => row("quote").querySelector<HTMLButtonElement>("[aria-label='Remove Font size']")?.click());
    expect(presentationRef.current?.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body", style: { color: "#111111" }, typography: { fontWeight: 500, textDecorationColor: "#222222", textStroke: { width: 1, color: "#333333" } } });
  });

  it("dismisses pending Font family without persisting a placeholder", async () => {
    const initial = addCustomTextStyle(base(), "Quote", "body");
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(initial, presentationRef);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font family")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
    await act(async () => row("quote").querySelector<HTMLButtonElement>("[aria-label='Remove Font family']")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
  });

  it("authors Text color only after a real literal choice and removes it sparsely", async () => {
    const initial = addCustomTextStyle(base(), "Quote", "body");
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(initial, presentationRef);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Text color")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
    expect(row("quote").querySelector("#text-style-quote-color")).not.toBeNull();
    const color = requiredElement<HTMLInputElement>("#text-style-quote-color-value");
    await act(async () => { setInputValue(color, "#123456"); });
    expect(presentationRef.current?.textStyles).toEqual([{ id: "quote", name: "Quote", role: "body", style: { color: "#123456" } }]);
    await act(async () => row("quote").querySelector<HTMLButtonElement>("[aria-label='Remove Text color']")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
  });

  it("persists palette references and detaches only the selected Text color", async () => {
    const initial = addCustomTextStyle(base(), "Quote", "body");
    const palette = [{ id: "primary", name: "Primary", value: "#336699" }] as const;
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(PresentationSchema.parse({ ...initial, palette: { colors: [...palette] } }), presentationRef, palette);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Text color")?.click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Use palette")?.click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button[aria-pressed]")).find((candidate) => candidate.getAttribute("aria-label")?.includes("Primary"))?.click());
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ style: { color: { kind: "palette", colorId: "primary" } } });
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Detach")?.click());
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ style: { color: "#336699" } });
    expect(presentationRef.current?.textStyles?.[0]).not.toHaveProperty("styleDetached");
  });

  it("keeps pending stroke transient until color completes the atomic object", async () => {
    const initial = addCustomTextStyle(base(), "Quote", "body");
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    const palette = [{ id: "outline", name: "Outline", value: "#111111" }] as const;
    await render(PresentationSchema.parse({ ...initial, palette: { colors: [...palette] } }), presentationRef, palette);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Text stroke")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
    const width = requiredElement<HTMLInputElement>("#text-style-quote-stroke-width");
    await act(async () => { setInputValue(width, "3"); });
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Use palette")?.click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button[aria-pressed]")).find((candidate) => candidate.getAttribute("aria-label")?.includes("Outline"))?.click());
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ typography: { textStroke: { width: 3, color: { kind: "palette", colorId: "outline" } } } });
  });

  it("surfaces imported appearance properties and preserves siblings when removing one", async () => {
    const initial = PresentationSchema.parse({ ...addCustomTextStyle(base(), "Quote", "body"), textStyles: [{ id: "quote", name: "Quote", role: "body", style: { color: "#111111" }, typography: { fontSize: 20, textDecorationColor: "#222222", textStroke: { width: 2, color: "#333333" } } }] });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(initial, presentationRef);
    await act(async () => disclosure("quote").click());
    expect(row("quote").querySelectorAll("[data-text-style-property]")).toHaveLength(4);
    await act(async () => row("quote").querySelector<HTMLButtonElement>("[aria-label='Remove Decoration color']")?.click());
    expect(presentationRef.current?.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body", style: { color: "#111111" }, typography: { fontSize: 20, textStroke: { width: 2, color: "#333333" } } });
  });

  it("reads imported pixel stroke widths and preserves the canonical width during color edits", async () => {
    const palette = [{ id: "outline", name: "Outline", value: "#111111" }] as const;
    const initial = PresentationSchema.parse({ ...addCustomTextStyle(base(), "Quote", "body"), palette: { colors: [...palette] }, textStyles: [{ id: "quote", name: "Quote", role: "body", typography: { textStroke: { width: "2px", color: { kind: "palette", colorId: "outline" } } } }] });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(initial, presentationRef, palette);
    await act(async () => disclosure("quote").click());

    expect(requiredElement<HTMLInputElement>("#text-style-quote-stroke-width").value).toBe("2");
    expect(presentationRef.current).toEqual(initial);
    const strokeProperty = requiredElement<HTMLElement>("[data-text-style-property='textStroke']");
    await act(async () => strokeProperty.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    await act(async () => strokeProperty.querySelector<HTMLButtonElement>("button[aria-pressed][aria-label*='Outline']")?.click());
    expect(presentationRef.current?.textStyles?.[0]?.typography?.textStroke?.width).toBe("2px");

    await act(async () => setInputValue(requiredElement<HTMLInputElement>("#text-style-quote-stroke-color-value"), "#222222"));
    expect(presentationRef.current?.textStyles?.[0]?.typography?.textStroke?.width).toBe("2px");
    await act(async () => setInputValue(requiredElement<HTMLInputElement>("#text-style-quote-stroke-width"), "3"));
    expect(presentationRef.current?.textStyles?.[0]?.typography?.textStroke?.width).toBe(3);
  });

  it("resolves a presentation-aware custom preview through the canonical style and palette", async () => {
    const palette = [{ id: "primary", name: "Primary", value: "#336699" }, { id: "outline", name: "Outline", value: "#111111" }] as const;
    const initial = PresentationSchema.parse({ ...addCustomTextStyle(base(), "Quote", "body"), palette: { colors: [...palette] }, textStyles: [{ id: "quote", name: "Quote", role: "body", style: { color: { kind: "palette", colorId: "primary" } }, typography: { fontSize: 20, textDecorationLine: "underline", textDecorationColor: { kind: "palette", colorId: "outline" }, textStroke: { width: 2, color: { kind: "palette", colorId: "outline" } } } }] });
    await render(initial, undefined, palette);
    await act(async () => disclosure("quote").click());

    const preview = requiredElement<HTMLElement>("[data-text-style-preview='quote']");
    const previewText = requiredElement<HTMLElement>("[data-text-style-preview='quote'] .powershow-text");
    expect(previewText.className).toContain("powershow-text-body");
    expect(previewText.getAttribute("style")).toContain("color:var(--ps-palette-");
    expect(previewText.getAttribute("style")).toContain("text-decoration-color:var(--ps-palette-");
    expect(previewText.getAttribute("style")).toContain("-webkit-text-stroke:2px var(--ps-palette-");
    expect(preview.getAttribute("style")).toContain(`${paletteColorCssVariableName("primary")}: #336699`);
    expect(preview.getAttribute("style")).toContain(`${paletteColorCssVariableName("outline")}: #111111`);
  });

  it("authors and removes Decoration color without changing core typography", async () => {
    const initial = PresentationSchema.parse({ ...addCustomTextStyle(base(), "Quote", "body"), textStyles: [{ id: "quote", name: "Quote", role: "body", typography: { fontSize: 20 } }] });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(initial, presentationRef);
    await act(async () => disclosure("quote").click());
    await act(async () => rowButton("quote", "+ Add property").click());
    await act(async () => Array.from(row("quote").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Decoration color")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
    const color = requiredElement<HTMLInputElement>("#text-style-quote-decoration-color-value");
    await act(async () => { setInputValue(color, "#abcdef"); });
    expect(presentationRef.current?.textStyles?.[0]).toMatchObject({ typography: { fontSize: 20, textDecorationColor: "#abcdef" } });
    await act(async () => row("quote").querySelector<HTMLButtonElement>("[aria-label='Remove Decoration color']")?.click());
    expect(presentationRef.current?.textStyles).toEqual(initial.textStyles);
  });

  it("cleans up a final fundamental appearance override while preserving a remaining core override", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);
    await act(async () => disclosure("body").click());
    await act(async () => rowButton("body", "+ Add property").click());
    await act(async () => Array.from(row("body").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Text color")?.click());
    const color = requiredElement<HTMLInputElement>("#text-style-body-color-value");
    await act(async () => { setInputValue(color, "#123456"); });
    expect(row("body").textContent).toContain("Customized");
    await act(async () => row("body").querySelector<HTMLButtonElement>("[aria-label='Remove Text color']")?.click());
    expect(presentationRef.current).not.toHaveProperty("textStyles");
    expect(row("body").textContent).toContain("Built-in");
    await act(async () => rowButton("body", "+ Add property").click());
    await act(async () => Array.from(row("body").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Font size")?.click());
    await act(async () => rowButton("body", "+ Add property").click());
    await act(async () => Array.from(row("body").querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Text color")?.click());
    await act(async () => { setInputValue(requiredElement<HTMLInputElement>("#text-style-body-color-value"), "#654321"); });
    await act(async () => row("body").querySelector<HTMLButtonElement>("[aria-label='Remove Text color']")?.click());
    expect(presentationRef.current?.textStyles).toEqual([{ id: "body", typography: { fontSize: 18 } }]);
    expect(row("body").textContent).toContain("Customized");
  });
});
