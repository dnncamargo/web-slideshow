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
});
