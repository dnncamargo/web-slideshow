// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema, type FontResource, type Presentation } from "@powershow/document-schema";
import { TEXT_VARIANT_TYPOGRAPHY_DEFAULTS } from "@powershow/theme/element-style-defaults";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { addCustomTypographyStyle, isTypographyStyleUsed, removeUnusedCustomTypographyStyle, resetFundamentalTypographyOverride, updateCustomTypographyStyle, upsertFundamentalTypographyOverride } from "../src/features/editor/typography-style-helpers";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
const presentationFont: FontResource = {
  id: "presentation-inter",
  family: "Inter",
  faces: [{ weight: 400, style: "normal", subset: "latin", source: { type: "url", url: "https://example.com/inter-400.woff2" } }],
};

const fundamentalIds = ["title", "subtitle", "body", "caption"] as const;

const base = (): Presentation => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "", elements: [] }] });

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function Harness({
  initial = base(),
  presentationRef,
}: {
  initial?: Presentation;
  presentationRef?: { current: Presentation | undefined };
}) {
  const [presentation, setPresentation] = useState(initial);
  presentationRef && (presentationRef.current = presentation);

  return <CustomResourcesWorkspace
    customLibraryPaletteRepository={repository}
    customLibraryFontRepository={repository}
    presentationColors={[]}
    presentationFonts={[presentationFont]}
    onAddLibraryPalette={() => ({ ok: true, addedColors: [] })}
    onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })}
    onAddPresentationColor={() => undefined}
    onUpdatePresentationColor={() => undefined}
    onRemovePresentationColor={() => undefined}
    onRemovePresentationFont={() => "not-found"}
    isPresentationFontInUse={() => false}
    presentationTypographyStyles={presentation.typographyStyles ?? []}
    onUpdateFundamentalTypographyStyle={(id, typography) => setPresentation((current) => upsertFundamentalTypographyOverride(current, id, typography))}
    onResetFundamentalTypographyStyle={(id) => setPresentation((current) => resetFundamentalTypographyOverride(current, id))}
    onAddTypographyStyle={(name, role) => setPresentation((current) => addCustomTypographyStyle(current, name, role))}
    onUpdateTypographyStyle={(id, patch) => setPresentation((current) => updateCustomTypographyStyle(current, id, patch))}
    onRemoveTypographyStyle={(id) => setPresentation((current) => removeUnusedCustomTypographyStyle(current, id) ?? current)}
    isTypographyStyleInUse={(id) => isTypographyStyleUsed(presentation, id)}
  />;
}

describe("Custom Resources Typography Styles", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    document.body.innerHTML = "";
    root = undefined;
  });

  async function render(initial?: Presentation, presentationRef?: { current: Presentation | undefined }): Promise<void> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<StudioI18nProvider><Harness initial={initial} presentationRef={presentationRef} /></StudioI18nProvider>));
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
    return requiredElement<HTMLElement>(`[data-typography-style-id='${id}']`);
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
    const typographyStyles = requiredElement<HTMLElement>("[data-presentation-typography-styles]");
    expect(typographyStyles.tagName).toBe("SECTION");
    expect(typographyStyles.getAttribute("aria-labelledby")).toBe("presentation-typography-styles-title");
    expect(typographyStyles.querySelector("#presentation-typography-styles-title")?.textContent).toBe("Typography Styles");
    expect(thisPresentation.contains(typographyStyles)).toBe(true);
    expect(fromLibrary.querySelector("[data-presentation-typography-styles]")).toBeNull();
    expect(fromLibrary.textContent).not.toContain("Typography Styles");
    expect(typographyStyles.textContent).not.toContain("Edit");

    for (const id of fundamentalIds) {
      expect(disclosure(id).getAttribute("aria-expanded")).toBe("false");
      expect(row(id).querySelector("#typography-style-" + id + "-editor")).toBeNull();
    }
  });

  it("edits a fundamental through the real typography control and resets the last override", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => disclosure("body").click());
    const fontSelect = requiredElement<HTMLSelectElement>("#typography-style-body-font-family");
    expect(Array.from(fontSelect.options).map((option) => option.value)).toContain("Inter");
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      fontSelect.value = "Inter";
      fontSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(presentationRef.current?.typographyStyles).toEqual([{ id: "body", typography: { fontFamily: "Inter" } }]);
    expect(row("body").textContent).toContain("Customized");
    expect(row("body").textContent).not.toContain("Edit");

    await act(async () => rowButton("body", "Reset").click());
    expect(row("body").textContent).toContain("Built-in");
    expect(row("body").querySelector("button")?.textContent).not.toContain("Reset");
    expect(presentationRef.current).not.toHaveProperty("typographyStyles");
  });

  it("opens and closes one Typography Style editor at a time", async () => {
    await render();

    expect(disclosure("body").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#typography-style-body-editor")).toBeNull();

    await act(async () => disclosure("body").click());
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#typography-style-body-editor")).not.toBeNull();

    await act(async () => disclosure("body").click());
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#typography-style-body-editor")).toBeNull();

    await act(async () => disclosure("title").click());
    await act(async () => disclosure("body").click());
    expect(disclosure("title").getAttribute("aria-expanded")).toBe("false");
    expect(disclosure("body").getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll("[data-presentation-typography-styles] [id$='-editor']")).toHaveLength(1);
  });

  it("renders a transient live preview from effective defaults and style values", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    expect(container.querySelector("[data-typography-style-preview='body']")).toBeNull();
    await act(async () => disclosure("body").click());

    const bodyPreview = requiredElement<HTMLElement>("[data-typography-style-preview='body']");
    const bodyPreviewText = () => requiredElement<HTMLElement>("[data-typography-style-preview='body'] .powershow-text");
    expect(bodyPreview.getAttribute("aria-hidden")).toBe("true");
    expect(bodyPreview.textContent).toBe("Aa");
    expect(bodyPreviewText().getAttribute("style")).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize}px`);

    const fontSelect = requiredElement<HTMLSelectElement>("#typography-style-body-font-family");
    await act(async () => {
      fontSelect.value = "Inter";
      fontSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(bodyPreviewText().getAttribute("style")).toContain('font-family:"Inter"');
    expect(JSON.stringify(presentationRef.current)).not.toContain("typography-style-preview-");
    expect(JSON.stringify(presentationRef.current)).not.toContain("Aa");

    await act(async () => rowButton("body", "Reset").click());
    expect(bodyPreviewText().getAttribute("style")).not.toContain("Inter");
    expect(bodyPreviewText().getAttribute("style")).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize}px`);

    await act(async () => disclosure("body").click());
    expect(container.querySelector("[data-typography-style-preview='body']")).toBeNull();
  });

  it("updates a custom Style preview when its role changes", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => button("+ Add Style").click());
    const nameInput = requiredElement<HTMLInputElement>("[data-new-typography-style] input");
    await act(async () => setInputValue(nameInput, "Quote"));
    await act(async () => button("+ Add Style").click());
    await act(async () => disclosure("quote").click());

    const quotePreviewText = () => requiredElement<HTMLElement>("[data-typography-style-preview='quote'] .powershow-text");
    const bodyFontSize = quotePreviewText().getAttribute("style");
    expect(bodyFontSize).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize}px`);

    const roleSelect = requiredElement<HTMLSelectElement>("[data-typography-style-id='quote'] select");
    await act(async () => {
      roleSelect.value = "caption";
      roleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(quotePreviewText().getAttribute("style")).toContain(`font-size:${TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.caption.fontSize}px`);
    expect(quotePreviewText().getAttribute("style")).not.toBe(bodyFontSize);
    expect(presentationRef.current?.typographyStyles).toMatchObject([{ id: "quote", role: "caption", typography: {} }]);
  });

  it("creates a custom style with a default role, rejects blank names, and commits a real name edit", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => button("+ Add Style").click());
    const form = requiredElement<HTMLElement>("[data-new-typography-style]");
    const nameInput = requiredElement<HTMLInputElement>("[data-new-typography-style] input");
    const createButton = Array.from(form.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "+ Add Style");
    expect(createButton?.disabled).toBe(true);
    await act(async () => setInputValue(nameInput, "   "));
    expect(createButton?.disabled).toBe(true);

    await act(async () => setInputValue(nameInput, "Quote"));
    await act(async () => createButton?.click());
    expect(presentationRef.current?.typographyStyles).toEqual([{ id: "quote", name: "Quote", role: "body", typography: {} }]);
    expect(row("quote").textContent).toContain("Body");

    await act(async () => disclosure("quote").click());
    const quoteRow = row("quote");
    const roleSelect = quoteRow.querySelector<HTMLSelectElement>("select");
    expect(roleSelect?.value).toBe("body");
    expect(Array.from(quoteRow.querySelectorAll("input")).some((input) => (input as HTMLInputElement).value === "quote")).toBe(false);

    const styleInput = requiredElement<HTMLInputElement>("[data-typography-style-id='quote'] input");
    await act(async () => {
      styleInput.focus();
      setInputValue(styleInput, "Block ");
    });
    expect(styleInput.value).toBe("Block ");
    await act(async () => setInputValue(styleInput, "Block Quote"));
    expect(styleInput.value).toBe("Block Quote");
    await act(async () => styleInput.blur());

    expect(row("quote").querySelector("strong")?.textContent).toBe("Block Quote");
    expect(presentationRef.current?.typographyStyles?.[0]).toMatchObject({ id: "quote", name: "Block Quote", role: "body", typography: {} });

    const editedQuoteRow = row("quote");
    const editedRoleSelect = requiredElement<HTMLSelectElement>("[data-typography-style-id='quote'] select");
    await act(async () => {
      editedRoleSelect.value = "caption";
      editedRoleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(presentationRef.current?.typographyStyles?.[0]).toMatchObject({ id: "quote", role: "caption" });
    expect(editedQuoteRow.getAttribute("data-typography-style-id")).toBe("quote");

    const quoteFontSelect = requiredElement<HTMLSelectElement>("#typography-style-quote-font-family");
    expect(Array.from(quoteFontSelect.options).map((option) => option.value)).toEqual(["", "Inter"]);
    await act(async () => {
      quoteFontSelect.value = "Inter";
      quoteFontSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(presentationRef.current?.typographyStyles?.[0]).toMatchObject({ id: "quote", typography: { fontFamily: "Inter" } });
    expect(row("quote").textContent).not.toContain("Edit");
  });

  it("removes an unused custom style", async () => {
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(undefined, presentationRef);

    await act(async () => button("+ Add Style").click());
    const nameInput = requiredElement<HTMLInputElement>("[data-new-typography-style] input");
    await act(async () => setInputValue(nameInput, "Quote"));
    await act(async () => button("+ Add Style").click());
    expect(row("quote")).not.toBeNull();

    expect(row("quote").textContent).not.toContain("Remove");
    await act(async () => disclosure("quote").click());
    expect(rowButton("quote", "Remove").disabled).toBe(false);
    await act(async () => rowButton("quote", "Remove").click());
    expect(container.querySelector("[data-typography-style-id='quote']")).toBeNull();
    expect(presentationRef.current).not.toHaveProperty("typographyStyles");
  });

  it("protects a used custom style and leaves its Text unchanged", async () => {
    const custom = addCustomTypographyStyle(base(), "Quote", "body");
    const usedPresentation = PresentationSchema.parse({
      ...custom,
      slides: [{ id: "s", title: "", elements: [{ id: "text", type: "text", hidden: false, variant: "quote", content: "unchanged" }] }],
    });
    const presentationRef: { current: Presentation | undefined } = { current: undefined };
    await render(usedPresentation, presentationRef);

    expect(row("quote").textContent).not.toContain("Remove");
    await act(async () => disclosure("quote").click());
    const removeButton = rowButton("quote", "Remove");
    expect(row("quote").textContent).toContain("In use");
    expect(removeButton.disabled).toBe(true);
    await act(async () => removeButton.click());
    expect(presentationRef.current?.typographyStyles).toEqual(usedPresentation.typographyStyles);
    expect(presentationRef.current?.slides[0]?.elements[0]).toMatchObject({ type: "text", variant: "quote", content: "unchanged" });
  });
});
