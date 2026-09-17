import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";

const gradient = {
  type: "linear" as const,
  stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
};

describe("canonical Text family renderer", () => {
  it.each([
    ["title", "<h1 "],
    ["subtitle", "<h2 "],
    ["body", "<p "],
  ] as const)("migrates the %s gradient border to the root painter", (variant, tag) => {
    const html = renderElement({
      type: "text",
      id: `${variant}-gradient`,
      hidden: false,
      variant,
      content: "Gradient text",
      style: {
        background: { color: "#101218" },
        border: { width: 3, style: "dashed", gradient },
        borderRadius: 12,
      },
      effect: { opacity: 0.8, shadow: { x: 0, y: 4, blur: 12, color: "#000" } },
    });

    expect(html).toContain(tag);
    expect(html).toContain("presentation-gradient-border");
    expect(html).toContain("border:0");
    expect(html).toContain("padding:3px");
    expect(html).toContain("--presentation-gradient-border-width:3px");
    expect(html).toContain("--presentation-gradient-border-paint:linear-gradient(180deg,#000 0%,#fff 100%)");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("background:#101218");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain("box-shadow:0px 4px 12px #000");
    expect(html).not.toContain("border-image:");
  });

  it("keeps multiline and rich block Text on one root without rewriting markup", () => {
    const html = renderElement({
      type: "text",
      id: "rich-gradient",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [{ text: "first line\nsecond line", marks: { bold: true } }],
      },
      style: { border: { width: 2, gradient } },
    });

    expect(html.match(/class="powershow-element/g)).toHaveLength(1);
    expect(html).toContain("presentation-gradient-border");
    expect(html).toContain("padding:2px");
    expect(html).toContain("<strong>first line<br>second line</strong>");
    expect(html).not.toContain("border-image:");
  });

  it("preserves authored absolute positioning and nested link ownership", () => {
    const html = renderElement({
      type: "text",
      id: "linked-gradient",
      hidden: false,
      variant: "title",
      content: "Linked title",
      layout: { position: "absolute", top: 10, right: 20 },
      style: { border: { width: 2, gradient } },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    });

    expect(html).toContain("position:absolute");
    expect(html).toContain("top:10px");
    expect(html).toContain("right:20px");
    expect(html).not.toContain("position:relative");
    expect(html).toContain("<h1 ");
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain("presentation-gradient-border");
    expect(html).not.toContain("border-image:");
  });

  it("adds a positioning context only to non-positioned gradient blocks", () => {
    const html = renderElement({
      type: "text",
      id: "positioned-gradient",
      hidden: false,
      variant: "body",
      content: "Body",
      style: { border: { width: 1, gradient } },
    });

    expect(html).toContain("position:relative");
    expect(html).toContain("padding:1px");
  });

  it.each(["solid", "dashed", "dotted"] as const)("keeps %s Text borders native", (style) => {
    const html = renderElement({
      type: "text",
      id: `native-${style}`,
      hidden: false,
      variant: "body",
      content: "Native border",
      style: { border: { width: 2, style, color: "#fff" } },
    });

    expect(html).not.toContain("presentation-gradient-border");
    expect(html).toContain(`border-width:2px`);
    expect(html).toContain(`border-style:${style}`);
    expect(html).toContain("border-color:#fff");
    expect(html).not.toContain("padding:2px");
  });

  it("intentionally leaves gradient captions inline and legacy", () => {
    const html = renderElement({
      type: "text",
      id: "caption-gradient",
      hidden: false,
      variant: "caption",
      content: "Caption text",
      style: { border: { width: 2, gradient } },
    });

    expect(html).toMatch(/^<small /);
    expect(html).not.toContain("presentation-gradient-border");
    expect(html).not.toContain("padding:2px");
    expect(html).toContain("border-image:");
  });

  it("keeps both background layers on the gradient Text root", () => {
    const html = renderElement({
      type: "text",
      id: "background-gradient",
      hidden: false,
      variant: "body",
      content: "Layered background",
      style: {
        background: {
          color: "#101218",
          gradient: { type: "linear", stops: [{ color: "#111", position: 0 }, { color: "#222", position: 100 }] },
        },
        border: { width: 2, gradient },
      },
    });

    expect(html).toContain("background:#101218");
    expect(html).toContain("background-image:linear-gradient");
    expect(html).toContain("presentation-gradient-border");
    expect(html).not.toContain("border-image:");
  });

  it("composes canonical Text responsibilities and link output", () => {
    const html = renderElement({
      id: "text",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Hello",
      layout: { position: "absolute", top: 10, right: 20 },
      style: { color: "#ffffff", background: { color: "#111827" }, borderRadius: 8, className: "hero" },
      typography: { fontSize: 24, fontWeight: 700, textStroke: { width: 1, color: "#000000" } },
      effect: { opacity: 0.75, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    });

    expect(html).toContain("position:absolute");
    expect(html).toContain("top:10px");
    expect(html).toContain("right:20px");
    expect(html).toContain("background:#111827");
    expect(html).toContain("font-size:24px");
    expect(html).toContain("opacity:0.75");
    expect(html).toContain("box-shadow:0px 2px 4px #000000");
    expect(html).toContain("-webkit-text-stroke:1px #000000");
    expect(html).toContain("hero");
    expect(html).toContain('target="_blank"');
  });

  it("renders the canonical Container + Text composition width and height", () => {
    const html = renderElement({
      id: "box",
      type: "container",
      role: "content",
      hidden: false,
      layout: { width: "50%", height: 120, children: { verticalAlign: "center" } },
      style: { borderRadius: 12 },
      children: [
        {
          id: "box-text",
          type: "text",
          variant: "body",
          hidden: false,
          content: "Hello",
        },
      ],
    });

    expect(html).toContain("width:50%");
    expect(html).toContain("height:120px");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain(">Hello</p>");
  });
});
