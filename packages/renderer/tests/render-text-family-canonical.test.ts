import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";

describe("canonical Text family renderer", () => {
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

  it("renders Textbox width and height from layout", () => {
    const html = renderElement({
      id: "textbox",
      type: "textbox",
      hidden: false,
      content: "Hello",
      layout: { width: "50%", height: 120 },
      typography: { fontFamily: "Inter" },
    });

    expect(html).toContain("width:50%");
    expect(html).toContain("height:120px");
    expect(html).toContain('font-family:&quot;Inter&quot;');
    expect(html).not.toContain("renderStyle");
  });
});
