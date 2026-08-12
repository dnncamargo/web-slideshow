import { describe, expect, it } from "vitest";
import type { ContainerElement, PowerShowElement } from "@powershow/document-schema";

import {
  moveElement,
  moveElementOut,
} from "../src/features/editor/element-operations";

function text(id: string, content = id) {
  return {
    type: "text" as const,
    id,
    hidden: false,
    variant: "body" as const,
    content,
  };
}

function container(id: string, children: PowerShowElement[] = []): ContainerElement {
  return {
    type: "container" as const,
    id,
    hidden: false,
    direction: "column" as const,
    children,
  };
}

describe("canonical element hierarchy moves", () => {
  it("reorders siblings upward and downward", () => {
    const elements = [text("first"), text("selected"), text("last")];

    expect(
      moveElement(elements, {
        elementId: "selected",
        targetParentId: null,
        targetIndex: 0,
      }).elements.map((element) => element.id),
    ).toEqual(["selected", "first", "last"]);
    expect(
      moveElement(elements, {
        elementId: "selected",
        targetParentId: null,
        targetIndex: 2,
      }).elements.map((element) => element.id),
    ).toEqual(["first", "last", "selected"]);
  });

  it("moves slide-root children into containers and back out", () => {
    const elements = [text("text"), container("container")];
    const inside = moveElement(elements, {
      elementId: "text",
      targetParentId: "container",
    });

    expect(inside.moved).toBe(true);
    expect(inside.elements).toHaveLength(1);
    expect((inside.elements[0] as ReturnType<typeof container>).children[0]?.id).toBe("text");

    const outside = moveElementOut(inside.elements, "text");
    expect(outside.moved).toBe(true);
    expect(outside.elements.map((element) => element.id)).toEqual(["container", "text"]);
  });

  it("moves between nested containers without duplicating or rewriting elements", () => {
    const positioned = {
      ...text("positioned", "Keep me"),
      style: {
        color: "#ffffff",
        placement: { mode: "absolute" as const, anchor: "center" as const, offsetX: "-20px" },
      },
    };
    const elements = [
      { ...container("source"), children: [positioned] },
      { ...container("target"), children: [container("nested")] },
    ];

    const result = moveElement(elements, {
      elementId: "positioned",
      targetParentId: "nested",
      targetIndex: 0,
    });

    const source = result.elements[0] as ReturnType<typeof container>;
    const target = result.elements[1] as ReturnType<typeof container>;
    const nested = target.children[0];

    expect(source.children).toEqual([]);
    expect(nested?.type).toBe("container");

    if (nested?.type === "container") {
      expect(nested.children).toHaveLength(1);
      expect(nested.children[0]).toEqual(positioned);
    }
  });

  it("rejects self and descendant targets atomically", () => {
    const elements = [
      {
        ...container("outer"),
        children: [container("inner")],
      },
    ];

    const selfMove = moveElement(elements, {
      elementId: "outer",
      targetParentId: "outer",
    });
    const cycleMove = moveElement(elements, {
      elementId: "outer",
      targetParentId: "inner",
    });

    expect(selfMove).toEqual({ elements, moved: false, error: "cycle" });
    expect(cycleMove).toEqual({ elements, moved: false, error: "cycle" });
  });

  it("rejects invalid target indices without removing the source", () => {
    const elements = [text("text"), container("target")];
    const result = moveElement(elements, {
      elementId: "text",
      targetParentId: "target",
      targetIndex: 2,
    });

    expect(result).toEqual({ elements, moved: false, error: "invalid-target-index" });
  });
});
