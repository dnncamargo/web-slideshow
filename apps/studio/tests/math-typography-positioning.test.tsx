// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContainerElement, MathElement, PresentationElement } from "@web-slideshow/document-schema";

import { MathInspector } from "../src/features/editor/inspector/math-inspector";
import type { ElementInspectorUpdate } from "../src/features/editor/inspector/inspector-types";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import { ContainerLayoutSection } from "../src/features/editor/inspector/sections/container-layout-section";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Math typography and positioning Inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let current: MathElement;
  const moveTo = vi.fn();
  const parent = {
    id: "parent",
    type: "container" as const,
    hidden: false,
    layout: { children: { mode: "stack" as const } },
    children: [],
  };
  const layerControls = { index: 1, count: 3, onMoveTo: moveTo };
  const paletteColors = [{ id: "accent", name: "Accent", value: "#abcdef" }];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    current = { id: "math", type: "math", format: "latex", source: String.raw`\frac{\sqrt{x}}{y^2}`, hidden: false };
    moveTo.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  const update: ElementInspectorUpdate = change => {
    const next = change(current as PresentationElement);
    if (next.type !== "math") throw new Error("Math Inspector changed the element type");
    current = next;
  };

  function render() {
    return act(async () => root.render(
      <StudioI18nProvider>
        <PresentationColorPaletteProvider colors={paletteColors}>
          <MathInspector element={current} onUpdate={update} parent={parent} layerControls={layerControls} />
        </PresentationColorPaletteProvider>
      </StudioI18nProvider>,
    ));
  }

  it("exposes only approved typography fields and writes the selected values", async () => {
    await render();
    expect(host.querySelector("#math-font-size")).not.toBeNull();
    expect(host.querySelector("#math-font-weight")).not.toBeNull();
    expect(host.querySelector("#math-font-style")).not.toBeNull();
    expect(host.querySelector("#math-text-align")).not.toBeNull();
    expect(host.querySelector("#math-line-height")).not.toBeNull();
    expect(host.querySelector("#math-font-family")).toBeNull();

    const changeSelect = async (id: string, value: string) => {
      const input = host.querySelector<HTMLSelectElement>(`#${id}`);
      if (!input) throw new Error(`${id} control missing`);
      await act(async () => { input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    await changeSelect("math-font-weight", "700");
    expect(current.typography?.fontWeight).toBe(700);
    await changeSelect("math-font-style", "italic");
    expect(current.typography?.fontStyle).toBe("italic");
    await changeSelect("math-text-align", "center");
    expect(current.typography?.textAlign).toBe("center");

    const size = host.querySelector<HTMLInputElement>("#math-font-size");
    if (!size) throw new Error("Math font size control missing");
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setInputValue?.call(size, "32"); size.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(current.typography?.fontSize).toBe("32rem");

    const lineHeight = host.querySelector<HTMLInputElement>("#math-line-height");
    if (!lineHeight) throw new Error("Math line-height control missing");
    await act(async () => { setInputValue?.call(lineHeight, "1.7"); lineHeight.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(current.typography?.lineHeight).toBe(1.7);

    await render();
    const preview = host.querySelector<HTMLElement>("[data-presentation-math-preview]");
    expect(preview?.innerHTML).toContain("font-weight:700");
    expect(preview?.innerHTML).toContain("font-style:italic");
    expect(preview?.innerHTML).toContain("font-size:32rem");
    expect(preview?.innerHTML).toContain("text-align:center");
    expect(preview?.innerHTML).toContain("line-height:1.7");
  });

  it("shows Math Effects in canonical order and edits opacity, shadow, and glow", async () => {
    await render();
    const sectionTitles = Array.from(host.querySelectorAll("details"))
      .filter(section => section.parentElement?.closest("details") === null)
      .map(section => section.querySelector("summary span:first-child")?.textContent?.trim());
    expect(sectionTitles).toEqual(["Content", "Typography", "Size", "Spacing", "Appearance", "Effects", "Placement"]);
    expect(host.querySelector("#math-text-stroke-mode")).toBeNull();
    expect(host.querySelector("#math-text-decoration-color")).toBeNull();

    const setNumber = async (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`);
      if (!input) throw new Error(`${id} control missing`);
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      await act(async () => { setValue?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
    };
    const setSelect = async (id: string, value: string) => {
      const select = host.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) throw new Error(`${id} control missing`);
      await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
    };

    await setNumber("math-opacity", "40");
    expect(current.effect?.opacity).toBe(0.4);
    await render();
    await setSelect("math-shadow-mode", "outer");
    expect(current.effect?.shadow).toBeDefined();
    await render();
    await setNumber("math-shadow-x", "3");
    expect(current.effect?.shadow).toMatchObject({ x: 3, y: 4, blur: 12, color: "#000000" });
    await render();
    await setSelect("math-glow-mode", "glow");
    await render();
    await setNumber("math-glow-blur", "18");
    expect(current.effect?.glow).toMatchObject({ blur: 18 });
    expect(current.effect?.opacity).toBe(0.4);
    expect(current.effect?.shadow).toMatchObject({ x: 3 });
  });

  it("blocks authored-link navigation in the secondary preview without disturbing LaTeX selection", async () => {
    current = { ...current, link: { kind: "url", href: "https://example.com/math", target: "_blank" } };
    await render();
    const source = host.querySelector<HTMLTextAreaElement>("[data-presentation-math-inspector] textarea");
    const anchor = host.querySelector<HTMLAnchorElement>('[data-presentation-math-preview] a[data-presentation-link="true"]');
    if (!source || !anchor) throw new Error("Math source or linked preview missing");
    source.focus();
    source.setSelectionRange(2, 6);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => { anchor.dispatchEvent(click); });

    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(source);
    expect([source.selectionStart, source.selectionEnd]).toEqual([2, 6]);
    expect(current.link?.href).toBe("https://example.com/math");
  });

  it("uses the palette for Math foreground and removes only the conflicting gradient", async () => {
    current = {
      ...current,
      style: {
        gradient: { type: "linear", stops: [{ position: 0, color: "#000000" }, { position: 100, color: "#ffffff" }] },
        background: { color: "#202020" },
        borderRadius: 4,
        className: "kept-style",
      },
    };
    await render();
    const fillMode = host.querySelector<HTMLSelectElement>("#math-fill-mode");
    if (!fillMode) throw new Error("Math fill mode control missing");
    await act(async () => { fillMode.value = "color"; fillMode.dispatchEvent(new Event("change", { bubbles: true })); });
    await render();
    const chooser = host.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (!chooser) throw new Error("Math color palette chooser missing");
    await act(async () => chooser.click());
    const accent = Array.from(host.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"))
      .find(button => button.getAttribute("aria-label")?.includes("Accent"));
    if (!accent) throw new Error("Accent palette color missing");
    await act(async () => accent.click());
    expect(current.style).toMatchObject({ color: { kind: "palette", colorId: "accent" }, background: { color: "#202020" }, borderRadius: 4, className: "kept-style" });
    expect(current.style).not.toHaveProperty("gradient");
  });

  it("keeps an existing RGBA foreground value connected to the shared color control and renderer", async () => {
    current = { ...current, style: { color: "rgba(10,20,30,0.4)" } };
    await render();
    expect(host.querySelector<HTMLInputElement>("#math-foreground-color-value")?.value).toContain("rgba");
    expect(host.querySelector<HTMLElement>("[data-presentation-math-preview]")?.innerHTML).toContain("color:rgba(10,20,30,0.4)");
  });

  it("edits dimensions and absolute coordinates without dropping other layout fields", async () => {
    current = { ...current, layout: { width: "50%", position: "absolute", top: "12px", left: 24, margin: 8 } };
    await render();
    const setNumeric = async (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`);
      if (!input) throw new Error(`${id} control missing`);
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      await act(async () => { setInputValue?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
    };
    await setNumeric("element-width", "75");
    expect(current.layout).toMatchObject({ width: "75%", position: "absolute", top: "12px", left: 24, margin: 8 });
    await setNumeric("element-height", "180");
    expect(current.layout).toMatchObject({ width: "75%", height: 180, position: "absolute", top: "12px", left: 24, margin: 8 });

    const top = host.querySelector<HTMLInputElement>("#element-canonical-top");
    if (!top) throw new Error("Math top coordinate missing");
    for (const edge of ["top", "right", "bottom", "left"] as const) expect(host.querySelector(`#element-canonical-${edge}`)).not.toBeNull();
    const setTextValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setTextValue?.call(top, "20%"); top.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(current.layout).toMatchObject({ width: "75%", height: 180, position: "absolute", top: "20%", left: 24, margin: 8 });
    const bringToFront = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "Bring to front");
    if (!bringToFront) throw new Error("Math layer control missing");
    await act(async () => bringToFront.click());
    expect(moveTo).toHaveBeenCalledWith(2);
  });

  it("keeps authored Math data when the parent container alignment changes", async () => {
    const mathChild: MathElement = { ...current, layout: { width: "60%", height: 120, margin: 5 }, typography: { fontWeight: 700, fontStyle: "italic" } };
    let container: ContainerElement = { id: "parent", type: "container", hidden: false, layout: { children: { mode: "flow", direction: "column" } }, children: [mathChild] };
    const updateContainer = (update: (value: ContainerElement) => ContainerElement) => { container = update(container); };
    const renderContainer = () => act(async () => root.render(<StudioI18nProvider><ContainerLayoutSection element={container} onUpdate={updateContainer} /></StudioI18nProvider>));
    await renderContainer();
    const horizontal = host.querySelector<HTMLSelectElement>("#container-horizontal-align");
    const vertical = host.querySelector<HTMLSelectElement>("#container-vertical-align");
    if (!horizontal || !vertical) throw new Error("Parent alignment controls missing");
    await act(async () => { horizontal.value = "center"; horizontal.dispatchEvent(new Event("change", { bubbles: true })); });
    await renderContainer();
    const refreshedVertical = host.querySelector<HTMLSelectElement>("#container-vertical-align");
    if (!refreshedVertical) throw new Error("Parent vertical alignment control missing");
    await act(async () => { refreshedVertical.value = "center"; refreshedVertical.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.layout?.children).toMatchObject({ horizontalAlign: "center", verticalAlign: "center" });
    expect(container.children[0]).toEqual(mathChild);
  });

  it("edits Math padding and appearance while preserving unrelated layout and style properties", async () => {
    current = {
      ...current,
      layout: { width: "60%", height: 90, margin: 7, left: 12 },
      style: { color: "#123456", background: { color: "#202020" }, borderRadius: 6, className: "retained" },
    };
    await render();
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const setNumber = async (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`);
      if (!input) throw new Error(`${id} control missing`);
      await act(async () => { setInputValue?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
    };
    await setNumber("math-padding", "12");
    await setNumber("math-paddingTop", "2");
    await setNumber("math-paddingRight", "3");
    await setNumber("math-paddingBottom", "4");
    await setNumber("math-paddingLeft", "5");
    for (const field of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
      expect(host.querySelector(`#math-${field}`)).not.toBeNull();
    }
    expect(current.layout).toMatchObject({ width: "60%", height: 90, margin: 7, left: 12, padding: 12, paddingTop: 2, paddingRight: 3, paddingBottom: 4, paddingLeft: 5 });

    const select = async (id: string, value: string) => {
      const control = host.querySelector<HTMLSelectElement>(`#${id}`);
      if (!control) throw new Error(`${id} control missing`);
      await act(async () => { control.value = value; control.dispatchEvent(new Event("change", { bubbles: true })); });
      await render();
    };
    await select("math-fill-mode", "gradient");
    expect(current.style?.gradient).toBeDefined();
    expect(current.style).not.toHaveProperty("color");
    expect(current.style).toMatchObject({ background: { color: "#202020" }, borderRadius: 6, className: "retained" });
    await select("math-fill-mode", "color");
    expect(current.style?.color).toBeDefined();
    expect(current.style).not.toHaveProperty("gradient");

    const backgroundColor = host.querySelector<HTMLInputElement>("#math-background-color");
    if (!backgroundColor) throw new Error("Math background color control missing");
    expect(current.style?.background?.color).toBe("#202020");
    await select("math-background-gradient-type", "linear");
    expect(current.style?.background).toMatchObject({ color: "#202020", gradient: { type: "linear" } });
    const backgroundValue = host.querySelector<HTMLInputElement>("#math-background-color-value");
    if (!backgroundValue) throw new Error("Math background color value input missing");
    const setTextValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setTextValue?.call(backgroundValue, "#abcdef"); backgroundValue.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(current.style?.background).toMatchObject({ color: "#abcdef", gradient: { type: "linear" } });
    await select("math-background-gradient-type", "none");
    expect(current.style?.background).toEqual({ color: "#abcdef" });

    await select("math-border-style", "dashed");
    expect(current.style?.border?.style).toBe("dashed");
    await render();
    await select("math-border-paint", "gradient");
    expect(current.style?.border?.gradient).toBeDefined();
    expect(current.style?.border?.width).toBeDefined();
    expect(current.style?.border?.style).toBe("solid");
    await setNumber("math-border-width", "5");
    expect(current.style?.border?.width).toBe(5);
    await setNumber("math-border-radius", "14");
    expect(current.style?.borderRadius).toBe(14);
    expect(current.style).toMatchObject({ background: { color: "#abcdef" }, className: "retained" });
  });
});
