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

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === text);
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
    const linkedStyles = [
      { target: "code", id: "code-z", name: "Code Z", style: { color: "#111111" } },
      { id: "container", name: "Container A", layout: { margin: 1 } },
      { target: "code", id: "code-a", name: "Code A", style: { color: "#222222" } },
      { target: "divider", id: "divider", name: "Divider A", style: { background: { color: "#333333" } } },
      { target: "code", id: "code-m", name: "Code M", style: { color: "#444444" } },
      { target: "topics", id: "topics", name: "Topics A", itemGap: 1 },
      { target: "table", mode: "simple", id: "simple-z", name: "Simple Table Z", style: { color: "#555555" } },
      { target: "table", mode: "structured", id: "structured-z", name: "Structured Table Z", style: { headerBackground: "#666666" } },
      { target: "table", mode: "simple", id: "simple-a", name: "Simple Table A", style: { color: "#777777" } },
      { target: "table", mode: "structured", id: "structured-a", name: "Structured Table A", style: { headerBackground: "#888888" } },
      { target: "terminal", id: "terminal", name: "Terminal A", style: { outputColor: "#999999" } },
    ];
    const presentation = basePresentation(linkedStyles);
    const before = structuredClone(presentation.linkedStyles);
    await render(presentation);
    const categories = Array.from(host?.querySelectorAll<HTMLElement>("[data-linked-style-category]") ?? []);
    expect(categories.map((category) => category.dataset.linkedStyleCategory)).toEqual(["container", "topics", "code", "terminal", "table", "divider"]);
    expect(host?.querySelector("[data-linked-style-category='code']")?.textContent).toContain("Code · 3");
    expect(Array.from(host?.querySelectorAll("[data-linked-style-category='code'] [data-linked-style-id]") ?? []).map((row) => row.getAttribute("data-linked-style-id"))).toEqual(["code-z", "code-a", "code-m"]);
    expect(host?.querySelector("[data-linked-style-category='table']")?.textContent).toContain("Table · 4");
    expect(host?.querySelector("[data-linked-style-subcategory='simple']")?.textContent).toContain("Simple Table · 2");
    expect(host?.querySelector("[data-linked-style-subcategory='structured']")?.textContent).toContain("Structured Table · 2");
    expect(Array.from(host?.querySelectorAll("[data-linked-style-subcategory='simple'] [data-linked-style-id]") ?? []).map((row) => row.getAttribute("data-linked-style-id"))).toEqual(["simple-z", "simple-a"]);
    expect(Array.from(host?.querySelectorAll("[data-linked-style-subcategory='structured'] [data-linked-style-id]") ?? []).map((row) => row.getAttribute("data-linked-style-id"))).toEqual(["structured-z", "structured-a"]);
    const allIds = linkedStyles.map((style) => style.id);
    for (const id of allIds) expect(host?.querySelectorAll(`[data-linked-style-id='${id}']`)).toHaveLength(1);
    expect(host?.querySelectorAll("[data-linked-style-id]")).toHaveLength(linkedStyles.length);
    expect(host?.querySelector("[data-linked-style-target='code']")).not.toBeNull();
    expect(host?.querySelector("[data-linked-style-target='divider']")).not.toBeNull();
    expect(presentation.linkedStyles).toEqual(before);
  });

  it("hides empty top-level categories while retaining the current zero-count Table subgroup", async () => {
    await render(basePresentation([{ target: "table", mode: "simple", id: "simple", name: "Simple", style: { color: "#111111" } }]));
    expect(Array.from(host?.querySelectorAll<HTMLElement>("[data-linked-style-category]") ?? []).map((category) => category.dataset.linkedStyleCategory)).toEqual(["table"]);
    expect(host?.querySelector("[data-linked-style-subcategory='simple']")?.textContent).toContain("Simple Table · 1");
    expect(host?.querySelector("[data-linked-style-subcategory='structured']")?.textContent).toContain("Structured Table · 0");
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

  it.each([
    { label: "Container", value: "container", element: { id: "container", type: "container", hidden: false, children: [], layout: { children: { gap: 4 } } } },
    { label: "Topics", value: "topics", element: { id: "topics", type: "topics", hidden: false, kind: "unordered", items: [], itemGap: 4 } },
    { label: "Code", value: "code", element: { id: "code", type: "code", hidden: false, code: "x", language: "ts", style: { color: "#123456" } } },
    { label: "Terminal", value: "terminal", element: { id: "terminal", type: "terminal", hidden: false, lines: [{ type: "output", content: "ready" }], style: { outputColor: "#123456" } } },
    { label: "Simple Table", value: "table", element: { id: "simple", type: "table", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], style: { color: "#123456" } } },
    { label: "Simple Table", value: "table", element: { id: "simple-explicit", type: "table", mode: "simple", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], style: { color: "#123456" } } },
    { label: "Structured Table", value: "table", element: { id: "structured", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [], style: { headerBackground: "#123456" } } },
    { label: "Divider", value: "divider", element: { id: "divider", type: "divider", hidden: false, orientation: "horizontal", style: { background: { color: "#123456" } } } },
  ] as const)("infers the read-only $label type for Add to Linked Styles", async ({ label, element }) => {
    const selected = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [element] }] }).slides[0]!.elements[0]!;
    await render(basePresentation(), () => undefined, selected);
    const add = host?.querySelector<HTMLButtonElement>("[data-linked-style-actions] > button:last-child");
    expect(add?.disabled).toBe(false);
    await act(async () => add?.click());
    expect(host?.querySelector("select[aria-label='Element type']")).toBeNull();
    expect(host?.querySelector("[data-linked-style-inferred-type]")?.textContent).toBe(label);
  });

  it("submits a structurally different selected Table exactly once without type selection", async () => {
    const selected = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [{ id: "structured", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [], style: { headerBackground: "#123456" } }] }] }).slides[0]!.elements[0]!;
    const submitted: string[] = [];
    await render(basePresentation(), () => undefined, selected, (name) => submitted.push(name));
    const open = host?.querySelector<HTMLButtonElement>("[data-linked-style-actions] > button:last-child");
    expect(open?.disabled).toBe(false);
    await act(async () => open?.click());
    expect(host?.querySelector("select[aria-label='Element type']")).toBeNull();
    expect(host?.querySelector("[data-linked-style-inferred-type]")?.textContent).toBe("Structured Table");
    const name = host?.querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("selected-style name input was not rendered");
    await act(async () => setInputValue(name, "Structured Selected"));
    await act(async () => buttonWithText("Add to Linked Styles")?.click());
    expect(submitted).toEqual(["Structured Selected"]);
  });

  it.each([
    { value: "container", property: "Gap", request: { kind: "container", name: "Container dispatch", property: "gap" } },
    { value: "topics", property: "Topic spacing", request: { kind: "topics", name: "Topics dispatch", property: "itemGap" } },
    { value: "code", property: "Color", request: { kind: "code", name: "Code dispatch", property: "style.color" } },
    { value: "terminal", property: "Output", request: { kind: "terminal", name: "Terminal dispatch", property: "style.outputColor" } },
    { value: "table:simple", property: "Font size", request: { kind: "table", mode: "simple", name: "Simple dispatch", property: "typography.fontSize" } },
    { value: "table:structured", property: "Header background", request: { kind: "table", mode: "structured", name: "Structured dispatch", property: "style.headerBackground" } },
    { value: "divider", property: "Rounded corners", request: { kind: "divider", name: "Divider dispatch", property: "style.borderRadius" } },
  ] as const)("dispatches the $value creation chooser as its discriminated request", async ({ value, property, request }) => {
    const requests: LinkedStyleCreationRequest[] = [];
    await render(basePresentation(), (next) => requests.push(next));
    await act(async () => buttonWithText("+ Add Linked Style")?.click());
    const selector = host?.querySelector<HTMLSelectElement>("[aria-label='Element type']");
    if (!selector) throw new Error("creation type selector was not rendered");
    await act(async () => setSelectValue(selector, value));
    const name = host?.querySelector<HTMLInputElement>("input");
    if (!name) throw new Error("creation name input was not rendered");
    await act(async () => setInputValue(name, request.name));
    await act(async () => buttonWithText("Add first property")?.click());
    const propertyButton = buttonWithText(property);
    if (!propertyButton) throw new Error(`property ${property} was not rendered`);
    await act(async () => propertyButton.click());
    expect(requests).toEqual([request]);
  });
});
