import { describe, expect, it } from "vitest";

import { PresentationSchema } from "../src";

const resource = {
  id: "file-notes",
  name: "Notes",
  kind: "text" as const,
  representation: "text" as const,
  contentType: "text/plain",
  source: { type: "text" as const, content: "notes" },
};

const imageResource = {
  id: "file-image",
  name: "Image",
  kind: "image" as const,
  representation: "binary" as const,
  contentType: "image/png" as const,
  source: { type: "url" as const, url: "https://example.test/image.png" },
};

function scripted(id: string, resourceIds: string[]) {
  return { id, type: "scripted" as const, hidden: false, resourceIds };
}

function container(id: string, children: unknown[]) {
  return { id, type: "container" as const, hidden: false, children };
}

function presentation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    resources: { files: [resource] },
    slides: [{ id: "slide-1", elements: [] }],
    ...overrides,
  };
}

describe("Presentation File references from Scripted", () => {
  it("accepts references from slide, nested, table, Topics, Root Definition, and local root trees", () => {
    const result = PresentationSchema.safeParse(presentation({
      slides: [{
        id: "slide-1",
        elements: [
          container("nested", [scripted("nested-scripted", ["file-notes"])]),
          {
            id: "topics",
            type: "topics",
            hidden: false,
            items: [{
              id: "topic",
              content: { id: "topic-content", children: [scripted("topic-scripted", ["file-notes"])] },
              children: [],
            }],
          },
          {
            id: "table",
            type: "table",
            hidden: false,
            mode: "structured",
            columns: [{ id: "column", header: { id: "header", children: [scripted("header-scripted", ["file-notes"])] } }],
            rows: [{ id: "row", cells: [{ id: "cell", children: [scripted("cell-scripted", ["file-notes"])] }] }],
          },
        ],
      }],
    }));

    const rootResult = PresentationSchema.safeParse(presentation({
      rootDefinitions: [{
        id: "master-1",
        name: "Master",
        root: container("master-root", [scripted("master-scripted", ["file-notes"])]),
        localChildTargetIds: ["master-root"],
      }],
      slides: [{
        id: "slide-1",
        rootDefinitionId: "master-1",
        elements: [],
        localRootChildren: [{
          targetContainerId: "master-root",
          children: [scripted("local-scripted", ["file-notes"])],
        }],
      }],
    }));

    expect(result.success).toBe(true);
    expect(rootResult.success).toBe(true);
  });

  it("rejects an unresolved reference and reports its resourceIds path", () => {
    const result = PresentationSchema.safeParse(presentation({
      slides: [{
        id: "slide-1",
        elements: [container("nested", [scripted("nested-scripted", ["missing-file"])])],
      }],
    }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ["slides", 0, "elements", 0, "children", 0, "resourceIds", 0] }),
      ]));
    }
  });
});

describe("Presentation File references from Image", () => {
  const image = (id: string) => ({ id, type: "image" as const, fileResourceId: "file-image" });

  it("accepts raster binary Image references throughout authoring trees", () => {
    const result = PresentationSchema.safeParse(presentation({
      resources: { files: [imageResource] },
      rootDefinitions: [{
        id: "master-1",
        name: "Master",
        root: container("master-root", [image("root-image")]),
        localChildTargetIds: ["master-root"],
      }],
      slides: [{
        id: "slide-1",
        elements: [
          image("slide-image"),
          container("nested", [image("nested-image")]),
          {
            id: "topics",
            type: "topics",
            hidden: false,
            items: [{
              id: "topic",
              content: { id: "topic-content", children: [image("topic-image")] },
              children: [],
            }],
          },
          {
            id: "table",
            type: "table",
            hidden: false,
            mode: "structured",
            columns: [{ id: "column", header: { id: "header", children: [image("header-image")] } }],
            rows: [{ id: "row", cells: [{ id: "cell", children: [image("cell-image")] }] }],
          },
        ],
      }, {
        id: "slide-2",
        rootDefinitionId: "master-1",
        elements: [],
        localRootChildren: [{
          targetContainerId: "master-root",
          children: [image("local-image")],
        }],
      }],
    }));

    expect(result.success).toBe(true);
  });

  it.each([
    ["missing", []],
    ["svg-text", [{
      id: "file-svg",
      name: "SVG",
      kind: "image" as const,
      representation: "text" as const,
      contentType: "image/svg+xml" as const,
      source: { type: "text" as const, content: "<svg />" },
    }]],
    ["non-image", [resource]],
  ])("rejects %s Image File references", (caseName, files) => {
    const result = PresentationSchema.safeParse(presentation({
      resources: { files },
      slides: [{ id: "slide-1", elements: [image("image")] }],
    }));

    expect(result.success, caseName).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ["slides", 0, "elements", 0, "fileResourceId"] }),
      ]));
    }
  });
});
