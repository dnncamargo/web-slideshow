import { describe, expect, it } from "vitest";

import { resolveCanvasClickSelection } from "../src/features/editor/canvas-selection-helpers";

function makeElement(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.firstElementChild as HTMLElement;
}

describe("canvas click selection resolution", () => {
  it("selects the PowerShow element clicked", () => {
    const element = makeElement('<section data-powershow-id="image-1" data-powershow-type="image"></section>');

    expect(resolveCanvasClickSelection(element)).toEqual({ id: "image-1", type: "image" });
  });

  it("resolves the nearest PowerShow ancestor from a nested click target", () => {
    const element = makeElement(
      '<section data-powershow-id="container-1" data-powershow-type="container"><span data-powershow-id="text-1" data-powershow-type="text">hello</span></section>',
    );
    const text = element.querySelector<HTMLElement>("[data-powershow-id='text-1']");

    expect(resolveCanvasClickSelection(text)).toEqual({ id: "text-1", type: "text" });
  });

  it("clears selection when the canvas background is clicked", () => {
    expect(resolveCanvasClickSelection(null)).toBeNull();
  });

  it("returns null for an element without a powershow id", () => {
    expect(resolveCanvasClickSelection(makeElement("<div></div>"))).toBeNull();
  });
});