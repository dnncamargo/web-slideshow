// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  paletteColorCssVariableName,
  resolveLogicalSlideSize,
} from "@powershow/renderer";

import { PresenterSlidePreview } from "../src/features/control/presenter/presenter-slide-preview";
import {
  createBlankPresentation,
  createBlankSlide,
} from "../src/features/persistence/presentation-repository-instance";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("PresenterSlidePreview logical geometry", () => {
  let container: HTMLDivElement;
  let root: Root;
  let getBoundingClientRect: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        width: 480,
        height: 270,
        top: 0,
        left: 0,
        right: 480,
        bottom: 270,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
  });

  afterEach(async () => {
    getBoundingClientRect.mockRestore();
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("fits a current 16:9 preview into its physical host", async () => {
    const presentation = createBlankPresentation(
      "presentation-1",
      "Presentation",
    );
    const slide = createBlankSlide("slide-1");

    await act(async () => {
      root.render(
        <PresenterSlidePreview
          presentation={presentation}
          slide={slide}
          aspectRatio="16:9"
          variant="current"
        />,
      );
    });

    const surface = container.firstElementChild?.firstElementChild as HTMLElement;
    const logicalSize = resolveLogicalSlideSize("16:9");

    expect(surface.style.width).toBe(`${logicalSize.logicalWidth}px`);
    expect(surface.style.height).toBe(`${logicalSize.logicalHeight}px`);
    expect(surface.style.transform).toBe("scale(0.5)");
  });

  it("uses the same logical surface for a 4:3 next preview", async () => {
    const presentation = {
      ...createBlankPresentation("presentation-1", "Presentation"),
      aspectRatio: "4:3" as const,
    };
    const slide = createBlankSlide("slide-1");

    getBoundingClientRect.mockReturnValue({
      width: 480,
      height: 360,
      top: 0,
      left: 0,
      right: 480,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    await act(async () => {
      root.render(
        <PresenterSlidePreview
          presentation={presentation}
          slide={slide}
          aspectRatio="4:3"
          variant="next"
        />,
      );
    });

    const surface = container.firstElementChild?.firstElementChild as HTMLElement;
    const logicalSize = resolveLogicalSlideSize("4:3");

    expect(surface.style.width).toBe(`${logicalSize.logicalWidth}px`);
    expect(surface.style.height).toBe(`${logicalSize.logicalHeight}px`);
    expect(surface.style.transform).toBe("scale(0.5)");
  });

  it("propagates the canonical palette to both current and next surfaces", async () => {
    const presentation = {
      ...createBlankPresentation("presentation-1", "Presentation"),
      palette: {
        colors: [
          { id: "background", name: "Background", value: "#102030" },
          { id: "accent", name: "Accent", value: "#f0c000" },
        ],
      },
    };
    const slide = {
      ...createBlankSlide("slide-1"),
      elements: [{
        type: "text" as const,
        id: "palette-text",
        hidden: false,
        variant: "body",
        content: "Palette text",
        style: { color: { kind: "palette" as const, colorId: "accent" } },
      }],
    };

    await act(async () => {
      root.render(
        <>
          <PresenterSlidePreview
            presentation={presentation}
            slide={slide}
            aspectRatio="16:9"
            variant="current"
          />
          <PresenterSlidePreview
            presentation={presentation}
            slide={slide}
            aspectRatio="16:9"
            variant="next"
          />
        </>,
      );
    });

    const surfaces = container.querySelectorAll<HTMLElement>("[class*='previewSurface']");
    expect(surfaces).toHaveLength(2);

    for (const surface of surfaces) {
      expect(surface.style.getPropertyValue(paletteColorCssVariableName("background"))).toBe("#102030");
      expect(surface.style.getPropertyValue(paletteColorCssVariableName("accent"))).toBe("#f0c000");
      expect(surface.style.width).toBe("960px");
      expect(surface.style.height).toBe("540px");
      expect(surface.style.transform).toBe("scale(0.5)");
      expect(surface.querySelector("[data-powershow-id='palette-text']")).not.toBeNull();
      expect(surface.innerHTML).toContain("var(--ps-palette-0061006300630065006e0074)");
    }

    expect(slide.elements[0]).toMatchObject({
      style: { color: { kind: "palette", colorId: "accent" } },
    });
  });
});
