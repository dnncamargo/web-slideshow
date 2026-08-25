import { describe, expect, it } from "vitest";
import {
  PowerShowElementSchema,
  type PowerShowElement,
  type Slide,
} from "@powershow/document-schema";

import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import {
  materializeCustomLibraryElementRecipe,
  mergeCustomLibraryElementRecipe,
} from "../src/features/custom-library/custom-library-apply";
import type { CustomLibraryElementRecipe } from "../src/features/custom-library/custom-library-recipe";

const slide = (elements: PowerShowElement[] = []): Slide => ({
  id: "slide-1",
  title: "",
  summary: "",
  speakerNotes: "",
  elements,
});
const slides: Slide[] = [slide()];

function text(id: string, content: string): PowerShowElement {
  return { id, type: "text", hidden: false, content, variant: "body" };
}

function recipe(
  type: CustomLibraryElementRecipe["type"],
  properties: CustomLibraryElementRecipe["properties"] = [],
  children?: CustomLibraryElementRecipe[],
): CustomLibraryElementRecipe {
  return children === undefined ? { type, properties } : { type, properties, children };
}

function ids(element: PowerShowElement): Set<string> {
  const result = new Set<string>();
  collectAuthoringIds(element, result);
  return result;
}

describe("Custom Library apply core", () => {
  it("materializes with create defaults and selected properties", () => {
    const result = materializeCustomLibraryElementRecipe(
      recipe("text", [{ path: "typography.fontFamily", value: "Roboto" }]),
      slides,
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "text") return;
    expect(result.element.content).toBe("New text");
    expect(result.element.typography?.fontFamily).toBe("Roboto");
    expect(result.element.id).not.toBe("text-element-1");
    expect(PowerShowElementSchema.safeParse(result.element).success).toBe(true);
  });

  it("replaces explicitly selected content and does not mutate inputs", () => {
    const source = recipe("text", [{ path: "content", value: "Saved" }]);
    const sourceBefore = structuredClone(source);
    const slidesBefore = structuredClone(slides);
    const result = materializeCustomLibraryElementRecipe(source, slides);

    expect(result.ok && result.element.type === "text" && result.element.content).toBe("Saved");
    expect(source).toEqual(sourceBefore);
    expect(slides).toEqual(slidesBefore);
  });

  it("materializes nested container children in order with fresh ids", () => {
    const result = materializeCustomLibraryElementRecipe(
      recipe("container", [], [
        recipe("text", [{ path: "content", value: "A" }]),
        recipe("container", [], [recipe("text", [{ path: "content", value: "B" }])]),
      ]),
      [slide([text("text-element-1", "Existing")])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "container") return;
    expect(result.element.children.map((child) => child.type)).toEqual(["text", "container"]);
    expect(result.element.children[0]?.type === "text" && result.element.children[0].content).toBe("A");
    expect(result.element.children[1]?.type === "container").toBe(true);
    expect(new Set([...ids(result.element)]).size).toBe(4);
    expect([...ids(result.element)].some((id) => id === "text-element-1")).toBe(false);
  });

  it("remaps intrinsic table authoring ids", () => {
    const sourceTable: PowerShowElement = {
      id: "source-table",
      type: "table",
      mode: "structured",
      hidden: false,
      showHeader: true,
      columns: [{ id: "source-column", header: { id: "source-header", children: [text("source-header-text", "H")] } }],
      rows: [{ id: "source-row", cells: [{ id: "source-cell", children: [text("source-cell-text", "V")] }] }],
    };
    const result = materializeCustomLibraryElementRecipe(
      recipe("table", [{ path: "rows", value: sourceTable.type === "table" ? sourceTable.rows : [] }]),
      [slide([text("source-row", "collision")])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "table" || result.element.mode !== "structured") return;
    expect(result.element.rows[0]?.id).not.toBe("source-row");
    expect(result.element.rows[0]?.cells[0]?.id).not.toBe("source-cell");
    expect(result.element.rows[0]?.cells[0]?.children[0]?.id).not.toBe("source-cell-text");
  });

  it("merges same-type properties while preserving identity and omitted values", () => {
    const target: PowerShowElement = {
      id: "title-1",
      type: "text",
      hidden: false,
      content: "Existing",
      variant: "body",
      typography: { fontFamily: "Inter", fontSize: "40px" },
    };
    const result = mergeCustomLibraryElementRecipe(
      recipe("text", [{ path: "typography.fontFamily", value: "Roboto" }]),
      target,
      [slide([target])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "text") return;
    expect(result.element.id).toBe("title-1");
    expect(result.element.content).toBe("Existing");
    expect(result.element.typography).toEqual({ fontFamily: "Roboto", fontSize: "40px" });
  });

  it("appends recipe children without changing existing child ids", () => {
    const target: PowerShowElement = {
      id: "container-1",
      type: "container",
      hidden: false,
      children: [text("existing-child", "Existing")],
    };
    const result = mergeCustomLibraryElementRecipe(
      recipe("container", [], [recipe("text", [{ path: "content", value: "New" }])]),
      target,
      [slide([target])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "container") return;
    expect(result.element.children.map((child) => child.id)).toHaveLength(2);
    expect(result.element.children[0]?.id).toBe("existing-child");
    expect(result.element.children[1]?.id).not.toBe("existing-child");
    expect(result.element.children[1]?.type === "text" && result.element.children[1].content).toBe("New");
  });

  it("rejects mismatches, unsupported creates, invalid values, and unsafe paths", () => {
    const target = text("target", "Target");
    expect(mergeCustomLibraryElementRecipe(recipe("image"), target, slides)).toEqual({ ok: false, reason: "type-mismatch" });
    expect(materializeCustomLibraryElementRecipe(recipe("chart"), slides)).toEqual({ ok: false, reason: "unsupported-create-type" });
    expect(materializeCustomLibraryElementRecipe(recipe("text", [{ path: "content", value: 42 }]), slides)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    for (const path of ["__proto__.polluted", "constructor.x", "prototype.x", "typography..fontSize", "content.0"]) {
      expect(materializeCustomLibraryElementRecipe(recipe("text", [{ path, value: "x" }]), slides)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    }
  });
});
