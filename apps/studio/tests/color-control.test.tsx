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

  function renderControl(value: ColorValue | undefined, onChange = vi.fn(), recentColors: readonly string[] = []) {
    act(() => root.render(
      <StudioI18nProvider>
        <RecentColorsProvider colors={recentColors} onAddColor={vi.fn()} onClearColors={vi.fn()} onMoveColor={vi.fn()}>
          <PresentationColorPaletteProvider colors={[
            { id: "accent", name: "Accent", value: "#ffffff" },
            { id: "border", name: "Border", value: "#ffffff" },
          ]}>
            <ColorControl id="color" name="Color" value={value} onChange={onChange} />
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
  });

  it("shows the linked entry name, selects only by id, and detaches to the current literal", () => {
    const onChange = renderControl({ kind: "palette", colorId: "border" });
    expect(container.textContent).toContain("Linked to presentation palette · Border");
    expect(container.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(container.querySelectorAll("button[aria-pressed='true']")).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();

    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    act(() => detach?.click());
    expect(onChange).toHaveBeenCalledWith("#ffffff");
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
});
