// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { updatePresentationTitle } from "../src/features/editor/presentation-title";
import { SlideLayoutPicker } from "../src/features/editor/slide-layout-picker";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { ProductSurfaceBrand } from "../src/features/app/product-surface-brand";
import {
  PRODUCT_NAME,
  PRODUCT_SURFACE_LABELS,
  type ProductSurfaceName,
} from "../src/features/app/product-labels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("editor UI foundation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("keeps only Create in the layout picker action area", () => {
    const onCreate = vi.fn();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <SlideLayoutPicker value="blank" onChange={vi.fn()} onCreate={onCreate} />
        </StudioI18nProvider>,
      );
    });

    expect(container.textContent).toContain("+ New");
    expect(container.textContent).not.toContain("Cancel");
    const createButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
    ).find((button) => button.textContent?.includes("+ New"));
    if (!createButton) throw new Error("expected the Create button");
    act(() => createButton.click());
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("keeps the slide sidebar rows stable as the layout picker opens and closes", () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={createBlankPresentation("sidebar-structure")} />
        </StudioI18nProvider>,
      );
    });

    const sidebar = container.querySelector("aside");
    expect(sidebar).not.toBeNull();
    if (!sidebar) throw new Error("expected the slide sidebar");

    const getRows = () => Array.from(sidebar.children);
    const getPickerSlot = () => getRows()[1];

    expect(getRows()).toHaveLength(4);
    expect(getRows()[0]?.className).toContain("slidePanelHeader");
    expect(getPickerSlot()?.className).toContain("slideLayoutPickerSlot");
    expect(getRows()[2]?.className).toContain("slideList");
    expect(getRows()[3]?.className).toContain("slideActions");
    expect(getPickerSlot()?.querySelector("[class*='layoutPicker']")).toBeNull();

    const newButton = Array.from(sidebar.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "+ New slide",
    );
    if (!newButton) throw new Error("expected the New button");
    act(() => newButton.click());

    expect(getRows()).toHaveLength(4);
    expect(getRows()[1]).toBe(getPickerSlot());
    expect(getPickerSlot()?.querySelector("[class*='layoutPicker']")).not.toBeNull();
    expect(getRows()[2]?.className).toContain("slideList");
    expect(getRows()[3]?.className).toContain("slideActions");

    const closeButton = Array.from(sidebar.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Close",
    );
    if (!closeButton) throw new Error("expected the Close button");
    act(() => closeButton.click());

    expect(getRows()).toHaveLength(4);
    expect(getRows()[1]).toBe(getPickerSlot());
    expect(getPickerSlot()?.querySelector("[class*='layoutPicker']")).toBeNull();
    expect(getRows()[2]?.className).toContain("slideList");
    expect(getRows()[3]?.className).toContain("slideActions");
  });

  it("updates Presentation.title without mutating a slide title", () => {
    const presentation = createBlankPresentation("presentation-1", "Before");
    const firstSlide = presentation.slides[0];
    if (!firstSlide) throw new Error("expected a blank presentation slide");
    const next = updatePresentationTitle(presentation, "After");

    expect(next.title).toBe("After");
    expect(next.slides[0]?.title).toBe(firstSlide.title);
    expect(next.slides).toBe(presentation.slides);
  });

  it("keeps the product name and surface names as separate central labels", () => {
    expect(PRODUCT_NAME).toBe("PowerShow");
    expect(PRODUCT_SURFACE_LABELS).toEqual({
      library: "Library",
      editor: "Editor",
      control: "Control",
    });
  });

  it.each(["library", "editor", "control"] as const)(
    "renders the canonical brand composition as separate semantic pieces for %s",
    (surface: ProductSurfaceName) => {
      act(() => {
        root.render(<ProductSurfaceBrand surface={surface} />);
      });

      const strong = container.querySelector("strong");
      expect(strong?.textContent).toBe("PowerShow");

      const surfaceSpan = container.querySelector(
        ".ps-ui-topbar__product-surface",
      );
      expect(surfaceSpan?.textContent).toBe(PRODUCT_SURFACE_LABELS[surface]);

      // The pair is one composition, but the product name and the surface
      // name remain separate semantic pieces.
      expect(container.querySelectorAll("strong").length).toBe(1);
      expect(surfaceSpan?.parentElement?.contains(strong)).toBe(true);
      expect(strong?.textContent).not.toContain(
        PRODUCT_SURFACE_LABELS[surface],
      );
    },
  );
});
