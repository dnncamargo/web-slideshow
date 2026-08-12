import { describe, expect, it } from "vitest";

import type { TextElement } from "@powershow/document-schema";

import { resolveCanvasPointerSelection } from "../src/features/editor/canvas-pointer-selection-helpers";

function textElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    type: "text",
    id: "text-1",
    hidden: false,
    variant: "body",
    content: "Hello",
    ...overrides,
  };
}

describe("canvas pointerdown selection", () => {
  const elements = [
    textElement({ id: "flow-text", content: "Flow" }),
    textElement({
      id: "absolute-text",
      style: { placement: { mode: "absolute", anchor: "center" } },
    }),
  ];

  it("selects a Flow element on pointerdown", () => {
    expect(
      resolveCanvasPointerSelection({ id: "flow-text", type: "text" }, elements),
    ).toEqual({
      id: "flow-text",
      type: "text",
      documentElement: elements[0],
    });
  });

  it("selects an Absolute element on pointerdown", () => {
    expect(
      resolveCanvasPointerSelection(
        { id: "absolute-text", type: "text" },
        elements,
      ),
    ).toEqual({
      id: "absolute-text",
      type: "text",
      documentElement: elements[1],
    });
  });

  it("returns null for Canvas background pointerdown", () => {
    expect(resolveCanvasPointerSelection(null, elements)).toBeNull();
    expect(
      resolveCanvasPointerSelection(
        { id: undefined, type: undefined },
        elements,
      ),
    ).toBeNull();
  });

  it("returns null when the target is not a known document element", () => {
    expect(
      resolveCanvasPointerSelection({ id: "missing", type: "text" }, elements),
    ).toBeNull();
  });
});