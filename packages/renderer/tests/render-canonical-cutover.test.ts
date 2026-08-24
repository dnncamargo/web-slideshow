import { describe, expect, it } from "vitest";
import { renderContentSlotStyle, renderElement } from "../src";

describe("Chart and Interactive placeholders", () => {
  it.each([
    [{ type: "chart", id: "chart-flow", hidden: false, chartType: "line", series: [] }],
    [{ type: "interactive", id: "interactive-flow", hidden: false, widget: "function-plot", config: {} }],
  ])("renders a flow placeholder without legacy style", (element) => {
    const html = renderElement(element as never);
    expect(html).toContain("powershow-placeholder");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("placement");
  });

  it("renders canonical absolute edges only", () => {
    const html = renderElement({
      type: "chart",
      id: "chart-absolute",
      hidden: false,
      layout: { position: "absolute", top: "10%", left: 12 },
      chartType: "bar",
      series: [],
    });
    expect(html).toContain("position:absolute;top:10%;left:12px");
    expect(html).not.toContain("width:");
  });

  it("does not render hidden placeholders", () => {
    expect(renderElement({ type: "interactive", id: "hidden", hidden: true, widget: "pwm-demo", config: {} })).toBe("");
  });
});
describe("canonical ContentSlot renderer", () => {
  it("renders only canonical slot layout, visual, and typography fields", () => {
    const style = renderContentSlotStyle({
      id: "slot",
      layout: { padding: 1, paddingTop: "2px", paddingRight: "3px", paddingBottom: 4, paddingLeft: "5px" },
      style: {
        color: "#ffffff",
        background: { color: "#000000" },
        border: { width: 1, style: "solid", color: "#333333" },
        borderRadius: 6,
        className: 'slot "quoted"',
      },
      typography: {
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 700,
        fontStyle: "italic",
        textAlign: "center",
        lineHeight: 1.4,
        letterSpacing: 0.2,
        textTransform: "uppercase",
        whiteSpace: "pre-wrap",
        textWrapStyle: "pretty",
        overflowWrap: "anywhere",
        textDecorationLine: "underline",
        textDecorationColor: "#ff0000",
        textStroke: { width: 1, color: "#000000" },
      },
      children: [],
    });
    expect(style).toContain("padding:1px");
    expect(style).toContain("padding-top:2px");
    expect(style).toContain("background:#000000");
    expect(style).toContain("font-family:\"Inter\"");
    expect(style).toContain("-webkit-text-stroke:1px #000000");
    expect(style).not.toContain("class");
  });

  it("leaves an unstyled structural slot without an inline style", () => {
    const html = renderElement({
      type: "table",
      id: "table",
      hidden: false,
      mode: "structured",
      showHeader: true,
      columns: [{ id: "column", header: { id: "header", children: [] }, width: 120 }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    });
    expect(html).toContain('data-powershow-content-slot-id="header"');
    expect(html).not.toContain('data-powershow-content-slot-id="header" style=');
    expect(html).toContain("width:120px");
  });

  it("uses canonical slot metadata for Topics and escapes the host class", () => {
    const html = renderElement({
      type: "topics",
      id: "topics",
      hidden: false,
      kind: "unordered",
      items: [{ id: "item", content: { id: "slot", layout: { padding: 8 }, style: { className: 'slot "quoted"' }, typography: { fontSize: 14 }, children: [] }, children: [] }],
    });
    expect(html).toContain('class="powershow-topic-item slot &quot;quoted&quot;"');
    expect(html).toContain("padding:8px");
    expect(html).toContain("font-size:14px");
  });
});
