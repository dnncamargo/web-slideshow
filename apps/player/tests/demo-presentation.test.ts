import { describe, expect, it } from "vitest";

import type { PresentationElement } from "@web-slideshow/document-schema";

import { demoPresentation } from "../src/demo-presentation";
import { displayName } from "@web-slideshow/instance-branding";

function findElement(element: PresentationElement, id: string): PresentationElement | undefined {
  if (element.id === id) return element;
  if (element.type !== "container") return undefined;
  for (const child of element.children) {
    const found = findElement(child, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe("canonical demo presentation", () => {
  it("imports as a validated current presentation with all eight slides", () => {
    expect(demoPresentation.schemaVersion).toBe(1);
    expect(demoPresentation.slides).toHaveLength(8);
    expect(demoPresentation.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
      "slide-4",
      "slide-5",
      "slide-6",
      "slide-7",
      "slide-8",
    ]);
  });

  it("keeps the demo Plot as the layout-owning element", () => {
    const slide = demoPresentation.slides.find((candidate) => candidate.id === "slide-8");
    const root = slide?.elements[0];
    const plot = root === undefined ? undefined : findElement(root, "demo-plot");
    const card = root === undefined ? undefined : findElement(root, "demo-plot-card");
    const interactive = root === undefined ? undefined : findElement(root, "demo-interactive");

    expect(plot?.type).toBe("plot");
    expect(plot?.layout).toEqual({ width: 232, height: 160 });
    expect(card?.type).toBe("container");
    expect(card?.type === "container" && card.children.some((child) => child.id === "demo-plot")).toBe(true);
    expect(findElement(root!, "demo-plot-frame")).toBeUndefined();
    expect(interactive?.type).toBe("interactive");
  });

  it("uses instance branding only in visual demo surfaces", () => {
    expect(demoPresentation.id).toBe("presentation-demo");
    expect(demoPresentation.title).toBe(`${displayName} Component Showcase`);
    const image = findElement(demoPresentation.slides[6]!.elements[0]!, "image-contain");
    expect(image?.type).toBe("image");
    expect(image?.type === "image" && image.src).toBe("/instance-demo.svg");
  });
});
