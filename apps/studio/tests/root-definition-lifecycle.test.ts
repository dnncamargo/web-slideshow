import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
  type RootDefinition,
} from "@web-slideshow/document-schema";

import {
  createRootPresetContainer,
  type SlideLayoutPreset,
} from "../src/features/editor/preset-structure";
import {
  createRootDefinitionFromPreset,
  deleteRootDefinition,
  renameRootDefinition,
} from "../src/features/editor/root-definition-lifecycle";

const presets: SlideLayoutPreset[] = [
  "blank",
  "full",
  "centered",
  "title-content",
  "two-columns",
  "three-columns",
  "title-two-columns",
];

function withoutIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutIds) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, entry]) => [key, withoutIds(entry)]),
    ) as T;
  }
  return value;
}

function definition(
  id: string,
  name = id,
  preset: SlideLayoutPreset = "blank",
): RootDefinition {
  return {
    id,
    name,
    root: createRootPresetContainer(preset, id, new Set()),
  };
}

function presentation(
  overrides: Partial<Presentation> = {},
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    slides: [{ id: "slide-1", elements: [] }],
    ...overrides,
  });
}

describe("Root Definition lifecycle operations", () => {
  it.each(presets)("creates a valid independent %s Root Definition", (preset) => {
    const source = presentation();
    const before = structuredClone(source);
    const result = createRootDefinitionFromPreset(source, preset, "  Shared root  ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("root-definition");
    expect(result.presentation.rootDefinitions).toHaveLength(1);
    expect(result.presentation.rootDefinitions?.[0]).toMatchObject({
      id: "root-definition",
      name: "Shared root",
    });
    expect(result.presentation.slides).toEqual(source.slides);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
    expect(source).toEqual(before);

    const createdRoot = result.presentation.rootDefinitions?.[0]?.root;
    const sharedRoot = createRootPresetContainer(preset, "other-owner", new Set());
    expect(createdRoot).toBeDefined();
    expect(withoutIds(createdRoot)).toEqual(withoutIds(sharedRoot));
    if (preset === "blank") {
      expect(createdRoot).toEqual({
        id: "root-definition-root",
        type: "container",
        hidden: false,
        children: [],
      });
    } else {
      expect(createdRoot?.type).toBe("container");
      expect(createdRoot?.children.length).toBeGreaterThan(0);
    }
  });

  it("rejects a blank creation name without changing the input", () => {
    const source = presentation();
    const before = structuredClone(source);

    expect(createRootDefinitionFromPreset(source, "blank", " \t ")).toEqual({
      ok: false,
      reason: "invalid-name",
    });
    expect(source).toEqual(before);
  });

  it("allocates Root and structural IDs across Slides, Roots, elements, and local children", () => {
    const existingRoot = definition("root-definition", "Existing");
    existingRoot.root.children = [{
      id: "root-definition-4-root",
      type: "container",
      hidden: false,
      children: [],
    }];
    existingRoot.localChildTargetIds = ["root-definition-root"];
    const source = presentation({
      rootDefinitions: [existingRoot],
      slides: [{
        id: "root-definition-2",
        rootDefinitionId: "root-definition",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [],
        localRootChildren: [{
          targetContainerId: "root-definition-root",
          children: [
            { id: "slide-element", type: "text", hidden: false, variant: "body", content: "Slide" },
            { id: "root-definition-3", type: "text", hidden: false, variant: "body", content: "Local" },
          ],
        }],
      }],
    });

    const result = createRootDefinitionFromPreset(source, "two-columns", "New");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("root-definition-4");
    expect(result.presentation.rootDefinitions?.[1]?.root.id).toBe("root-definition-4-root-2");
  });

  it("appends without changing the default Root reference", () => {
    const source = presentation({
      rootDefinitions: [definition("root-a", "A")],
      defaultRootDefinitionId: "root-a",
    });

    const result = createRootDefinitionFromPreset(source, "title-two-columns", "B");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.rootDefinitions?.map((root) => root.id)).toEqual(["root-a", "root-definition"]);
    expect(result.presentation.defaultRootDefinitionId).toBe("root-a");
  });

  it("renames only the selected Root Definition", () => {
    const source = presentation({
      rootDefinitions: [definition("root-a", "A", "two-columns"), definition("root-b", "B", "blank")],
      defaultRootDefinitionId: "root-a",
      slides: [{ id: "slide-1", title: "", summary: "", speakerNotes: "", rootDefinitionId: "root-a", elements: [] }],
    });
    const beforeRoot = structuredClone(source.rootDefinitions?.[0]);
    const beforeSlide = structuredClone(source.slides);

    const result = renameRootDefinition(source, "root-a", "  Renamed  ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.rootDefinitions?.[0]?.name).toBe("Renamed");
    expect(result.presentation.rootDefinitions?.[0]?.id).toBe("root-a");
    expect(result.presentation.rootDefinitions?.[0]?.root).toEqual(beforeRoot?.root);
    expect(result.presentation.rootDefinitions?.[0]?.localChildTargetIds).toEqual(beforeRoot?.localChildTargetIds);
    expect(result.presentation.rootDefinitions?.[1]).toEqual(source.rootDefinitions?.[1]);
    expect(result.presentation.slides).toEqual(beforeSlide);
    expect(result.presentation.defaultRootDefinitionId).toBe("root-a");
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
    expect(source.rootDefinitions?.[0]?.name).toBe("A");
  });

  it.each([
    ["empty", "  ", "invalid-name"],
    ["missing", "New", "not-found"],
    ["same", " A ", "no-op"],
  ] as const)("rejects %s rename with reason %s", (_case, name, reason) => {
    const source = presentation({ rootDefinitions: [definition("root-a", "A")] });
    const before = structuredClone(source);

    expect(renameRootDefinition(source, reason === "not-found" ? "missing" : "root-a", name)).toEqual({
      ok: false,
      reason,
    });
    expect(source).toEqual(before);
  });

  it("deletes an unused Root Definition and omits the empty optional collection", () => {
    const source = presentation({ rootDefinitions: [definition("root-a", "A")] });
    const result = deleteRootDefinition(source, "root-a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).not.toHaveProperty("rootDefinitions");
    expect(result.presentation.slides).toEqual(source.slides);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
    expect(source.rootDefinitions).toHaveLength(1);
  });

  it.each(["default", "slide-reference"] as const)("blocks deletion with a %s reference", (referenceKind) => {
    const source = referenceKind === "default"
      ? presentation({ rootDefinitions: [definition("root-a", "A")], defaultRootDefinitionId: "root-a" })
      : presentation({
          rootDefinitions: [definition("root-a", "A")],
          slides: [{ id: "slide-1", title: "", summary: "", speakerNotes: "", rootDefinitionId: "root-a", elements: [] }],
        });
    const before = structuredClone(source);

    expect(deleteRootDefinition(source, "root-a")).toEqual({ ok: false, reason: "referenced" });
    expect(source).toEqual(before);
  });

  it("preserves independent Roots and Slides when deleting the middle Root", () => {
    const source = presentation({
      rootDefinitions: [
        definition("root-a", "A", "full"),
        definition("root-b", "B", "two-columns"),
        definition("root-c", "C", "title-two-columns"),
      ],
      slides: [{ id: "slide-1", title: "", summary: "", speakerNotes: "", elements: [{ id: "slide-element", type: "text", hidden: false, variant: "body", content: "Slide" }] }],
    });
    const before = structuredClone(source);
    const result = deleteRootDefinition(source, "root-b");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.rootDefinitions?.map((root) => root.id)).toEqual(["root-a", "root-c"]);
    expect(result.presentation.rootDefinitions?.[0]).toEqual(before.rootDefinitions?.[0]);
    expect(result.presentation.rootDefinitions?.[1]).toEqual(before.rootDefinitions?.[2]);
    expect(result.presentation.slides).toEqual(before.slides);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
    expect(source).toEqual(before);
  });

  it("returns not-found for deleting an unknown Root Definition", () => {
    const source = presentation({ rootDefinitions: [definition("root-a", "A")] });
    expect(deleteRootDefinition(source, "missing")).toEqual({ ok: false, reason: "not-found" });
  });

  it("keeps created Root trees independent from future structural builds", () => {
    const source = presentation();
    const result = createRootDefinitionFromPreset(source, "two-columns", "A");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = result.presentation.rootDefinitions?.[0]?.root;
    const later = createRootPresetContainer("two-columns", "later-owner", new Set());
    expect(created).not.toBe(later);
    expect(created?.children[0]).not.toBe(later.children[0]);
    expect(source).toEqual(presentation());
  });
});
