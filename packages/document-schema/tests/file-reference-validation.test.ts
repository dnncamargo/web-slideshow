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
