import { describe, expect, it } from "vitest";
import {
  PresentationSchema,
  listRootDefinitionStructuralIds,
  type Presentation,
} from "@web-slideshow/document-schema";

import {
  buildPresentationExportFilename,
  normalizeImportedPresentation,
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

function normalizationPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-source",
    title: "Normalization demo",
    textStyles: [
      {
        id: "heading-copy-copy",
        name: "Heading",
        role: "title",
        typography: { fontSize: "32px" },
      },
      { id: "body", style: { color: "#ffffff" } },
      {
        id: "system:topics",
        name: "Topics",
        role: "body",
        style: { color: "#ffffff" },
      },
    ],
    linkedStyles: [{
      id: "linked-style-copy-copy",
      name: "Column",
      style: { background: { color: "#123456" } },
    }, {
      target: "topics",
      id: "topics-style-copy",
      name: "Topics",
      kind: "unordered",
    }],
    resources: {
      fonts: [{
        id: "font-copy-copy",
        family: "Inter",
        source: { type: "url", url: "https://example.test/font.woff2", format: "woff2" },
      }],
    },
    palette: { colors: [{ id: "brand-copy", name: "Brand", value: "#123456" }] },
    slides: [{
      id: "slide-copy-copy",
      elements: [{
        id: "container-element-copy-copy",
        type: "container",
        linkedStyleId: "linked-style-copy-copy",
        children: [{
          id: "text-element-copy-copy",
          type: "text",
          variant: "heading-copy-copy",
          content: "container-element-copy-copy must remain authored text",
        }, {
          id: "image-element-copy-copy",
          type: "image",
          src: "https://example.test/image.png",
          alt: "Image",
        }, {
          id: "scripted-element-copy-copy",
          type: "scripted",
          script: "onAction('start'); // container-element-copy-copy",
          ports: [{ id: "start", label: "Start", kind: "action" }],
        }, {
          id: "table-element-copy-copy",
          type: "table",
          mode: "structured",
          columns: [{
            id: "table-column-copy",
            header: {
              id: "header-slot-copy",
              children: [{ id: "header-text-copy", type: "text", content: "Header" }],
            },
          }],
          rows: [{
            id: "table-row-copy",
            cells: [{
              id: "cell-slot-copy",
              children: [{ id: "cell-text-copy", type: "text", content: "Cell" }],
            }],
          }],
        }, {
          id: "topics-element-copy-copy",
          type: "topics",
          linkedStyleId: "topics-style-copy",
          items: [{
            id: "topic-item-copy",
            content: {
              id: "topic-slot-copy",
              children: [{ id: "topic-text-copy", type: "text", content: "Topic" }],
            },
            children: [],
          }],
        }],
      }],
    }, {
      id: "slide-copy-copy",
      elements: [{
        id: "container-element-copy-copy",
        type: "container",
        children: [{ id: "text-element-copy-copy", type: "text", content: "Second slide" }],
      }],
    }],
  });
}

function rootDefinitionPresentation(): Presentation {
  const source = normalizationPresentation();

  return PresentationSchema.parse({
    ...source,
    title: "Root Definition normalization",
    rootDefinitions: [{
      id: "root-definition-a",
      name: "Shared Layout",
      root: {
        id: "master-root-copy",
        type: "container",
        linkedStyleId: "linked-style-copy-copy",
        children: [{
          id: "master-text-copy",
          type: "text",
          variant: "heading-copy-copy",
          content: "Master",
        }, {
          id: "master-table-copy",
          type: "table",
          mode: "structured",
          columns: [{
            id: "master-column-copy",
            header: {
              id: "master-header-copy",
              children: [{
                id: "master-header-text-copy",
                type: "text",
                variant: "heading-copy-copy",
                content: "Header",
              }],
            },
          }],
          rows: [{
            id: "master-row-copy",
            cells: [{
              id: "master-cell-copy",
              children: [{
                id: "master-cell-text-copy",
                type: "text",
                variant: "heading-copy-copy",
                content: "Cell",
              }],
            }],
          }],
        }, {
          id: "master-topics-copy",
          type: "topics",
          linkedStyleId: "topics-style-copy",
          kind: "unordered",
          items: [{
            id: "master-topic-copy",
            content: {
              id: "master-topic-slot-copy",
              children: [{
                id: "master-topic-text-copy",
                type: "text",
                variant: "heading-copy-copy",
                content: "Topic",
              }],
            },
            children: [{
              id: "master-nested-topic-copy",
              content: {
                id: "master-nested-topic-slot-copy",
                children: [],
              },
              children: [],
            }],
          }],
        }, {
          id: "master-target-copy",
          type: "container",
          children: [],
        }],
      },
      localChildTargetIds: ["master-target-copy"],
    }],
    slides: [{
      ...source.slides[0]!,
      id: "slide-ordinary",
    }, {
      id: "slide-root",
      rootDefinitionId: "root-definition-a",
      elements: [],
      localRootChildren: [{
        targetContainerId: "master-target-copy",
        children: [{
          id: "local-text-copy",
          type: "text",
          variant: "heading-copy-copy",
          content: "Local",
        }],
      }],
    }],
  });
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

  it("exports Root Definitions referentially without materializing slide.elements", () => {
    const source = rootDefinitionPresentation();
    const exported = exportedPresentation(source);

    expect(PresentationSchema.parse(exported)).toEqual(source);
    expect(exported).toMatchObject({
      schemaVersion: 1,
      rootDefinitions: [{ id: "root-definition-a", name: "Shared Layout" }],
      slides: [{ elements: expect.any(Array) }, {
        rootDefinitionId: "root-definition-a",
        elements: [],
        localRootChildren: [{ targetContainerId: "master-target-copy" }],
      }],
    });
  });

  it("regenerates Root Definition identities and remaps typed master targets during import", () => {
    const source = rootDefinitionPresentation();
    const before = structuredClone(source);
    const imported = prepareImportedPresentation(source, "presentation-new");
    const sourceDefinition = source.rootDefinitions?.[0];
    const importedDefinition = imported.rootDefinitions?.[0];
    const sourceSlide = source.slides[1];
    const importedSlide = imported.slides[1];

    if (!sourceDefinition || !importedDefinition || !sourceSlide || !importedSlide) {
      throw new Error("Expected Root Definition fixture.");
    }

    const sourceStructuralIds = listRootDefinitionStructuralIds(sourceDefinition.root);
    const importedStructuralIds = listRootDefinitionStructuralIds(importedDefinition.root);
    const structuralIdMap = new Map(
      sourceStructuralIds.map((id, index) => [id, importedStructuralIds[index]]),
    );

    expect(importedDefinition.id).toBe("root-definition-1");
    expect(importedDefinition.name).toBe("Shared Layout");
    expect(imported.defaultRootDefinitionId).toBeUndefined();
    expect(importedSlide.rootDefinitionId).toBe(importedDefinition.id);
    expect(importedSlide.rootDefinitionId).not.toBe(sourceSlide.rootDefinitionId);
    expect(importedStructuralIds).toHaveLength(sourceStructuralIds.length);
    sourceStructuralIds.forEach((id) => {
      expect(importedStructuralIds).not.toContain(id);
      expect(structuralIdMap.get(id)).toBeDefined();
    });

    const newTargetId = structuralIdMap.get("master-target-copy");
    expect(newTargetId).toBeDefined();
    expect(importedDefinition.localChildTargetIds).toEqual([newTargetId]);
    expect(importedDefinition.localChildTargetIds).not.toContain("master-target-copy");
    expect(importedSlide.localRootChildren?.[0]?.targetContainerId).toBe(newTargetId);
    expect(importedSlide.localRootChildren?.[0]?.targetContainerId).not.toBe("master-target-copy");
    expect(importedSlide.elements).toEqual([]);

    const importedRoot = importedDefinition.root;
    expect(importedRoot.type).toBe("container");
    if (importedRoot.type === "container") {
      expect(importedRoot.linkedStyleId).toBe("linked-style-1");
      expect(importedRoot.children[0]).toMatchObject({
        type: "text",
        variant: "text-style-1",
      });
      expect(importedRoot.children[2]).toMatchObject({
        type: "topics",
        linkedStyleId: "linked-style-2",
      });
    }

    const localText = importedSlide.localRootChildren?.[0]?.children[0];
    expect(localText).toMatchObject({ type: "text", variant: "text-style-1" });
    expect(localText?.id).not.toBe("local-text-copy");
    expect(PresentationSchema.safeParse(imported).success).toBe(true);
    expect(source).toEqual(before);

    const normalizedFirst = normalizeImportedPresentation(source);
    const normalizedSecond = normalizeImportedPresentation(source);
    expect(normalizedFirst).toEqual(normalizedSecond);
  });

  it("remaps a compatible default Root Definition reference during import", () => {
    const source = rootDefinitionPresentation();
    const rootSlide = source.slides[1];
    if (!rootSlide) throw new Error("Expected Root Definition fixture slide.");

    const defaultedSource = PresentationSchema.parse({
      ...source,
      defaultRootDefinitionId: "root-definition-a",
      slides: [{ ...rootSlide, rootDefinitionId: undefined }],
    });
    const imported = prepareImportedPresentation(defaultedSource, "presentation-default-new");
    const importedDefinition = imported.rootDefinitions?.[0];

    expect(importedDefinition).toBeDefined();
    expect(imported.defaultRootDefinitionId).toBe(importedDefinition?.id);
    expect(imported.defaultRootDefinitionId).not.toBe("root-definition-a");
    expect(imported.slides[0]?.rootDefinitionId).toBeUndefined();
    expect(PresentationSchema.safeParse(imported).success).toBe(true);
  });

  it("normalizes imported IDs without mutating the source", () => {
    const source = normalizationPresentation();
    const before = structuredClone(source);
    const imported = prepareImportedPresentation(source, "presentation-new");
    const firstRoot = imported.slides[0]?.elements[0];
    const secondRoot = imported.slides[1]?.elements[0];

    expect(imported.id).toBe("presentation-new");
    expect(imported.slides.map((slide) => slide.id)).toEqual(["slide-1", "slide-2"]);
    expect(firstRoot?.type === "container" && firstRoot.children.map((element) => element.id)).toEqual([
      "text-1",
      "image-1",
      "scripted-1",
      "table-1",
      "topics-1",
    ]);
    expect(firstRoot?.id).toBe("container-1");
    expect(secondRoot?.type === "container" && secondRoot.children.map((element) => element.id)).toEqual([
      "text-5",
    ]);
    expect(secondRoot?.id).toBe("container-2");
    expect(source).toEqual(before);
  });

  it("keeps normalization deterministic and remaps typed style references", () => {
    const source = normalizationPresentation();
    const first = normalizeImportedPresentation(source);
    const second = normalizeImportedPresentation(source);

    expect(first).toEqual(second);
    expect(first.textStyles?.map((style) => style.id)).toEqual([
      "text-style-1",
      "body",
      "system:topics",
    ]);
    expect(first.linkedStyles?.map((style) => style.id)).toEqual([
      "linked-style-1",
      "linked-style-2",
    ]);
    const container = first.slides[0]?.elements[0];
    const text = container?.type === "container" ? container.children[0] : undefined;
    expect(container?.type === "container" && container.linkedStyleId).toBe("linked-style-1");
    expect(text?.type === "text" && text.variant).toBe("text-style-1");
    const topics = container?.type === "container" ? container.children[4] : undefined;
    expect(topics?.type === "topics" && topics.linkedStyleId).toBe("linked-style-2");
  });

  it("remaps linked style references for Code, Terminal, Tables, and Divider", () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "source",
      title: "Linked targets",
      linkedStyles: [
        { target: "code", id: "code-copy", name: "Code", style: { color: "#112233" } },
        { target: "terminal", id: "terminal-copy", name: "Terminal", style: { commandColor: "#112233" } },
        { target: "table", mode: "simple", id: "simple-copy", name: "Simple", typography: { fontSize: 14 } },
        { target: "table", mode: "structured", id: "structured-copy", name: "Structured", style: { headerBackground: "#112233" } },
        { target: "divider", id: "divider-copy", name: "Divider", style: { background: { color: "#112233" } } },
      ],
      slides: [{ id: "slide-copy", elements: [
        { id: "code-copy", type: "code", code: "const x = 1", linkedStyleId: "code-copy" },
        { id: "terminal-copy", type: "terminal", lines: [], linkedStyleId: "terminal-copy" },
        { id: "simple-copy", type: "table", columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], linkedStyleId: "simple-copy" },
        {
          id: "structured-copy", type: "table", mode: "structured", linkedStyleId: "structured-copy",
          columns: [{ id: "column-copy", header: { id: "header-copy", children: [] } }],
          rows: [{ id: "row-copy", cells: [{ id: "cell-copy", children: [] }] }],
        },
        { id: "divider-copy", type: "divider", linkedStyleId: "divider-copy" },
      ] }],
    });
    const imported = prepareImportedPresentation(source, "imported");
    expect(imported.linkedStyles?.map((style) => style.id)).toEqual([
      "linked-style-1", "linked-style-2", "linked-style-3", "linked-style-4", "linked-style-5",
    ]);
    expect(imported.slides[0]?.elements.map((element) => "linkedStyleId" in element ? element.linkedStyleId : undefined)).toEqual([
      "linked-style-1", "linked-style-2", "linked-style-3", "linked-style-4", "linked-style-5",
    ]);
    const table = imported.slides[0]?.elements[3];
    expect(table?.type === "table" && table.mode === "structured" && table.columns[0]?.id).toBe("table-column-1");
    expect(PresentationSchema.safeParse(imported).success).toBe(true);
  });

  it("preserves authored and explicitly stable identities", () => {
    const source = normalizationPresentation();
    const imported = normalizeImportedPresentation(source);
    const root = imported.slides[0]?.elements[0];
    const elements = root?.type === "container" ? root.children : undefined;
    const scripted = elements?.find((element) => element.type === "scripted");
    const table = elements?.find((element) => element.type === "table");

    expect(scripted?.type === "scripted" && scripted.ports[0]?.id).toBe("start");
    expect(scripted?.type === "scripted" && scripted.script).toBe("onAction('start'); // container-element-copy-copy");
    expect(imported.resources?.fonts?.[0]?.id).toBe("font-copy-copy");
    expect(imported.palette?.colors[0]?.id).toBe("brand-copy");
    expect(table?.type === "table" && table.mode).toBe("structured");
    expect(imported.textStyles?.find((style) => style.id === "body")?.id).toBe("body");
    expect(imported.textStyles?.find((style) => style.id === "system:topics")?.id).toBe("system:topics");
    expect(root?.type === "container" && root.children[0]).toMatchObject({
      type: "text",
      content: "container-element-copy-copy must remain authored text",
    });
  });

  it("assigns distinct IDs when imported structural IDs are duplicated", () => {
    const source = normalizationPresentation();
    const imported = normalizeImportedPresentation(source);

    expect(imported.slides.map((slide) => slide.id)).toEqual(["slide-1", "slide-2"]);
    expect(imported.slides[1]?.elements[0]?.id).toBe("container-2");
    const firstRoot = imported.slides[0]?.elements[0];
    const table = firstRoot?.type === "container"
      ? firstRoot.children.find((element) => element.type === "table")
      : undefined;
    if (table?.type !== "table" || table.mode !== "structured") throw new Error("Expected structured table.");
    expect(table.columns[0]?.id).toBe("table-column-1");
    expect(table.rows[0]?.id).toBe("table-row-1");
    expect(table.rows[0]?.cells[0]?.id).toBe("table-cell-1");
    expect(table.columns[0]?.header.id).toBe("content-slot-1");
  });

  it("keeps the existing root ID allocation separate from nested normalization", () => {
    const source = normalizationPresentation();
    const imported = prepareImportedPresentation(source, "presentation-generated-by-import");

    expect(imported.id).toBe("presentation-generated-by-import");
    expect(imported.id).not.toBe(source.id);
    expect(imported.slides[0]?.id).toBe("slide-1");
  });

  it("does not create Root Definitions for legacy ordinary slides", () => {
    const imported = prepareImportedPresentation(presentation(), "presentation-new");

    expect(imported.rootDefinitions).toBeUndefined();
    expect(imported.defaultRootDefinitionId).toBeUndefined();
    expect(imported.slides[0]?.elements.length).toBeGreaterThan(0);
  });

  it("returns a new normalized value", () => {
    const source = normalizationPresentation();
    const before = structuredClone(source);
    const imported = normalizeImportedPresentation(source);

    expect(imported).not.toBe(source);
    expect(imported.slides).not.toBe(source.slides);
    expect(imported.slides[0]?.elements).not.toBe(source.slides[0]?.elements);
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
    expect(buildPresentationExportFilename("A:/ demo? ", "Apresentação São João")).toBe("A- demo.apresentacao-sao-joao.json");
    expect(buildPresentationExportFilename("Title", "!!!")).toBe("Title.instance.json");
  });
});
