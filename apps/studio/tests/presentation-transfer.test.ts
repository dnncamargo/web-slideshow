import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import {
  buildPresentationExportFilename,
  parsePresentationImport,
  prepareImportedPresentation,
  serializePresentationForExport,
} from "../src/features/library/presentation-transfer";

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-source",
    title: "Transfer / demo",
    description: "Description",
    aspectRatio: "4:3",
    resources: {
      fonts: [{
        id: "font-1",
        family: "Inter",
        source: { type: "url", url: "https://example.test/font.woff2", format: "woff2" },
      }],
    },
    palette: { colors: ["#123456"] },
    slides: [{
      id: "slide-1",
      elements: [{
        id: "script-1",
        type: "scripted",
        html: "<strong>exact</strong>",
        css: ".x { color: red; }",
        script: "window.example = true;",
      }],
    }],
  });
}

describe("canonical presentation transfer", () => {
  it("serializes raw canonical JSON and round-trips through the schema", () => {
    const source = presentation();
    const json = serializePresentationForExport(source);
    const exported: unknown = JSON.parse(json);

    expect(PresentationSchema.safeParse(exported).success).toBe(true);
    expect(parsePresentationImport(json)).toEqual(source);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("preserves resources, palette, authored strings, and internal ids", () => {
    const source = presentation();
    const imported = parsePresentationImport(serializePresentationForExport(source));

    expect(imported).toEqual(source);
    expect(imported.resources).toEqual(source.resources);
    expect(imported.palette).toEqual(source.palette);
    expect(imported.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);
  });

  it("changes only the root id without mutating the source", () => {
    const source = presentation();
    const before = structuredClone(source);
    const imported = prepareImportedPresentation(source, "presentation-new");

    expect(imported).toEqual({ ...source, id: "presentation-new" });
    expect(imported.slides).toBe(source.slides);
    expect(source).toEqual(before);
  });

  it("rejects malformed, wrong-version, and legacy documents", () => {
    expect(() => parsePresentationImport("{")).toThrow();
    expect(() => parsePresentationImport(JSON.stringify({ ...presentation(), schemaVersion: 2 }))).toThrow();
    expect(() => parsePresentationImport(JSON.stringify({
      ...presentation(),
      slides: [{ id: "slide-1", elements: [{ type: "textbox", id: "legacy" }] }],
    }))).toThrow();
  });

  it("builds a safe export filename", () => {
    expect(buildPresentationExportFilename("A:/ demo? ")).toBe("A- demo.powershow.json");
  });
});
