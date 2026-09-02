import { describe, expect, it } from "vitest";
import type { BlocksElement, CodeElement, SimpleTableElement, TerminalElement } from "@powershow/document-schema";
import { updateCanonicalSurfaceForCanvasDrag, updateSurfaceForCanvasResize } from "../src/features/editor/canonical-text-canvas-geometry";

const geometry = { parentWidthPx: 1000, parentHeightPx: 600, initialLeftPx: 20, initialTopPx: 30, initialRightPx: 660, initialBottomPx: 390, initialWidthPx: 320, initialHeightPx: 180 };

const dataElements: (CodeElement | TerminalElement | SimpleTableElement | BlocksElement)[] = [
  { id: "code", type: "code", hidden: false, code: "x", language: "text", showLineNumbers: true, highlightedLines: [] },
  { id: "terminal", type: "terminal", hidden: false, lines: [] },
  { id: "table", type: "table", hidden: false, columns: [], rows: [] },
  { id: "blocks", type: "blocks", hidden: false, items: [] },
];

describe("canonical data canvas routing", () => {
  it.each(dataElements)("keeps %s flow elements non-draggable but resizable", (element) => {
    const flow = updateCanonicalSurfaceForCanvasDrag(element, 20, 10, geometry);
    expect(flow).toBe(element);
    const resized = updateSurfaceForCanvasResize(element, "e", 40, 0, geometry);
    expect(resized.layout?.width).toBe(360);
    expect(resized.layout?.position).toBeUndefined();
  });

  it.each(dataElements)("moves %s absolute elements through canonical edges", (element) => {
    const absolute = { ...element, layout: { position: "absolute" as const, left: 20, top: 30, width: 320, height: 180 } };
    const dragged = updateCanonicalSurfaceForCanvasDrag(absolute, 15, -5, geometry);
    expect(dragged.layout?.left).toBe(35);
    expect(dragged.layout?.top).toBe(25);
    expect(dragged.layout?.width).toBe(320);
  });
});
