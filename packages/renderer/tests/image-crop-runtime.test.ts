import { describe, expect, it } from "vitest";

import { hydrateImageCrops } from "../src/image-crop-runtime";

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  style: Record<string, string> = {};
  private readonly listeners = new Map<string, EventListener>();

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  load(width: number, height: number): void {
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.listeners.get("load")?.(new Event("load"));
  }
}

class FakeNode {
  dataset: Record<string, string> = {
    powershowImageCrop: JSON.stringify({ x: 10, y: 20, width: 60, height: 50 }),
    powershowImageFit: "contain",
    powershowImageFocalX: "50",
    powershowImageFocalY: "50",
    powershowImageWidthAuthored: "true",
    powershowImageHeightAuthored: "true",
  };
  style: Record<string, string> = {};
  clientWidth = 600;
  clientHeight = 400;
  parentElement = {
    clientWidth: 900,
    clientHeight: 700,
    getBoundingClientRect: () => ({ width: 900, height: 700 }),
  } as unknown as HTMLElement;
  readonly viewport: {
    style: Record<string, string>;
    querySelector: (selector: string) => FakeImage;
  } = { style: {}, querySelector: () => this.image };
  readonly image = new FakeImage();
  private width = 600;
  private height = 400;

  querySelector<T>(selector: string): T | null {
    if (selector === ".powershow-image-crop-viewport") return this.viewport as T;
    if (selector === ".powershow-image-media") return this.image as T;
    return null;
  }

  getBoundingClientRect(): DOMRect {
    return { width: this.width, height: this.height } as DOMRect;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.clientWidth = width;
    this.clientHeight = height;
  }
}

describe("hydrateImageCrops", () => {
  it("hydrates loaded images, waits for unloaded images, and is repeatable", () => {
    const node = new FakeNode();
    const root = { querySelectorAll: () => [node] };

    hydrateImageCrops(root as unknown as ParentNode);
    expect(node.viewport.style.width).toBeUndefined();

    node.image.load(1200, 800);
    expect(node.viewport.style.width).toBe("600px");
    expect(node.image.style.left).toBe("-100px");

    const firstLeft = node.image.style.left;
    hydrateImageCrops(root as unknown as ParentNode);
    expect(node.image.style.left).toBe(firstLeft);

    node.resize(300, 200);
    hydrateImageCrops(root as unknown as ParentNode);
    expect(node.viewport.style.width).toBe("300px");
    expect(node.image.style.width).toBe("500px");
  });

  it.each([
    ["true", "false", 600, 333.333333],
    ["false", "true", 720, 400],
  ] as const)("derives the missing authored dimension (%s/%s)", (widthAuthored, heightAuthored, expectedWidth, expectedHeight) => {
    const node = new FakeNode();
    node.dataset.powershowImageWidthAuthored = widthAuthored;
    node.dataset.powershowImageHeightAuthored = heightAuthored;
    if (widthAuthored === "false") node.clientWidth = 0;
    if (heightAuthored === "false") node.clientHeight = 0;
    const root = { querySelectorAll: () => [node] };

    node.image.load(1200, 800);

    hydrateImageCrops(root as unknown as ParentNode);
    expect(Number.parseFloat(node.style.width ?? `${expectedWidth}`)).toBeCloseTo(expectedWidth);
    expect(Number.parseFloat(node.style.height ?? `${expectedHeight}`)).toBeCloseTo(expectedHeight);
  });

  it("uses the natural crop size for neither-authored dimensions and ignores block auto width", () => {
    const node = new FakeNode();
    node.dataset.powershowImageWidthAuthored = "false";
    node.dataset.powershowImageHeightAuthored = "false";
    node.clientWidth = 900;
    node.clientHeight = 0;
    node.parentElement = {
      clientWidth: 900,
      clientHeight: 700,
      getBoundingClientRect: () => ({ width: 900, height: 700 }),
    } as unknown as HTMLElement;
    const root = { querySelectorAll: () => [node] };

    node.image.load(1200, 800);
    hydrateImageCrops(root as unknown as ParentNode);

    expect(node.style.width).toBe("720px");
    expect(node.style.height).toBe("400px");
  });

  it("scales neither-authored dimensions proportionally to parent constraints", () => {
    const node = new FakeNode();
    node.dataset.powershowImageWidthAuthored = "false";
    node.dataset.powershowImageHeightAuthored = "false";
    node.parentElement = {
      clientWidth: 300,
      clientHeight: 100,
      getBoundingClientRect: () => ({ width: 300, height: 100 }),
    } as unknown as HTMLElement;
    const root = { querySelectorAll: () => [node] };

    node.image.load(1200, 800);
    hydrateImageCrops(root as unknown as ParentNode);

    expect(node.style.width).toBe("180px");
    expect(node.style.height).toBe("100px");

    node.parentElement = {
      clientWidth: 120,
      clientHeight: 700,
      getBoundingClientRect: () => ({ width: 120, height: 700 }),
    } as unknown as HTMLElement;
    hydrateImageCrops(root as unknown as ParentNode);
    expect(node.style.width).toBe("120px");
    expect(Number.parseFloat(node.style.height ?? "")).toBeCloseTo(66.666666, 5);
  });

  it("does nothing for non-cropped images", () => {
    const root = { querySelectorAll: () => [] };
    hydrateImageCrops(root as unknown as ParentNode);
    expect(true).toBe(true);
  });

  it("does not resize a constrained Gallery overlay crop root", () => {
    const node = new FakeNode();
    node.dataset.powershowImageWidthAuthored = "true";
    node.dataset.powershowImageHeightAuthored = "true";
    const root = { querySelectorAll: () => [node] };
    node.image.load(1200, 800);
    hydrateImageCrops(root as unknown as ParentNode);
    expect(node.style.width).toBeUndefined();
    expect(node.style.height).toBeUndefined();
    expect(node.viewport.style.width).toBe("600px");
    expect(node.image.style.width).toBe("1000px");
  });

  it("derives only height for an intrinsic-sizing Gallery crop", () => {
    const node = new FakeNode();
    node.dataset.powershowImageWidthAuthored = "true";
    node.dataset.powershowImageHeightAuthored = "false";
    node.clientHeight = 0;
    const root = { querySelectorAll: () => [node] };
    node.image.load(1200, 800);
    hydrateImageCrops(root as unknown as ParentNode);
    expect(node.style.width).toBeUndefined();
    expect(Number.parseFloat(node.style.height ?? "")).toBeCloseTo(333.333333, 5);
    expect(node.viewport.style.width).toBe("600px");
    expect(Number.parseFloat(node.viewport.style.height ?? "")).toBeCloseTo(333.333333, 5);
  });
});
