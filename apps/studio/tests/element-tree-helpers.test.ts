import { describe, expect, it } from "vitest";

import {
  getElementLabel,
  getParentTargets,
  getTreeActionState,
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
});
