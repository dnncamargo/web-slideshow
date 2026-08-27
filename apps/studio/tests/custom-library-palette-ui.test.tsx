// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { CustomLibraryPaletteBrowser } from "../src/features/custom-library/custom-library-palette-browser";
import { CustomLibraryPaletteDetails } from "../src/features/custom-library/custom-library-palette-details";
import type { CustomLibraryPaletteRecord } from "../src/features/custom-library/custom-library-palette-repository";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const record: CustomLibraryPaletteRecord = {
  id: "palette-1",
  palette: {
    name: "Brand Warm",
    description: "Warm presentation palette",
    colors: [
      { name: "Accent", value: "#facc15" },
      { name: "Accent", value: "#facc15" },
      { name: "Overlay", value: "rgba(10, 20, 30, 0.5)" },
      { name: "Four", value: "#111111" },
      { name: "Five", value: "#222222" },
      { name: "Six", value: "#333333" },
      { name: "Seven", value: "#444444" },
    ],
  },
};

describe("Custom Library Palette browser and details", () => {
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

  it("renders compact ordered previews, metadata, duplicate values, and accessible selection", () => {
    const onSelect = vi.fn();
    act(() => root.render(
      <StudioI18nProvider>
        <CustomLibraryPaletteBrowser records={[record]} selectedId={null} onSelect={onSelect} />
      </StudioI18nProvider>,
    ));

    const row = container.querySelector<HTMLButtonElement>("button");
    expect(row?.getAttribute("aria-label")).toBe("Brand Warm");
    expect(row?.getAttribute("aria-pressed")).toBe("false");
    expect(row?.textContent).toContain("Brand Warm");
    expect(row?.textContent).toContain("7 colors");
    expect(row?.textContent).toContain("Warm presentation palette");
    expect(container.querySelectorAll("[data-palette-swatch]")).toHaveLength(6);
    expect(container.textContent).toContain("+1");
    expect(container.querySelectorAll("[data-palette-swatch]")[0]?.getAttribute("style")).toContain("rgb(250, 204, 21)");
    act(() => row?.click());
    expect(onSelect).toHaveBeenCalledWith("palette-1");
  });

  it("shows no-selection state and the complete ordered color list without IDs", () => {
    const onDelete = vi.fn();
    act(() => root.render(
      <StudioI18nProvider>
        <CustomLibraryPaletteDetails record={null} onDelete={onDelete} />
      </StudioI18nProvider>,
    ));
    expect(container.textContent).toContain("Select a palette to view details.");
    expect(onDelete).not.toHaveBeenCalled();

    act(() => root.render(
      <StudioI18nProvider>
        <CustomLibraryPaletteDetails record={record} onDelete={onDelete} />
      </StudioI18nProvider>,
    ));
    expect(container.textContent).toContain("Brand Warm");
    expect(container.textContent).toContain("Warm presentation palette");
    expect(container.textContent).toContain("7");
    expect(container.textContent).toContain("rgba(10, 20, 30, 0.5)");
    expect(container.querySelectorAll("[data-palette-color-row]")).toHaveLength(7);
    expect(container.textContent).not.toContain("palette-1");
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
