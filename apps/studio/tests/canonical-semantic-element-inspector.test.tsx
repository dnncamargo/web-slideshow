// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlotElement, InteractiveElement, PresentationElement, ShapeElement, StructuredTableElement } from "@web-slideshow/document-schema";
import { ElementInspector } from "../src/features/editor/element-inspector";
import type { TableAuthoringControls, TopicsAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fonts: readonly { id: string; family: string }[] = [];
const topics: TopicsAuthoringControls = { onAddTopLevelTopic: () => null, onAddChildTopic: () => null };
const tables: TableAuthoringControls = { onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} };

const interactiveElement: InteractiveElement = { id: "interactive-1", type: "interactive", hidden: false, widget: "function-plot", config: {} };

describe("canonical semantic element inspector", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  async function renderElement(initial: PlotElement | InteractiveElement | ShapeElement) {
    let element: PresentationElement = initial;
    const renderInspector = () => root.render(
      <StudioI18nProvider>
        <ElementInspector
          element={element}
          onUpdate={(update) => { element = update(element); renderInspector(); }}
          fontResources={fonts}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditingImageId={null}
          onFocalEditingImageIdChange={() => {}}
          parent={null}
          layerControls={{ index: 0, count: 1, onMoveTo: () => {} }}
          topicsAuthoringControls={topics}
          tableAuthoringControls={tables}
        />
      </StudioI18nProvider>,
    );
    await act(async () => renderInspector());

    return { element: () => element };
  }

  it("Plot uses its source Inspector and only canonical positioning", async () => {
    const { element } = await renderElement({ id: "plot-1", type: "plot", hidden: false, source: "" });

    expect(container.textContent).not.toContain("Specific editing controls will be added");
    expect(container.querySelector("#plot-source")).not.toBeNull();
    expect(container.querySelector("#element-canonical-position-mode")).not.toBeNull();
    expect(container.querySelector("#element-placement-mode")).toBeNull();
    expect(element()).not.toHaveProperty("style");

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
      mode.value = "absolute";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(element()).toHaveProperty("layout.position", "absolute");

    await act(async () => {
      const left = container.querySelector<HTMLInputElement>("#element-canonical-left")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(left, "24");
      left.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(element()).toHaveProperty("layout.left", 24);
    expect(element()).not.toHaveProperty("style");
  });

  it("forwards shared Table structural selection through the dispatcher", async () => {
    const table: StructuredTableElement = {
      id: "table-1",
      type: "table",
      mode: "structured",
      hidden: false,
      showHeader: true,
      columns: [
        { id: "column-1", header: { id: "header-1", children: [] } },
        { id: "column-2", header: { id: "header-2", children: [] } },
      ],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }, { id: "cell-2", children: [] }] }],
    };
    let selection: { kind: "column"; tableId: string; id: string } | null = null;

    await act(async () => root.render(
      <StudioI18nProvider>
        <ElementInspector
          element={table}
          onUpdate={() => {}}
          fontResources={fonts}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditingImageId={null}
          onFocalEditingImageIdChange={() => {}}
          parent={null}
          layerControls={{ index: 0, count: 1, onMoveTo: () => {}}}
          topicsAuthoringControls={topics}
          tableAuthoringControls={tables}
          onSelectTableStructuralNode={(next) => {
            if (next?.kind === "column") selection = next;
          }}
        />
      </StudioI18nProvider>,
    ));

    const button = container.querySelector<HTMLButtonElement>('[aria-label="Column 2"]');
    expect(button).not.toBeNull();
    await act(async () => button?.click());
    expect(selection).toEqual({ kind: "column", tableId: "table-1", id: "column-2" });
  });

  it("authors Plot size independently and preserves it across Flow and Absolute", async () => {
    const { element } = await renderElement({
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "",
      layout: { width: "60%", height: 360, position: "absolute", top: 20, left: 30 },
    });

    expect(container.textContent).toContain("Size");
    expect(container.textContent).toContain("Width");
    expect(container.textContent).toContain("Height");
    expect(container.querySelector<HTMLInputElement>("#element-width")?.value).toBe("60");
    expect(container.querySelector<HTMLSelectElement>("#element-width-unit")?.value).toBe("%");
    expect(container.querySelector<HTMLInputElement>("#element-height")?.value).toBe("360");
    expect(container.querySelector<HTMLSelectElement>("#element-height-unit")?.value).toBe("px");

    await act(async () => {
      const width = container.querySelector<HTMLInputElement>("#element-width")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(width, "70");
      width.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(element()).toMatchObject({
      layout: { width: "70%", height: 360, position: "absolute", top: 20, left: 30 },
    });

    await act(async () => {
      const height = container.querySelector<HTMLInputElement>("#element-height")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(height, "250");
      height.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(element()).toMatchObject({
      layout: { width: "70%", height: 250, position: "absolute", top: 20, left: 30 },
    });

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
      mode.value = "flow";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(element()).toMatchObject({ layout: { width: "70%", height: 250 } });
    expect(element()).not.toHaveProperty("layout.position");
    expect(element()).not.toHaveProperty("layout.top");
    expect(element()).not.toHaveProperty("layout.left");

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
      mode.value = "absolute";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(element()).toMatchObject({ layout: { width: "70%", height: 250, position: "absolute" } });

    await act(async () => {
      const widthReset = container.querySelector("#element-width")?.closest("label")?.querySelector("button");
      (widthReset as HTMLButtonElement).click();
    });
    expect(element()).toMatchObject({ layout: { height: 250, position: "absolute" } });
    expect(element()).not.toHaveProperty("layout.width");

    await act(async () => {
      const heightReset = container.querySelector("#element-height")?.closest("label")?.querySelector("button");
      (heightReset as HTMLButtonElement).click();
    });
    expect(element()).toHaveProperty("layout", { position: "absolute" });
  });

  it("authors Shape geometry presets, structural values, size, and placement", async () => {
    const { element } = await renderElement({
      id: "shape-1",
      type: "shape",
      hidden: false,
      geometry: { mode: "generated", generator: "triangle", config: { apexX: 50 } },
      layout: { width: 240, height: 160 },
      style: { fill: { type: "color", color: "#22d3ee" } },
    });

    expect(container.querySelector("#shape-geometry-preset")).not.toBeNull();
    expect(container.querySelector("#shape-apex-x")).not.toBeNull();
    expect(container.querySelector("#element-width")).not.toBeNull();
    expect(container.querySelector("#element-canonical-position-mode")).not.toBeNull();

    await act(async () => {
      const preset = container.querySelector<HTMLSelectElement>("#shape-geometry-preset")!;
      preset.value = "star";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(element()).toMatchObject({ geometry: { mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 0.45 } } });
    expect(element()).toMatchObject({ id: "shape-1", layout: { width: 240, height: 160 }, style: { fill: { color: "#22d3ee" } } });

    await act(async () => {
      const preset = container.querySelector<HTMLSelectElement>("#shape-geometry-preset")!;
      preset.value = "polygon";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
      const points = container.querySelector<HTMLInputElement>("#shape-polygon-points")!;
      points.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(points, "8");
      points.dispatchEvent(new Event("input", { bubbles: true }));
      points.dispatchEvent(new Event("focusout", { bubbles: true }));
    });
    expect(element()).toHaveProperty("geometry.config.points", 8);

    await act(async () => {
      const points = container.querySelector<HTMLInputElement>("#shape-polygon-points")!;
      points.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(points, "2");
      points.dispatchEvent(new Event("input", { bubbles: true }));
      points.dispatchEvent(new Event("focusout", { bubbles: true }));
    });
    expect(element()).toHaveProperty("geometry.config.points", 8);

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
      mode.value = "absolute";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
      const left = container.querySelector<HTMLInputElement>("#element-canonical-left")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(left, "24");
      left.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(element()).toHaveProperty("layout.left", 24);
  });

  it("shows existing QR Shape geometry without exposing QR editing", async () => {
    await renderElement({
      id: "shape-qr",
      type: "shape",
      hidden: false,
      geometry: { mode: "generated", generator: "qr-code", config: { value: "https://example.com", errorCorrection: "M", quietZone: 4 } },
    });

    const preset = container.querySelector<HTMLSelectElement>("#shape-geometry-preset");
    expect(preset?.value).toBe("qr-code");
    expect(preset?.disabled).toBe(true);
    expect(container.querySelector("#shape-polygon-points")).toBeNull();
    expect(container.textContent).toContain("QR Code");
  });

  it("Interactive remains unsupported and uses only canonical positioning", async () => {
    const { element } = await renderElement(interactiveElement);

    expect(container.textContent).toContain("Specific editing controls will be added");
    expect(container.querySelector("#element-canonical-position-mode")).not.toBeNull();
    expect(container.querySelector("#element-placement-mode")).toBeNull();
    expect(element()).not.toHaveProperty("style");

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
      mode.value = "absolute";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(element()).toHaveProperty("layout.position", "absolute");

    await act(async () => {
      const left = container.querySelector<HTMLInputElement>("#element-canonical-left")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(left, "24");
      left.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(element()).toHaveProperty("layout.left", 24);
    expect(element()).not.toHaveProperty("style");
  });
});
