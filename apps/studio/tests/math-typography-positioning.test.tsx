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
});
