// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { updatePresentationTitle } from "../src/features/editor/presentation-title";
import { SlideLayoutPicker } from "../src/features/editor/slide-layout-picker";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { PRODUCT_SURFACE_LABELS } from "../src/features/app/product-labels";

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

  it("updates Presentation.title without mutating a slide title", () => {
    const presentation = createBlankPresentation("presentation-1", "Before");
    const firstSlide = presentation.slides[0];
    if (!firstSlide) throw new Error("expected a blank presentation slide");
    const next = updatePresentationTitle(presentation, "After");

    expect(next.title).toBe("After");
    expect(next.slides[0]?.title).toBe(firstSlide.title);
    expect(next.slides).toBe(presentation.slides);
  });

  it("centralizes the visible Studio suite labels", () => {
    expect(PRODUCT_SURFACE_LABELS).toEqual({
      studio: "PowerShow Studio",
      editor: "PowerShow Editor",
      control: "PowerShow Control",
    });
  });
});
