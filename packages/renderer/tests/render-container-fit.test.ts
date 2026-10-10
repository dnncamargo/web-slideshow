import { describe, expect, it } from "vitest";
import type { PresentationElement } from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";

const text = {
  id: "text",
  type: "text" as const,
  hidden: false,
  content: "Child",
  variant: "body" as const,
};

function container(overrides: Record<string, unknown> = {}): PresentationElement {
  return {
    id: "container",
    type: "container" as const,
    hidden: false,
    children: [text],
    ...overrides,
  } as PresentationElement;
}

describe("renderContainer historical children fit", () => {
  it("renders a historical fit document with ordinary Container layout", () => {
    const html = renderElement(container({
      layout: {
        width: "60%",
        padding: 20,
        overflow: "visible",
        children: {
          mode: "flow",
          direction: "row",
          gap: 12,
          distribution: "space-between",
          verticalAlign: "center",
          fit: { mode: "cover", sourceWidth: 800, sourceHeight: 400 },
        },
      },
    }));

    expect(html).not.toContain("presentation-container-fit");
    expect(html).not.toContain("data-presentation-container-fit");
    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:row");
    expect(html).toContain("gap:12px");
    expect(html).toContain("justify-content:space-between");
    expect(html).toContain("align-items:center");
    expect(html).toContain("width:60%");
    expect(html).toContain("padding:20px");
  });

  it("keeps ordinary stack layout and absolute positioning intact", () => {
    const html = renderElement(container({
      layout: { children: { mode: "stack", direction: "row", gap: 12 } },
      children: [{ ...text, layout: { position: "absolute", left: "25%", top: "10%" } }],
    }));

    expect(html).toContain("presentation-container-stack");
    expect(html).toContain("display:grid");
    expect(html).toContain("grid-area:1 / 1");
    expect(html).toContain("position:relative");
    expect(html).toContain("left:25%");
    expect(html).toContain("top:10%");
  });

  it("keeps pattern and link layers in the ordinary Container surface", () => {
    const html = renderElement(container({
      style: { background: { pattern: { image: "linear-gradient(#000,#fff)" } } },
      link: { href: "https://example.com", target: "_self" },
      layout: { children: { fit: { mode: "fill", sourceWidth: 800, sourceHeight: 400 } } },
    }));

    expect(html).not.toContain("presentation-container-fit-surface");
    expect(html).toContain("presentation-container-background-pattern");
    expect(html).toContain("data-presentation-container-link-surface");
  });
});
