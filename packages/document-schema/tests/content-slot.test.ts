import { describe, expect, it } from "vitest";

import {
  ContentSlotSchema,
  PowerShowElementSchema,
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
  children: [],
  ...overrides
};
}

describe("ContentSlotSchema", () => {
  it("accepts a minimal empty slot", () => {
    const result = ContentSlotSchema.safeParse({
      id: "slot-1",
      children: [],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        id: "slot-1",
        children: [],
      });
    }
  });

  it("rejects a missing id", () => {
    expect(
      ContentSlotSchema.safeParse({
        children: [],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(
      ContentSlotSchema.safeParse({
        id: "",
        children: [],
      }).success,
    ).toBe(false);
  });

  it("rejects missing children", () => {
    expect(
      ContentSlotSchema.safeParse({
        id: "slot-1",
      }).success,
    ).toBe(false);
  });

  it.each([
    { style: { padding: 1 } },
    { style: { fontSize: 16 } },
    { style: { background: "#fff" } },
    { style: { opacity: 0.5 } },
    { layout: { position: "absolute" } },
    { layout: { width: 10 } },
    { effect: {} },
    { link: {} },
    { unknown: true },
  ])("rejects legacy or forbidden field %j", (extra) => {
    expect(ContentSlotSchema.safeParse({ id: "slot-1", children: [], ...extra }).success).toBe(false);
  });

  it("accepts and preserves canonical optional namespaces", () => {
    const result = ContentSlotSchema.safeParse({
      id: "slot-1",
      layout: { padding: 12 },
      style: { color: "#fff", className: "slot-body" },
      typography: { fontSize: 16 },
      children: [],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        id: "slot-1",
        layout: { padding: 12 },
        style: { color: "#ffffff", className: "slot-body" },
        typography: { fontSize: 16 },
        children: [],
      });
    }
  });

  it("accepts mixed PowerShowElement children", () => {
    const result = ContentSlotSchema.safeParse({
      id: "slot-1",
      children: [
        textElement({ id: "text-child" }),
        imageElement({ id: "image-child" }),
        containerElement({
          id: "container-child",
          children: [textElement({ id: "nested-text" })],
        }),
      ],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children.map((child) => child.type)).toEqual([
        "text",
        "image",
        "container",
      ]);
    }
  });

  it("accepts recursive content", () => {
    const result = ContentSlotSchema.safeParse({
      id: "slot-1",
      children: [
        containerElement({
          id: "outer-container",
          children: [
            textElement({ id: "nested-text" }),
            imageElement({ id: "nested-image" }),
          ],
        }),
      ],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children[0]).toMatchObject({
  type: "container",
  children: [
          {
            type: "text",
            id: "nested-text",
          },
          {
            type: "image",
            id: "nested-image",
          },
        ]
});
    }
  });

  it("accepts canonical links on child elements", () => {
    const result = ContentSlotSchema.safeParse({
      id: "slot-1",
      children: [
        textElement({
          id: "linked-text",
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
          id: "linked-container",
          link: {
            kind: "url",
            href: "https://example.com/container",
          },
        }),
      ],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children).toEqual([
        expect.objectContaining({
          type: "text",
          id: "linked-text",
          link: {
            kind: "url",
            href: "https://example.com/text",
            target: "_blank",
          },
        }),
        expect.objectContaining({
          type: "image",
          id: "linked-image",
          link: {
            kind: "url",
            href: "http://example.com/image",
          },
        }),
        expect.objectContaining({
  type: "container",
  id: "linked-container",
  link: {
            kind: "url",
            href: "https://example.com/container",
          }
}),
      ]);
    }
  });

  it("rejects an invalid child", () => {
    expect(
      ContentSlotSchema.safeParse({
        id: "slot-1",
        children: [
          {
            type: "not-a-real-element",
            id: "invalid-child",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("roundtrips through JSON serialization", () => {
    const source = ContentSlotSchema.parse({
      id: "slot-1",
      layout: { paddingTop: 4 },
      style: { background: { color: "#000" } },
      typography: { fontWeight: 700 },
      children: [
        textElement({
          id: "text-child",
          link: {
            kind: "url",
            href: "https://example.com/text",
          },
        }),
        containerElement({
          id: "container-child",
          children: [
            imageElement({
              id: "image-child",
            }),
          ],
        }),
      ],
    });

    const restored = ContentSlotSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });

  it("parses as a ContentSlot but not as an autonomous PowerShowElement", () => {
    const slot = {
      id: "slot-1",
      children: [],
    };

    expect(ContentSlotSchema.safeParse(slot).success).toBe(true);
    expect(PowerShowElementSchema.safeParse(slot).success).toBe(false);
  });
});
