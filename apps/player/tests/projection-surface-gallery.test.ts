// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

import { mountProjectionSurface } from "../src/projection-surface";

function galleryPresentation({
  items = ["first", "second", "third"],
  galleries = 1,
  slides = 1,
}: {
  items?: string[];
  galleries?: number;
  slides?: number;
} = {}) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "gallery-player-test",
    title: "Gallery Player Test",
    description: "",
    aspectRatio: "16:9",
    slides: Array.from({ length: slides }, (_, slideIndex) => ({
      id: `slide-${slideIndex}`,
      elements: Array.from({ length: galleries }, (_, galleryIndex) => ({
        type: "gallery" as const,
        id: `gallery-${slideIndex}-${galleryIndex}`,
        fit: "contain" as const,
        items: items.map((name) => ({
          src: `/${galleryIndex}-${name}.png`,
          alt: name,
        })),
      })),
    })),
  });
}

function galleryItems(root: HTMLElement, galleryIndex = 0): HTMLElement[] {
  const gallery = root.querySelectorAll<HTMLElement>(".powershow-gallery")[galleryIndex];

  if (!gallery) {
    throw new Error("Gallery was not rendered.");
  }

  return Array.from(gallery.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.classList.contains("powershow-gallery-item"),
  );
}

function activeIndex(items: HTMLElement[]): number {
  return items.findIndex((item) =>
    item.classList.contains("powershow-gallery-item-active"),
  );
}

function expandedOverlay(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(".powershow-player-gallery-expanded");
}

function expandedImage(root: HTMLElement): HTMLImageElement | null {
  return expandedOverlay(root)?.querySelector<HTMLImageElement>("img") ?? null;
}

describe("Projection surface Gallery interaction", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    const element = document.querySelector<HTMLElement>("#app");

    if (!element) throw new Error("Test root was not created.");
    root = element;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("preserves renderer initial state and advances nested image clicks with wrap", () => {
    const projection = mountProjectionSurface(root, galleryPresentation(), { transition: "none" });
    const items = galleryItems(root);

    expect(activeIndex(items)).toBe(0);
    expect(items[0]?.getAttribute("aria-hidden")).toBeNull();
    expect(items[1]?.getAttribute("aria-hidden")).toBe("true");
    expect(items[2]?.getAttribute("aria-hidden")).toBe("true");

    const firstImage = items[0]?.querySelector<HTMLImageElement>("img.powershow-gallery-image");
    firstImage?.click();
    expect(activeIndex(items)).toBe(1);
    expect(items[0]?.style.visibility).toBe("hidden");
    expect(items[0]?.style.display).not.toBe("none");
    expect(items[0]?.style.position).toBe("relative");
    expect(items[0]?.style.height).toBe("auto");
    expect(items[1]?.style.visibility).toBe("");
    expect(items[1]?.getAttribute("aria-hidden")).toBeNull();

    items[1]?.querySelector<HTMLImageElement>("img")?.click();
    expect(activeIndex(items)).toBe(2);
    items[2]?.querySelector<HTMLImageElement>("img")?.click();
    expect(activeIndex(items)).toBe(0);

    projection.destroy();
  });

  it("keeps single and empty Galleries inert", () => {
    const single = mountProjectionSurface(root, galleryPresentation({ items: ["only"] }), { transition: "none" });
    galleryItems(root)[0]?.querySelector<HTMLImageElement>("img")?.click();
    expect(activeIndex(galleryItems(root))).toBe(0);
    single.destroy();

    const empty = mountProjectionSurface(root, galleryPresentation({ items: [] }), { transition: "none" });
    expect(() => root.querySelector<HTMLElement>(".powershow-gallery")?.click()).not.toThrow();
    empty.destroy();
  });

  it("advances each Gallery independently", () => {
    const projection = mountProjectionSurface(root, galleryPresentation({ galleries: 2 }), { transition: "none" });
    const first = galleryItems(root, 0);
    const second = galleryItems(root, 1);

    first[0]?.querySelector<HTMLImageElement>("img")?.click();
    expect(activeIndex(first)).toBe(1);
    expect(activeIndex(second)).toBe(0);
    second[0]?.querySelector<HTMLImageElement>("img")?.click();
    expect(activeIndex(first)).toBe(1);
    expect(activeIndex(second)).toBe(1);

    projection.destroy();
  });

  it("preserves local Gallery state on resize and resets it on a slide rerender", () => {
    const projection = mountProjectionSurface(root, galleryPresentation({ slides: 2 }), { transition: "none" });
    galleryItems(root)[0]?.querySelector<HTMLImageElement>("img")?.click();
    window.dispatchEvent(new Event("resize"));
    expect(activeIndex(galleryItems(root))).toBe(1);

    projection.goTo(1);
    projection.goTo(0);
    expect(activeIndex(galleryItems(root))).toBe(0);

    projection.destroy();
  });

  it("removes the delegated interaction listener during idempotent destroy", () => {
    const projection = mountProjectionSurface(root, galleryPresentation(), { transition: "none" });
    const image = root.querySelector<HTMLImageElement>("img.powershow-gallery-image");

    projection.destroy();
    projection.destroy();

    expect(root.children).toHaveLength(0);
    expect(() => image?.click()).not.toThrow();
  });

  it("expands the current item as an unscaled physical stage layer and collapses absolutely", () => {
    const projection = mountProjectionSurface(root, galleryPresentation(), { transition: "none" });

    projection.setGalleryExpanded("gallery-0-0", true);
    const overlay = expandedOverlay(root);
    expect(overlay).not.toBeNull();
    expect(expandedImage(root)?.getAttribute("src")).toBe("/0-first.png");
    expect(overlay?.parentElement).toBe(projection.stage);
    expect(overlay?.closest(".powershow-player-slide-host")).toBeNull();
    expect(overlay?.closest(".powershow-player-slide-surface")).toBeNull();

    projection.setGalleryExpanded("gallery-0-0", false);
    projection.setGalleryExpanded("gallery-0-0", false);
    expect(expandedOverlay(root)).toBeNull();
    projection.destroy();
  });

  it("keeps one expanded Gallery at a time and ignores missing or empty Galleries", () => {
    const projection = mountProjectionSurface(root, galleryPresentation({ galleries: 2 }), { transition: "none" });
    projection.setGalleryExpanded("gallery-0-0", true);
    projection.setGalleryExpanded("gallery-0-1", true);

    expect(root.querySelectorAll(".powershow-player-gallery-expanded")).toHaveLength(1);
    expect(expandedOverlay(root)?.dataset.powershowGalleryExpanded).toBe("gallery-0-1");
    projection.setGalleryExpanded("gallery-0-0", false);
    expect(expandedOverlay(root)?.dataset.powershowGalleryExpanded).toBe("gallery-0-1");
    expect(() => projection.setGalleryExpanded("missing", true)).not.toThrow();
    expect(expandedOverlay(root)?.dataset.powershowGalleryExpanded).toBe("gallery-0-1");
    projection.destroy();

    const empty = mountProjectionSurface(root, galleryPresentation({ items: [] }), { transition: "none" });
    expect(() => empty.setGalleryExpanded("gallery-0-0", true)).not.toThrow();
    expect(expandedOverlay(root)).toBeNull();
    empty.destroy();
  });

  it("uses and refreshes the active item when an expanded Gallery advances", () => {
    const projection = mountProjectionSurface(root, galleryPresentation(), { transition: "none" });
    const originalItems = galleryItems(root);
    originalItems[0]?.querySelector<HTMLImageElement>("img")?.click();
    projection.setGalleryExpanded("gallery-0-0", true);

    expect(expandedImage(root)?.getAttribute("src")).toBe("/0-second.png");
    expandedImage(root)?.click();
    expect(activeIndex(originalItems)).toBe(2);
    expect(expandedImage(root)?.getAttribute("src")).toBe("/0-third.png");
    expect(root.querySelectorAll(".powershow-player-gallery-expanded")).toHaveLength(1);
    projection.destroy();
  });

  it("clones without changing the original Gallery DOM and preserves image fit and focal point", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1, id: "gallery-clone", title: "Gallery Clone", description: "", aspectRatio: "16:9",
      slides: [{ id: "slide", elements: [{ type: "gallery", id: "gallery-fit", fit: "contain", items: [
        { src: "/focal.png", alt: "Focal", fit: "cover", focalPoint: { x: 25, y: 75 } },
        { src: "/next.png", alt: "Next" },
      ] }] }],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const original = galleryItems(root)[0];
    const originalStyle = original?.getAttribute("style");
    const originalCount = galleryItems(root).length;
    projection.setGalleryExpanded("gallery-fit", true);

    const image = expandedImage(root);
    expect(image?.style.objectFit).toBe("cover");
    expect(image?.style.objectPosition).toBe("25% 75%");
    expect(galleryItems(root)).toHaveLength(originalCount);
    expect(galleryItems(root)[0]).toBe(original);
    expect(original?.getAttribute("style")).toBe(originalStyle);
    projection.destroy();
  });

  it("normalizes cloned crop constraints while retaining renderer crop markup", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1, id: "gallery-crop", title: "Gallery Crop", description: "", aspectRatio: "16:9",
      slides: [{ id: "slide", elements: [{ type: "gallery", id: "gallery-crop", items: [
        { src: "/crop.png", alt: "Crop", crop: { x: 10, y: 20, width: 60, height: 50 } },
      ] }] }],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    projection.setGalleryExpanded("gallery-crop", true);
    const clone = expandedOverlay(root)?.querySelector<HTMLElement>("[data-powershow-image-crop]");

    expect(clone?.dataset.powershowImageWidthAuthored).toBe("true");
    expect(clone?.dataset.powershowImageHeightAuthored).toBe("true");
    expect(clone?.querySelector(".powershow-image-crop-viewport")).not.toBeNull();
    expect(clone?.querySelector(".powershow-image-media")).not.toBeNull();
    projection.destroy();
  });

  it("keeps an expanded Gallery through resize, resets it on slide navigation, and supports arbitrary ids", () => {
    const awkwardId = 'gallery[0].a:b"quoted"';
    const presentation = PresentationSchema.parse({
      schemaVersion: 1, id: "gallery-navigation", title: "Gallery Navigation", description: "", aspectRatio: "16:9",
      slides: [
        { id: "first", elements: [{ type: "gallery", id: awkwardId, items: [{ src: "/first.png", alt: "First" }] }] },
        { id: "second", elements: [] },
      ],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    projection.setGalleryExpanded(awkwardId, true);
    window.dispatchEvent(new Event("resize"));
    expect(root.querySelectorAll(".powershow-player-gallery-expanded")).toHaveLength(1);
    expect(expandedImage(root)?.getAttribute("src")).toBe("/first.png");

    projection.goTo(1);
    expect(expandedOverlay(root)).toBeNull();
    projection.goTo(0);
    expect(expandedOverlay(root)).toBeNull();
    projection.destroy();
  });

  it("removes expanded interaction during idempotent destroy", () => {
    const projection = mountProjectionSurface(root, galleryPresentation(), { transition: "none" });
    projection.setGalleryExpanded("gallery-0-0", true);
    const image = expandedImage(root);
    projection.destroy();
    projection.destroy();

    expect(root.children).toHaveLength(0);
    expect(() => image?.click()).not.toThrow();
  });
});
