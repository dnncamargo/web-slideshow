// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { LinkedStyleCreationRequest } from "../src/features/editor/linked-style-creation";

const repository = { listPalettes: async () => [], listFonts: async () => [] } as never;
let host: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

function basePresentation(linkedStyles?: object[]): Presentation {
  return PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [], linkedStyles });
}

async function render(presentation: Presentation, onCreate: (request: LinkedStyleCreationRequest) => void = () => undefined, selectedElement: PresentationElement | null = null, onCreateFromSelected: (name: string) => void = () => undefined): Promise<void> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(<StudioI18nProvider><CustomResourcesWorkspace
    customLibraryPaletteRepository={repository}
    customLibraryFontRepository={repository}
    presentation={presentation}
    presentationColors={[]}
    presentationFonts={[]}
    presentationTextStyles={[]}
    onAddLibraryPalette={() => ({ ok: true, addedColors: [] })}
    onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })}
    onApplyElementStyle={() => ({ ok: true })}
    onAddPresentationColor={() => undefined}
    onUpdatePresentationColor={() => undefined}
    onRemovePresentationColor={() => undefined}
    onRemovePresentationFont={() => "not-found"}
    isPresentationFontInUse={() => false}
    onCreateLinkedStyle={onCreate}
    selectedElement={selectedElement}
    onCreateLinkedStyleFromSelected={onCreateFromSelected}
  /></StudioI18nProvider>));
}

describe("LSX4B1 Linked Styles Resources", () => {
  it("starts Add Linked Style with an empty type selector and gates the first-property chooser", async () => {
    await render(basePresentation());
    await act(async () => host?.querySelector<HTMLButtonElement>("[data-linked-style-actions] > button:first-child")?.click());
    const selector = host?.querySelector<HTMLSelectElement>("[aria-label='Element type']");
    expect(selector?.value).toBe("");
    expect(host?.querySelector("[data-linked-style-property-chooser]")).toBeNull();
    expect(host?.textContent).not.toContain("Linked Style name");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
      setter?.call(selector, "code");
      selector?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host?.textContent).toContain("Linked Style name");
    expect(host?.textContent).not.toContain("Add property");
    const name = host!.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(name, "Code");
      name.dispatchEvent(new Event("input", { bubbles: true }));
      name.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => Array.from(host?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Add first property"))?.click());
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Color");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Command");

    const selectKind = async (value: string): Promise<void> => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
        setter?.call(selector, value);
        selector?.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(host?.querySelector("[data-linked-style-property-chooser]")).toBeNull();
      await act(async () => Array.from(host?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Add first property"))?.click());
      expect(host?.querySelector("[data-linked-style-property-chooser]")).not.toBeNull();
    };
    await selectKind("container");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Gap");
    await selectKind("topics");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Topic spacing");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Command");
    await selectKind("terminal");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Command");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Header background");
    await selectKind("table:simple");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Font size");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Header background");
    await selectKind("table:structured");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Header background");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Font size");
    await selectKind("divider");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).toContain("Width");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Margin");
    expect(host?.querySelector("[data-linked-style-property-chooser]")?.textContent).not.toContain("Border");
  });

  it("keeps all supported creation contracts available and categorizes registered styles", async () => {
    await render(basePresentation([
      { id: "container", name: "Container A", layout: { margin: 1 } },
      { target: "topics", id: "topics", name: "Topics A", itemGap: 1 },
      { target: "code", id: "code-a", name: "Code A", style: { color: "#111111" } },
      { target: "code", id: "code-b", name: "Code B", style: { color: "#222222" } },
      { target: "terminal", id: "terminal", name: "Terminal A", style: { outputColor: "#333333" } },
      { target: "table", mode: "simple", id: "simple", name: "Simple Table A", style: { color: "#444444" } },
      { target: "table", mode: "structured", id: "structured", name: "Structured Table A", style: { headerBackground: "#555555" } },
      { target: "divider", id: "divider", name: "Divider A", style: { background: { color: "#666666" } } },
    ]));
    const categories = Array.from(host?.querySelectorAll<HTMLElement>("[data-linked-style-category]") ?? []);
    expect(categories.map((category) => category.dataset.linkedStyleCategory)).toEqual(["container", "topics", "code", "terminal", "table", "divider"]);
    expect(host?.querySelector("[data-linked-style-category='code']")?.textContent).toContain("Code · 2");
    expect(host?.querySelector("[data-linked-style-category='table']")?.textContent).toContain("Table · 2");
    expect(host?.querySelector("[data-linked-style-subcategory='simple']")?.textContent).toContain("Simple Table · 1");
    expect(host?.querySelector("[data-linked-style-subcategory='structured']")?.textContent).toContain("Structured Table · 1");
    expect(host?.querySelectorAll("[data-linked-style-id]")).toHaveLength(8);
    expect(host?.querySelector("[data-linked-style-target='code']")).not.toBeNull();
    expect(host?.querySelector("[data-linked-style-target='divider']")).not.toBeNull();
  });

  it("shows an inferred read-only type for Add to Linked Styles", async () => {
    const selected = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [{ id: "code", type: "code", hidden: false, code: "x", language: "ts", style: { color: "#123456" } }] }] }).slides[0]!.elements[0]!;
    const submitted: string[] = [];
    await render(basePresentation(), () => undefined, selected, (name) => submitted.push(name));
    await act(async () => host?.querySelector<HTMLButtonElement>("[data-linked-style-actions] > button:last-child")?.click());
    expect(host?.querySelector("select[aria-label='Element type']")).toBeNull();
    expect(host?.querySelector("[data-linked-style-inferred-type]")?.textContent).toBe("Code");
    const name = host!.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(name, "Selected Code");
      name.dispatchEvent(new Event("input", { bubbles: true }));
      name.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => Array.from(host?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Add to Linked Styles"))?.click());
    expect(submitted).toEqual(["Selected Code"]);
  });
});
