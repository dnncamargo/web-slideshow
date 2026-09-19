import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  type Presentation,
} from "@web-slideshow/document-schema";

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
    palette: { colors: [{ id: "#123456", name: "#123456", value: "#123456" }] },
    slides: [{
      id: "slide-1",
      elements: [{
        id: "container-root",
        type: "container",
        role: "column",
        layout: {
          width: "100%",
          height: "100%",
          overflow: "hidden",
          flexShrink: 0,
          children: {
            mode: "flow",
            direction: "column",
            gap: "16px",
            fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 },
          },
        },
        style: {
          background: {
            gradient: {
              type: "linear",
              angle: 45,
              stops: [{ color: "#123456", position: 0 }, { color: "#ffffff", position: 100 }],
            },
            pattern: { image: "linear-gradient(#ffffff22 1px, transparent 1px)", size: "8px 8px" },
          },
          border: {
            width: "2px",
            gradient: {
              type: "linear",
              stops: [{ color: "#123456", position: 0 }, { color: "#ffffff", position: 100 }],
            },
          },
        },
        effect: { opacity: 0.9, shadow: { x: "1px", y: "2px", blur: "3px", color: "#123456" } },
        link: { kind: "url", href: "https://example.test/container", target: "_blank" },
        children: [{
          id: "container-nested",
          type: "container",
          role: "content",
          layout: { width: "50%", overflow: "hidden", flexShrink: 0, children: { mode: "flow", direction: "column", gap: "8px" } },
          children: [{
            id: "text-1",
            type: "text",
            content: { type: "rich-text", runs: [{ text: "Preserve " }, { text: "this", marks: { bold: true, color: "#123456" } }] },
            typography: {
              textDecorationLine: "underline",
              textDecorationColor: "#123456",
              textStroke: { width: "1px", color: "#ffffff" },
            },
          }, {
            id: "image-1",
            type: "image",
            src: "https://example.test/image.png",
            alt: "Exact image",
            fit: "cover",
            focalPoint: { x: 25, y: 75 },
            crop: { x: 10, y: 10, width: 80, height: 80 },
          }, {
            id: "script-1",
            type: "scripted",
            html: "<strong>exact</strong>",
            css: ".x { color: red; }",
            script: "window.example = true;",
          }],
        }],
      }],
    }],
  });
}

function exportedPresentation(source: Presentation): Record<string, unknown> {
  return JSON.parse(serializePresentationForExport(source)) as Record<string, unknown>;
}

describe("canonical presentation transfer", () => {
  it("serializes raw canonical JSON without an envelope and round-trips through the schema", () => {
    const source = presentation();
    const json = serializePresentationForExport(source);
    const exported = exportedPresentation(source);

    expect(PresentationSchema.safeParse(exported).success).toBe(true);
    expect(exported).toMatchObject({ schemaVersion: 1, id: source.id, title: source.title, slides: source.slides });
    expect(exported).not.toHaveProperty("presentation");
    expect(exported).not.toHaveProperty("document");
    expect(parsePresentationImport(json)).toEqual(source);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("preserves current canonical content, nested ids, resources, palette, and authored strings", () => {
    const source = presentation();
    const imported = parsePresentationImport(serializePresentationForExport(source));
    const root = imported.slides[0]?.elements[0];

    expect(imported).toEqual(source);
    expect(imported.resources).toEqual(source.resources);
    expect(imported.palette).toEqual(source.palette);
    expect(root).toMatchObject({
      id: "container-root",
      layout: {
        flexShrink: 0,
        overflow: "hidden",
        children: { mode: "flow", direction: "column", gap: "16px", fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 } },
      },
      children: [{ id: "container-nested", children: [{ id: "text-1" }, { id: "image-1" }, { id: "script-1" }] }],
    });
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

  it("rejects invalid current container layout contracts", () => {
    const flexShrink = exportedPresentation(presentation());
    const partialFit = exportedPresentation(presentation());
    const root = (flexShrink.slides as Array<{ elements: Array<{ layout: Record<string, unknown> }> }>)[0]?.elements[0];
    const partialRoot = (partialFit.slides as Array<{ elements: Array<{ layout: { children: { fit: Record<string, unknown> } } }> }>)[0]?.elements[0];

    if (!root || !partialRoot) throw new Error("Expected canonical container fixture.");
    root.layout.flexShrink = 1;
    delete partialRoot.layout.children.fit.sourceHeight;

    expect(() => parsePresentationImport(JSON.stringify(flexShrink))).toThrow();
    expect(() => parsePresentationImport(JSON.stringify(partialFit))).toThrow();
  });

  it("builds a safe export filename", () => {
    expect(buildPresentationExportFilename("A:/ demo? ")).toBe("A- demo.presentation.json");
  });

  it("normalizes exact legacy reserved IDs and the legacy demo asset at import", () => {
    const legacy = PresentationSchema.parse({
      schemaVersion: 1,
      id: "legacy-presentation",
      title: "PowerShow legacy content",
      slides: [{
        id: "legacy-slide",
        elements: [{
          id: "legacy-topics",
          type: "topics",
          hidden: false,
          items: [{
            id: "topic-item",
            content: {
              id: "topic-slot",
              children: [{ id: "topic-text", type: "text", hidden: false, variant: "powershow:topics", content: "PowerShow" }],
            },
            children: [],
          }],
        }, {
          id: "legacy-table",
          type: "table",
          mode: "structured",
          showHeader: true,
          hidden: false,
          columns: [{
            id: "column",
            header: { id: "header-slot", children: [{ id: "header-text", type: "text", hidden: false, variant: "powershow:table-column-header", content: "Header" }] },
          }],
          rows: [{
            id: "row",
            cells: [{ id: "cell-slot", children: [{ id: "cell-text", type: "text", hidden: false, variant: "powershow:table-cell", content: "Cell" }] }],
          }],
        }, {
          id: "legacy-image",
          type: "image",
          hidden: false,
          src: "/powershow-demo.svg",
          alt: "PowerShow caption",
          fit: "contain",
        }, {
          id: "unrelated-image",
          type: "image",
          hidden: false,
          src: "https://example.test/powershow-demo.svg?source=powershow",
          alt: "External powershow URL",
          fit: "contain",
        }, {
          id: "legacy-script",
          type: "scripted",
          html: "<p>Hello PowerShow</p>",
          css: ".powershow { color: red; }",
          script: "PowerShow.ports.value = 'PowerShow';",
        }],
      }],
      textStyles: [
        { id: "powershow:topics", name: "Topics", role: "body" },
        { id: "powershow:table-column-header", name: "Column header", role: "body" },
        { id: "powershow:table-cell", name: "Table cell", role: "body" },
      ],
    });
    const imported = parsePresentationImport(JSON.stringify(legacy));
    const elements = imported.slides[0]?.elements ?? [];
    const topics = elements[0];
    const table = elements[1];

    expect(imported.textStyles?.map((style) => style.id)).toEqual([
      SYSTEM_TOPICS_TEXT_STYLE_ID,
      SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
      SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
    ]);
    expect(topics?.type === "topics" && topics.items[0]?.content.children[0]).toMatchObject({ variant: SYSTEM_TOPICS_TEXT_STYLE_ID, content: "PowerShow" });
    expect(table?.type === "table" && table.mode === "structured" && table.columns[0]?.header.children[0]).toMatchObject({ variant: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID });
    expect(table?.type === "table" && table.mode === "structured" && table.rows[0]?.cells[0]?.children[0]).toMatchObject({ variant: SYSTEM_TABLE_CELL_TEXT_STYLE_ID });
    expect(elements[2]).toMatchObject({ src: "/instance-demo.svg" });
    expect(elements[3]).toMatchObject({ src: "https://example.test/powershow-demo.svg?source=powershow" });
    expect(elements[4]).toMatchObject({ html: "<p>Hello PowerShow</p>", css: ".powershow { color: red; }", script: "PowerShow.ports.value = 'PowerShow';" });
  });

  it("deduplicates a legacy reserved style when the canonical style already exists", () => {
    const source = presentation();
    const legacy = {
      ...source,
      textStyles: [
        { id: SYSTEM_TOPICS_TEXT_STYLE_ID, name: "Canonical topics", role: "body" },
        { id: "powershow:topics", name: "Legacy topics", role: "body" },
      ],
      slides: [{
        ...source.slides[0],
        elements: [{ id: "topic-text", type: "text", hidden: false, variant: "powershow:topics", content: "Topic" }],
      }],
    };
    const imported = parsePresentationImport(JSON.stringify(legacy));

    expect(imported.textStyles).toHaveLength(1);
    expect(imported.textStyles?.[0]?.id).toBe(SYSTEM_TOPICS_TEXT_STYLE_ID);
    expect(imported.slides[0]?.elements[0]).toMatchObject({ variant: SYSTEM_TOPICS_TEXT_STYLE_ID });
  });
});
