// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { EDITOR_AUTOSAVE_DELAY_MS } from "../src/features/editor/editor-save-state";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = {
  listPalettes: vi.fn(async () => []),
  listFonts: vi.fn(async () => []),
} as never;

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function makePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "editor-typography",
    title: "Typography",
    resources: {
      fonts: [{
        id: "fira-code",
        family: "Fira Code",
        faces: [{
          weight: 400,
          style: "normal",
          subset: "latin",
          source: { type: "url", url: "https://example.com/fira-code.woff2" },
        }],
      }],
    },
    palette: { colors: [
      { id: "primary", name: "Primary", value: "#336699" },
      { id: "outline", name: "Outline", value: "#111111" },
    ] },
    slides: [{
      id: "slide",
      title: "Slide",
      elements: [{
        id: "body-text",
        type: "text",
        variant: "body",
        content: "Attached body",
      }],
    }],
  });
}

describe("EditorWorkspace Text Styles rendering", () => {
  let root: Root | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    document.body.innerHTML = "";
    vi.useRealTimers();
    root = undefined;
  });

  it("propagates an edited attached Body style through the real canvas and autosaves it", async () => {
    vi.useFakeTimers();
    const initial = makePresentation();
    const before = structuredClone(initial);
    const saved: Presentation[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => root?.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (presentation) => { saved.push(presentation); }}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
        />
      </StudioI18nProvider>,
    ));

    const canvasText = () => container.querySelector<HTMLElement>("[data-powershow-id='body-text']");
    expect(canvasText()?.getAttribute("style") ?? "").not.toContain("Fira Code");
    expect(container.querySelector("[data-powershow-font-resources]")?.textContent).toContain("Fira Code");

    const resourcesButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    await act(async () => resourcesButton?.click());
    const editBodyButton = container.querySelector<HTMLButtonElement>("[data-text-style-id='body'] button");
    await act(async () => editBodyButton?.click());

    const addProperty = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-text-style-id='body'] button")).find((button) => button.textContent?.trim() === "+ Add property");
    await act(async () => addProperty?.click());
    const addFontFamily = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-text-style-id='body'] button")).find((button) => button.textContent?.trim() === "Font family");
    await act(async () => addFontFamily?.click());
    const fontSelect = container.querySelector<HTMLSelectElement>("#text-style-body-font-family");
    expect(fontSelect).not.toBeNull();
    await act(async () => {
      if (!fontSelect) return;
      fontSelect.value = "Fira Code";
      fontSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(canvasText()?.getAttribute("style")).toContain('font-family:"Fira Code"');
    expect(container.querySelectorAll("[data-powershow-font-resources]")).toHaveLength(1);
    expect(container.querySelector("[data-text-style-preview='body'] .powershow-text")?.getAttribute("style")).toContain('font-family:"Fira Code"');
    expect(initial).toEqual(before);
    expect(container.querySelector<HTMLElement>("[data-powershow-id='body-text']")?.getAttribute("style")).not.toContain("font-size");

    await act(async () => { await vi.advanceTimersByTimeAsync(EDITOR_AUTOSAVE_DELAY_MS); });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.textStyles).toEqual([{ id: "body", typography: { fontFamily: "Fira Code" } }]);
    expect(saved[0]?.slides[0]?.elements[0]).not.toHaveProperty("typography.fontFamily");
  });

  it("propagates Palette-linked color and atomic stroke authoring to the real canvas", async () => {
    vi.useFakeTimers();
    const initial = makePresentation();
    const saved: Presentation[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => root?.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} onSave={async (presentation) => { saved.push(presentation); }} customLibraryPaletteRepository={repositories} customLibraryFontRepository={repositories} /></StudioI18nProvider>));
    const resourcesButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    await act(async () => resourcesButton?.click());
    await act(async () => container.querySelector<HTMLButtonElement>("[data-text-style-id='body'] button")?.click());
    const row = () => container.querySelector<HTMLElement>("[data-text-style-id='body']");
    const addProperty = () => Array.from(row()?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === "+ Add property");

    await act(async () => addProperty()?.click());
    await act(async () => Array.from(row()?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === "Text color")?.click());
    expect(initial.textStyles).toBeUndefined();
    const colorProperty = () => row()?.querySelector<HTMLElement>("[data-text-style-property='color']");
    await act(async () => colorProperty()?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    await act(async () => Array.from(colorProperty()?.querySelectorAll<HTMLButtonElement>("button[aria-pressed]") ?? []).find((button) => button.getAttribute("aria-label")?.includes("Primary"))?.click());

    await act(async () => addProperty()?.click());
    await act(async () => Array.from(row()?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === "Text stroke")?.click());
    const width = row()?.querySelector<HTMLInputElement>("#text-style-body-stroke-width");
    expect(width).not.toBeNull();
    await act(async () => {
      if (!width) return;
      setInputValue(width, "3");
    });
    expect(initial.textStyles).toBeUndefined();
    const strokeProperty = () => row()?.querySelector<HTMLElement>("[data-text-style-property='textStroke']");
    await act(async () => strokeProperty()?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    await act(async () => Array.from(strokeProperty()?.querySelectorAll<HTMLButtonElement>("button[aria-pressed]") ?? []).find((button) => button.getAttribute("aria-label")?.includes("Outline"))?.click());

    const canvasText = container.querySelector<HTMLElement>("[data-powershow-id='body-text']");
    expect(canvasText?.getAttribute("style")).toContain("var(--ps-palette-");
    expect(canvasText?.getAttribute("style")).toContain("-webkit-text-stroke:3px var(--ps-palette-");
    await act(async () => { await vi.advanceTimersByTimeAsync(EDITOR_AUTOSAVE_DELAY_MS); });
    expect(saved.at(-1)?.textStyles).toEqual([{ id: "body", style: { color: { kind: "palette", colorId: "primary" } }, typography: { textStroke: { width: 3, color: { kind: "palette", colorId: "outline" } } } }]);
    expect(saved.at(-1)?.slides[0]?.elements[0]).not.toHaveProperty("style.color");
    expect(saved.at(-1)?.slides[0]?.elements[0]).not.toHaveProperty("typography.textStroke");
  });
});
