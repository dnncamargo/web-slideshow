// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema, type LinkedContainerStyle, type Presentation } from "@powershow/document-schema";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { updateLinkedStyle } from "../src/features/editor/linked-style-authoring";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;

function makePresentation(style: LinkedContainerStyle["style"], extra: Record<string, unknown> = {}, presentationExtra: Record<string, unknown> = {}) {
  return PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "card", name: "Card", style, ...extra }], ...presentationExtra });
}

function Harness({ initial, onReady }: { initial: Presentation; onReady: (presentation: Presentation) => void }) {
  const [presentation, setPresentation] = useState(initial);
  onReady(presentation);
  return <StudioI18nProvider><CustomResourcesWorkspace customLibraryPaletteRepository={repository} customLibraryFontRepository={repository} presentation={presentation} presentationColors={[]} presentationFonts={[]} presentationTextStyles={[]} onAddLibraryPalette={() => ({ ok: true, addedColors: [] })} onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })} onApplyElementStyle={() => ({ ok: true })} onAddPresentationColor={() => undefined} onUpdatePresentationColor={() => undefined} onRemovePresentationColor={() => undefined} onRemovePresentationFont={() => "not-found"} isPresentationFontInUse={() => false} onUpdateLinkedStyle={(id, patch) => setPresentation((current) => updateLinkedStyle(current, id, patch))} /></StudioI18nProvider>;
}

describe("Linked Styles Resources border radius", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); });

  async function render(initial: Presentation) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root?.render(<Harness initial={initial} onReady={(value) => { presentation = value; }} />));
  }

  let presentation!: Presentation;
  async function openEditor() {
    const section = Array.from(host?.querySelectorAll("details") ?? []).find((item) => item.textContent?.includes("Linked Styles"));
    await act(async () => section?.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => host?.querySelector<HTMLButtonElement>("[data-linked-style-id='card'] button")?.click());
  }
  async function edit(value: string) {
    const input = host?.querySelector<HTMLInputElement>("#linked-style-card-border-radius");
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("writes numeric px values as numbers", async () => {
    await render(makePresentation({ borderRadius: 16, color: "#fff" })); await openEditor();
    expect(host?.querySelector<HTMLSelectElement>("select[aria-label='Rounded corners unit']")?.value).toBe("px");
    await edit("20");
    expect(presentation.linkedStyles?.[0]?.style?.borderRadius).toBe(20);
  });

  it("preserves rem values while editing", async () => {
    await render(makePresentation({ borderRadius: "1rem", color: "#fff" })); await openEditor();
    expect(host?.querySelector<HTMLInputElement>("#linked-style-card-border-radius")?.value).toBe("1");
    expect(host?.querySelector<HTMLSelectElement>("select[aria-label='Rounded corners unit']")?.value).toBe("rem");
    await edit("1.5");
    expect(presentation.linkedStyles?.[0]?.style?.borderRadius).toBe("1.5rem");
  });

  it("clears radius when another authored property remains", async () => {
    await render(makePresentation({ borderRadius: 16, color: "#fff" }, { layout: { children: { gap: 12 } } })); await openEditor(); await edit("");
    expect(presentation.linkedStyles?.[0]?.style?.borderRadius).toBeUndefined();
    expect(presentation.linkedStyles?.[0]?.layout?.children?.gap).toBe(12);
  });

  it("rejects clearing the final authored property and shows feedback", async () => {
    const initial = makePresentation({ borderRadius: 16 }); await render(initial); await openEditor(); await edit("");
    expect(presentation.linkedStyles?.[0]?.style?.borderRadius).toBe(16);
    expect(host?.querySelector("[role='status']")?.textContent ?? "").toContain("must keep at least one authored property");
  });

  it("preserves unrelated linked style bags when radius changes", async () => {
    const initial = makePresentation({ borderRadius: 16, color: { kind: "palette", colorId: "accent" } }, { layout: { children: { gap: 12 } }, typography: { fontSize: 20 }, effect: { shadow: { x: 0, y: 2, blur: 4, color: "#000" } } }, { palette: { colors: [{ id: "accent", name: "Accent", value: "#fff" }] } });
    await render(initial); await openEditor(); await edit("20");
    expect(presentation.linkedStyles?.[0]).toMatchObject({ layout: { children: { gap: 12 } }, style: { borderRadius: 20, color: { kind: "palette", colorId: "accent" } }, typography: { fontSize: 20 }, effect: { shadow: { y: 2 } } });
    expect(presentation.linkedStyles?.[0]?.style).not.toHaveProperty("className");
  });
});
