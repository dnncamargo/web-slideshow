import { describe, expect, it, vi } from "vitest";

import { hydrateContainerFits } from "../src/container-fit-runtime";
import { hydrateRendererRuntime } from "../src/renderer-runtime";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly callback: () => void;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  trigger(): void {
    this.callback();
  }
}

function fitRoot(width = 400, height = 300) {
  const surface = { style: {} as Record<string, string> };
  const viewport = {
    dataset: {
      powershowContainerFit: "true",
      powershowContainerFitMode: "contain",
      powershowContainerFitSourceWidth: "800",
      powershowContainerFitSourceHeight: "400",
    },
    clientWidth: width,
    clientHeight: height,
    querySelector: () => surface,
    isConnected: true,
  } as unknown as HTMLElement;
  const root = { querySelectorAll: () => [viewport] };
  return { root, viewport, surface };
}

describe("hydrateContainerFits", () => {
  it("hydrates contain, cover, and fill from target dimensions", () => {
    const modes = ["contain", "cover", "fill"] as const;
    for (const mode of modes) {
      const { root, viewport, surface } = fitRoot();
      viewport.dataset.powershowContainerFitMode = mode;
      hydrateContainerFits(root as unknown as ParentNode);
      const transform = surface.style.transform;
      expect(transform).toContain(mode === "contain" ? "scale(0.5,0.5)" : mode === "cover" ? "scale(0.75,0.75)" : "scale(0.5,0.75)");
    }
  });

  it("recalculates on target resize without duplicating observers", () => {
    const { root, viewport, surface } = fitRoot();
    hydrateContainerFits(root as unknown as ParentNode);
    hydrateContainerFits(root as unknown as ParentNode);
    expect(FakeResizeObserver.instances.at(-1)?.observe).toHaveBeenCalledTimes(1);

    (viewport as { clientWidth: number; clientHeight: number }).clientWidth = 800;
    (viewport as { clientWidth: number; clientHeight: number }).clientHeight = 400;
    FakeResizeObserver.instances.at(-1)?.trigger();
    expect(surface.style.transform).toContain("scale(1,1)");
  });

  it("does not apply a corrupt transform for an invalid target", () => {
    const { root, surface } = fitRoot(0, 300);
    hydrateContainerFits(root as unknown as ParentNode);
    expect(surface.style.transform).toBe("");
  });

  it("hydrates nested fit viewports independently", () => {
    const outer = fitRoot(400, 300);
    const inner = fitRoot(300, 200);
    const root = { querySelectorAll: () => [outer.viewport, inner.viewport] };
    hydrateContainerFits(root as unknown as ParentNode);
    expect(outer.surface.style.transform).toContain("scale(0.5,0.5)");
    expect(inner.surface.style.transform).toContain("scale(0.375,0.375)");
  });

  it("disconnects observers for removed viewports on the next hydration", () => {
    const first = fitRoot();
    hydrateContainerFits(first.root as unknown as ParentNode);
    const firstObserver = FakeResizeObserver.instances.at(-1);
    (first.viewport as { isConnected: boolean }).isConnected = false;
    const second = fitRoot();
    hydrateContainerFits(second.root as unknown as ParentNode);
    expect(firstObserver?.disconnect).toHaveBeenCalled();
  });
});

describe("hydrateRendererRuntime", () => {
  it("retains Image Crop hydration while adding Container Fit hydration", () => {
    const { viewport, surface } = fitRoot();
    const image = {
      naturalWidth: 1200,
      naturalHeight: 800,
      addEventListener: vi.fn(),
      style: {},
    };
    const imageRoot = {
      dataset: {
        powershowImageCrop: JSON.stringify({ x: 10, y: 20, width: 60, height: 50 }),
        powershowImageFit: "contain",
        powershowImageFocalX: "50",
        powershowImageFocalY: "50",
        powershowImageWidthAuthored: "true",
        powershowImageHeightAuthored: "true",
      },
      clientWidth: 600,
      clientHeight: 400,
      getBoundingClientRect: () => ({ width: 600, height: 400 }),
      querySelector: (selector: string) => selector === ".powershow-image-media" ? image : null,
    };
    const root = {
      querySelectorAll: (selector: string) => selector.includes("image-crop")
        ? [imageRoot]
        : [viewport],
    };
    hydrateRendererRuntime(root as unknown as ParentNode);
    expect(image.addEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    expect(surface.style.transform).toContain("scale(0.5,0.5)");
  });
});

vi.stubGlobal("ResizeObserver", FakeResizeObserver);
