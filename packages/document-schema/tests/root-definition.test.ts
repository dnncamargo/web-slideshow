import { describe, expect, it } from "vitest";

import { PresentationSchema, RootDefinitionSchema } from "../src";

function text(id: string, content = "Text") {
  return { id, type: "text" as const, content };
}

function container(id: string, children: unknown[] = []) {
  return { id, type: "container" as const, children };
}

function definition(overrides: Record<string, unknown> = {}) {
  return {
    id: "master-1",
    name: "Master",
    root: container("master-root", [container("master-content", [text("master-text")])]),
    localChildTargetIds: ["master-content"],
    ...overrides,
  };
}

function presentation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    slides: [{ id: "slide-1", elements: [] }],
    ...overrides,
  };
}

describe("Root Definition canonical storage", () => {
  it("keeps a legacy Presentation unchanged", () => {
    const result = PresentationSchema.parse(presentation({ slides: [{ id: "slide-1", elements: [text("ordinary")] }] }));
    expect(result).not.toHaveProperty("rootDefinitions");
    expect(result).not.toHaveProperty("defaultRootDefinitionId");
    expect(result.slides[0]?.elements[0]).toMatchObject(text("ordinary"));
  });

  it("accepts one or multiple valid Root Definitions", () => {
    expect(RootDefinitionSchema.safeParse(definition()).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition(), definition({ id: "master-2", name: "Alternate" })],
    })).success).toBe(true);
  });

  it("accepts a valid default and explicit Slide reference", () => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      defaultRootDefinitionId: "master-1",
      slides: [{ id: "slide-1", rootDefinitionId: "master-1", elements: [] }],
    })).success).toBe(true);
  });

  it("accepts local content through Presentation default inheritance", () => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      defaultRootDefinitionId: "master-1",
      slides: [{
        id: "slide-1",
        elements: [],
        localRootChildren: [{
          targetContainerId: "master-content",
          children: [text("default-local")],
        }],
      }],
    })).success).toBe(true);
  });

  it("rejects a populated legacy slide when a Presentation default makes it Master-backed", () => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      defaultRootDefinitionId: "master-1",
      slides: [{ id: "slide-1", elements: [text("legacy-content")] }],
    })).success).toBe(false);
  });

  it("uses an explicit Slide reference instead of the Presentation default", () => {
    const alternate = definition({
      id: "master-2",
      name: "Alternate",
      root: container("alternate-root", [container("alternate-content", [text("alternate-text")])]),
      localChildTargetIds: ["alternate-content"],
    });
    const accepted = presentation({
      rootDefinitions: [definition(), alternate],
      defaultRootDefinitionId: "master-1",
      slides: [{
        id: "slide-1",
        rootDefinitionId: "master-2",
        elements: [],
        localRootChildren: [{ targetContainerId: "alternate-content", children: [text("explicit-local")] }],
      }],
    });
    expect(PresentationSchema.safeParse(accepted).success).toBe(true);

    const wrongTarget = structuredClone(accepted);
    const slide = wrongTarget.slides[0] as unknown as { localRootChildren: Array<{ targetContainerId: string; children: unknown[] }> };
    slide.localRootChildren[0]!.targetContainerId = "master-content";
    expect(PresentationSchema.safeParse(wrongTarget).success).toBe(false);
  });

  it.each([
    ["dangling default", { rootDefinitions: [definition()], defaultRootDefinitionId: "missing" }],
    ["dangling explicit reference", { rootDefinitions: [definition()], slides: [{ id: "slide-1", rootDefinitionId: "missing", elements: [] }] }],
    ["duplicate definition IDs", { rootDefinitions: [definition(), definition()] }],
  ])("rejects %s", (_name, overrides) => {
    expect(PresentationSchema.safeParse(presentation(overrides)).success).toBe(false);
  });

  it("requires the Root Definition root to be a Container", () => {
    expect(RootDefinitionSchema.safeParse({ ...definition(), root: text("not-container") }).success).toBe(false);
  });

  it.each([
    ["nonexistent target", ["missing"]],
    ["non-Container target", ["master-text"]],
    ["duplicate allowed targets", ["master-content", "master-content"]],
  ])("rejects %s", (_name, targets) => {
    expect(RootDefinitionSchema.safeParse(definition({ localChildTargetIds: targets })).success).toBe(false);
  });

  it("accepts valid targeted local children, including nested Containers", () => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      slides: [{
        id: "slide-1",
        rootDefinitionId: "master-1",
        elements: [],
        localRootChildren: [{
          targetContainerId: "master-content",
          children: [container("local-container", [text("local-text")])],
        }],
      }],
    })).success).toBe(true);
  });

  it.each([
    ["duplicate local targets", [{ targetContainerId: "master-content", children: [text("a")] }, { targetContainerId: "master-content", children: [text("b")] }]],
    ["unauthorized local target", [{ targetContainerId: "master-root", children: [text("a")] }]],
  ])("rejects %s", (_name, localRootChildren) => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      slides: [{ id: "slide-1", rootDefinitionId: "master-1", elements: [], localRootChildren }],
    })).success).toBe(false);
  });

  it("rejects local content without an effective Root Definition", () => {
    expect(PresentationSchema.safeParse(presentation({
      slides: [{ id: "slide-1", elements: [], localRootChildren: [{ targetContainerId: "x", children: [text("local")] }] }],
    })).success).toBe(false);
  });

  it("rejects ordinary slide.elements content on a Master-backed Slide", () => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      slides: [{ id: "slide-1", rootDefinitionId: "master-1", elements: [text("ordinary")] }],
    })).success).toBe(false);
  });

  it("keeps ordinary slide.elements valid without a Root Definition", () => {
    expect(PresentationSchema.safeParse(presentation({
      slides: [{ id: "slide-1", elements: [container("ordinary-container", [text("ordinary-text")]) ] }],
    })).success).toBe(true);
  });

  it("validates style, text-style, and palette references in master and local trees", () => {
    const master = definition({
      root: container("master-root", [{ ...text("master-text"), variant: "heading" }]),
      localChildTargetIds: ["master-root"],
    });
    const invalid = presentation({
      rootDefinitions: [master],
      textStyles: [{ id: "heading", name: "Heading", role: "title", typography: { fontSize: 20 } }],
      linkedStyles: [{ id: "master-style", name: "Master", layout: { children: { direction: "column" } } }],
      palette: { colors: [{ id: "accent", name: "Accent", value: "#ff0000" }] },
      slides: [{
        id: "slide-1",
        rootDefinitionId: "master-1",
        elements: [],
        localRootChildren: [{ targetContainerId: "master-root", children: [{ ...text("local-text"), variant: "missing" }] }],
      }],
    });
    expect(PresentationSchema.safeParse(invalid).success).toBe(false);

    const valid = presentation({
      rootDefinitions: [definition({ root: { ...container("master-root", [{ ...text("master-text"), variant: "heading" }]), linkedStyleId: "master-style" }, localChildTargetIds: ["master-root"] })],
      textStyles: [{ id: "heading", name: "Heading", role: "title", typography: { fontSize: 20 } }],
      linkedStyles: [{ id: "master-style", name: "Master", layout: { children: { direction: "column" } } }],
      slides: [{ id: "slide-1", rootDefinitionId: "master-1", elements: [], localRootChildren: [{ targetContainerId: "master-root", children: [text("local-text", "ok")] }] }],
    });
    expect(PresentationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects Root Definition and local-tree materialization ID collisions", () => {
    expect(PresentationSchema.safeParse(presentation({
      rootDefinitions: [definition()],
      slides: [{
        id: "slide-1",
        rootDefinitionId: "master-1",
        elements: [],
        localRootChildren: [{ targetContainerId: "master-content", children: [text("master-text")] }],
      }],
    })).success).toBe(false);
  });
});
