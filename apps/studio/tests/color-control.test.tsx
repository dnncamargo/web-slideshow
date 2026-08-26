// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ColorValue } from "@powershow/document-schema";

import { ColorControl } from "../src/features/editor/inspector/sections/color-control";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import { RecentColorsProvider } from "../src/features/editor/inspector/sections/recent-colors-provider";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ColorControl linked palette UX", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  function renderControl(value: ColorValue | undefined, onChange = vi.fn(), recentColors: readonly string[] = [], disabled = false, paletteColors = [
    { id: "accent", name: "Accent", value: "#ffffff" },
    { id: "border", name: "Border", value: "#ffffff" },
  ]) {
    act(() => root.render(
      <StudioI18nProvider>
        <RecentColorsProvider colors={recentColors} onAddColor={vi.fn()} onClearColors={vi.fn()} onMoveColor={vi.fn()}>
          <PresentationColorPaletteProvider colors={paletteColors}>
            <ColorControl id="color" name="Color" value={value} onChange={onChange} disabled={disabled} />
          </PresentationColorPaletteProvider>
        </RecentColorsProvider>
      </StudioI18nProvider>,
    ));
    return onChange;
  }

  it("renders literals without authoring on mount", () => {
    const onChange = renderControl("#ffffff");
    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Theme");
    expect(container.querySelector("[aria-label='Add current color']")).toBeNull();
    expect(container.querySelector("button[aria-expanded]")?.textContent).toBe("Use palette");
    expect(container.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
  });

  it("opens the chooser on demand and selects a palette reference", () => {
    const onChange = renderControl("#ffffff");
    const usePalette = container.querySelector<HTMLButtonElement>("button[aria-expanded]");
    expect(usePalette?.getAttribute("aria-expanded")).toBe("false");
    act(() => usePalette?.click());
    expect(usePalette?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#color-palette-chooser")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    const accent = Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"))
      .find((button) => button.getAttribute("aria-label")?.includes("Accent"));
    act(() => accent?.click());
    expect(onChange).toHaveBeenCalledWith({ kind: "palette", colorId: "accent" });
    expect(container.querySelector("#color-palette-chooser")).toBeNull();
  });

  it("shows the linked entry name without opening the chooser and detaches safely", () => {
    const onChange = renderControl({ kind: "palette", colorId: "border" });
    expect(container.textContent).toContain("Linked to presentation palette · Border");
    expect(container.querySelector("#color-palette-chooser")).toBeNull();
    const change = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Change palette");
    expect(change?.getAttribute("aria-expanded")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();

    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    act(() => detach?.click());
    expect(onChange).toHaveBeenCalledWith("#ffffff");
  });

  it("uses strict color ids when duplicate visual values are present", () => {
    const onChange = renderControl({ kind: "palette", colorId: "border" });
    const change = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Change palette");
    act(() => change?.click());
    const selected = container.querySelectorAll<HTMLButtonElement>("button[aria-pressed='true']");
    expect(selected).toHaveLength(1);
    expect(selected[0]?.getAttribute("aria-label")).toContain("Border");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed='false']"))).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps an equal literal value unlinked", () => {
    const onChange = renderControl("#ffffff");
    act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    expect(container.querySelectorAll("button[aria-pressed='true']")).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not use the picker fallback for an unresolved detach", () => {
    const onChange = renderControl({ kind: "palette", colorId: "missing" });
    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    expect(detach?.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders and emits Recent Colors as literals", () => {
    const onChange = renderControl("#000000", vi.fn(), ["#facc15"]);
    const recent = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.style.backgroundColor === "rgb(250, 204, 21)");
    expect(recent).toBeDefined();
    act(() => recent?.click());
    expect(onChange).toHaveBeenCalledWith("#facc15");
  });

  it("closes the chooser when literal text or picker edits are authored", () => {
    const onChange = renderControl("#000000");
    act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    const input = container.querySelector<HTMLInputElement>("#color-value");
    act(() => { if (input) { setInputValue(input, "#123456"); input.dispatchEvent(new Event("input", { bubbles: true })); } });
    expect(onChange).toHaveBeenCalledWith("#123456");
    expect(container.querySelector("#color-palette-chooser")).toBeNull();
  });

  it("does not offer a chooser for an empty palette and disables authored actions", () => {
    const onChange = renderControl({ kind: "palette", colorId: "missing" }, vi.fn(), [], true, []);
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    expect(detach?.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}
