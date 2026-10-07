import { describe, expect, it } from "vitest";

import { PresentationSchema } from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";
import { renderPresentation } from "../src/render-presentation";

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
    expect(html).toContain("text-shadow:0px 4px 12px #000");
    expect(html).not.toContain("box-shadow:");
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

    expect(html.match(/class="presentation-element/g)).toHaveLength(1);
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
    expect(html).toContain("text-shadow:0px 2px 4px #000000");
    expect(html).toContain("-webkit-text-stroke:1px #000000");
    expect(html).toContain("hero");
    expect(html).toContain('target="_blank"');
  });

  it("renders Text Shadow as a glyph shadow and ignores legacy box-only fields", () => {
    const html = renderElement({
      id: "glyph-shadow",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Shadow",
      effect: {
        shadow: {
          x: 2,
          y: 3,
          blur: 6,
          spread: 9,
          inset: true,
          color: "#000000",
        },
      },
    });

    expect(html).toContain("text-shadow:2px 3px 6px #000000");
    expect(html).not.toContain("box-shadow:");
    expect(html).not.toContain("9px");
    expect(html).not.toContain("inset");
  });

  it("keeps Shadow in text-shadow and renders Glow externally", () => {
    const html = renderElement({
      id: "glyph-effects",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Effects",
      effect: {
        shadow: { x: 1, y: 2, blur: 3, color: "#000000" },
        glow: { blur: 8, color: "#22d3ee" },
      },
    });

    expect(html).toContain("text-shadow:1px 2px 3px #000000");
    expect(html).toContain("filter:drop-shadow(0 0 8px #22d3ee)");
    expect(html).not.toContain("text-shadow:1px 2px 3px #000000,0 0 8px #22d3ee");
    expect(html.match(/text-shadow:/g)).toHaveLength(1);
    expect(html).not.toContain("box-shadow:");
  });

  it("uses Palette variables for Text Shadow and Glow colors", () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "palette-text-effects",
      title: "Palette Text Effects",
      palette: {
        colors: [
          { id: "shadow", name: "Shadow", value: "#000000" },
          { id: "glow", name: "Glow", value: "#22d3ee" },
        ],
      },
      slides: [{
        id: "slide",
        elements: [{
          id: "text",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Palette effects",
          effect: {
            shadow: { x: 1, y: 2, blur: 3, color: { kind: "palette", colorId: "shadow" } },
            glow: { blur: 8, color: { kind: "palette", colorId: "glow" } },
          },
        }],
      }],
    });

    const html = renderPresentation(source);
    expect(html).toContain("text-shadow:1px 2px 3px var(--ps-palette-0073006800610064006f0077)");
    expect(html).toContain("filter:drop-shadow(0 0 8px var(--ps-palette-0067006c006f0077))");
  });

  it("renders Glow-only Text on one external content surface", () => {
    const html = renderElement({
      id: "glow-only",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Glow",
      effect: { glow: { blur: 1, color: "#22d3ee" } },
    });

    expect(html.match(/presentation-text-content/g)).toHaveLength(1);
    expect(html).toContain("filter:drop-shadow(0 0 1px #22d3ee)");
    expect(html).not.toContain("text-shadow:");
  });

  it("keeps Gradient and Glow on one shared content surface", () => {
    const html = renderElement({
      id: "gradient-glow",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Gradient Glow",
      style: { gradient },
      effect: { glow: { blur: 12, color: "#22d3ee" } },
    });

    expect(html.match(/presentation-text-content/g)).toHaveLength(1);
    expect(html.match(/presentation-text-gradient-content/g)).toHaveLength(1);
    expect(html).toContain("--presentation-text-gradient:linear-gradient(180deg,#000 0%,#fff 100%)");
    expect(html).toContain("filter:drop-shadow(0 0 12px #22d3ee)");
  });

  it.each([0, -4, "0px"] as const)("keeps Gradient visible and omits non-positive Glow blur %s", (blur) => {
    const html = renderElement({
      id: "zero-gradient-glow",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Gradient Glow",
      style: { gradient },
      effect: { glow: { blur, color: "#22d3ee" } },
    });

    expect(html).toContain("presentation-text-gradient-content");
    expect(html).not.toContain("filter:");
  });

  it("does not apply Glow to a Text background or border box", () => {
    const html = renderElement({
      id: "background-glow",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Glyph Glow",
      style: { background: { color: "#101218" }, border: { width: 2, style: "solid", color: "#ffffff" }, borderRadius: 8 },
      effect: { glow: { blur: 12, color: "#22d3ee" } },
    });
    const root = html.slice(0, html.indexOf(">"));

    expect(root).toContain("background:#101218");
    expect(root).toContain("border-width:2px");
    expect(root).not.toContain("filter:");
    expect(html).toContain("filter:drop-shadow(0 0 12px #22d3ee)");
  });

  it("uses one Glow content surface for rich text without duplicating markup", () => {
    const html = renderElement({
      id: "rich-glow",
      type: "text",
      hidden: false,
      variant: "body",
      content: {
        type: "rich-text",
        runs: [{ text: "bold", marks: { bold: true } }, { text: " and code", marks: { code: true } }],
      },
      effect: { glow: { blur: 12, color: "#22d3ee" } },
    });

    expect(html.match(/presentation-text-content/g)).toHaveLength(1);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code> and code</code>");
    expect(html).toContain("filter:drop-shadow(0 0 12px #22d3ee)");
  });

  it("uses one Glow content surface for multiline Text", () => {
    const html = renderElement({
      id: "multiline-glow",
      type: "text",
      hidden: false,
      variant: "body",
      content: "first line\nsecond line",
      effect: { glow: { blur: 12, color: "#22d3ee" } },
    });

    expect(html.match(/presentation-text-content/g)).toHaveLength(1);
    expect(html).toContain("first line<br>second line");
  });

  it("owns an effective glyph Gradient on one internal content surface", () => {
    const html = renderElement({
      id: "glyph-gradient",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Gradient\ntext",
      style: { gradient },
    });
    const root = html.slice(0, html.indexOf(">"));

    expect(html.match(/presentation-text-gradient-content/g)).toHaveLength(1);
    expect(html).toContain("--presentation-text-gradient:linear-gradient(180deg,#000 0%,#fff 100%)");
    expect(root).not.toContain("background-image:");
    expect(html).toContain("Gradient<br>text");
  });

  it("keeps solid Text free of Gradient markup", () => {
    const html = renderElement({
      id: "solid-text",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Solid",
      style: { color: "#ffffff" },
    });

    expect(html).not.toContain("presentation-text-gradient-content");
    expect(html).not.toContain("--presentation-text-gradient:");
  });

  it("keeps box background Gradient and glyph Gradient on distinct owners", () => {
    const html = renderElement({
      id: "two-gradients",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Two gradients",
      style: {
        background: { gradient },
        gradient: {
          type: "linear",
          angle: 90,
          stops: [{ color: "#f00", position: 0 }, { color: "#00f", position: 100 }],
        },
      },
    });
    const root = html.slice(0, html.indexOf(">"));

    expect(root).toContain("background-image:linear-gradient(180deg,#000 0%,#fff 100%)");
    expect(root).not.toContain("--presentation-text-gradient:");
    expect(html).toContain("--presentation-text-gradient:linear-gradient(90deg,#f00 0%,#00f 100%)");
  });

  it("renders linked Text Style Gradient as the effective atomic fill", () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "linked-text-gradient",
      title: "Linked Text Gradient",
      textStyles: [{ id: "body", style: { gradient } }],
      slides: [{
        id: "slide",
        elements: [{
          id: "linked-gradient",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Linked gradient",
        }],
      }],
    });

    const html = renderPresentation(source);
    expect(html).toContain("presentation-text-gradient-content");
    expect(html).toContain("--presentation-text-gradient:linear-gradient(180deg,#000000 0%,#ffffff 100%)");
  });

  it("lets local Color beat linked Gradient and local Gradient beat linked Color", () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "atomic-text-fills",
      title: "Atomic Text Fills",
      textStyles: [
        { id: "body", style: { gradient } },
        { id: "subtitle", style: { color: "#00ff00" } },
      ],
      slides: [{
        id: "slide",
        elements: [
          {
            id: "local-color",
            type: "text",
            hidden: false,
            variant: "body",
            content: "Local color",
            style: { color: "#ff0000" },
          },
          {
            id: "local-gradient",
            type: "text",
            hidden: false,
            variant: "subtitle",
            content: "Local gradient",
            style: { gradient },
          },
        ],
      }],
    });

    const html = renderPresentation(source);
    const localColorStart = html.indexOf('data-presentation-id="local-color"');
    const localColorEnd = html.indexOf(">", localColorStart);
    const localColorTag = html.slice(html.lastIndexOf("<", localColorStart), localColorEnd);
    const localGradientStart = html.indexOf('data-presentation-id="local-gradient"');
    const localGradientContent = html.slice(localGradientStart);

    expect(localColorTag).toContain("color:#ff0000");
    expect(localColorTag).not.toContain("--presentation-text-gradient:");
    expect(localGradientContent).toContain("presentation-text-gradient-content");
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

  it("keeps a no-color Text child eligible for the Container fallback", () => {
    const html = renderElement({
      id: "colored-container",
      type: "container",
      hidden: false,
      style: { color: "#ff00aa" },
      children: [{
        id: "fallback-text",
        type: "text",
        hidden: false,
        variant: "body",
        content: "Fallback text",
      }],
    });

    expect(html).toContain("--presentation-container-color:#ff00aa");
    expect(html).toContain('data-presentation-id="fallback-text"');
    expect(html).not.toContain('data-presentation-id="fallback-text" style="color:');
  });
});
