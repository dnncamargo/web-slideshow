import { describe, expect, it } from "vitest";

import type { TextElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

function textElement(
  overrides: Partial<Omit<TextElement, "type" | "id">> = {},
): TextElement {
  return {
    type: "text",
    id: "text-1",
    hidden: false,
    variant: "body",
    content: "Hello PowerShow",
    ...overrides,
  };
}

describe("renderElement rich text", () => {
  it("preserves newlines when callers own whitespace", async () => {
    const { renderRichText } = await import("../src/render-rich-text");

    expect(renderRichText({ type: "rich-text", runs: [{ text: "a\nb", marks: { bold: true } }] }, { newlineMode: "preserve" })).toContain("<strong>a\nb</strong>");
  });
  it("renders authored newlines as line breaks in plain text", () => {
    expect(renderElement(textElement({ content: "first\nsecond" }))).toContain(
      ">first<br>second</p>",
    );
    expect(renderElement(textElement({ content: "first\n\nsecond" }))).toContain(
      ">first<br><br>second</p>",
    );
  });

  it("renders authored newlines as line breaks inside marked rich text", () => {
    const html = renderElement(textElement({
      content: {
        type: "rich-text",
        runs: [{ text: "before\nafter", marks: { bold: true } }],
      },
    }));

    expect(html).toContain("<strong>before<br>after</strong>");
  });

  it("renders plain text unchanged", () => {
    const html = renderElement(textElement());

    expect(html).toContain(">Hello PowerShow</p>");
  });

  it("concatenates unmarked rich-text runs in order", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [
            { text: "Dar " },
            { text: "instruções" },
            { text: " para um computador" },
          ],
        },
      }),
    );

    expect(html).toContain("Dar instruções para um computador");
  });

  it("renders bold with strong", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [{ text: "bold", marks: { bold: true } }],
        },
      }),
    );

    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders italic with em", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [{ text: "italic", marks: { italic: true } }],
        },
      }),
    );

    expect(html).toContain("<em>italic</em>");
  });

  it("renders code with code", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [{ text: "const x = 1;", marks: { code: true } }],
        },
      }),
    );

    expect(html).toContain("<code>const x = 1;</code>");
  });

  it("renders underline with inline text-decoration", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [{ text: "underline", marks: { underline: true } }],
        },
      }),
    );

    expect(html).toContain(
      '<span style="text-decoration-line:underline">underline</span>',
    );
  });

  it("renders color with inline color", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [{ text: "color", marks: { color: "#7c3aed" } }],
        },
      }),
    );

    expect(html).toContain('<span style="color:#7c3aed">color</span>');
  });

  it("uses deterministic nesting for combined marks", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [
            {
              text: "important",
              marks: {
                code: true,
                bold: true,
                italic: true,
                underline: true,
                color: "#ff0000",
              },
            },
          ],
        },
      }),
    );

    expect(html).toContain(
      '<span style="text-decoration-line:underline;color:#ff0000"><em><strong><code>important</code></strong></em></span>',
    );
  });

  it("escapes special HTML characters in rich-text runs", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [{ text: "<script>alert(1)</script>", marks: { bold: true } }],
        },
      }),
    );

    expect(html).toContain(
      "<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>",
    );
    expect(html).not.toContain("<script>");
  });

  it("escapes HTML while still rendering its authored newline", () => {
    const html = renderElement(textElement({
      content: "<script>alert(1)</script>\nnext",
    }));

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;<br>next");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes plain string content instead of interpreting markup", () => {
    const html = renderElement(
      textElement({
        content: "<b>unsafe</b>",
      }),
    );

    expect(html).toContain("&lt;b&gt;unsafe&lt;/b&gt;");
    expect(html).not.toContain("<b>unsafe</b>");
  });

  it("preserves text order across differently marked runs", () => {
    const html = renderElement(
      textElement({
        content: {
          type: "rich-text",
          runs: [
            { text: "A", marks: { bold: true } },
            { text: "B", marks: { italic: true } },
            { text: "C" },
          ],
        },
      }),
    );

    expect(html).toContain("<strong>A</strong><em>B</em>C");
  });

  it("keeps hidden text behavior unchanged", () => {
    const html = renderElement(
      textElement({
        hidden: true,
        content: {
          type: "rich-text",
          runs: [{ text: "Invisible", marks: { bold: true } }],
        },
      }),
    );

    expect(html).toBe("");
  });
});
