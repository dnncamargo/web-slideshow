import { describe, expect, it } from "vitest";

import type {
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
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

function topicsElement(
  overrides: Record<string, unknown> = {},
): TopicsElement {
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
        style: {
          width: "50%",
          className: "topic-root",
        },
      }),
    );

    expect(html).toContain(
      '<ul class="powershow-element powershow-topics topic-root"',
    );
    expect(html).toContain('data-powershow-id="topics-root"');
    expect(html).toContain('data-powershow-type="topics"');
    expect(html).toContain("width:50%");
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
    expect(html).not.toContain("slot-direct");
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
      '<li class="powershow-topic-item topic &quot;body&quot;" style="padding:12px">',
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

    expect(html).toContain(
      '<ul class="powershow-topics">',
    );
    expect(countOccurrences(html, 'data-powershow-type="topics"')).toBe(1);
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

    expect(html).toContain(
      'href="https://example.com/text"',
    );
    expect(html).toContain(
      'rel="noopener noreferrer"',
    );
    expect(html).toContain(
      'href="http://example.com/image"',
    );
    expect(html).toContain(
      'data-powershow-type="container"',
    );
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
});
