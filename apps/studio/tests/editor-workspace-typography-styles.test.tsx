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
    expect(initial).toEqual(before);
    expect(container.querySelector<HTMLElement>("[data-powershow-id='body-text']")?.getAttribute("style")).not.toContain("font-size");

    await act(async () => { await vi.advanceTimersByTimeAsync(EDITOR_AUTOSAVE_DELAY_MS); });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.textStyles).toEqual([{ id: "body", typography: { fontFamily: "Fira Code" } }]);
    expect(saved[0]?.slides[0]?.elements[0]).not.toHaveProperty("typography.fontFamily");
  });
});
