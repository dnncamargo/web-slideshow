// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type ShapeElement } from "@web-slideshow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { ShapeInspector } from "../src/features/editor/inspector/shape-inspector";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";

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

function historyPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "shape-history",
    title: "Shape history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [shapeElement({ id: "shape-history-1" })],
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
    await mount();
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
