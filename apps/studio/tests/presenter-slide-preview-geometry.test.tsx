// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  paletteColorCssVariableName,
  resolveLogicalSlideSize,
} from "@web-slideshow/renderer";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

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

  function rootPresentation(rootDefinitionId?: string): Presentation {
    return PresentationSchema.parse({
      ...createBlankPresentation("root-presentation", "Root Presentation"),
      defaultRootDefinitionId: "default-root",
      rootDefinitions: [
        {
          id: "default-root",
          name: "Default",
          root: {
            id: "default-container",
            type: "container",
            children: [
              { id: "default-master", type: "text", content: "Default master" },
              { id: "root-gallery", type: "gallery", items: [{ src: "/one.png" }, { src: "/two.png" }] },
              { id: "local-target", type: "container", children: [] },
            ],
          },
          localChildTargetIds: ["local-target"],
        },
        {
          id: "explicit-root",
          name: "Explicit",
          root: {
            id: "explicit-container",
            type: "container",
            children: [{ id: "explicit-master", type: "text", content: "Explicit master" }],
          },
        },
      ],
      slides: [{
        id: "root-slide",
        elements: [],
        ...(rootDefinitionId === undefined ? {} : { rootDefinitionId }),
        ...(rootDefinitionId === undefined ? {
          localRootChildren: [{
            targetContainerId: "local-target",
            children: [{ id: "local-child", type: "text", content: "Local child" }],
          }],
        } : {}),
      }],
    });
  }

  it("materializes default and explicit Root Definitions in Preview, preserving IDs and Gallery projection", async () => {
    const presentation = rootPresentation();
    const slide = presentation.slides[0]!;
    expect(slide.elements).toEqual([]);

    await act(async () => {
      root.render(<PresenterSlidePreview presentation={presentation} slide={slide} aspectRatio="16:9" variant="current" galleryTargets={[{ elementId: "root-gallery", targetIndex: 1 }]} />);
    });

    expect(container.textContent).toContain("Default master");
    expect(container.textContent).toContain("Local child");
    expect(container.textContent!.indexOf("Default master")).toBeLessThan(container.textContent!.indexOf("Local child"));
    expect(container.querySelector('[data-presentation-id="default-master"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="local-child"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="root-gallery"] .presentation-gallery-item-active')?.getAttribute("data-presentation-gallery-index")).toBe("1");
    expect(container.querySelector("[data-root-definition-id]")).toBeNull();

    const explicitPresentation = rootPresentation("explicit-root");
    await act(async () => {
      root.render(<PresenterSlidePreview presentation={explicitPresentation} slide={explicitPresentation.slides[0]!} aspectRatio="16:9" variant="next" />);
    });
    expect(container.textContent).toContain("Explicit master");
    expect(container.textContent).not.toContain("Default master");
    expect(container.querySelector('[data-presentation-id="explicit-master"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="default-master"]')).toBeNull();
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
      expect(surface.querySelector("[data-presentation-id='palette-text']")).not.toBeNull();
      expect(surface.innerHTML).toContain("var(--ps-palette-0061006300630065006e0074)");
    }

    expect(slide.elements[0]).toMatchObject({
      style: { color: { kind: "palette", colorId: "accent" } },
    });
  });

  it("preserves an Embed iframe across equivalent preview rerenders", async () => {
    const presentation = createBlankPresentation(
      "presentation-1",
      "Presentation",
    );
    const slide = {
      ...createBlankSlide("slide-1"),
      elements: [{
        id: "embed-1",
        type: "embed" as const,
        hidden: false,
        src: "https://blockly.games/maze?lang=en&level=4",
        title: "Blockly Maze",
      }],
    };

    await act(async () => {
      root.render(
        <PresenterSlidePreview
          presentation={presentation}
          slide={slide}
          aspectRatio="16:9"
          variant="current"
          galleryTargets={[]}
        />,
      );
    });

    const firstIframe = container.querySelector("iframe");
    expect(firstIframe).not.toBeNull();
    const firstSrc = firstIframe?.getAttribute("src");

    await act(async () => {
      root.render(
        <PresenterSlidePreview
          presentation={{ ...presentation }}
          slide={{ ...slide, elements: [...slide.elements] }}
          aspectRatio="16:9"
          variant="current"
          galleryTargets={[]}
        />,
      );
    });

    const secondIframe = container.querySelector("iframe");
    expect(secondIframe).toBe(firstIframe);
    expect(secondIframe?.getAttribute("src")).toBe(firstSrc);
  });

  it("replaces the Embed iframe when rendered markup changes", async () => {
    const presentation = createBlankPresentation(
      "presentation-1",
      "Presentation",
    );
    const slide = {
      ...createBlankSlide("slide-1"),
      elements: [{
        id: "embed-1",
        type: "embed" as const,
        hidden: false,
        src: "https://example.com/first",
        title: "First",
      }],
    };

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

    const firstIframe = container.querySelector("iframe");

    await act(async () => {
      root.render(
        <PresenterSlidePreview
          presentation={presentation}
          slide={{
            ...slide,
            elements: [{ ...slide.elements[0], src: "https://example.com/second" }],
          }}
          aspectRatio="16:9"
          variant="current"
        />,
      );
    });

    const secondIframe = container.querySelector("iframe");
    expect(secondIframe).not.toBe(firstIframe);
    expect(secondIframe?.getAttribute("src")).toBe("https://example.com/second");
  });
});
