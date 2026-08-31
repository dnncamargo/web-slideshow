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
});
