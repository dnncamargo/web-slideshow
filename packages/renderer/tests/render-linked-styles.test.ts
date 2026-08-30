import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ContainerElement,
} from "@powershow/document-schema";

import { renderElement, renderPresentation } from "../src";

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

    expect(html).not.toContain("powershow-container-fit-surface");
    expect(html).toContain('data-powershow-id="parent"');
    expect(html).toContain("position:relative");
    expect(html).toContain('data-powershow-id="child"');
    expect(html).toContain("position:absolute");
    expect(html).toContain("top:10px");
    expect(html).toContain("right:20px");
    expect(html).toContain("bottom:30px");
    expect(html).toContain("left:40px");
  });

  it("fails linked low-level rendering without presentation context while preserving unlinked compatibility", () => {
    expect(() => renderElement({ id: "linked", type: "container", hidden: false, linkedStyleId: "card", children: [] })).toThrow(
      "Cannot render linked container style without presentation context: card",
    );
    expect(renderElement({ id: "plain", type: "container", hidden: false, children: [] })).toContain(
      'data-powershow-id="plain"',
    );
  });
});
