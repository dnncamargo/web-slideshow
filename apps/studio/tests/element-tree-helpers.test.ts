import { describe, expect, it } from "vitest";

import {
  getElementLabel,
  getParentTargets,
  getTreeActionState,
  resolveTreeDrop,
} from "../src/features/editor/element-tree-helpers";

describe("element tree helpers", () => {
  const nested = {
    type: "container" as const,
    id: "nested",
    hidden: false,
    direction: "column" as const,
    children: [],
  };
  const container = {
    type: "container" as const,
    id: "container",
    hidden: false,
    direction: "column" as const,
    children: [nested],
  };
  const slide = { id: "slide", title: "", summary: "", speakerNotes: "", elements: [container] };

  it("creates concise sanitized text labels", () => {
    expect(
      getElementLabel(
        { type: "text", id: "text", hidden: false, variant: "body", content: "<b>Intro</b> to PWM" },
        "Text",
      ),
    ).toBe("Text — Intro to PWM");
  });

  it("excludes self and descendants from valid parent targets", () => {
    expect(getParentTargets(slide, container, (key) => key === "tree.slide" ? "Slide" : "Container")).toEqual([
      { id: null, label: "Slide" },
    ]);
  });

  it("reports sibling and move-out action boundaries", () => {
    expect(getTreeActionState(0, 2, null)).toEqual({ canMoveUp: false, canMoveDown: true, canMoveOut: false });
    expect(getTreeActionState(1, 2, "container")).toEqual({ canMoveUp: true, canMoveDown: false, canMoveOut: true });
  });

  it("resolves before and after drops with same-parent index shifts", () => {
    const elements = [
      { type: "text" as const, id: "first", hidden: false, variant: "body" as const, content: "First" },
      { type: "text" as const, id: "second", hidden: false, variant: "body" as const, content: "Second" },
      { type: "text" as const, id: "third", hidden: false, variant: "body" as const, content: "Third" },
    ];

    expect(resolveTreeDrop(elements, "first", "third", "before")).toEqual({
      elementId: "first",
      targetParentId: null,
      targetIndex: 1,
    });
    expect(resolveTreeDrop(elements, "first", "third", "after")).toEqual({
      elementId: "first",
      targetParentId: null,
      targetIndex: 2,
    });
  });

  it("accepts valid inside drops and rejects non-container, self, and descendant targets", () => {
    const elements = [
      {
        type: "container" as const,
        id: "outer",
        hidden: false,
        direction: "column" as const,
        children: [
          {
            type: "container" as const,
            id: "inner",
            hidden: false,
            direction: "column" as const,
            children: [],
          },
        ],
      },
      { type: "text" as const, id: "text", hidden: false, variant: "body" as const, content: "Text" },
    ];

    expect(resolveTreeDrop(elements, "text", "outer", "inside")).toEqual({
      elementId: "text",
      targetParentId: "outer",
    });
    expect(resolveTreeDrop(elements, "text", "outer", "before")).toEqual({
      elementId: "text",
      targetParentId: null,
      targetIndex: 0,
    });
    expect(resolveTreeDrop(elements, "text", "text", "before")).toBeNull();
    expect(resolveTreeDrop(elements, "outer", "inner", "inside")).toBeNull();
    expect(resolveTreeDrop(elements, "outer", "text", "inside")).toBeNull();
  });
});
