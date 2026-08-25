import { describe, expect, it } from "vitest";

import { PowerShowElementSchema, TextElementSchema } from "../src";

describe("TextElementSchema rich text", () => {
  it("parses legacy plain text content as a string", () => {
    const result = TextElementSchema.safeParse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: "plain text",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(typeof result.data.content).toBe("string");
      expect(result.data.content).toBe("plain text");
    }
  });

  it("preserves the string shape after parsing", () => {
    const parsed = TextElementSchema.parse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: "Hello",
    });

    expect(parsed.content).toBe("Hello");
  });

  it("parses rich text content", () => {
    const result = TextElementSchema.safeParse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [
          {
            text: "Hello",
          },
        ],
      },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.content).toEqual({
        type: "rich-text",
        runs: [
          {
            text: "Hello",
          },
        ],
      });
    }
  });

  it("parses multiple runs in order", () => {
    const result = TextElementSchema.parse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [
          { text: "Dar " },
          { text: "instruções" },
          { text: " para um computador" },
        ],
      },
    });

    expect(result.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Dar " },
        { text: "instruções" },
        { text: " para um computador" },
      ],
    });
  });

  it.each([
    { bold: true },
    { italic: true },
    { underline: true },
    { code: true },
    { color: "#7c3aed" },
  ])("parses supported mark %j", (marks) => {
    const result = TextElementSchema.safeParse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [
          {
            text: "marked",
            marks,
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("parses combined marks", () => {
    const result = TextElementSchema.parse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [
          {
            text: "marked",
            marks: {
              bold: true,
              italic: true,
              underline: true,
              code: true,
              color: "rgba(124, 58, 237, 0.5)",
            },
          },
        ],
      },
    });

    expect(result.content).toEqual({
      type: "rich-text",
      runs: [
        {
          text: "marked",
          marks: {
            bold: true,
            italic: true,
            underline: true,
            code: true,
            color: "rgba(124, 58, 237, 0.5)",
          },
        },
      ],
    });
  });

  it("parses canonical color values", () => {
    const result = TextElementSchema.parse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [
          {
            text: "colorful",
            marks: {
              color: "#7c3aed80",
            },
          },
        ],
      },
    });

    expect(result.content).toEqual({
      type: "rich-text",
      runs: [
        {
          text: "colorful",
          marks: {
            color: "#7c3aed80",
          },
        },
      ],
    });
  });

  it("allows an empty runs array", () => {
    const result = TextElementSchema.safeParse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [],
      },
    });

    expect(result.success).toBe(true);
  });

  it("allows empty run text", () => {
    const result = TextElementSchema.safeParse({
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [
          {
            text: "",
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported rich-text discriminants", () => {
    expect(
      TextElementSchema.safeParse({
        type: "text",
        id: "text-1",
        hidden: false,
        variant: "body",
        content: {
          type: "plain-text",
          runs: [],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid rich-text run objects", () => {
    expect(
      TextElementSchema.safeParse({
        type: "text",
        id: "text-1",
        hidden: false,
        variant: "body",
        content: {
          type: "rich-text",
          runs: [
            {
              text: "ok",
              marks: {
                bold: "yes",
              },
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});

describe("Textbox rejection", () => {
  it("rejects a legacy Textbox element", () => {
    const result = PowerShowElementSchema.safeParse({
      type: "textbox",
      id: "textbox-1",
      hidden: false,
      content: "plain text",
    });

    expect(result.success).toBe(false);
  });
});
