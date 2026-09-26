import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { inspectTargetLinkedStyle } from "../src/features/editor/inspector/linked-style-inspector";

function presentation(element: object, linkedStyles: object[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    linkedStyles,
    slides: [{ id: "slide", title: "", elements: [element] }],
  });
}

describe("target Linked Style ownership inspection", () => {
  it("matches Simple mode including omitted mode and keeps background members independent", () => {
    const source = presentation(
      { id: "table", type: "table", hidden: false, columns: [], rows: [], style: { background: { gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] } } }, linkedStyleId: "simple" },
      [{ target: "table", mode: "simple", id: "simple", name: "Simple", style: { background: { color: "#123456" } }, typography: { fontSize: 18 } }],
    );
    const element = source.slides[0]!.elements[0]!;
    if (element.type !== "table") throw new Error("Expected table");
    const inspection = inspectTargetLinkedStyle(source, element);

    expect(inspection.linked).toMatchObject({ target: "table", mode: "simple" });
    expect(inspection.getProperty("style.background.color")).toMatchObject({ owned: true, effectiveValue: "#123456" });
    expect(inspection.getProperty("style.background.gradient")).toMatchObject({ owned: false, effectiveValue: expect.any(Object) });
    expect(inspection.getProperty("typography.fontSize")).toMatchObject({ owned: true, effectiveValue: 18 });
    expect(inspection.getProperty("style.className" as never).owned).toBe(false);
  });

  it("counts falsey authored values and keeps Terminal title typography independent", () => {
    const source = presentation(
      { id: "terminal", type: "terminal", hidden: false, lines: [], linkedStyleId: "terminal" },
      [{ target: "terminal", id: "terminal", name: "Terminal", effect: { opacity: 0 }, titleTypography: { fontSize: 0 }, style: { outputColor: "#000000" } }],
    );
    const element = source.slides[0]!.elements[0]!;
    if (element.type !== "terminal") throw new Error("Expected terminal");
    const inspection = inspectTargetLinkedStyle(source, element);

    expect(inspection.getProperty("effect.opacity")).toMatchObject({ owned: true, linkedValue: 0, effectiveValue: 0 });
    expect(inspection.getProperty("titleTypography.fontSize")).toMatchObject({ owned: true, linkedValue: 0 });
    expect(inspection.getProperty("style.outputColor")).toMatchObject({ owned: true, linkedValue: "#000000" });
    expect(inspection.getProperty("typography.fontSize").owned).toBe(false);
  });

  it("fails closed for incompatible styles and never treats className as owned", () => {
    const source = { ...presentation({ id: "divider", type: "divider", orientation: "horizontal" }, []), linkedStyles: [{ target: "code" as const, id: "code", name: "Code", style: { color: "#ffffff" } }] } as Presentation;
    const element = { ...source.slides[0]!.elements[0]!, linkedStyleId: "code" } as Presentation["slides"][number]["elements"][number];
    if (element.type !== "divider") throw new Error("Expected divider");
    const inspection = inspectTargetLinkedStyle(source, element);

    expect(inspection.linked).toBeUndefined();
    expect(inspection.getProperty("style.background.color").owned).toBe(false);
    expect(inspection.getProperty("style.className" as never).owned).toBe(false);
  });
});
