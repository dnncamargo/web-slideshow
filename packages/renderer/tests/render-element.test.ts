import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

describe("renderElement", () => {
  it("renders body text", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "text-1",
      hidden: false,
      variant: "body",
      content: "Hello PowerShow",
    };

    const html = renderElement(element);

    expect(html).toContain("<p ");
    expect(html).toContain("Hello PowerShow");

    expect(html).toContain('data-powershow-id="text-1"');

    expect(html).toContain('data-powershow-type="text"');
  });

  it("renders title text as h1", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "title-1",
      hidden: false,
      variant: "title",
      content: "PowerShow",
    };

    const html = renderElement(element);

    expect(html).toContain("<h1 ");
    expect(html).toContain(">PowerShow</h1>");
  });

  it.each([
    ["uppercase", "uppercase"],
    ["lowercase", "lowercase"],
    ["capitalize", "capitalize"],
  ] as const)(
    "does not rewrite element content for %s text-transform",
    (_name, textTransform) => {
      const element: PowerShowElement = {
        type: "text",
        id: "case-text",
        hidden: false,
        variant: "body",
        content: "PowerShow Example",
        style: { textTransform },
      };

      const html = renderElement(element);

      // The stored content is preserved exactly; only CSS text-transform is
      // emitted, and the browser applies the casing visually.
      expect(html).toContain(">PowerShow Example</p>");
      expect(html).toContain(`text-transform:${textTransform}`);
    },
  );

  it("escapes text content", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "dangerous-text",
      hidden: false,
      variant: "body",
      content: '<script>alert("PowerShow")</script>',
    };

    const html = renderElement(element);

    expect(html).not.toContain("<script>");

    expect(html).toContain("&lt;script&gt;");
  });

  it("renders nothing when an element is hidden", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "hidden-text",
      hidden: true,
      variant: "body",
      content: "Invisible",
    };

    expect(renderElement(element)).toBe("");
  });

  it("renders an image", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "image-1",
      hidden: false,
      src: "/assets/example.png",
      alt: "Example image",
      fit: "contain",
    };

    const html = renderElement(element);

    expect(html).toContain("<img ");

    expect(html).toContain('src="/assets/example.png"');

    expect(html).toContain('alt="Example image"');

    expect(html).toContain("object-fit:contain");
    expect(html).toContain("object-position:50% 50%");
  });

  it("renders an image focal point without changing fit or size styles", () => {
    const html = renderElement({
      type: "image",
      id: "focal-image",
      hidden: false,
      src: "/assets/example.png",
      alt: "Example image",
      fit: "cover",
      focalPoint: { x: 25, y: 70 },
      style: { width: "60%", height: 200, borderRadius: 8 },
    });

    expect(html).toContain("object-fit:cover");
    expect(html).toContain("object-position:25% 70%");
    expect(html).toContain("width:60%");
    expect(html).toContain("height:200px");
    expect(html).toContain("border-radius:8px");
  });

  it.each([
    [{ x: 0, y: 0 }, "object-position:0% 0%"],
    [{ x: 100, y: 100 }, "object-position:100% 100%"],
  ] as const)("renders extreme focal point %o", (focalPoint, expected) => {
    const html = renderElement({
      type: "image",
      id: "focal-image",
      hidden: false,
      src: "/assets/example.png",
      alt: "Example image",
      fit: "cover",
      focalPoint,
    });

    expect(html).toContain(expected);
  });

  it("escapes image attributes", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "image-1",
      hidden: false,
      src: '/image?a=1&b="2"',
      alt: 'Image "example"',
      fit: "cover",
    };

    const html = renderElement(element);

    expect(html).toContain("/image?a=1&amp;b=&quot;2&quot;");

    expect(html).toContain("Image &quot;example&quot;");
  });

  it("renders a row container", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "row-1",
      hidden: false,
      layout: { children: { direction: "row" } },
      children: [],
    };

    const html = renderElement(element);

    expect(html).toContain("display:flex");

    expect(html).toContain("flex-direction:row");
  });

  it("renders a column container", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "column-1",
      hidden: false,
      layout: { children: { direction: "column" } },
      children: [],
    };

    const html = renderElement(element);

    expect(html).toContain("flex-direction:column");
  });

  it("maps row alignment to flex axes", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "row-aligned",
      hidden: false,
      layout: { children: { direction: "row", horizontalAlign: "center", verticalAlign: "end" } },
      children: [],
    };

    const html = renderElement(element);

    expect(html).toContain("justify-content:center");

    expect(html).toContain("align-items:flex-end");
  });

  it("maps column alignment to flex axes", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "column-aligned",
      hidden: false,
      layout: { children: { direction: "column", horizontalAlign: "center", verticalAlign: "end" } },
      children: [],
    };

    const html = renderElement(element);

    expect(html).toContain("align-items:center");

    expect(html).toContain("justify-content:flex-end");
  });

  it("renders nested containers recursively", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "root",
      hidden: false,
      layout: { children: { direction: "column" } },

      children: [
        {
          type: "container",
          id: "nested",
          hidden: false,
          layout: { children: { direction: "row" } },

          children: [
            {
              type: "text",
              id: "nested-text",
              hidden: false,
              variant: "body",
              content: "Recursive rendering works",
            },
          ],
        },
      ],
    };

    const html = renderElement(element);

    expect(html).toContain('data-powershow-id="root"');

    expect(html).toContain('data-powershow-id="nested"');

    expect(html).toContain('data-powershow-id="nested-text"');

    expect(html).toContain("Recursive rendering works");
  });

  it.each([
    ["main", "<main"],
    ["header", "<header"],
    ["footer", "<footer"],
  ] as const)("renders %s containers using semantic HTML", (role, tag) => {
    const element: PowerShowElement = {
      type: "container",
      id: `${role}-1`,
      hidden: false,
      layout: { children: { direction: "column" } },
      role,
      children: [],
    };

    const html = renderElement(element);

    expect(html).toContain(tag);

    expect(html).toContain(`data-powershow-role="${role}"`);
  });

  it("supports mixed content inside containers", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "mixed-content",
      hidden: false,
      layout: { children: { direction: "row" } },

      children: [
        {
          type: "image",
          id: "image",
          hidden: false,
          src: "/photo.png",
          alt: "Photo",
          fit: "cover",
        },

        {
          type: "textbox",
          id: "textbox",
          hidden: false,
          content: "Mixed content",
        },

        {
          type: "text",
          id: "text",
          hidden: false,
          variant: "caption",
          content: "Caption",
        },
      ],
    };

    const html = renderElement(element);

    expect(html).toContain('data-powershow-type="image"');

    expect(html).toContain('data-powershow-type="textbox"');

    expect(html).toContain('data-powershow-type="text"');
  });

  it("renders implemented-later elements as placeholders", () => {
    const element: PowerShowElement = {
      type: "chart",
      id: "chart-1",
      hidden: false,
      chartType: "line",
      series: [],
    };

    const html = renderElement(element);

    expect(html).toContain("powershow-placeholder-chart");

    expect(html).toContain("[chart]");
  });

  it("renders code with line numbers", () => {
    const element: PowerShowElement = {
      type: "code",
      id: "code-1",
      hidden: false,
      code: "const answer = 42;\nconsole.log(answer);",
      language: "typescript",
      showLineNumbers: true,
      highlightedLines: [2],
    };

    const html = renderElement(element);

    expect(html).toContain('data-powershow-type="code"');

    expect(html).toContain('data-language="typescript"');

    expect(html).toContain("powershow-code-line-number");

    expect(html).toContain("powershow-code-line-highlighted");
  });

  it("escapes code content", () => {
    const element: PowerShowElement = {
      type: "code",
      id: "code-danger",
      hidden: false,
      code: "<script>alert(1)</script>",
      language: "html",
      showLineNumbers: false,
      highlightedLines: [],
    };

    const html = renderElement(element);

    expect(html).not.toContain("<script>");

    expect(html).toContain("&lt;script&gt;");
  });
  it("renders terminal lines", () => {
    const element: PowerShowElement = {
      type: "terminal",
      id: "terminal-1",
      hidden: false,
      title: "PowerShow Terminal",

      lines: [
        {
          type: "command",
          content: "pnpm test",
        },
        {
          type: "output",
          content: "79 tests passed",
        },
        {
          type: "comment",
          content: "Ready",
        },
      ],
    };

    const html = renderElement(element);

    expect(html).toContain("PowerShow Terminal");

    expect(html).toContain("powershow-terminal-line-command");

    expect(html).toContain("pnpm test");

    expect(html).toContain("79 tests passed");
  });
  it("renders tables using declared column order", () => {
    const element: PowerShowElement = {
      type: "table",
      id: "table-1",
      hidden: false,

      columns: [
        {
          key: "name",
          label: "Name",
        },
        {
          key: "score",
          label: "Score",
        },
      ],

      rows: [
        {
          score: 10,
          name: "Alice",
        },
        {
          score: 20,
          name: "Bob",
        },
      ],
    };

    const html = renderElement(element);

    expect(html).toContain('<th scope="col">Name</th>');

    expect(html).toContain('<th scope="col">Score</th>');

    expect(html).toContain("<td>Alice</td><td>10</td>");

    expect(html).toContain("<td>Bob</td><td>20</td>");
  });
  it("escapes table cell values", () => {
    const element: PowerShowElement = {
      type: "table",
      id: "unsafe-table",
      hidden: false,

      columns: [
        {
          key: "value",
          label: "Value",
        },
      ],

      rows: [
        {
          value: "<script>alert(1)</script>",
        },
      ],
    };

    const html = renderElement(element);

    expect(html).not.toContain("<script>");

    expect(html).toContain("&lt;script&gt;");
  });

  // ============================================================
  // BEGIN: TESTE DE CONTAINER REDIMENSIONÁVEL
  // ============================================================

  it("renders container dimensions", () => {
    const html = renderElement({
      type: "container",

      id: "resizable-panel",

      hidden: false,

      layout: { width: "68%", height: "60%", children: { direction: "column" } },

      children: [],
    });

    expect(html).toContain("width:68%");

    expect(html).toContain("height:60%");
  });

  // ============================================================
  // END: TESTE DE CONTAINER REDIMENSIONÁVEL
  // ============================================================
});
