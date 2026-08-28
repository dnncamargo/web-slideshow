// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { addCustomTypographyStyle, removeUnusedCustomTypographyStyle, resetFundamentalTypographyOverride, updateCustomTypographyStyle, upsertFundamentalTypographyOverride } from "../src/features/editor/typography-style-helpers";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
const base = (): Presentation => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "", elements: [] }] });
function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function Harness({ initial = base() }: { initial?: Presentation }) {
  const [presentation, setPresentation] = useState(initial);
  return <CustomResourcesWorkspace customLibraryPaletteRepository={repository} customLibraryFontRepository={repository} presentationColors={[]} presentationFonts={[]} onAddLibraryPalette={() => ({ ok: true, addedColors: [] })} onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })} onAddPresentationColor={() => undefined} onUpdatePresentationColor={() => undefined} onRemovePresentationColor={() => undefined} onRemovePresentationFont={() => "not-found"} isPresentationFontInUse={() => false} presentationTypographyStyles={presentation.typographyStyles ?? []} onUpdateFundamentalTypographyStyle={(id, typography) => setPresentation((current) => upsertFundamentalTypographyOverride(current, id, typography))} onResetFundamentalTypographyStyle={(id) => setPresentation((current) => resetFundamentalTypographyOverride(current, id))} onAddTypographyStyle={(name, role) => setPresentation((current) => addCustomTypographyStyle(current, name, role))} onUpdateTypographyStyle={(id, patch) => setPresentation((current) => updateCustomTypographyStyle(current, id, patch))} onRemoveTypographyStyle={(id) => setPresentation((current) => removeUnusedCustomTypographyStyle(current, id) ?? current)} isTypographyStyleInUse={() => false} />;
}

describe("Custom Resources Typography Styles", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ""; root = undefined; });
  async function render(initial?: Presentation) { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); await act(async () => root?.render(<StudioI18nProvider><Harness initial={initial} /></StudioI18nProvider>)); }
  function button(label: string): HTMLButtonElement { const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === label); if (!found) throw new Error(`Missing button ${label}`); return found; }

  it("shows virtual fundamentals as built-in without mutating on render", async () => {
    await render();
    expect(container.textContent).toContain("TitleBuilt-in");
    expect(container.textContent).toContain("SubtitleBuilt-in");
    expect(container.textContent).toContain("BodyBuilt-in");
    expect(container.textContent).toContain("CaptionBuilt-in");
    expect(container.querySelectorAll("[data-typography-style-id]")).toHaveLength(4);
  });

  it("creates, edits, and removes a custom style while preserving its ID", async () => {
    await render();
    await act(async () => button("+ Add Style").click());
    const form = container.querySelector("[data-new-typography-style]");
    const nameInput = form?.querySelector("input");
    expect((form?.querySelector("select") as HTMLSelectElement).value).toBe("body");
    await act(async () => { if (nameInput) setInputValue(nameInput, "Quote"); });
    await act(async () => button("+ Add Style").click());
    expect(container.querySelector("[data-typography-style-id='quote']")).not.toBeNull();
    await act(async () => Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === "Edit" && candidate.closest("[data-typography-style-id='quote']"))?.click());
    const styleInput = container.querySelector<HTMLInputElement>("[data-typography-style-id='quote'] input");
    expect(styleInput).not.toBeNull();
    await act(async () => { if (styleInput) { styleInput.focus(); setInputValue(styleInput, "Block "); } });
    expect(styleInput?.value).toBe("Block ");
    await act(async () => styleInput?.dispatchEvent(new FocusEvent("blur", { bubbles: true })));
    expect(styleInput?.value).toBe("Block ");
    expect(container.querySelector("[data-typography-style-id='quote']")).not.toBeNull();
  });
});
