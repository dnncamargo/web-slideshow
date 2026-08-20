import { describe, expect, it } from "vitest";

import {
  ContentSlotSchema,
  PowerShowElementSchema,
  TableElementSchema,
  TopicItemSchema,
  TopicsElementSchema,
} from "../src";

function textElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "text",
    id: "text-1",
    hidden: false,
    variant: "body",
    content: "PowerShow",
    ...overrides,
  };
}

function textboxElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "textbox",
    id: "textbox-1",
    hidden: false,
    content: "PowerShow",
    ...overrides,
  };
}

function imageElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "image",
    id: "image-1",
    hidden: false,
    src: "/assets/example.png",
    alt: "Example image",
    fit: "contain",
    ...overrides,
  };
}

function codeElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "code",
    id: "code-1",
    hidden: false,
    code: "const answer = 42;",
    language: "typescript",
    showLineNumbers: true,
    highlightedLines: [],
    ...overrides,
  };
}

function terminalElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "terminal",
    id: "terminal-1",
    hidden: false,
    lines: [],
    ...overrides,
  };
}

function tableElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "table",
    id: "table-1",
    hidden: false,
    columns: [
      {
        key: "value",
        label: "Value",
      },
    ],
    rows: [],
    ...overrides,
  };
}

function containerElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "container",
    id: "container-1",
    hidden: false,
    direction: "column",
    children: [],
    ...overrides,
  };
}

function contentSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: "slot-1",
    children: [],
    ...overrides,
  };
}

function topicItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "topic-1",
    content: contentSlot(),
    children: [],
    ...overrides,
  };
}

function topicsElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items: [],
    ...overrides,
  };
}

describe("TopicsElementSchema", () => {
  it("accepts a minimal unordered topics element", () => {
    const result = TopicsElementSchema.safeParse(topicsElement());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        id: "topics-1",
        type: "topics",
        hidden: false,
        kind: "unordered",
        items: [],
      });
      expect(result.data).not.toHaveProperty("rootMarkerStyle");
      expect(result.data).not.toHaveProperty("markerColor");
      expect(result.data).not.toHaveProperty("itemGap");
    }
  });

  it("accepts a minimal ordered topics element", () => {
    const result = TopicsElementSchema.safeParse(
      topicsElement({
        id: "topics-ordered",
        kind: "ordered",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a missing kind", () => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          kind: undefined,
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects an unsupported kind", () => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          kind: "stacked",
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects missing items", () => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          items: undefined,
        }),
      ).success,
    ).toBe(false);
  });

  it("keeps hidden default behavior consistent with BaseElementSchema", () => {
    const result = TopicsElementSchema.parse(
      topicsElement({
        id: "topics-hidden-default",
      }),
    );

    expect(result.hidden).toBe(false);
  });

  it("accepts a non-negative itemGap", () => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          id: "topics-gap",
          itemGap: 0,
        }),
      ).success,
    ).toBe(true);

    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          id: "topics-gap-large",
          itemGap: 24,
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects a negative itemGap", () => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          id: "topics-gap-negative",
          itemGap: -1,
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts root marker style and marker color overrides", () => {
    const result = TopicsElementSchema.safeParse(
      topicsElement({
        id: "topics-marker",
        rootMarkerStyle: "circle",
        markerColor: "#f8fafc",
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.rootMarkerStyle).toBe("circle");
      expect(result.data.markerColor).toBe("#f8fafc");
    }
  });

  it.each([
    "disc",
    "circle",
    "square",
    "none",
    "decimal",
    "lower-alpha",
    "upper-alpha",
    "lower-roman",
    "upper-roman",
  ] as const)("accepts root marker style %s", (rootMarkerStyle) => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          id: `topics-marker-${rootMarkerStyle}`,
          rootMarkerStyle,
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects an unsupported root marker style", () => {
    expect(
      TopicsElementSchema.safeParse(
        topicsElement({
          id: "topics-invalid-marker",
          rootMarkerStyle: "triangle" as never,
        }),
      ).success,
    ).toBe(false);
  });
});

describe("TopicItemSchema", () => {
  it("accepts a minimal topic item", () => {
    const result = TopicItemSchema.safeParse(topicItem());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        id: "topic-1",
        content: {
          id: "slot-1",
          children: [],
        },
        children: [],
      });
    }
  });

  it("rejects a missing id", () => {
    expect(
      TopicItemSchema.safeParse(
        topicItem({
          id: undefined,
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(
      TopicItemSchema.safeParse(
        topicItem({
          id: "",
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects missing content", () => {
    expect(
      TopicItemSchema.safeParse(
        topicItem({
          content: undefined,
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects missing children", () => {
    expect(
      TopicItemSchema.safeParse(
        topicItem({
          children: undefined,
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts nested topic recursion", () => {
    const result = TopicItemSchema.safeParse(
      topicItem({
        id: "topic-parent",
        children: [
          topicItem({
            id: "topic-child",
            children: [
              topicItem({
                id: "topic-grandchild",
              }),
            ],
          }),
        ],
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children[0]).toMatchObject({
        id: "topic-child",
        children: [
          {
            id: "topic-grandchild",
          },
        ],
      });
    }
  });
});

describe("ContentSlotSchema", () => {
  it("accepts mixed PowerShowElement children", () => {
    const result = ContentSlotSchema.safeParse(
      contentSlot({
        id: "slot-mixed",
        children: [
          textElement({ id: "text-child" }),
          textboxElement({ id: "textbox-child" }),
          imageElement({ id: "image-child" }),
          containerElement({
            id: "container-child",
            children: [textElement({ id: "nested-text" })],
          }),
          codeElement({ id: "code-child" }),
          terminalElement({ id: "terminal-child" }),
          tableElement({ id: "table-child" }),
          topicsElement({
            id: "topics-child",
            items: [],
          }),
        ],
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children.map((child) => child.type)).toEqual([
        "text",
        "textbox",
        "image",
        "container",
        "code",
        "terminal",
        "table",
        "topics",
      ]);
    }
  });

  it("accepts a container inside topic content", () => {
    const result = TopicItemSchema.safeParse(
      topicItem({
        id: "topic-with-container",
        content: contentSlot({
          id: "slot-container",
          children: [
            containerElement({
              id: "container-inside-slot",
              children: [textElement({ id: "inner-text" })],
            }),
          ],
        }),
      }),
    );

    expect(result.success).toBe(true);
  });

  it("accepts a nested autonomous topics element inside topic content", () => {
    const result = TopicItemSchema.safeParse(
      topicItem({
        id: "topic-with-topics",
        content: contentSlot({
          id: "slot-topics",
          children: [
            topicsElement({
              id: "nested-topics",
              kind: "ordered",
              items: [
                topicItem({
                  id: "nested-topic",
                }),
              ],
            }),
          ],
        }),
      }),
    );

    expect(result.success).toBe(true);
  });
});

describe("PowerShowElementSchema integration", () => {
  it("accepts topics inside a container", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        id: "topics-container",
        children: [
          topicsElement({
            id: "topics-root",
            kind: "ordered",
            items: [
              topicItem({
                id: "topic-inside-container",
              }),
            ],
          }),
        ],
      }),
    );

    expect(result.success).toBe(true);
  });
});

describe("TableElementSchema", () => {
  it("still validates the existing table shape", () => {
    const result = TableElementSchema.safeParse(
      tableElement({
        id: "table-existing",
        rows: [
          {
            value: "alpha",
          },
        ],
      }),
    );

    expect(result.success).toBe(true);
  });
});

describe("Topics serialization", () => {
  it("roundtrips through JSON serialization", () => {
    const source = TopicsElementSchema.parse(
      topicsElement({
        id: "topics-roundtrip",
        kind: "ordered",
        itemGap: 12,
        style: {
          className: "topics-root",
          opacity: 0.8,
        },
        items: [
          topicItem({
            id: "topic-roundtrip",
            content: contentSlot({
              id: "slot-roundtrip",
              style: {
                className: "topic-slot",
              },
              children: [
                textElement({
                  id: "topic-text",
                  link: {
                    kind: "url",
                    href: "https://example.com",
                  },
                }),
              ],
            }),
            children: [
              topicItem({
                id: "nested-topic-roundtrip",
              }),
            ],
          }),
        ],
      }),
    );

    const restored = TopicsElementSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });
});
