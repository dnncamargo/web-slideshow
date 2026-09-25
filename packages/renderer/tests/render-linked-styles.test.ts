import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ContainerElement,
} from "@web-slideshow/document-schema";

import { renderElement, renderPresentation } from "../src";

function tagForId(html: string, id: string): string {
  const marker = `data-presentation-id="${id}"`;
  const markerIndex = html.indexOf(marker);
  const start = html.lastIndexOf("<", markerIndex);
  const end = html.indexOf(">", markerIndex);
  return html.slice(start, end);
}

function presentation(elements: ContainerElement[]) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "linked-rendering",
    title: "Linked rendering",
    palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    linkedStyles: [{
      id: "card",
      name: "Card",
      layout: { padding: 12, children: { direction: "row", gap: 8 } },
      style: {
        color: { kind: "palette", colorId: "accent" },
        background: {
          color: "#101827",
          gradient: { type: "linear", angle: 90, stops: [{ color: "#111111", position: 0 }, { color: "#222222", position: 100 }] },
          pattern: { image: "linear-gradient(#000,#fff)" },
        },
      },
      typography: { fontSize: 20, fontWeight: 700 },
      effect: { opacity: 0.5, shadow: { x: 1, y: 2, blur: 3, color: "#000000" } },
    }, {
      id: "absolute",
      name: "Absolute",
      layout: { position: "absolute", top: 10, right: 20, bottom: 30, left: 40 },
    }],
    slides: [{ id: "slide", elements }],
  });
}

describe("Linked Container Style rendering", () => {
  it("renders linked authored namespaces, Palette references, and local class names without mutation", () => {
    const container: ContainerElement = {
      id: "card-instance",
      type: "container",
      hidden: false,
      linkedStyleId: "card",
      style: { className: "local-card" },
      children: [],
    };
    const source = presentation([container]);
    const snapshot = structuredClone(source);

    const html = renderPresentation(source);

    expect(html).toContain("padding:12px");
    expect(html).toContain("flex-direction:row");
    expect(html).toContain("gap:8px");
    expect(html).toContain("color:var(--ps-palette-0061006300630065006e0074)");
    expect(html).toContain("background:#101827");
    expect(html).toContain("background-image:linear-gradient(90deg,#111111 0%,#222222 100%)");
    expect(html).toContain("linear-gradient(#000,#fff)");
    expect(html).toContain("font-size:20px");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("box-shadow:1px 2px 3px #000000");
    expect(html).toContain("local-card");
    expect(source).toEqual(snapshot);
  });

  it("uses the effective linked Container color for descendant fallback", () => {
    const source = presentation([{
      id: "linked-colored-container",
      type: "container",
      hidden: false,
      linkedStyleId: "card",
      children: [],
    }]);

    const tag = tagForId(renderPresentation(source), "linked-colored-container");
    expect(tag).toContain("color:var(--ps-palette-0061006300630065006e0074)");
    expect(tag).toContain("--presentation-container-color:var(--ps-palette-0061006300630065006e0074)");
  });

  it("keeps local overrides while retaining unoverridden linked values and falsy effects", () => {
    const html = renderPresentation(presentation([{
      id: "card-instance",
      type: "container",
      hidden: false,
      linkedStyleId: "card",
      layout: { padding: 24, children: { gap: 0 } },
      style: { background: { color: "#ffffff" } },
      effect: { opacity: 0 },
      children: [],
    }]));

    expect(html).toContain("padding:24px");
    expect(html).toContain("flex-direction:row");
    expect(html).toContain("gap:0px");
    expect(html).toContain("background:#ffffff");
    expect(html).toContain("background-image:linear-gradient(90deg,#111111 0%,#222222 100%)");
    expect(html).toContain("opacity:0");
    expect(html).toContain("box-shadow:1px 2px 3px #000000");
  });

  it("uses linked absolute child layout consistently for positioning and fit", () => {
    const html = renderPresentation(presentation([{
      id: "parent",
      type: "container",
      hidden: false,
      layout: { children: { fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 } } },
      children: [{
        id: "child",
        type: "container",
        hidden: false,
        linkedStyleId: "absolute",
        children: [],
      }],
    }]));

    const surfaceStart = html.indexOf("presentation-container-fit-surface");
    const childStart = html.indexOf('data-presentation-id="child"');

    expect(surfaceStart).toBeGreaterThan(-1);
    expect(html.slice(surfaceStart)).toContain("position:relative");
    expect(childStart).toBeGreaterThan(surfaceStart);
    expect(tagForId(html, "child")).toContain("position:absolute");
    expect(tagForId(html, "child")).toContain("top:10px");
    expect(tagForId(html, "child")).toContain("right:20px");
    expect(tagForId(html, "child")).toContain("bottom:30px");
    expect(tagForId(html, "child")).toContain("left:40px");
  });

  it("uses linked absolute child layout for a non-fitted parent containing block", () => {
    const html = renderPresentation(presentation([{
      id: "parent",
      type: "container",
      hidden: false,
      children: [{
        id: "child",
        type: "container",
        hidden: false,
        linkedStyleId: "absolute",
        children: [],
      }],
    }]));

    expect(tagForId(html, "parent")).toContain("position:relative");
    expect(tagForId(html, "parent")).not.toContain("position:absolute");
    expect(tagForId(html, "child")).toContain("position:absolute");
    expect(tagForId(html, "child")).toContain("top:10px");
    expect(tagForId(html, "child")).toContain("right:20px");
    expect(tagForId(html, "child")).toContain("bottom:30px");
    expect(tagForId(html, "child")).toContain("left:40px");
  });

  it("fails linked low-level rendering without presentation context while preserving unlinked compatibility", () => {
    expect(() => renderElement({ id: "linked", type: "container", hidden: false, linkedStyleId: "card", children: [] })).toThrow(
      "Cannot render linked container style without presentation context: card",
    );
    expect(renderElement({ id: "plain", type: "container", hidden: false, children: [] })).toContain(
      'data-presentation-id="plain"',
    );
  });
});

describe("Linked target style rendering", () => {
  it("consumes effective Code, Terminal, both Table modes, and Divider styles through renderPresentation", () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "target-linked-rendering",
      title: "Target linked rendering",
      linkedStyles: [
        { target: "code", id: "code-style", name: "Code", layout: { width: 320 }, style: { color: "#00ff00" }, typography: { fontSize: 18 }, effect: { opacity: 0 } },
        { target: "terminal", id: "terminal-style", name: "Terminal", style: { commandColor: "#ff0000" }, typography: { fontSize: 17 }, titleTypography: { fontWeight: 700 } },
        { target: "table", mode: "simple", id: "simple-style", name: "Simple", style: { color: "#ffffff" }, typography: { fontSize: 16 } },
        { target: "table", mode: "structured", id: "structured-style", name: "Structured", layout: { height: 240 }, style: { headerBackground: "#111111", bodyRowAlternateBackground: "#222222", dividerOpacity: 0.25 }, effect: { opacity: 0.8 } },
        { target: "divider", id: "divider-style", name: "Divider", layout: { width: 40 }, style: { background: { color: "#abcdef" } }, effect: { opacity: 0.5 } },
      ],
      slides: [{ id: "slide", elements: [
        { id: "code", type: "code", hidden: false, linkedStyleId: "code-style", code: "const x = 1", language: "ts", showLineNumbers: true, highlightedLines: [] },
        { id: "terminal", type: "terminal", hidden: false, linkedStyleId: "terminal-style", title: "Shell", titleStyle: { color: "#ffffff" }, lines: [{ type: "command", content: "$ ls" }] },
        { id: "simple", type: "table", hidden: false, linkedStyleId: "simple-style", columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }] },
        { id: "structured", type: "table", hidden: false, linkedStyleId: "structured-style", mode: "structured", showHeader: true, columns: [{ id: "column", header: { id: "header", children: [] } }], rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }] },
        { id: "divider", type: "divider", hidden: false, linkedStyleId: "divider-style", orientation: "vertical" },
      ] }],
    });

    const html = renderPresentation(source);
    expect(tagForId(html, "code")).toContain("width:320px");
    expect(tagForId(html, "code")).toContain("color:#00ff00");
    expect(tagForId(html, "code")).toContain("opacity:0");
    expect(tagForId(html, "terminal")).toContain("--presentation-terminal-command-color:#ff0000");
    expect(html).toContain("font-size:17px");
    expect(tagForId(html, "simple")).toContain("font-size:16px");
    expect(tagForId(html, "structured")).toContain("height:240px");
    expect(html).toContain("background:#111111");
    expect(html).toContain("--presentation-table-divider-opacity:0.25");
    expect(tagForId(html, "divider")).toContain("width:40px");
    expect(tagForId(html, "divider")).toContain("background:#abcdef");
    expect(tagForId(html, "divider")).toContain("opacity:0.5");
  });

  it("requires presentation context only for linked low-level targets", () => {
    const elements = [
      { id: "code", type: "code" as const, hidden: false, linkedStyleId: "style", code: "x", language: "text", showLineNumbers: true, highlightedLines: [] },
      { id: "terminal", type: "terminal" as const, hidden: false, linkedStyleId: "style", lines: [] },
      { id: "table", type: "table" as const, hidden: false, linkedStyleId: "style", columns: [], rows: [] },
      { id: "divider", type: "divider" as const, hidden: false, linkedStyleId: "style", orientation: "horizontal" as const },
    ];
    for (const element of elements) {
      expect(() => renderElement(element)).toThrow("without presentation context");
    }
    expect(renderElement({ id: "plain-divider", type: "divider", hidden: false, orientation: "horizontal" })).toContain("data-presentation-id=\"plain-divider\"");
  });
});
