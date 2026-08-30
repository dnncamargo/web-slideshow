import { describe, expect, it } from "vitest";
import type { PowerShowElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

const text = {
  id: "text",
  type: "text" as const,
  hidden: false,
  content: "Child",
  variant: "body" as const,
};

function container(overrides: Record<string, unknown> = {}): PowerShowElement {
  return {
    id: "container",
    type: "container" as const,
    hidden: false,
    children: [text],
    ...overrides,
  } as PowerShowElement;
}

describe("renderContainer children fit", () => {
  it("keeps the existing no-fit structure and layout", () => {
    const html = renderElement(container({
      layout: { children: { mode: "stack", direction: "row", gap: 12 } },
    }));

    expect(html).toContain("powershow-container-stack");
    expect(html).toContain("display:grid");
    expect(html).not.toContain("powershow-container-fit-viewport");
    expect(html).toContain("grid-area:1 / 1");
  });

  it("emits fit wrappers and keeps outer visual/layout properties outer", () => {
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
      style: {
        background: { color: "#ffffff" },
        borderRadius: 8,
        className: "custom-container",
      },
    }));

    expect(html).toContain("powershow-container-fit-viewport");
    expect(html).toContain("powershow-container-fit-surface");
    expect(html).toContain('data-powershow-container-fit-mode="cover"');
    expect(html).toContain('data-powershow-container-fit-source-width="800"');
    expect(html).toContain('data-powershow-container-fit-source-height="400"');
    expect(html).toContain("width:60%");
    expect(html).toContain("padding:20px");
    expect(html).toContain("overflow:visible");
    expect(html).toContain("background:#ffffff");
    expect(html).toContain("border-radius:8px");

    const surfaceStart = html.indexOf("powershow-container-fit-surface");
    const surface = html.slice(surfaceStart);
    expect(surface).toContain("display:flex");
    expect(surface).toContain("flex-direction:row");
    expect(surface).toContain("gap:12px");
    expect(surface).toContain("justify-content:space-between");
    expect(surface).toContain("align-items:center");
  });

  it("uses the source surface as the absolute containing block", () => {
    const html = renderElement(container({
      layout: {
        children: {
          fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 },
        },
      },
      children: [{ ...text, layout: { position: "absolute", left: "25%", top: "10%" } }],
    }));

    const surfaceStart = html.indexOf("powershow-container-fit-surface");
    expect(surfaceStart).toBeGreaterThan(-1);
    expect(html.slice(surfaceStart)).toContain("position:relative");
    expect(html.slice(surfaceStart)).toContain('left:25%');
    expect(html.slice(surfaceStart)).toContain('top:10%');
  });

  it("preserves pattern and link layers outside the fitted surface", () => {
    const html = renderElement(container({
      style: { background: { pattern: { image: "linear-gradient(#000,#fff)" } } },
      link: { href: "https://example.com", target: "_self" },
      layout: { children: { fit: { mode: "fill", sourceWidth: 800, sourceHeight: 400 } } },
    }));

    const surfaceStart = html.indexOf("powershow-container-fit-surface");
    const linkStart = html.indexOf("data-powershow-container-link-surface");
    expect(html.indexOf("powershow-container-background-pattern")).toBeLessThan(surfaceStart);
    expect(linkStart).toBeGreaterThan(surfaceStart);
    expect(html.slice(linkStart)).toContain("z-index:100");
  });

  it("keeps source dimensions in normal flow for auto-sized containers", () => {
    const html = renderElement(container({
      layout: { children: { fit: { mode: "contain", sourceWidth: 320, sourceHeight: 180 } } },
    }));

    expect(html).toContain("width:320px;height:180px");
    expect(html).toContain("position:relative;width:100%;height:100%");
    expect(html).not.toContain("position:absolute;width:320px");
  });
});
