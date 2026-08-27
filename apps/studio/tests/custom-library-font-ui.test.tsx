// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { CustomLibraryFontBrowser } from "../src/features/custom-library/custom-library-font-browser";
import { CustomLibraryFontDetails } from "../src/features/custom-library/custom-library-font-details";
import type { CustomLibraryFontRecord } from "../src/features/custom-library/custom-library-font";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const record: CustomLibraryFontRecord = {
  id: "internal-font-id",
  font: {
    family: "Inter",
    faces: [
      { weight: 700, style: "italic", subset: "latin", source: { type: "url", url: "https://cdn.example.test/700-i.woff2", format: "woff2" } },
      { weight: 400, style: "normal", subset: "latin", source: { type: "url", url: "https://cdn.example.test/400.woff2", format: "woff2" } },
      { source: { type: "url", url: "https://cdn.example.test/default.woff2" } },
    ],
  },
};

describe("Custom Library Font browser and details", () => {
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

  it("renders one selectable compact row per master without the repository id", () => {
    const onSelect = vi.fn();
    act(() => root.render(<StudioI18nProvider><CustomLibraryFontBrowser records={[record]} selectedId={null} onSelect={onSelect} /></StudioI18nProvider>));
    const row = container.querySelector<HTMLButtonElement>("[data-custom-library-font-row]");
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("Inter");
    expect(row?.textContent).toContain("3 faces");
    expect(row?.getAttribute("aria-pressed")).toBe("false");
    expect(row?.getAttribute("data-selected")).toBe("false");
    expect(row?.textContent).not.toContain("internal-font-id");
    act(() => row?.click());
    expect(onSelect).toHaveBeenCalledWith("internal-font-id");
  });

  it("shows semantic fields and deterministic face metadata without source URLs", () => {
    act(() => root.render(<StudioI18nProvider><CustomLibraryFontDetails record={record} onDelete={vi.fn()} /></StudioI18nProvider>));
    expect(container.textContent).toContain("FamilyInter");
    expect(container.textContent).toContain("Faces3");
    expect(container.textContent).toContain("400 · 700 · Default");
    expect(container.textContent).toContain("Normal · Italic · Default");
    expect(container.textContent).toContain("700 · Italic · latin · WOFF2");
    expect(container.textContent).not.toContain("https://cdn.example.test");
    expect(container.textContent).not.toContain("internal-font-id");
  });

  it("renders a font-specific no-selection state and only delete action", () => {
    const onDelete = vi.fn();
    act(() => root.render(<StudioI18nProvider><CustomLibraryFontDetails record={null} onDelete={onDelete} /></StudioI18nProvider>));
    expect(container.textContent).toContain("Select a font to view details.");
    expect(container.querySelector("button")).toBeNull();
  });
});
