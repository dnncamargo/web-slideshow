// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import type { TextElement } from "@powershow/document-schema";

import {
  resolveCanvasEmbedPointerTarget,
  resolveCanvasPointerHit,
  resolveCanvasPointerSelection,
} from "../src/features/editor/canvas-pointer-selection-helpers";

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

describe("neutralized Embed canvas hit-testing", () => {
  const embed = {
    id: "embed-1",
    type: "embed" as const,
    left: 100,
    top: 100,
    right: 300,
    bottom: 220,
  };

  it("resolves a root Embed hit", () => {
    expect(
      resolveCanvasEmbedPointerTarget({ clientX: 150, clientY: 150 }, [embed]),
    ).toEqual({ id: "embed-1", type: "embed" });
  });

  it("resolves an Embed nested in a Container before the Container", () => {
    expect(
      resolveCanvasEmbedPointerTarget({ clientX: 250, clientY: 200 }, [embed]),
    ).toEqual({ id: "embed-1", type: "embed" });
  });

  it("does not resolve the Container area outside the Embed", () => {
    expect(
      resolveCanvasEmbedPointerTarget({ clientX: 350, clientY: 200 }, [embed]),
    ).toBeNull();
  });

  it("leaves ordinary Text and Container DOM selection to the existing path", () => {
    const ordinaryText = textElement({ id: "ordinary-text" });

    expect(resolveCanvasEmbedPointerTarget({ clientX: 50, clientY: 50 }, [])).toBeNull();
    expect(
      resolveCanvasPointerSelection(
        { id: "ordinary-text", type: "text" },
        [ordinaryText],
      ),
    ).toMatchObject({ id: "ordinary-text", type: "text" });
  });
});

describe("Canvas pointer hit resolution", () => {
  function canvasElement(
    id: string,
    type: string,
    parent?: HTMLElement,
  ): HTMLElement {
    const element = document.createElement("div");

    element.dataset.powershowId = id;
    element.dataset.powershowType = type;

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }

  it("selects a root Embed and retains its authored DOM element", () => {
    const embed = canvasElement("embed-1", "embed");
    const hit = resolveCanvasPointerHit({
      embeds: [embed],
      embedTarget: { id: "embed-1", type: "embed" },
      ordinaryTarget: null,
    });

    expect(hit.elementTarget).toBe(embed);
    expect(hit.target).toEqual({ id: "embed-1", type: "embed" });
  });

  it("selects an Embed nested in a Container over the Container", () => {
    const container = canvasElement("container-1", "container");
    const embed = canvasElement("embed-1", "embed", container);
    const hit = resolveCanvasPointerHit({
      embeds: [embed],
      embedTarget: { id: "embed-1", type: "embed" },
      ordinaryTarget: container,
    });

    expect(hit.elementTarget).toBe(embed);
    expect(hit.target).toEqual({ id: "embed-1", type: "embed" });
  });

  it("selects the Container when the pointer is outside the Embed", () => {
    const container = canvasElement("container-1", "container");
    const embed = canvasElement("embed-1", "embed", container);
    const hit = resolveCanvasPointerHit({
      embeds: [embed],
      embedTarget: null,
      ordinaryTarget: container,
    });

    expect(hit.elementTarget).toBe(container);
    expect(hit.target).toEqual({ id: "container-1", type: "container" });
  });

  it("does not preempt a sibling authored element over an Embed rectangle", () => {
    const embed = canvasElement("embed-1", "embed");
    const text = canvasElement("text-1", "text");
    const hit = resolveCanvasPointerHit({
      embeds: [embed],
      embedTarget: { id: "embed-1", type: "embed" },
      ordinaryTarget: text,
    });

    expect(hit.elementTarget).toBe(text);
    expect(hit.target).toEqual({ id: "text-1", type: "text" });
  });

  it("keeps the ordinary authored selection when no Embed is hit", () => {
    const text = canvasElement("text-1", "text");
    const hit = resolveCanvasPointerHit({
      embeds: [],
      embedTarget: null,
      ordinaryTarget: text,
    });

    expect(hit.elementTarget).toBe(text);
    expect(hit.target).toEqual({ id: "text-1", type: "text" });
  });

  it("returns null targets for Canvas background hits", () => {
    const hit = resolveCanvasPointerHit({
      embeds: [],
      embedTarget: null,
      ordinaryTarget: null,
    });

    expect(hit.elementTarget).toBeNull();
    expect(hit.target).toBeNull();
  });
});
