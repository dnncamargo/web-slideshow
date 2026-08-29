import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";

import {
  createContainerElement,
  createTextElement,
} from "./fixtures/render-fixtures";

const GRADIENT = {
  type: "linear" as const,
  angle: 90,
  stops: [
    { color: "#111111", position: 0 },
    { color: "#ffffff", position: 100 },
  ],
};

const PATTERN = {
  image: "linear-gradient(#444 1px, transparent 1px)",
};

function rootTag(html: string): string {
  return html.slice(0, html.indexOf(">"));
}

function tagForId(html: string, id: string): string {
  const marker = `data-powershow-id="${id}"`;
  const end = html.indexOf(">", html.indexOf(marker));
  const start = html.lastIndexOf("<", html.indexOf(marker));

  return html.slice(start, end);
}

describe("production canonical Container renderer", () => {
  it("uses flow and column as effective defaults without authoring position", () => {
    const tag = rootTag(renderElement(createContainerElement()));

    expect(tag).toContain("display:flex");
    expect(tag).toContain("flex-direction:column");
    expect(tag).not.toContain("position:");
  });

  it("renders canonical dimensions, spacing, and overflow", () => {
    const tag = rootTag(renderElement(createContainerElement({
      layout: {
        width: 100,
        height: "80%",
        minWidth: 20,
        minHeight: "10px",
        maxWidth: 500,
        maxHeight: "90vh",
        margin: 1,
        marginTop: 2,
        marginRight: 3,
        marginBottom: 4,
        marginLeft: 5,
        padding: 6,
        paddingTop: 7,
        paddingRight: 8,
        paddingBottom: 9,
        paddingLeft: 10,
        overflow: "hidden",
      },
    })));

    for (const declaration of [
      "width:100px", "height:80%", "min-width:20px", "min-height:10px",
      "max-width:500px", "max-height:90vh", "margin:1px", "margin-top:2px",
      "margin-right:3px", "margin-bottom:4px", "margin-left:5px",
      "padding:6px", "padding-top:7px", "padding-right:8px",
      "padding-bottom:9px", "padding-left:10px", "overflow:hidden",
    ]) {
      expect(tag).toContain(declaration);
    }
  });

  it("renders authored Container flex shrinking on the outer Container only", () => {
    const defaultTag = rootTag(renderElement(createContainerElement()));
    expect(defaultTag).not.toContain("flex-shrink:");

    const fittedHtml = renderElement(createContainerElement({
      layout: {
        flexShrink: 0,
        width: 800,
        height: 400,
        padding: 12,
        children: {
          fit: { mode: "contain", sourceWidth: 400, sourceHeight: 200 },
        },
      },
      children: [createTextElement({ id: "fit-child" })],
    }));

    expect(rootTag(fittedHtml)).toContain("flex-shrink:0");
    expect(fittedHtml).toContain('class="powershow-container-fit-viewport"');
    expect(tagForId(fittedHtml, "fit-child")).not.toContain("flex-shrink:");
  });

  it("renders canonical absolute placement with opposite edges", () => {
    const tag = rootTag(renderElement(createContainerElement({
      layout: {
        position: "absolute",
        top: 0,
        right: 4,
        bottom: 8,
        left: 12,
      },
    })));

    expect(tag).toContain("position:absolute");
    expect(tag).toContain("top:0px");
    expect(tag).toContain("right:4px");
    expect(tag).toContain("bottom:8px");
    expect(tag).toContain("left:12px");
    expect(tag).not.toContain("position:relative");
  });

  it("renders canonical children layout and stack child placement", () => {
    const flowTag = rootTag(renderElement(createContainerElement({
      layout: {
        children: {
          direction: "row",
          gap: 16,
          distribution: "space-between",
          horizontalAlign: "center",
          verticalAlign: "end",
        },
      },
    })));

    expect(flowTag).toContain("flex-direction:row");
    expect(flowTag).toContain("gap:16px");
    expect(flowTag).toContain("justify-content:space-between");
    expect(flowTag).toContain("align-items:flex-end");

    const stackHtml = renderElement(createContainerElement({
      layout: { children: { mode: "stack", horizontalAlign: "center", verticalAlign: "end" } },
      children: [createTextElement({ id: "stack-child" })],
    }));

    expect(rootTag(stackHtml)).toContain("display:grid");
    expect(rootTag(stackHtml)).toContain("justify-items:center");
    expect(rootTag(stackHtml)).toContain("align-items:end");
    expect(tagForId(stackHtml, "stack-child")).toContain("grid-area:1 / 1");
  });

  it("renders canonical visual, typography, class, and effect namespaces", () => {
    const html = renderElement(createContainerElement({
      style: {
        color: "#ffffff",
        background: { color: "#111111", gradient: GRADIENT, pattern: PATTERN },
        border: { width: 2, style: "solid", color: "#ffffff" },
        borderRadius: 12,
        className: "hero",
      },
      typography: {
        fontFamily: "Open Sans",
        fontSize: 24,
        fontWeight: 700,
        fontStyle: "italic",
        textAlign: "center",
        lineHeight: 1.5,
        letterSpacing: 2,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        textWrapStyle: "balance",
        overflowWrap: "break-word",
        textDecorationLine: "underline",
        textDecorationColor: "#ff0000",
        textStroke: { width: 1, color: "#000000" },
      },
      effect: {
        opacity: 0.75,
        shadow: { x: 0, y: 2, blur: 8, color: "#000000" },
      },
    }));
    const tag = rootTag(html);

    for (const declaration of [
      "color:#ffffff", "background:#111111", "background-image:linear-gradient(90deg,#111111 0%,#ffffff 100%)",
      "border-width:2px", "border-style:solid",
      "border-color:#ffffff", "border-radius:12px", "hero", "font-family:&quot;Open Sans&quot;",
      "font-size:24px", "font-weight:700", "font-style:italic", "text-align:center",
      "line-height:1.5", "letter-spacing:2px", "text-transform:uppercase", "white-space:nowrap",
      "text-wrap-style:balance", "overflow-wrap:break-word", "text-decoration-line:underline",
      "text-decoration-color:#ff0000", "-webkit-text-stroke:1px #000000", "opacity:0.75",
      "box-shadow:0px 2px 8px #000000",
    ]) {
      expect(tag).toContain(declaration);
    }

    expect(html).toContain(`background-image:${PATTERN.image}`);
  });

  it("renders gradient borders from the canonical border namespace", () => {
    const tag = rootTag(renderElement(createContainerElement({
      style: {
        border: { width: 2, gradient: GRADIENT },
      },
    })));

    expect(tag).toContain("border-color:transparent");
    expect(tag).toContain(
      "border-image:linear-gradient(90deg,#111111 0%,#ffffff 100%) 1",
    );
  });

  it("quotes and escapes a font family through the production renderer", () => {
    const tag = rootTag(renderElement(createContainerElement({
      typography: { fontFamily: 'Font "Unsafe"' },
    })));

    expect(tag).toContain(
      String.raw`font-family:&quot;Font \22 Unsafe\22 &quot;`,
    );
  });

  it("preserves structure, semantics, hidden behavior, recursion, and non-Container children", () => {
    const html = renderElement(createContainerElement({
      role: "main",
      children: [
        createContainerElement({ id: "nested", children: [createTextElement({ id: "text" })] }),
        createTextElement({ id: "canonical-child", layout: { position: "absolute", top: 0, left: 0 } }),
      ],
    }));

    expect(rootTag(html)).toContain("<main");
    expect(rootTag(html)).toContain('data-powershow-role="main"');
    expect(html).toContain('data-powershow-id="nested"');
    expect(html).toContain('data-powershow-id="text"');
    expect(html).toContain('data-powershow-id="canonical-child"');
    expect(rootTag(html)).toContain("position:relative");
    expect(renderElement(createContainerElement({ hidden: true }))).toBe("");
  });

  it("renders link surfaces and blank-target security attributes", () => {
    const html = renderElement(createContainerElement({
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    }));

    expect(rootTag(html)).toContain("position:relative");
    expect(html).toContain('data-powershow-container-link-surface="true"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("preserves authored containing blocks across absolute, pattern, link, and nested cases", () => {
    const absoluteChild = createContainerElement({
      id: "absolute-child",
      layout: { position: "absolute", top: 10, right: 20, bottom: 30, left: 40 },
    });

    const absoluteParent = renderElement(createContainerElement({
      layout: { position: "absolute" },
      children: [absoluteChild],
    }));
    expect(rootTag(absoluteParent)).toContain("position:absolute");
    expect(rootTag(absoluteParent)).not.toContain("position:relative");
    expect(tagForId(absoluteParent, "absolute-child")).toContain("top:10px");
    expect(tagForId(absoluteParent, "absolute-child")).toContain("right:20px");

    const normalParentWithAbsoluteChild = renderElement(createContainerElement({
      children: [createContainerElement({
        id: "normal-absolute-child",
        layout: { position: "absolute", top: 10, left: 20 },
      })],
    }));
    expect(rootTag(normalParentWithAbsoluteChild)).toContain("position:relative");
    expect(rootTag(normalParentWithAbsoluteChild)).not.toContain("position:absolute");
    expect(tagForId(normalParentWithAbsoluteChild, "normal-absolute-child")).toContain("position:absolute");
    expect(tagForId(normalParentWithAbsoluteChild, "normal-absolute-child")).toContain("top:10px");
    expect(tagForId(normalParentWithAbsoluteChild, "normal-absolute-child")).toContain("left:20px");

    const normalPatternParent = renderElement(createContainerElement({
      style: { background: { pattern: PATTERN } },
    }));
    expect(rootTag(normalPatternParent)).toContain("position:relative");
    expect(rootTag(normalPatternParent)).toContain("isolation:isolate");

    const patternParent = renderElement(createContainerElement({
      layout: { position: "absolute" },
      style: { background: { pattern: PATTERN } },
      link: { kind: "url", href: "https://example.com" },
    }));
    expect(rootTag(patternParent)).toContain("position:absolute");
    expect(rootTag(patternParent)).not.toContain("position:relative");
    expect(rootTag(patternParent)).toContain("isolation:isolate");
    expect(patternParent).toContain("powershow-container-background-pattern");

    const legacyPlacementParent = renderElement(createContainerElement({
      children: [createTextElement({ layout: { position: "absolute", top: 0, left: 0 } })],
    }));
    expect(rootTag(legacyPlacementParent)).toContain("position:relative");
  });
});
