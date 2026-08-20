import { describe, expect, it } from "vitest";

import {
  getElementLabel,
  getElementTreeChildren,
  getParentTargets,
  getTreeActionState,
  resolveTreeDrop,
} from "../src/features/editor/element-tree-helpers";

describe("element tree helpers", () => {
  const container = {
    type: "container" as const,
    id: "container",
    hidden: false,
    direction: "column" as const,
    children: [],
  };
  const slot = {
    id: "slot",
    children: [
      {
        type: "text" as const,
        id: "slot-text",
        hidden: false,
        variant: "body" as const,
        content: "Slot",
      },
    ],
  };
  const topics = {
    type: "topics" as const,
    id: "topics",
    hidden: false,
    kind: "unordered" as const,
    items: [
      {
        id: "topic",
        content: slot,
        children: [],
      },
    ],
  };
  const slide = {
    id: "slide",
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [container, topics],
  };

  it("creates concise sanitized text labels", () => {
    expect(
      getElementLabel(
        {
          type: "text",
          id: "text",
          hidden: false,
          variant: "body",
          content: "<b>Intro</b> to PWM",
        },
        "Text",
      ),
    ).toBe("Text — Intro to PWM");
  });

  it("excludes self and descendants from valid parent targets", () => {
    expect(
      getParentTargets(slide, container, (key) =>
        key === "tree.slide" ? "Slide" : "Container",
      ),
    ).toEqual([{ id: null, label: "Slide" }]);
  });

  it("reports sibling and move-out action boundaries", () => {
    expect(getTreeActionState(0, 2, { kind: "slide" })).toEqual({
      canMoveUp: false,
      canMoveDown: true,
      canMoveOut: false,
    });
    expect(
      getTreeActionState(1, 2, { kind: "container", id: "container" }),
    ).toEqual({ canMoveUp: true, canMoveDown: false, canMoveOut: true });
    expect(
      getTreeActionState(1, 2, { kind: "content-slot", id: "slot" }),
    ).toEqual({
      canMoveUp: true,
      canMoveDown: false,
      canMoveOut: false,
    });
  });

  it("resolves before and after drops with same-parent index shifts", () => {
    const elements = [
      {
        type: "text" as const,
        id: "first",
        hidden: false,
        variant: "body" as const,
        content: "First",
      },
      {
        type: "text" as const,
        id: "second",
        hidden: false,
        variant: "body" as const,
        content: "Second",
      },
      {
        type: "text" as const,
        id: "third",
        hidden: false,
        variant: "body" as const,
        content: "Third",
      },
    ];

    expect(resolveTreeDrop(elements, "first", "third", "before")).toEqual({
      elementId: "first",
      targetParentRef: { kind: "slide" },
      targetIndex: 1,
    });
    expect(resolveTreeDrop(elements, "first", "third", "after")).toEqual({
      elementId: "first",
      targetParentRef: { kind: "slide" },
      targetIndex: 2,
    });
  });

  it("does not treat container and content-slot parents with the same id as the same sibling list", () => {
    const elements = [
      {
        type: "container" as const,
        id: "shared",
        hidden: false,
        direction: "column" as const,
        children: [
          {
            type: "text" as const,
            id: "source",
            hidden: false,
            variant: "body" as const,
            content: "Source",
          },
        ],
      },
      {
        type: "topics" as const,
        id: "topics-shared-parent-test",
        hidden: false,
        kind: "unordered" as const,
        items: [
          {
            id: "topic-shared-parent-test",
            content: {
              id: "shared",
              children: [
                {
                  type: "text" as const,
                  id: "slot-first",
                  hidden: false,
                  variant: "body" as const,
                  content: "Slot first",
                },
                {
                  type: "text" as const,
                  id: "target",
                  hidden: false,
                  variant: "body" as const,
                  content: "Target",
                },
              ],
            },
            children: [],
          },
        ],
      },
    ];

    expect(resolveTreeDrop(elements, "source", "target", "before")).toEqual({
      elementId: "source",
      targetParentRef: {
        kind: "content-slot",
        id: "shared",
      },
      targetIndex: 1,
    });
  });

  it("accepts valid inside drops and resolves content slot siblings", () => {
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
      {
        type: "text" as const,
        id: "text",
        hidden: false,
        variant: "body" as const,
        content: "Text",
      },
    ];

    expect(resolveTreeDrop(elements, "text", "outer", "inside")).toEqual({
      elementId: "text",
      targetParentRef: { kind: "container", id: "outer" },
    });
    expect(
      resolveTreeDrop(
        [
          {
            type: "topics" as const,
            id: "topics",
            hidden: false,
            kind: "unordered" as const,
            items: [
              {
                id: "topic",
                content: {
                  id: "slot",
                  children: [
                    {
                      type: "text" as const,
                      id: "first",
                      hidden: false,
                      variant: "body" as const,
                      content: "First",
                    },
                    {
                      type: "text" as const,
                      id: "second",
                      hidden: false,
                      variant: "body" as const,
                      content: "Second",
                    },
                  ],
                },
                children: [],
              },
            ],
          },
        ],
        "first",
        "second",
        "after",
      ),
    ).toEqual({
      elementId: "first",
      targetParentRef: { kind: "content-slot", id: "slot" },
      targetIndex: 1,
    });
    expect(resolveTreeDrop(elements, "text", "text", "before")).toBeNull();
    expect(resolveTreeDrop(elements, "outer", "inner", "inside")).toBeNull();
    expect(resolveTreeDrop(elements, "outer", "text", "inside")).toBeNull();
  });

  it("keeps Topics structural nodes out of generic tree children", () => {
    const topicsElement = {
      type: "topics" as const,
      id: "topics",
      hidden: false,
      kind: "unordered" as const,
      items: [
        {
          id: "topic-a",
          content: {
            id: "slot-a",
            children: [
              {
                type: "text" as const,
                id: "slot-text",
                hidden: false,
                variant: "body" as const,
                content: "Slot",
              },
              {
                type: "image" as const,
                id: "slot-image",
                hidden: false,
                src: "/a.png",
                alt: "a",
                fit: "contain" as const,
              },
            ],
          },
          children: [
            {
              id: "topic-a-child",
              content: {
                id: "slot-a-child",
                children: [
                  {
                    type: "container" as const,
                    id: "slot-child-container",
                    hidden: false,
                    direction: "column" as const,
                    children: [],
                  },
                ],
              },
              children: [],
            },
          ],
        },
      ],
    };

    expect(getElementTreeChildren(topicsElement)).toEqual([]);
  });

  it("returns container children and empty lists for leaf nodes", () => {
    const containerWithChild = {
      type: "container" as const,
      id: "outer",
      hidden: false,
      direction: "column" as const,
      children: [
        {
          type: "text" as const,
          id: "inner-text",
          hidden: false,
          variant: "body" as const,
          content: "Inner",
        },
      ],
    };

    expect(
      getElementTreeChildren(containerWithChild).map((child) => child.id),
    ).toEqual(["inner-text"]);

    expect(
      getElementTreeChildren({
        type: "text" as const,
        id: "leaf",
        hidden: false,
        variant: "body" as const,
        content: "Leaf",
      }),
    ).toEqual([]);
  });
});
