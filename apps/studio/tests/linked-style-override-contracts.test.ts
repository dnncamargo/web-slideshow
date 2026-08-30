import { describe, expect, it } from "vitest";
import { PresentationSchema, resolveLinkedContainerStyle } from "@powershow/document-schema";
import { getContainerShareablePropertySource } from "../src/features/editor/inspector/linked-style-inspector";

describe("Linked/local override contracts", () => {
  it("uses authored local values even when equal to or falsy against Linked", () => {
    const document = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [{ id: "c", type: "container", hidden: false, linkedStyleId: "card", layout: { children: { gap: 12 } }, effect: { opacity: 0 }, children: [] }] }], linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } }, effect: { opacity: 0.8 } }] });
    const container = document.slides[0]!.elements[0]!;
    if (container.type !== "container") return;
    expect(getContainerShareablePropertySource(document, container, "layout.children.gap").source).toBe("local");
    expect(getContainerShareablePropertySource(document, container, "effect.opacity").source).toBe("local");
    expect(resolveLinkedContainerStyle(document, container).layout?.children?.gap).toBe(12);
    expect(resolveLinkedContainerStyle(document, container).effect?.opacity).toBe(0);
  });

  it("keeps linked Length strings, palette references, and unrelated local state separate", () => {
    const document = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [{ id: "c", type: "container", hidden: false, linkedStyleId: "card", style: { className: "local-hook" }, children: [] }] }], palette: { colors: [{ id: "accent", name: "Accent", value: "#0ff" }] }, linkedStyles: [{ id: "card", name: "Card", style: { borderRadius: "1rem", color: { kind: "palette", colorId: "accent" } } }] });
    const container = document.slides[0]!.elements[0]!;
    if (container.type !== "container") return;
    expect(getContainerShareablePropertySource(document, container, "style.borderRadius")).toMatchObject({ source: "linked", linkedValue: "1rem" });
    expect(container.style?.className).toBe("local-hook");
    expect(getContainerShareablePropertySource(document, container, "style.color").linkedValue).toEqual({ kind: "palette", colorId: "accent" });
  });
});
