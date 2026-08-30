import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { getContainerShareablePropertySource, type ContainerShareableProperty } from "../src/features/editor/inspector/linked-style-inspector";

const properties: readonly ContainerShareableProperty[] = [
  "layout.position", "layout.top", "layout.right", "layout.bottom", "layout.left",
  "layout.width", "layout.height", "layout.margin", "layout.marginTop", "layout.marginRight", "layout.marginBottom", "layout.marginLeft",
  "layout.padding", "layout.paddingTop", "layout.paddingRight", "layout.paddingBottom", "layout.paddingLeft", "layout.flexShrink",
  "layout.children.mode", "layout.children.direction", "layout.children.gap", "layout.children.distribution",
  "layout.children.horizontalAlign", "layout.children.verticalAlign", "layout.children.fit", "layout.overflow",
  "style.color", "style.background.color", "style.background.gradient", "style.background.pattern", "style.border", "style.borderRadius",
  "effect.opacity", "effect.shadow",
];

function documentWithContainer(local: boolean) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "p",
    title: "P",
    slides: [{ id: "s", title: "S", elements: [{
      id: "c", type: "container", hidden: false, linkedStyleId: "linked", children: [],
      ...(local ? {
        layout: { position: "absolute", top: 0, right: 1, bottom: 2, left: 3, width: "10%", height: "20%", margin: 0, marginTop: 1, marginRight: 2, marginBottom: 3, marginLeft: 4, padding: 0, paddingTop: 1, paddingRight: 2, paddingBottom: 3, paddingLeft: 4, flexShrink: 0, overflow: "hidden", children: { mode: "stack", direction: "row", gap: 0, distribution: "space-between", horizontalAlign: "center", verticalAlign: "end", fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 } } },
        style: { color: "#fff", background: { color: "#000", gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] }, pattern: { image: "linear-gradient(#000, #fff)" }, }, border: { width: 1, style: "solid", color: "#fff" }, borderRadius: 16 },
        effect: { opacity: 0, shadow: { x: 0, y: 1, blur: 2, color: "#000" } },
      } : {}),
    }] }],
    linkedStyles: [{ id: "linked", name: "Linked", layout: { position: "absolute", top: 0, right: 1, bottom: 2, left: 3, width: "10%", height: "20%", margin: 0, marginTop: 1, marginRight: 2, marginBottom: 3, marginLeft: 4, padding: 0, paddingTop: 1, paddingRight: 2, paddingBottom: 3, paddingLeft: 4, flexShrink: 0, overflow: "hidden", children: { mode: "stack", direction: "row", gap: 0, distribution: "space-between", horizontalAlign: "center", verticalAlign: "end", fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 } } }, style: { color: "#fff", background: { color: "#000", gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] }, pattern: { image: "linear-gradient(#000, #fff)" } }, border: { width: 1, style: "solid", color: "#fff" }, borderRadius: 16 }, effect: { opacity: 0, shadow: { x: 0, y: 1, blur: 2, color: "#000" } } }],
  });
}

describe("Linked Container source inspection", () => {
  it("covers every exposed shareable property and uses authorship, including 0", () => {
    const document = documentWithContainer(true);
    const container = document.slides[0]!.elements[0]!;
    if (container.type !== "container") throw new Error("fixture container missing");
    for (const property of properties) {
      expect(getContainerShareablePropertySource(document, container, property).source, property).toBe("local");
    }
  });

  it("reports linked-only properties as linked", () => {
    const document = documentWithContainer(false);
    const container = document.slides[0]!.elements[0]!;
    if (container.type !== "container") throw new Error("fixture container missing");
    for (const property of properties) {
      expect(getContainerShareablePropertySource(document, container, property).source, property).toBe("linked");
    }
  });
});
