// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChartElement, InteractiveElement, PowerShowElement } from "@powershow/document-schema";
import { ElementInspector } from "../src/features/editor/element-inspector";
import type { BlocksAuthoringControls, FontResourceControls, TableAuthoringControls, TopicsAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fonts: FontResourceControls = { fontResources: [], onAddFontFace: vi.fn(), onRemoveFontFace: vi.fn(), isFontFamilyInUse: () => false };
const topics: TopicsAuthoringControls = { onAddTopLevelTopic: () => null, onAddChildTopic: () => null };
const blocks: BlocksAuthoringControls = { onAddRootBlock: () => null, onAddScopeChild: () => null, onAddTextPart: () => null, onAddSocketPart: () => null, onCreateSocketValue: () => null };
const tables: TableAuthoringControls = { onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} };

const elements: readonly [string, ChartElement | InteractiveElement][] = [
  ["Chart", { id: "chart-1", type: "chart", hidden: false, chartType: "line", series: [] }],
  ["Interactive", { id: "interactive-1", type: "interactive", hidden: false, widget: "function-plot", config: {} }],
];

describe("canonical semantic element inspector", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  it.each(elements)("%s uses only canonical positioning", async (_name, initial) => {
    let element: PowerShowElement = initial;
    const renderInspector = () => root.render(
      <StudioI18nProvider>
        <ElementInspector
          element={element}
          onUpdate={(update) => { element = update(element); renderInspector(); }}
          fontResourceControls={fonts}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditingImageId={null}
          onFocalEditingImageIdChange={() => {}}
          parent={null}
          layerControls={{ index: 0, count: 1, onMoveTo: () => {} }}
          topicsAuthoringControls={topics}
          blocksAuthoringControls={blocks}
          tableAuthoringControls={tables}
        />
      </StudioI18nProvider>,
    );
    await act(async () => renderInspector());

    expect(container.textContent).toContain("Specific editing controls will be added");
    expect(container.querySelector("#element-canonical-position-mode")).not.toBeNull();
    expect(container.querySelector("#element-placement-mode")).toBeNull();
    expect(element).not.toHaveProperty("style");

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")!;
      mode.value = "absolute";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(element).toHaveProperty("layout.position", "absolute");

    await act(async () => {
      const left = container.querySelector<HTMLInputElement>("#element-canonical-left")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(left, "24");
      left.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(element).toHaveProperty("layout.left", 24);
    expect(element).not.toHaveProperty("style");
  });
});
