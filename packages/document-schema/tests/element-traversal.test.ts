import { describe, expect, it } from "vitest";
import { PresentationSchema, visitSlideElements } from "../src";

describe("visitSlideElements", () => {
  it("visits canonical slide elements in Container pre-order only", () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", description: "", aspectRatio: "16:9", slides: [{ id: "s", title: "", summary: "", speakerNotes: "", elements: [{ id: "A", type: "text", content: "A" }, { id: "C", type: "container", children: [{ id: "B", type: "text", content: "B" }, { id: "D", type: "container", children: [{ id: "E", type: "text", content: "E" }] }] }, { id: "F", type: "gallery", items: [{ src: "f", alt: "" }] }] }] });
    const visited: string[] = [];
    visitSlideElements(presentation.slides[0]!, (element) => visited.push(element.id));
    expect(visited).toEqual(["A", "C", "B", "D", "E", "F"]);
  });
});
