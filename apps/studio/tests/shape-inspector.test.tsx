// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type ShapeElement } from "@web-slideshow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { ElementInspector } from "../src/features/editor/element-inspector";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { ShapeInspector } from "../src/features/editor/inspector/shape-inspector";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import { createShapeGeometry } from "../src/features/editor/shape-geometry-authoring";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const RECTANGLE_GEOMETRY: ShapeElement["geometry"] = {
  mode: "path",
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  commands: [
    { type: "move", x: 0, y: 0 },
    { type: "line", x: 100, y: 0 },
    { type: "line", x: 100, y: 100 },
    { type: "line", x: 0, y: 100 },
    { type: "close" },
  ],
};

const SH6E_ACCEPTANCE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 124 124" fill="none">
<rect width="124" height="124" rx="24" fill="#F97316"/>
<path d="M19.375 36.7818V100.625C19.375 102.834 21.1659 104.625 23.375 104.625H87.2181C90.7818 104.625 92.5664 100.316 90.0466 97.7966L26.2034 33.9534C23.6836 31.4336 19.375 33.2182 19.375 36.7818Z" fill="white"/>
<circle cx="63.2109" cy="37.5391" r="18.1641" fill="black"/>
<rect opacity="0.4" x="81.1328" y="80.7198" width="17.5687" height="17.3876" rx="4" transform="rotate(-45 81.1328 80.7198)" fill="#FDBA74"/>
</svg>`;

function shapeElement(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: "shape-1",
    type: "shape",
    hidden: false,
    geometry: RECTANGLE_GEOMETRY,
    layout: { width: 240, height: 160 },
    style: { fill: { type: "color", color: "#22d3ee" } },
    ...overrides,
  };
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("expected native value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function historyPresentation(shapeOverrides: Partial<ShapeElement> = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "shape-history",
    title: "Shape history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [shapeElement({ id: "shape-history-1", ...shapeOverrides })],
    }],
  });
}

function qrHistoryPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "qr-shape-history",
    title: "QR Shape history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [shapeElement({
        id: "qr-history-1",
        geometry: { mode: "generated", generator: "qr-code", config: { value: "A", errorCorrection: "M", quietZone: 4 } },
      })],
    }],
  });
}

describe("ShapeInspector appearance, effects, and interaction", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: ShapeElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial: ShapeElement = shapeElement()): Promise<void> {
    state = initial;
    const render = () => root.render(
      <StudioI18nProvider>
        <PresentationColorPaletteProvider colors={[{ id: "brand", name: "Brand", value: "#123456" }]}>
          <ShapeInspector
            element={state}
            onUpdate={(update) => {
              const next = update(state);
              if (next.type !== "shape") throw new Error("expected Shape update");
              state = next;
              render();
            }}
          />
        </PresentationColorPaletteProvider>
      </StudioI18nProvider>,
    );
    await act(async () => render());
  }

  async function mountInElementInspector(initial: ShapeElement = shapeElement()): Promise<void> {
    state = initial;
    const render = () => root.render(
      <StudioI18nProvider>
        <PresentationColorPaletteProvider colors={[{ id: "brand", name: "Brand", value: "#123456" }]}>
          <ElementInspector
            element={state}
            onUpdate={(update) => {
              const next = update(state);
              if (next.type !== "shape") throw new Error("expected Shape update");
              state = next;
              render();
            }}
            onContainerFitModeChange={() => true}
            fontResources={[]}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={{ index: 0, count: 1, onMoveTo: () => {} }}
            topicsAuthoringControls={{ onAddTopLevelTopic: () => null, onAddChildTopic: () => null }}
            tableAuthoringControls={{ onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} }}
          />
        </PresentationColorPaletteProvider>
      </StudioI18nProvider>,
    );
    await act(async () => render());
  }

  function select(id: string): HTMLSelectElement {
    const control = host.querySelector<HTMLSelectElement>(`#${id}`);
    if (!control) throw new Error(`select ${id} was not rendered`);
    return control;
  }

  function input(id: string): HTMLInputElement {
    const control = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!control) throw new Error(`input ${id} was not rendered`);
    return control;
  }

  function textArea(id: string): HTMLTextAreaElement {
    const control = host.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (!control) throw new Error(`textarea ${id} was not rendered`);
    return control;
  }

  it("supports None, preserves stroke, and keeps geometry/layout unchanged", async () => {
    await mount({
      ...shapeElement(),
      style: {
        fill: { type: "color", color: "#22d3ee" },
        stroke: { width: 2, style: "solid", color: "#111111" },
      },
    });

    await act(async () => changeSelect(select("shape-fill-type"), "none"));

    expect(state.style).toEqual({ stroke: { width: 2, style: "solid", color: "#111111" } });
    expect(state.geometry).toBe(RECTANGLE_GEOMETRY);
    expect(state.layout).toEqual({ width: 240, height: 160 });
  });

  it("creates canonical Color and preserves palette references", async () => {
    await mount(shapeElement({ style: undefined }));

    await act(async () => changeSelect(select("shape-fill-type"), "color"));
    expect(state.style?.fill).toEqual({ type: "color", color: "#22d3ee" });

    await act(async () => {
      const paletteButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.includes("Use palette"));
      if (!paletteButton) throw new Error(`palette disclosure missing: ${host.textContent}`);
      paletteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      const paletteSwatch = host.querySelector<HTMLButtonElement>("#shape-fill-color-palette-chooser [aria-label=\"Apply palette color Brand\"]");
      if (!paletteSwatch) throw new Error(`palette chooser missing: ${host.innerHTML}`);
      paletteSwatch.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(state.style?.fill).toEqual({ type: "color", color: { kind: "palette", colorId: "brand" } });
  });

  it("creates and edits a canonical gradient without replacing other Shape properties", async () => {
    await mount(shapeElement({ style: { stroke: { width: 3, style: "solid", color: "#abcdef" } } }));

    await act(async () => changeSelect(select("shape-fill-type"), "gradient"));
    expect(state.style?.fill?.type).toBe("gradient");
    expect(state.style?.stroke).toEqual({ width: 3, style: "solid", color: "#abcdef" });

    await act(async () => setInputValue(input("shape-fill-gradient-angle"), "90"));
    expect(state.style?.fill).toMatchObject({ type: "gradient", gradient: { type: "linear", angle: 90 } });
  });

  it("authors image fill source, fit, crop, and focal point without canvas editing", async () => {
    await mount();

    await act(async () => changeSelect(select("shape-fill-type"), "image"));
    expect(state.style?.fill).toEqual({ type: "image", src: "/instance-demo.svg", fit: "contain" });

    await act(async () => setInputValue(textArea("shape-fill-source"), "/shape.png"));
    expect(state.style?.fill).toMatchObject({ type: "image", src: "/shape.png" });

    await act(async () => {
      setInputValue(textArea("shape-fill-source"), "");
      textArea("shape-fill-source").dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(state.style?.fill).toMatchObject({ type: "image", src: "/shape.png" });
    expect(textArea("shape-fill-source").value).toBe("/shape.png");

    await act(async () => changeSelect(select("shape-fill-fit"), "cover"));
    expect(state.style?.fill).toMatchObject({ type: "image", fit: "cover" });

    await act(async () => setInputValue(input("shape-fill-crop-x"), "10"));
    await act(async () => setInputValue(input("shape-fill-focal-x"), "25"));
    expect(state.style?.fill).toMatchObject({
      type: "image",
      crop: { x: 10 },
      focalPoint: { x: 25, y: 50 },
    });
    expect(host.textContent).not.toContain("Edit crop on canvas");
    expect(host.textContent).not.toContain("Edit focal point on canvas");
  });

  it("uses canonical Border and keeps fill when stroke is removed", async () => {
    await mount();

    await act(async () => changeSelect(select("shape-border-style"), "solid"));
    expect(state.style?.stroke).toMatchObject({ width: 1, style: "solid" });
    expect(state.style?.fill).toEqual({ type: "color", color: "#22d3ee" });

    await act(async () => changeSelect(select("shape-border-paint"), "gradient"));
    expect(state.style?.stroke?.gradient).toBeDefined();
    expect(state.style?.stroke?.color).toBeUndefined();

    await act(async () => changeSelect(select("shape-border-style"), "none"));
    expect(state.style?.stroke).toBeUndefined();
    expect(state.style?.fill).toEqual({ type: "color", color: "#22d3ee" });
  });

  it("authors opacity and shadow through canonical effects", async () => {
    await mount();

    await act(async () => setInputValue(input("shape-opacity"), "60"));
    expect(state.effect?.opacity).toBe(0.6);

    await act(async () => changeSelect(select("shape-shadow-mode"), "outer"));
    expect(state.effect?.shadow).toMatchObject({ x: 0, y: 4, blur: 12, color: "#000000" });

    await act(async () => setInputValue(input("shape-shadow-x"), "8"));
    expect(state.effect?.shadow?.x).toBe(8);

    await act(async () => changeSelect(select("shape-shadow-mode"), "none"));
    expect(state.effect).toEqual({ opacity: 0.6 });
  });

  it("supports canonical links but does not expose QR creation", async () => {
    await mountInElementInspector();
    const url = host.querySelector<HTMLInputElement>("#shape-link-url");
    if (!url) throw new Error("Shape URL input was not rendered");

    await act(async () => setInputValue(url, "https://example.com/shape"));
    await act(async () => url.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));

    expect(state.link).toEqual({ kind: "url", href: "https://example.com/shape" });
    expect(Array.from(host.querySelectorAll("button")).some((button) => button.textContent?.includes("Create QR code"))).toBe(false);

    await act(async () => setInputValue(url, "javascript:alert(1)"));
    await act(async () => url.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(state.link).toEqual({ kind: "url", href: "https://example.com/shape" });
  });

  it("edits an existing QR Shape without changing its geometry", async () => {
    const qrGeometry = { mode: "generated", generator: "qr-code", config: { value: "https://example.com", errorCorrection: "M", quietZone: 4 } } as const;
    const initial = shapeElement({
      geometry: qrGeometry,
      style: { fill: { type: "color", color: "#123456" } },
      effect: { opacity: 0.8 },
      link: { kind: "url", href: "https://example.com/qr", target: "_blank" },
    });
    await mount(initial);

    expect(input("shape-qr-content").value).toBe("https://example.com");
    expect(select("shape-qr-error-correction").value).toBe("M");
    expect(input("shape-qr-quiet-zone").value).toBe("4");

    await act(async () => {
      const content = input("shape-qr-content");
      setInputValue(content, "plain text QR content");
      content.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(state.geometry).toMatchObject({ config: { value: "plain text QR content" } });

    await act(async () => {
      const content = input("shape-qr-content");
      setInputValue(content, "");
      content.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(state.geometry).toMatchObject({ config: { value: "plain text QR content" } });

    await act(async () => changeSelect(select("shape-qr-error-correction"), "H"));
    expect(state.geometry).toMatchObject({ config: { errorCorrection: "H" } });

    await act(async () => {
      const quietZone = input("shape-qr-quiet-zone");
      setInputValue(quietZone, "2");
      quietZone.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(state.geometry).toMatchObject({ config: { quietZone: 2 } });

    await act(async () => {
      const quietZone = input("shape-qr-quiet-zone");
      setInputValue(quietZone, "-1.5");
      quietZone.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(state.geometry).toMatchObject({ config: { quietZone: 2 } });

    await act(async () => changeSelect(select("shape-fill-type"), "color"));

    expect(state.geometry).not.toBe(qrGeometry);
    expect(state.style?.fill).toEqual({ type: "color", color: "#123456" });
    expect(state.layout).toEqual(initial.layout);
    expect(state.effect).toEqual(initial.effect);
    expect(state.link).toEqual(initial.link);
  });

  it("uses native number controls for Shape geometry and animation drafts", async () => {
    await mount(shapeElement({
      geometry: { mode: "generated", generator: "triangle", config: { apexX: 50 } },
    }));

    expect(input("shape-apex-x").type).toBe("number");
    expect(input("shape-apex-x").min).toBe("0");
    expect(input("shape-apex-x").max).toBe("100");
    expect(input("shape-apex-x").step).toBe("1");

    await mount(shapeElement({
      geometry: { mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 0.45, rotationDeg: 15 } },
    }));
    expect(input("shape-polygon-points").type).toBe("number");
    expect(input("shape-polygon-points").min).toBe("3");
    expect(input("shape-polygon-points").max).toBe("12");
    expect(input("shape-polygon-points").step).toBe("1");
    expect(input("shape-polygon-inner-radius").type).toBe("number");
    expect(input("shape-polygon-inner-radius").min).toBe("1");
    expect(input("shape-polygon-inner-radius").max).toBe("100");
    expect(input("shape-polygon-inner-radius").step).toBe("1");
    expect(input("shape-polygon-rotation").type).toBe("number");
    expect(input("shape-polygon-rotation").step).toBe("1");

    await mount(shapeElement({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "A", errorCorrection: "M", quietZone: 4 } },
    }));
    expect(input("shape-qr-quiet-zone").type).toBe("number");
    expect(input("shape-qr-quiet-zone").min).toBe("0");
    expect(input("shape-qr-quiet-zone").step).toBe("1");

    await act(async () => input("shape-animation-enabled").click());
    await act(async () => input("shape-animation-rotate-enabled").click());
    await act(async () => input("shape-animation-translate-enabled").click());
    await act(async () => input("shape-animation-skew-enabled").click());

    for (const id of [
      "shape-animation-rotate-from",
      "shape-animation-rotate-to",
      "shape-animation-translate-from-x",
      "shape-animation-translate-from-y",
      "shape-animation-translate-to-x",
      "shape-animation-translate-to-y",
      "shape-animation-skew-from-x",
      "shape-animation-skew-from-y",
      "shape-animation-skew-to-x",
      "shape-animation-skew-to-y",
    ]) {
      expect(input(id).type).toBe("number");
      expect(input(id).step).toBe("1");
    }
    expect(input("shape-animation-duration").type).toBe("number");
    expect(input("shape-animation-duration").min).toBe("1");
    expect(input("shape-animation-duration").step).toBe("1");

    expect(input("shape-transform-translate-x").type).toBe("number");
    expect(input("shape-transform-translate-y").type).toBe("number");
    expect(input("shape-transform-rotation").type).toBe("number");
  });

  it("applies authored transform sparsely and supports rounded-corner length input", async () => {
    await mount(shapeElement({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "A", errorCorrection: "M", quietZone: 4 } },
      style: { fill: { type: "color", color: "#22d3ee" }, stroke: { width: 2, style: "solid", color: "#123456" } },
    }));

    await act(async () => {
      setInputValue(input("shape-transform-translate-x"), "12");
      setInputValue(input("shape-transform-translate-y"), "-4");
      setInputValue(input("shape-transform-rotation"), "30");
      host.querySelector<HTMLButtonElement>("#shape-transform-apply")?.click();
    });
    expect(state.transform).toEqual({ translateXPercent: 12, translateYPercent: -4, rotationDeg: 30 });

    await act(async () => setInputValue(input("shape-border-radius"), "12"));
    expect(state.style?.borderRadius).toBe(12);
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#shape-border-radius-unit")!, "rem"));
    expect(state.style?.borderRadius).toBe("0.75rem");

    await act(async () => {
      const reset = host.querySelector<HTMLButtonElement>("#shape-border-radius")?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
      reset?.click();
    });
    expect(state.style?.borderRadius).toBeUndefined();
    expect(state.style?.stroke).toEqual({ width: 2, style: "solid", color: "#123456" });
  });

  it("shows rounded corners only for QR geometry and keeps Border for every Shape", async () => {
    const nonQrGeometries: ShapeElement["geometry"][] = [
      RECTANGLE_GEOMETRY,
      createShapeGeometry("ellipse"),
      {
        mode: "path",
        viewBox: { x: 0, y: 0, width: 100, height: 100 },
        commands: [
          { type: "move", x: 100, y: 50 },
          { type: "arc", radiusX: 50, radiusY: 50, rotationDeg: 0, largeArc: false, sweep: true, x: 0, y: 50 },
          { type: "arc", radiusX: 50, radiusY: 50, rotationDeg: 0, largeArc: false, sweep: true, x: 100, y: 50 },
          { type: "close" },
        ],
      },
      { mode: "generated", generator: "triangle", config: { apexX: 50 } },
      { mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 1 } },
      { mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 0.45 } },
      {
        mode: "path",
        viewBox: { x: 0, y: 0, width: 100, height: 100 },
        commands: [{ type: "move", x: 10, y: 10 }, { type: "line", x: 90, y: 10 }, { type: "close" }],
      },
    ];

    for (const geometry of nonQrGeometries) {
      await mount(shapeElement({ geometry, style: { stroke: { width: 1, style: "solid", color: "#111111" } } }));
      expect(host.querySelector("#shape-border-radius")).toBeNull();
      expect(host.querySelector("#shape-border-style")).not.toBeNull();
    }

    await mount(shapeElement({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "A", errorCorrection: "M", quietZone: 4 } },
      style: { stroke: { width: 1, style: "solid", color: "#111111" }, borderRadius: 8 },
    }));
    expect(host.querySelector("#shape-border-radius")).not.toBeNull();
    expect(host.querySelector("#shape-border-style")).not.toBeNull();
    expect(input("shape-border-radius").value).toBe("8");
  });

  it("edits Path geometry through a draft and keeps invalid Apply non-mutating", async () => {
    await mount();

    expect(select("shape-geometry-preset").value).toBe("rectangle");
    expect(textArea("shape-path-source").value).toBe("M 0 0 L 100 0 L 100 100 L 0 100 Z");

    await act(async () => {
      setInputValue(textArea("shape-path-source"), "m 10 10 h 80 v 80 h -80 z");
      setInputValue(input("shape-path-viewbox-width"), "120");
      changeSelect(select("shape-path-fill-rule"), "evenodd");
    });
    expect(state.geometry).toEqual(RECTANGLE_GEOMETRY);

    await act(async () => host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click());
    expect(state.geometry).toEqual({
      mode: "path",
      viewBox: { x: 0, y: 0, width: 120, height: 100 },
      commands: [
        { type: "move", x: 10, y: 10 },
        { type: "line", x: 90, y: 10 },
        { type: "line", x: 90, y: 90 },
        { type: "line", x: 10, y: 90 },
        { type: "close" },
      ],
      fillRule: "evenodd",
    });
    expect(select("shape-geometry-preset").value).toBe("custom");

    const appliedGeometry = state.geometry;
    await act(async () => {
      setInputValue(textArea("shape-path-source"), "<svg>");
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    expect(state.geometry).toBe(appliedGeometry);
    expect(host.textContent).toContain("SVG");

    await act(async () => {
      setInputValue(textArea("shape-path-source"), `<svg viewBox="0 0 200 100" fill-rule="evenodd"><g><path d="M 0 0 L 100 0 L 100 100 Z" /></g></svg>`);
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    expect(state.geometry).toMatchObject({
      viewBox: { x: 0, y: 0, width: 200, height: 100 },
      fillRule: "evenodd",
    });
    expect(state.geometry.mode === "path" ? state.geometry.commands[0] : undefined).toEqual({ type: "move", x: 0, y: 0 });

    await act(async () => {
      setInputValue(textArea("shape-path-source"), "M 1 1");
      host.querySelector<HTMLButtonElement>("#shape-path-reset")?.click();
    });
    expect(textArea("shape-path-source").value).toBe("M 0 0 L 100 0 L 100 100 Z");
  });

  it("records one history action for Path Apply and restores it with undo", async () => {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={historyPresentation()} />
      </StudioI18nProvider>,
    ));

    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="shape-history-1"]');
    if (!canvasShape) throw new Error("rendered Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(select("shape-geometry-preset").value).toBe("rectangle");

    await act(async () => {
      setInputValue(textArea("shape-path-source"), "M 0 0 L 80 0 L 80 80 Z");
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    expect(select("shape-geometry-preset").value).toBe("custom");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(select("shape-geometry-preset").value).toBe("rectangle");
  });

  it("applies a single-layer SVG appearance and opacity to the current Shape", async () => {
    const transform = { translateXPercent: 12, translateYPercent: -4, rotationDeg: 30 };
    const animation = { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 30 } };
    await mount(shapeElement({ transform, animation }));
    await act(async () => {
      setInputValue(textArea("shape-path-source"), `<svg viewBox="0 0 40 20"><rect x="2" y="3" width="30" height="10" fill="#123456" stroke="#ff0000" stroke-width="2" opacity="0.4" /></svg>`);
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    expect(state.geometry).toMatchObject({ mode: "path", viewBox: { width: 40, height: 20 } });
    expect(state.style).toMatchObject({ fill: { type: "color", color: "#123456" }, stroke: { width: 2, color: "#ff0000" } });
    expect(state.effect).toEqual({ opacity: 0.4 });
    expect(state.transform).toEqual(transform);
    expect(state.animation).toEqual(animation);
  });

  it("replaces a selected Shape with a fitted compound SVG container in one history action", async () => {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={historyPresentation()} />
      </StudioI18nProvider>,
    ));
    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="shape-history-1"]');
    if (!canvasShape) throw new Error("rendered Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => {
      setInputValue(textArea("shape-path-source"), `<svg viewBox="0 0 200 100"><rect width="80" height="40" fill="#ff0000" /><circle cx="120" cy="50" r="20" fill="#0000ff" /></svg>`);
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    const container = host.querySelector<HTMLElement>('[data-presentation-type="container"][data-presentation-id="shape-history-1"]');
    expect(container).not.toBeNull();
    expect(container?.querySelectorAll('[data-presentation-type="shape"]')).toHaveLength(2);
    expect(container?.getAttribute("data-presentation-id")).toBe("shape-history-1");
    expect(container?.querySelector('[data-presentation-type="shape"]')?.getAttribute("style")).toContain("width:200px;height:100px");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(host.querySelector('[data-presentation-type="container"][data-presentation-id="shape-history-1"]')).toBeNull();
    expect(host.querySelector('[data-presentation-type="shape"][data-presentation-id="shape-history-1"]')).not.toBeNull();
  });

  it("imports the exact SH6E acceptance SVG as four ordered child Shapes", async () => {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={historyPresentation()} />
      </StudioI18nProvider>,
    ));
    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="shape-history-1"]');
    if (!canvasShape) throw new Error("rendered Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => {
      setInputValue(textArea("shape-path-source"), SH6E_ACCEPTANCE_SVG);
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });

    const container = host.querySelector<HTMLElement>('[data-presentation-type="container"][data-presentation-id="shape-history-1"]');
    const children = Array.from(container?.querySelectorAll<HTMLElement>('[data-presentation-type="shape"]') ?? []);
    expect(container).not.toBeNull();
    expect(children).toHaveLength(4);
    expect(children.map((child) => child.getAttribute("data-presentation-id"))).toEqual([
      "shape-history-1-svg-1",
      "shape-history-1-svg-2",
      "shape-history-1-svg-3",
      "shape-history-1-svg-4",
    ]);
    expect(container?.innerHTML).toContain("#f97316");
    expect(container?.innerHTML).toContain("#ffffff");
    expect(container?.innerHTML).toContain("#000000");
    expect(container?.innerHTML).toContain("#fdba74");
    expect(children[3]?.getAttribute("style")).toContain("opacity:0.4");
  });

  it("rejects compound SVG import when the selected Shape has a transform", async () => {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={historyPresentation({ transform: { rotationDeg: 30 } })} />
      </StudioI18nProvider>,
    ));
    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="shape-history-1"]');
    if (!canvasShape) throw new Error("rendered Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => {
      setInputValue(textArea("shape-path-source"), `<svg viewBox="0 0 20 20"><rect width="10" height="10" /><circle cx="15" cy="15" r="3" /></svg>`);
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    expect(host.textContent).toContain("Reset Shape transform and animation before importing a compound SVG.");
    expect(host.querySelector('[data-presentation-type="container"][data-presentation-id="shape-history-1"]')).toBeNull();
    expect(host.querySelector('[data-presentation-type="shape"][data-presentation-id="shape-history-1"]')).not.toBeNull();
  });

  it("rejects compound SVG import when the selected Shape has animation without adding history", async () => {
    const animation = { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 30 } };
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={historyPresentation({ animation })} />
      </StudioI18nProvider>,
    ));
    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="shape-history-1"]');
    if (!canvasShape) throw new Error("rendered Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => changeSelect(select("shape-fill-type"), "gradient"));
    expect(select("shape-fill-type").value).toBe("gradient");
    await act(async () => {
      setInputValue(textArea("shape-path-source"), `<svg viewBox="0 0 20 20"><rect width="10" height="10" /><circle cx="15" cy="15" r="3" /></svg>`);
      host.querySelector<HTMLButtonElement>("#shape-path-apply")?.click();
    });
    expect(host.textContent).toContain("Reset Shape transform and animation before importing a compound SVG.");
    expect(host.querySelector('[data-presentation-type="container"][data-presentation-id="shape-history-1"]')).toBeNull();
    expect(select("shape-fill-type").value).toBe("gradient");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(select("shape-fill-type").value).toBe("color");
    expect(host.querySelector('[data-presentation-type="shape"][data-presentation-id="shape-history-1"]')).not.toBeNull();
  });

  it("records representative Shape changes in the shared Undo/Redo history", async () => {
    const presentation = historyPresentation();
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={presentation} />
      </StudioI18nProvider>,
    ));

    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="shape-history-1"]');
    if (!canvasShape) throw new Error("rendered Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const fillType = select("shape-fill-type");
    await act(async () => changeSelect(fillType, "gradient"));
    expect(select("shape-fill-type").value).toBe("gradient");
    const undoFill = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoFill));
    expect(select("shape-fill-type").value).toBe("color");
    const redoFill = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoFill));
    expect(select("shape-fill-type").value).toBe("gradient");

    await act(async () => changeSelect(select("shape-fill-type"), "image"));
    await act(async () => changeSelect(select("shape-fill-fit"), "cover"));
    const undoFit = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoFit));
    expect(select("shape-fill-fit").value).toBe("contain");

    await act(async () => setInputValue(input("shape-opacity"), "60"));
    expect(input("shape-opacity").value).toBe("60");
    const undoOpacity = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoOpacity));
    expect(input("shape-opacity").value).toBe("100");

    await act(async () => changeSelect(select("shape-shadow-mode"), "outer"));
    const undoShadow = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoShadow));
    expect(select("shape-shadow-mode").value).toBe("none");
  });

  it("coalesces QR content and quiet-zone edits and undoes discrete correction changes", async () => {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={qrHistoryPresentation()} />
      </StudioI18nProvider>,
    ));

    const canvasShape = host.querySelector<HTMLElement>('[data-presentation-id="qr-history-1"]');
    if (!canvasShape) throw new Error("rendered QR Shape was not found");
    await act(async () => canvasShape.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const content = input("shape-qr-content");
    await act(async () => {
      content.focus();
      setInputValue(content, "B");
      content.blur();
    });
    expect(input("shape-qr-content").value).toBe("B");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("shape-qr-content").value).toBe("A");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(input("shape-qr-content").value).toBe("B");

    await act(async () => changeSelect(select("shape-qr-error-correction"), "H"));
    expect(select("shape-qr-error-correction").value).toBe("H");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(select("shape-qr-error-correction").value).toBe("M");

    const quietZone = input("shape-qr-quiet-zone");
    await act(async () => {
      quietZone.focus();
      setInputValue(quietZone, "2");
      quietZone.blur();
    });
    expect(input("shape-qr-quiet-zone").value).toBe("2");
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(input("shape-qr-quiet-zone").value).toBe("4");
  });
});
