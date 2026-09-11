// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EmbedElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { ElementInspector } from "../src/features/editor/element-inspector";
import type {
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fonts: readonly { id: string; family: string }[] = [];
const topics: TopicsAuthoringControls = { onAddTopLevelTopic: () => null, onAddChildTopic: () => null };
const tables: TableAuthoringControls = { onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} };

const ELEMENT_BASES = {
  text: { id: "text-1", type: "text", hidden: false, variant: "body", content: "Margin" },
  image: { id: "image-1", type: "image", hidden: false, src: "/image.png", alt: "", fit: "contain" },
  code: { id: "code-1", type: "code", hidden: false, code: "x", language: "text", showLineNumbers: true, highlightedLines: [] },
  terminal: { id: "terminal-1", type: "terminal", hidden: false, lines: [] },
  table: { id: "table-1", type: "table", hidden: false, columns: [], rows: [] },
  blocks: { id: "blocks-1", type: "blocks", hidden: false, source: "" },
  gallery: { id: "gallery-1", type: "gallery", hidden: false, items: [], fit: "contain" },
  embed: { id: "embed-1", type: "embed", hidden: false, src: "https://example.com/", title: "Embedded content" },
  scripted: { id: "scripted-1", type: "scripted", hidden: false, title: "Scripted content", html: "", css: "", script: "", ports: [] },
  plot: { id: "plot-1", type: "plot", hidden: false, source: "" },
} satisfies Record<string, PowerShowElement>;

const SPACING_CASES = [
  ["text", ELEMENT_BASES.text],
  ["image", ELEMENT_BASES.image],
  ["code", ELEMENT_BASES.code],
  ["terminal", ELEMENT_BASES.terminal],
  ["table", ELEMENT_BASES.table],
  ["blocks", ELEMENT_BASES.blocks],
  ["gallery", ELEMENT_BASES.gallery],
  ["embed", ELEMENT_BASES.embed],
  ["scripted", ELEMENT_BASES.scripted],
  ["plot", ELEMENT_BASES.plot],
] as const;

const MARGIN_LAYOUT = {
  margin: 12,
  marginTop: 1,
  marginRight: 2,
  marginBottom: 3,
  marginLeft: 4,
} as const;

describe("shared element spacing section", () => {
  let container: HTMLDivElement;
  let root: Root;

  async function renderElement(initial: PowerShowElement) {
    let element: PowerShowElement = initial;
    const renderInspector = () => root.render(
      <StudioI18nProvider>
        <ElementInspector
          element={element}
          onUpdate={(update) => { element = update(element); renderInspector(); }}
          onContainerFitModeChange={() => true}
          fontResources={fonts}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditingImageId={null}
          onFocalEditingImageIdChange={() => {}}
          cropEditingImageId={null}
          onCropEditingImageIdChange={() => {}}
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

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function marginInput(prefix: string, field: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(`#${prefix}-margin${field}`);
    if (!input) throw new Error(`margin input #${prefix}-margin${field} not found`);
    return input;
  }

  function changeInput(input: HTMLInputElement, value: string): void {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sectionTitleOf(input: HTMLInputElement): string {
    const title = input.closest("details")?.querySelector("summary")?.textContent?.trim();
    if (!title) throw new Error("section title not found");
    return title;
  }

  function summaries(): string[] {
    return Array.from(container.querySelectorAll("summary")).map((s) => s.textContent.trim());
  }

  it.each(SPACING_CASES)(
    "exposes margin inside a SPACING section for %s and hydrates the existing layout",
    async (prefix, base) => {
      await renderElement({
        ...base,
        layout: { ...MARGIN_LAYOUT },
      });

      const main = marginInput(prefix, "");
      expect(sectionTitleOf(main)).toBe("Spacing");
      expect(main.value).toBe("12");
      expect(marginInput(prefix, "-top").value).toBe("1");
      expect(marginInput(prefix, "-right").value).toBe("2");
      expect(marginInput(prefix, "-bottom").value).toBe("3");
      expect(marginInput(prefix, "-left").value).toBe("4");

      // The standalone MARGIN section is gone; the outer title is SPACING.
      expect(summaries()).not.toContain("Margin");
    },
  );

  it("writing the all-sides margin persists the canonical layout.margin", async () => {
    const { element } = await renderElement({
      ...ELEMENT_BASES.image,
      layout: { width: "50%", position: "absolute", margin: 4 },
    });

    await act(async () => changeInput(marginInput("image", ""), "16"));

    expect(element()).toMatchObject({
      layout: { width: "50%", position: "absolute", margin: 16 },
    });
    expect(element()).not.toHaveProperty("alignSelf");
  });

  it("writing a per-side margin preserves unrelated layout and other margins", async () => {
    const { element } = await renderElement({
      ...ELEMENT_BASES.terminal,
      layout: { width: 300, margin: 8 },
    });

    await act(async () => changeInput(marginInput("terminal", "-top"), "24"));

    expect(element()).toMatchObject({
      layout: { width: 300, margin: 8, marginTop: 24 },
    });
  });

  it("clearing an authored margin prunes it from the canonical layout", async () => {
    const { element } = await renderElement({
      ...ELEMENT_BASES.code,
      layout: { margin: 6 },
    });

    await act(async () => changeInput(marginInput("code", ""), ""));

    expect((element() as { layout?: unknown }).layout).toBeUndefined();
  });

  it.each([
    ["image", ELEMENT_BASES.image],
    ["plot", ELEMENT_BASES.plot],
    ["embed", ELEMENT_BASES.embed],
  ] as const)(
    "orders Size before Spacing before Appearance for %s",
    async (_type, base) => {
      await renderElement(base);

      const order = summaries();
      const size = order.indexOf("Size");
      const spacing = order.indexOf("Spacing");
      const appearance = order.indexOf("Appearance");

      expect(size).toBeGreaterThanOrEqual(0);
      expect(spacing).toBeGreaterThan(size);
      expect(appearance).toBeGreaterThan(spacing);
    },
  );
});

describe("shared Embed size and viewport authoring", () => {
  let container: HTMLDivElement;
  let root: Root;

  async function renderElement(initial: EmbedElement) {
    let element: EmbedElement = initial;
    const renderInspector = () => root.render(
      <StudioI18nProvider>
        <ElementInspector
          element={element}
          onUpdate={(update) => {
            const next = update(element);
            if (next.type === "embed") {
              element = next;
              renderInspector();
            }
          }}
          onContainerFitModeChange={() => true}
          fontResources={fonts}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditingImageId={null}
          onFocalEditingImageIdChange={() => {}}
          cropEditingImageId={null}
          onCropEditingImageIdChange={() => {}}
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

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function sizeInput(id: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`size input #${id} not found`);
    return input;
  }

  it("keeps Embed Size and Spacing as separate sections next to the viewport", async () => {
    await renderElement({
      ...ELEMENT_BASES.embed,
      layout: { width: "70%", height: 240 },
      viewport: { zoom: 0.75 },
    });

    expect(sizeInput("element-width").value).toBe("70");
    expect(sizeInput("element-height").value).toBe("240");

    const sizeTitle = sizeInput("element-width").closest("details")?.querySelector("summary")?.textContent?.trim();
    const spacingTitle = container.querySelector<HTMLInputElement>("#embed-margin")!.closest("details")?.querySelector("summary")?.textContent?.trim();
    expect(sizeTitle).toBe("Size");
    expect(spacingTitle).toBe("Spacing");
    expect(sizeInput("element-width").closest("details")).not.toBe(
      container.querySelector<HTMLInputElement>("#embed-margin")!.closest("details"),
    );

    // The Embed viewport section remains present and separate.
    expect(container.querySelector<HTMLInputElement>("#embed-viewport-zoom")).not.toBeNull();
  });

  it("persists Embed size changes canonically and leaves the viewport intact", async () => {
    const { element } = await renderElement({
      ...ELEMENT_BASES.embed,
      layout: { width: "70%" },
      viewport: { zoom: 1.25, top: 30, left: 40 },
    });

    const width = sizeInput("element-width");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(width, "80");
      width.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const hydrated = element();
    expect(hydrated.layout).toMatchObject({ width: "80%" });
    expect(hydrated.viewport).toEqual({ zoom: 1.25, top: 30, left: 40 });
  });
});