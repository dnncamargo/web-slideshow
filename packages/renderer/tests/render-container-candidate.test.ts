import { describe, expect, it } from "vitest";

import {
  CandidateContainerSchema,
  type CandidateContainerElement,
} from "@powershow/document-schema";

import { renderCandidateContainer } from "../src/render-container-candidate";

const PATTERN = "radial-gradient(#444 1px, transparent 1px)";

function parseCandidate(
  value: Record<string, unknown>,
): CandidateContainerElement {
  return CandidateContainerSchema.parse(value);
}

function rootTag(html: string): string {
  return html.slice(0, html.indexOf(">"));
}

const productionChild = {
  id: "production-text",
  type: "text" as const,
  hidden: false,
  variant: "body" as const,
  content: "Production child",
};

describe("renderCandidateContainer", () => {
  it("uses effective flow/column defaults without authored namespaces", () => {
    const html = renderCandidateContainer(
      parseCandidate({ id: "minimal", type: "container", children: [] }),
      () => "",
    );

    expect(rootTag(html)).toContain("display:flex");
    expect(rootTag(html)).toContain("flex-direction:column");
    expect(rootTag(html)).not.toContain("position:");
  });

  it("renders canonical dimensions, spacing, overflow, and direct positioning", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "layout",
        type: "container",
        children: [],
        layout: {
          width: "80%",
          height: 200,
          minWidth: 100,
          minHeight: "20%",
          maxWidth: "90%",
          maxHeight: 500,
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
          overflow: "auto",
          position: "absolute",
          top: 11,
          right: 12,
          bottom: 13,
          left: 14,
        },
      }),
      () => "",
    );

    const tag = rootTag(html);

    expect(tag).toContain("width:80%");
    expect(tag).toContain("height:200px");
    expect(tag).toContain("min-width:100px");
    expect(tag).toContain("max-height:500px");
    expect(tag).toContain("margin-top:2px");
    expect(tag).toContain("padding-left:10px");
    expect(tag).toContain("overflow:auto");
    expect(tag).toContain("position:absolute");
    expect(tag).toContain("top:11px");
    expect(tag).toContain("right:12px");
    expect(tag).toContain("bottom:13px");
    expect(tag).toContain("left:14px");
  });

  it("renders flow direction, gap, distribution, and alignment", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "flow",
        type: "container",
        children: [],
        layout: {
          children: {
            direction: "row",
            gap: 16,
            distribution: "space-between",
            verticalAlign: "center",
          },
        },
      }),
      () => "",
    );

    expect(rootTag(html)).toContain("display:flex");
    expect(rootTag(html)).toContain("flex-direction:row");
    expect(rootTag(html)).toContain("gap:16px");
    expect(rootTag(html)).toContain("justify-content:space-between");
    expect(rootTag(html)).toContain("align-items:center");
  });

  it("renders stack mode with overlap and alignment", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "stack",
        type: "container",
        children: [
          { id: "one", type: "container", children: [] },
          { id: "two", type: "container", children: [] },
        ],
        layout: {
          children: {
            mode: "stack",
            horizontalAlign: "center",
            verticalAlign: "end",
          },
        },
      }),
      () => "",
    );

    expect(rootTag(html)).toContain("display:grid");
    expect(rootTag(html)).toContain("powershow-container-stack");
    expect(rootTag(html)).toContain("justify-items:center");
    expect(rootTag(html)).toContain("align-items:end");
    expect(html.match(/grid-area:1 \/ 1/g)).toHaveLength(2);
  });

  it("renders backgrounds, borders, typography, effects, and custom class", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "styled",
        type: "container",
        children: [],
        style: {
          color: "#ffffff",
          background: {
            color: "#111827",
            gradient: {
              type: "linear",
              stops: [
                { color: "#000000", position: 0 },
                { color: "#ffffff", position: 100 },
              ],
            },
            pattern: { image: PATTERN, opacity: 0.5 },
          },
          border: { width: 2, color: "#ffffff" },
          borderRadius: 12,
          className: "custom-surface",
        },
        typography: {
          fontFamily: 'Font "Unsafe"',
          fontSize: 20,
          fontWeight: 700,
          fontStyle: "italic",
          textAlign: "center",
          lineHeight: 1.5,
          letterSpacing: 2,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          textWrapStyle: "pretty",
          overflowWrap: "anywhere",
          textDecorationLine: "underline",
          textDecorationColor: "#ff0000",
          textStroke: { width: 1, color: "#000000" },
        },
        effect: {
          opacity: 0.8,
          shadow: { x: 0, y: 4, blur: 12, color: "#000000" },
        },
      }),
      () => "",
    );

    const tag = rootTag(html);

    expect(tag).toContain("background:#111827");
    expect(tag).toContain("background-image:linear-gradient");
    expect(html).toContain(PATTERN);
    expect(tag).toContain("border-width:2px");
    expect(tag).toContain("border-color:#ffffff");
    expect(tag).toContain("border-radius:12px");
    expect(tag).toContain("font-family:&quot;Font \\22 Unsafe\\22 &quot;");
    expect(tag).toContain("text-align:center");
    expect(tag).toContain("-webkit-text-stroke:1px #000000");
    expect(tag).toContain("opacity:0.8");
    expect(tag).toContain("box-shadow:0px 4px 12px #000000");
    expect(tag).toContain("custom-surface");
    expect(rootTag(html)).toContain("isolation:isolate");
  });

  it("renders gradient borders with the current border utility", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "gradient-border",
        type: "container",
        children: [],
        style: {
          border: {
            width: 2,
            gradient: {
              type: "linear",
              stops: [
                { color: "#000000", position: 0 },
                { color: "#ffffff", position: 100 },
              ],
            },
          },
        },
      }),
      () => "",
    );

    expect(rootTag(html)).toContain("border-color:transparent");
    expect(rootTag(html)).toContain("border-image:linear-gradient");
  });

  it("preserves semantic role/tag and link surface behavior", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "linked-main",
        type: "container",
        role: "main",
        children: [],
        link: {
          kind: "url",
          href: "https://example.com/?a=1&b=2",
          target: "_blank",
        },
      }),
      () => "",
    );

    expect(html).toMatch(/^<main /);
    expect(rootTag(html)).toContain("position:relative");
    expect(rootTag(html)).toContain("z-index:0");
    expect(html).toContain('data-powershow-container-link-surface="true"');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("suppresses hidden candidates and recurses/callback-renders children", () => {
    expect(
      renderCandidateContainer(
        parseCandidate({
          id: "hidden",
          type: "container",
          hidden: true,
          children: [],
        }),
        () => "",
      ),
    ).toBe("");

    const html = renderCandidateContainer(
      parseCandidate({
        id: "parent",
        type: "container",
        children: [
          { id: "nested", type: "container", children: [] },
          productionChild,
        ],
      }),
      (child) =>
        `<p data-powershow-id="${child.id}">${
          child.type === "text" ? child.content : ""
        }</p>`,
    );

    expect(html).toContain('data-powershow-id="nested"');
    expect(html).toContain('data-powershow-id="production-text"');
    expect(html).toContain("Production child");
  });

  it("adds only renderer-owned containing blocks when needed", () => {
    const candidateChild = {
      id: "absolute-child",
      type: "container" as const,
      children: [],
      layout: { position: "absolute" as const, top: 10 },
    };

    const normalWithAbsoluteChild = renderCandidateContainer(
      parseCandidate({
        id: "normal-parent",
        type: "container",
        children: [candidateChild],
      }),
      () => "",
    );
    expect(rootTag(normalWithAbsoluteChild)).toContain("position:relative");

    const absoluteWithAbsoluteChild = renderCandidateContainer(
      parseCandidate({
        id: "absolute-parent",
        type: "container",
        layout: { position: "absolute", top: 0 },
        children: [candidateChild],
      }),
      () => "",
    );
    expect(rootTag(absoluteWithAbsoluteChild)).toContain("position:absolute");
    expect(rootTag(absoluteWithAbsoluteChild)).not.toContain("position:relative");
  });

  it("detects production children with legacy absolute position contracts", () => {
    const positionChild = {
      ...productionChild,
      id: "production-position-child",
      style: { position: "absolute" as const },
    };
    const placementChild = {
      ...productionChild,
      id: "production-placement-child",
      style: { placement: { mode: "absolute" as const } },
    };
    const renderProductionChild = () => "<p></p>";

    for (const child of [positionChild, placementChild]) {
      const html = renderCandidateContainer(
        parseCandidate({
          id: "production-position-parent",
          type: "container",
          children: [child],
        }),
        renderProductionChild,
      );

      expect(rootTag(html)).toContain("position:relative");
    }
  });

  it("preserves authored absolute positioning for link and pattern roots", () => {
    for (const extra of [
      { link: { kind: "url", href: "https://example.com" } },
      { style: { background: { pattern: { image: PATTERN } } } },
    ]) {
      const html = renderCandidateContainer(
        parseCandidate({
          id: "absolute-root",
          type: "container",
          layout: { position: "absolute", top: 0 },
          children: [],
          ...extra,
        }),
        () => "",
      );

      expect(rootTag(html)).toContain("position:absolute");
      expect(rootTag(html)).not.toContain("position:relative");
    }

    const patterned = renderCandidateContainer(
      parseCandidate({
        id: "normal-pattern",
        type: "container",
        children: [],
        style: { background: { pattern: { image: PATTERN } } },
      }),
      () => "",
    );
    expect(rootTag(patterned)).toContain("position:relative");
    expect(rootTag(patterned)).toContain("isolation:isolate");
  });

  it("keeps pattern and link layers together and preserves nested absolute children", () => {
    const html = renderCandidateContainer(
      parseCandidate({
        id: "patterned-link",
        type: "container",
        link: { kind: "url", href: "https://example.com" },
        style: { background: { pattern: { image: PATTERN } } },
        children: [
          {
            id: "nested-absolute",
            type: "container",
            layout: { position: "absolute", top: 12, right: 24 },
            children: [],
          },
        ],
      }),
      () => "",
    );

    expect(html).toContain("powershow-container-background-pattern");
    expect(html).toContain("data-powershow-container-link-surface");
    expect(html).toContain('data-powershow-id="nested-absolute"');
    expect(html).toContain("position:absolute;top:12px;right:24px");
  });
});
