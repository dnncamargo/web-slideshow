import { describe, expect, it } from "vitest";

import type { TopicItem, TopicsElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function topicMarkerSequence(html: string): string[] {
  const matches: string[] = [];

  const regex = /--powershow-topic-marker-style:([a-z-]+)/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1]!);
  }

  return matches;
}

function nestedTopicItems(depth: number, overrides: Record<string, unknown> = {}): TopicItem[] {
  const item: TopicItem = {
    id: `topic-depth-${depth}`,
    content: {
      id: `slot-depth-${depth}`,
      children: [],
    },
    children: [],
    ...overrides,
  };

  if (depth > 0) {
    item.children = nestedTopicItems(depth - 1);
  }

  return [item];
}

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

function topicItem(overrides: Record<string, unknown> = {}): TopicItem {
  return {
    id: "topic-1",
    content: {
      id: "slot-1",
      children: [],
    },
    children: [],
    ...overrides,
  } as TopicItem;
}

function topicsElement(overrides: Record<string, unknown> = {}): TopicsElement {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items: [],
    ...overrides,
  } as TopicsElement;
}

describe("renderElement topics support", () => {
  it("renders an unordered root as a ul with canonical attributes", () => {
    const html = renderElement(
      topicsElement({
        id: "topics-root",
        layout: {
          position: "absolute",
          left: 12,
        },
        style: {
          className: "topic-root",
        },
      }),
    );

    expect(html).toContain(
      '<ul class="powershow-element powershow-topics topic-root"',
    );
    expect(html).toContain('data-powershow-id="topics-root"');
    expect(html).toContain('data-powershow-type="topics"');
    expect(html).toContain("position:absolute");
  });

  it("renders an ordered root as an ol", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-topics",
        kind: "ordered",
      }),
    );

    expect(html).toContain("<ol ");
  });

  it("renders an explicit itemGap as a CSS custom property", () => {
    const html = renderElement(
      topicsElement({
        id: "spaced-topics",
        itemGap: 12,
        items: [
          topicItem({
            id: "topic-a",
            children: [
              topicItem({
                id: "topic-a-child",
              }),
            ],
          }),
        ],
      }),
    );

    expect(html).toContain("--powershow-topic-item-gap:12px");
    expect(countOccurrences(html, "--powershow-topic-item-gap:12px")).toBe(1);
    expect(countOccurrences(html, "<li ")).toBe(2);
  });

  it.each([
    ["unordered", "circle"],
    ["ordered", "lower-roman"],
    ["unordered", "none"],
  ] as const)("renders %s topics with root marker style %s", (kind, rootMarkerStyle) => {
    const html = renderElement(
      topicsElement({
        id: `topics-${kind}-${rootMarkerStyle}`,
        kind,
        rootMarkerStyle,
      }),
    );

    expect(html).toContain(`--powershow-topic-marker-style:${rootMarkerStyle}`);
  });

  it("renders an independent marker color override", () => {
    const html = renderElement(
      topicsElement({
        id: "colored-markers",
        markerColor: "#22d3ee",
      }),
    );

    expect(html).toContain("--powershow-topic-marker-color:#22d3ee");
  });

  it("preserves a local Text override inside collectively styled Topics", () => {
    const html = renderElement(
      topicsElement({
        id: "styled-topics",
        style: {
          color: "#ffffff",
        },
        typography: {
          fontSize: 30,
          fontWeight: 400,
        },
        items: [
          topicItem({
            id: "topic-a",
            content: {
              id: "slot-a",
              children: [
                textElement({
                  id: "topic-a-text",
                  content: "Local override",
                  style: {
                    color: "#facc15",
                  },
                  typography: { fontWeight: 700 },
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toContain("--powershow-topic-color:#ffffff");
    expect(html).toContain("--powershow-topic-font-size:30px");
    expect(html).toContain("color:#facc15");
    expect(html).toContain("font-weight:700");
  });

  it("renders collective topic text defaults as scoped custom properties", () => {
    const html = renderElement(
      topicsElement({
        id: "styled-topics",
        style: {
          color: "#ffffff",
        },
        typography: {
          fontFamily: "Inter",
          fontSize: 24,
          fontStyle: "italic",
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: 1,
          textDecorationLine: "underline",
        },
        items: [
          topicItem({
            id: "topic-a",
            content: {
              id: "slot-a",
              children: [
                textElement({
                  id: "topic-a-text",
                  content: "Styled topic",
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toContain("--powershow-topic-color:#ffffff");
    expect(html).toContain("--powershow-topic-font-family:&quot;Inter&quot;");
    expect(html).toContain("--powershow-topic-font-size:24px");
    expect(html).toContain("--powershow-topic-font-weight:700");
    expect(html).toContain("--powershow-topic-font-style:italic");
    expect(html).toContain("--powershow-topic-line-height:1.4");
    expect(html).toContain("--powershow-topic-letter-spacing:1px");
    expect(html).toContain("--powershow-topic-text-decoration-line:underline");
    expect(html).not.toContain('style="text-decoration-line:underline"');
  });

  it("renders an empty list without items", () => {
    const html = renderElement(
      topicsElement({
        id: "empty-topics",
      }),
    );

    expect(html).toContain("<ul ");
    expect(html).not.toContain("<li ");
    expect(html).toContain("</ul>");
  });

  it("renders nothing when hidden", () => {
    expect(
      renderElement(
        topicsElement({
          id: "hidden-topics",
          hidden: true,
        }),
      ),
    ).toBe("");
  });

  it("renders one topic item as one li", () => {
    const html = renderElement(
      topicsElement({
        id: "single-topic-list",
        items: [
          topicItem({
            id: "topic-1",
            content: {
              id: "slot-1",
              children: [
                textElement({
                  id: "topic-text",
                  content: "Topic text",
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(countOccurrences(html, "<li ")).toBe(1);
    expect(html).toContain("Topic text");
  });

  it("exposes the canonical ContentSlot id as structural terminator metadata on each topic li", () => {
    const html = renderElement(
      topicsElement({
        id: "slot-metadata",
        items: [
          topicItem({
            id: "parent-topic",
            content: {
              id: "parent-slot",
              children: [],
            },
            children: [
              topicItem({
                id: "child-topic",
                content: {
                  id: "child-slot",
                  children: [],
                },
              }),
            ],
          }),
        ],
      }),
    );

    expect(
      countOccurrences(html, 'data-powershow-content-slot-id="parent-slot"'),
    ).toBe(1);
    expect(
      countOccurrences(html, 'data-powershow-content-slot-id="child-slot"'),
    ).toBe(1);
    expect(html).toContain('data-powershow-content-slot-id="parent-slot"');
  });

  it("renders ContentSlot children directly inside li", () => {
    const html = renderElement(
      topicsElement({
        id: "direct-slot",
        items: [
          topicItem({
            id: "topic-direct",
            content: {
              id: "slot-direct",
              children: [
                textElement({
                  id: "direct-text",
                  content: "Direct content",
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toMatch(/<li[^>]*><p /);
    expect(
      countOccurrences(
        html,
        'data-powershow-content-slot-id="slot-direct"',
      ),
    ).toBe(1);
    expect(html).not.toContain('data-powershow-id="slot-direct"');
  });

  it("preserves child order", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-content",
        items: [
          topicItem({
            id: "topic-order",
            content: {
              id: "slot-order",
              children: [
                textElement({
                  id: "first-child",
                  content: "First child",
                }),
                imageElement({
                  id: "second-child",
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html.indexOf("First child")).toBeLessThan(
      html.indexOf('src="/assets/example.png"'),
    );
  });

  it("applies ContentSlot style and className to li", () => {
    const html = renderElement(
      topicsElement({
        id: "styled-slot",
        items: [
          topicItem({
            id: "topic-styled",
            content: {
              id: "slot-styled",
              style: {
                padding: 12,
                className: 'topic "body"',
              },
              children: [
                textElement({
                  id: "styled-text",
                  content: "Styled",
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toContain(
      '<li class="powershow-topic-item topic &quot;body&quot;" data-powershow-content-slot-id="slot-styled" style="padding:12px">',
    );
  });

  it("renders nested topic children as the same kind of list", () => {
    const html = renderElement(
      topicsElement({
        id: "nested-topics",
        kind: "unordered",
        items: [
          topicItem({
            id: "parent-topic",
            children: [
              topicItem({
                id: "child-topic",
              }),
            ],
          }),
        ],
      }),
    );

    expect(html).toContain('<ul class="powershow-topics" style=');
    expect(countOccurrences(html, 'data-powershow-type="topics"')).toBe(1);
    expect(
      countOccurrences(html, 'class="powershow-element powershow-topics"'),
    ).toBe(1);
  });

  it("renders mixed children and preserves safe links", () => {
    const html = renderElement(
      topicsElement({
        id: "mixed-topics",
        items: [
          topicItem({
            id: "mixed-topic",
            content: {
              id: "slot-mixed",
              children: [
                textElement({
                  id: "linked-text",
                  content: "Linked text",
                  link: {
                    kind: "url",
                    href: "https://example.com/text",
                    target: "_blank",
                  },
                }),
                imageElement({
                  id: "linked-image",
                  link: {
                    kind: "url",
                    href: "http://example.com/image",
                  },
                }),
                containerElement({
                  id: "mixed-container",
                  children: [
                    textElement({
                      id: "nested-text",
                      content: "Nested text",
                    }),
                  ],
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toContain('href="https://example.com/text"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="http://example.com/image"');
    expect(html).toContain('data-powershow-type="container"');
  });

  it("renders an autonomous nested topics element inside the topic content", () => {
    const html = renderElement(
      topicsElement({
        id: "topics-with-nested-topics",
        items: [
          topicItem({
            id: "parent-topic",
            content: {
              id: "slot-with-topics",
              children: [
                topicsElement({
                  id: "nested-topics-root",
                  kind: "ordered",
                  items: [
                    topicItem({
                      id: "nested-topic",
                    }),
                  ],
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(countOccurrences(html, 'data-powershow-type="topics"')).toBe(2);
    expect(
      countOccurrences(html, 'class="powershow-element powershow-topics"'),
    ).toBe(2);
    expect(html).toContain("<ol ");
  });

  it("escapes authored attributes and content", () => {
    const html = renderElement(
      topicsElement({
        id: "topics-escaping",
        style: {
          className: 'topic "root"',
        },
        items: [
          topicItem({
            id: "topic-escaping",
            content: {
              id: "slot-escaping",
              style: {
                className: 'slot "body"',
              },
              children: [
                textElement({
                  id: "escaped-text",
                  content: '<script>alert("x")</script>',
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toContain(
      'class="powershow-element powershow-topics topic &quot;root&quot;"',
    );
    expect(html).toContain(
      'class="powershow-topic-item slot &quot;body&quot;"',
    );
    expect(html).toContain("&lt;script&gt;");
  });

  // ============================================================
  // BEGIN: STRUCTURAL MARKER PROGRESSION
  // ============================================================

  it("derives unordered default markers by structural depth", () => {
    const html = renderElement(
      topicsElement({
        id: "unordered-default",
        kind: "unordered",
        items: nestedTopicItems(3),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "disc",
      "circle",
      "square",
      "disc",
    ]);
  });

  it("derives unordered markers starting from circle", () => {
    const html = renderElement(
      topicsElement({
        id: "unordered-circle",
        kind: "unordered",
        rootMarkerStyle: "circle",
        items: nestedTopicItems(2),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "circle",
      "square",
      "disc",
    ]);
  });

  it("derives unordered markers starting from square", () => {
    const html = renderElement(
      topicsElement({
        id: "unordered-square",
        kind: "unordered",
        rootMarkerStyle: "square",
        items: nestedTopicItems(2),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "square",
      "disc",
      "circle",
    ]);
  });

  it("uses none at every structural level for unordered topics", () => {
    const html = renderElement(
      topicsElement({
        id: "unordered-none",
        kind: "unordered",
        rootMarkerStyle: "none",
        items: nestedTopicItems(3),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "none",
      "none",
      "none",
      "none",
    ]);
  });

  it("derives ordered default markers by structural depth", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-default",
        kind: "ordered",
        items: nestedTopicItems(3),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "decimal",
      "lower-alpha",
      "lower-roman",
      "decimal",
    ]);
  });

  it("derives ordered markers starting from lower-alpha", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-lower-alpha",
        kind: "ordered",
        rootMarkerStyle: "lower-alpha",
        items: nestedTopicItems(2),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "lower-alpha",
      "lower-roman",
      "decimal",
    ]);
  });

  it("derives ordered markers starting from lower-roman", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-lower-roman",
        kind: "ordered",
        rootMarkerStyle: "lower-roman",
        items: nestedTopicItems(2),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "lower-roman",
      "decimal",
      "lower-alpha",
    ]);
  });

  it("derives ordered markers starting from upper-alpha", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-upper-alpha",
        kind: "ordered",
        rootMarkerStyle: "upper-alpha",
        items: nestedTopicItems(2),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "upper-alpha",
      "upper-roman",
      "decimal",
    ]);
  });

  it("derives ordered markers starting from upper-roman", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-upper-roman",
        kind: "ordered",
        rootMarkerStyle: "upper-roman",
        items: nestedTopicItems(2),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "upper-roman",
      "decimal",
      "upper-alpha",
    ]);
  });

  it("uses none at every structural level for ordered topics", () => {
    const html = renderElement(
      topicsElement({
        id: "ordered-none",
        kind: "ordered",
        rootMarkerStyle: "none",
        items: nestedTopicItems(3),
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "none",
      "none",
      "none",
      "none",
    ]);
  });

  it("starts a fresh depth-0 sequence for an autonomous nested TopicsElement", () => {
    const html = renderElement(
      topicsElement({
        id: "outer-topics",
        kind: "unordered",
        items: [
          topicItem({
            id: "outer-parent",
            content: {
              id: "outer-slot",
              children: [
                topicsElement({
                  id: "inner-topics",
                  kind: "ordered",
                  rootMarkerStyle: "lower-alpha",
                  items: nestedTopicItems(1),
                }),
              ],
            },
            children: [
              topicItem({
                id: "outer-child",
              }),
            ],
          }),
        ],
      }),
    );

    expect(topicMarkerSequence(html)).toEqual([
      "disc",
      "lower-alpha",
      "lower-roman",
      "circle",
    ]);
  });

  it("does not mark structural nested lists as powershow-element", () => {
    const html = renderElement(
      topicsElement({
        id: "nested-no-element",
        kind: "unordered",
        items: nestedTopicItems(2),
      }),
    );

    expect(countOccurrences(html, "powershow-topics")).toBe(3);
    expect(
      countOccurrences(html, 'class="powershow-element powershow-topics"'),
    ).toBe(1);
    expect(countOccurrences(html, 'class="powershow-topics" style=')).toBe(2);
  });

  it("renders an Image and a Container inside TopicItem content", () => {
    const html = renderElement(
      topicsElement({
        id: "slot-media",
        items: [
          topicItem({
            id: "topic-media",
            content: {
              id: "slot-media-content",
              children: [
                imageElement({
                  id: "slot-image",
                }),
                containerElement({
                  id: "slot-container",
                }),
              ],
            },
          }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="slot-image"');
    expect(html).toContain('src="/assets/example.png"');
    expect(html).toContain('data-powershow-id="slot-container"');
    expect(
      html.indexOf('data-powershow-id="slot-image"'),
    ).toBeLessThan(
      html.indexOf('data-powershow-id="slot-container"'),
    );
  });

  it("keeps markerColor collective and scoped to the root across all levels", () => {
    const html = renderElement(
      topicsElement({
        id: "colored-nested",
        kind: "unordered",
        markerColor: "#22d3ee",
        items: nestedTopicItems(2),
      }),
    );

    expect(countOccurrences(html, "--powershow-topic-marker-color:#22d3ee")).toBe(1);
    expect(html).toContain("--powershow-topic-marker-color:#22d3ee");
  });

  it("renders structural TopicItem.children deeper than the Studio authoring limit", () => {
    const html = renderElement(
      topicsElement({
        id: "deep-structural",
        kind: "unordered",
        items: nestedTopicItems(6),
      }),
    );

    expect(countOccurrences(html, "<li ")).toBe(7);
    expect(countOccurrences(html, 'class="powershow-topics" style=')).toBe(6);
    expect(countOccurrences(html, 'class="powershow-element powershow-topics"')).toBe(1);
    expect(topicMarkerSequence(html)).toEqual([
      "disc",
      "circle",
      "square",
      "disc",
      "circle",
      "square",
      "disc",
    ]);
  });
});
