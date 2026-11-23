import { describe, expect, it } from "vitest";
import { renderElement } from "../src/render-element";
import { renderSlide } from "../src/render-slide";

const math = (source: string, extra: Record<string, unknown> = {}) => ({ id: "m", type: "math" as const, format: "latex" as const, hidden: false, source, ...extra });

describe("Math renderer", () => {
  it("preserves KaTeX's natural font defaults when no weight or style is authored", () => {
    const html = renderElement(math("x"));
    expect(html).not.toContain("presentation-math-weight");
    expect(html).not.toContain("presentation-math-style");
  });
  it.each([String.raw`\frac{a}{b}`, String.raw`\sqrt{x}`, "x^2_i", String.raw`x\leq y`, String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`, String.raw`\begin{cases}x&x>0\\0&x=0\end{cases}`, String.raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`, String.raw`\sum_{i=1}^n i`])("renders %s as HTML and MathML", (source) => {
    const html = renderElement(math(source));
    expect(html).toContain("<math");
    expect(html).toContain("presentation-math");
  });
  it("safely falls back on invalid, hostile, and oversized input without aborting slide", () => {
    for (const source of [String.raw`\frac{`, String.raw`\href{javascript:alert(1)}{x}`, "x".repeat(4097)]) {
      const html = renderElement(math(source));
      expect(html).toContain("presentation-math-error");
      expect(html).not.toContain("javascript:");
    }
    const slide = renderSlide({ id: "s", title: "", summary: "", speakerNotes: "", elements: [math(String.raw`\frac{`), { id: "t", type: "text", content: "after", variant: "body", hidden: false }] });
    expect(slide).toContain("presentation-math-error");
    expect(slide).toContain("after");
  });
  it("applies layout, appearance, gradient and effects", () => {
    const html = renderElement(math("x", { layout: { width: 300, position: "absolute", left: 10, margin: 4 }, style: { gradient: { type: "linear", stops: [{ position: 0, color: "#000" }, { position: 100, color: "#fff" }] } }, effect: { opacity: 0.5, glow: { blur: 6, color: "#f0f" }, shadow: { x: 1, y: 2, blur: 3, color: "#000" } } }));
    expect(html).toContain("width:300px");
    expect(html).toContain("linear-gradient");
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("position:absolute");
    expect(html).toContain("left:10px");
    expect(html).toContain("margin:4px");
    expect(html).toContain("filter:drop-shadow");
    expect(html).toContain("text-shadow:1px 2px 3px #000");
    expect(html.match(/filter:/g)).toHaveLength(1);
  });
  it("keeps multiline KaTeX intact while applying glyph shadow and one glow filter", () => {
    const html = renderElement(math(String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`, {
      effect: { shadow: { x: 2, y: 3, blur: 5, spread: 4, inset: true, color: "#123456" }, glow: { blur: 8, color: "#abcdef" } },
    }));
    expect(html).toContain("katex-html");
    expect(html).toContain("<math");
    expect(html).toContain("text-shadow:2px 3px 5px #123456");
    expect(html).toContain("filter:drop-shadow(0 0 8px #abcdef)");
    expect(html.match(/filter:/g)).toHaveLength(1);
    expect(html).not.toContain("drop-shadow(inset");
    expect(html).not.toContain("spread");
  });
  it("applies solid color, background, border, radius, typography, visibility, and link", () => {
    const html = renderElement(math("x", { layout: { height: 80, top: 4, marginBottom: 7 }, style: { color: "#123456", background: { color: "#ffffff" }, border: { width: 2, color: "#000000" }, borderRadius: 5, className: "authored-math" }, typography: { fontSize: 22, fontWeight: 700, fontStyle: "italic", textAlign: "right", lineHeight: 1.4 }, link: { kind: "url", href: "https://example.com" } }));
    expect(html).toContain("color:#123456");
    expect(html).toContain("background:#ffffff");
    expect(html).toContain("border-radius:5px");
    expect(html).toContain("font-size:22px");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("font-style:italic");
    expect(html).toContain("presentation-math-weight");
    expect(html).toContain("presentation-math-style");
    expect(html).toContain("text-align:right");
    expect(html).toContain("line-height:1.4");
    expect(html).toContain("height:80px");
    expect(html).toContain("top:4px");
    expect(html).toContain("margin-bottom:7px");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("authored-math");
    expect(renderElement(math("x", { hidden: true }))).toBe("");
  });
  it.each([
    { kind: "display", source: "x^2" },
    { kind: "multiline", source: String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}` },
  ])("renders a safe $kind Math link as one escaped native anchor", ({ source }) => {
    const html = renderElement(math(source, { link: { kind: "url", href: 'https://example.com/math?a=1&b="quoted"', target: "_blank" } }));
    expect(html).toContain("katex-display");
    expect(html).toContain("<math");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://example.com/math?a=1&amp;b=&quot;quoted&quot;"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('data-presentation-link="true"');
    expect(html.indexOf("<a ")).toBeLessThan(html.indexOf("katex-display"));
  });
  it("renders Math same-tab links without adding external-window protections", () => {
    const html = renderElement(math("x", { link: { kind: "url", href: "https://example.com/math", target: "_self" } }));
    expect(html).toContain('href="https://example.com/math"');
    expect(html).toContain('target="_self"');
    expect(html).toContain('data-presentation-link="true"');
    expect(html).not.toContain("rel=");
  });
  it("keeps KaTeX complex math output intact when typography is applied", () => {
    const html = renderElement(math(String.raw`\begin{aligned}\frac{\sqrt{x}}{y^2}&=\sum_{i=1}^n i\\z&\leq 2\end{aligned}`, { typography: { fontWeight: 400, fontStyle: "normal" } }));
    expect(html).toContain("font-weight:400");
    expect(html).toContain("font-style:normal");
    expect(html).toContain("katex-html");
    expect(html).toContain("katex-mathml");
    expect(html).toContain("<mo>∑</mo>");
  });
  it("applies bold italic overrides to complex KaTeX structures", () => {
    const html = renderElement(math(String.raw`\frac{\sqrt{x^2+1}}{\int_0^1 y\,dy}=\sum_{i=1}^n i`, { typography: { fontWeight: 700, fontStyle: "italic" } }));
    expect(html).toContain("font-weight:700");
    expect(html).toContain("font-style:italic");
    expect(html).toContain("presentation-math-weight");
    expect(html).toContain("presentation-math-style");
    expect(html).toContain("katex-html");
    expect(html).toContain("mfrac");
    expect(html).toContain("msqrt");
  });
  it("renders Math as a normal child of flow containers with parent alignment", () => {
    const html = renderElement({
      id: "math-parent",
      type: "container",
      hidden: false,
      layout: { children: { direction: "column", horizontalAlign: "center", verticalAlign: "center" } },
      children: [math("x", { layout: { width: "50%", height: 40, margin: 3 } })],
    });
    expect(html).toContain("align-items:center");
    expect(html).toContain("justify-content:center");
    expect(html).toContain('data-presentation-type="math"');
    expect(html).toContain("width:50%");
    expect(html).toContain("height:40px");
    expect(html).toContain("margin:3px");
  });
  it("applies general and side padding with CSS side precedence and preserves layout values", () => {
    const html = renderElement(math("x", { layout: { width: "50%", height: 80, margin: 4, padding: 12, paddingTop: 2, paddingLeft: "1rem", position: "absolute", top: 8, left: 9 } }));
    expect(html).toContain("box-sizing:border-box");
    expect(html).toContain("padding:12px");
    expect(html).toContain("padding-top:2px");
    expect(html).toContain("padding-left:1rem");
    expect(html).toContain("width:50%");
    expect(html).toContain("height:80px");
    expect(html).toContain("margin:4px");
    expect(html).toContain("position:absolute");
    expect(html).toContain("top:8px");
    expect(html).toContain("left:9px");
  });
  it("renders gradient borders through the shared rounded mask with width and authored radius", () => {
    const html = renderElement(math("x", { layout: { width: 200, padding: 8 }, style: { border: { width: 3, style: "solid", gradient: { type: "linear", stops: [{ position: 0, color: "#000000" }, { position: 100, color: "#ffffff" }] } }, borderRadius: 16 } }));
    expect(html).toContain("presentation-gradient-border");
    expect(html).toContain("--presentation-gradient-border-width:3px");
    expect(html).toContain("--presentation-gradient-border-paint:linear-gradient");
    expect(html).toContain("border-radius:16px");
    expect(html).toContain("padding-top:calc(8px + 3px)");
    expect(html).not.toContain("border-image:");
  });
  it.each(["dashed", "dotted"] as const)("preserves the %s solid-border style", style => {
    const html = renderElement(math("x", { style: { background: { gradient: { type: "radial", stops: [{ position: 0, color: "#000000" }, { position: 100, color: "#ffffff" }] } }, border: { width: 2, style, color: "#123456" } } }));
    expect(html).toContain("background-image:radial-gradient");
    expect(html).toContain(`border-style:${style}`);
    expect(html).toContain("border-width:2px");
    expect(html).toContain("border-color:#123456");
  });
});
