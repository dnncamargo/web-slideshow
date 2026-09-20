import { describe, expect, it } from "vitest";

import {
  materializeSlide,
  PresentationSchema,
  type Presentation,
  type PresentationElement,
  type Slide,
} from "../src";

function text(id: string, content = id, extras: Record<string, unknown> = {}) {
  return { id, type: "text" as const, content, ...extras } as unknown as PresentationElement;
}

function container(
  id: string,
  children: unknown[] = [],
  extras: Record<string, unknown> = {},
) {
  return { id, type: "container" as const, children, ...extras };
}

function slot(id: string, children: unknown[] = []) {
  return { id, children };
}

function definition(
  root: unknown,
  localChildTargetIds: string[] = [],
  id = "master-1",
) {
  return { id, name: id, root, localChildTargetIds };
}

function presentation(
  slide: unknown,
  rootDefinitions: unknown[] = [],
  extras: Record<string, unknown> = {},
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    rootDefinitions,
    slides: [slide],
    ...extras,
  });
}

function ordinarySlide(elements: unknown[] = [container("ordinary-root", [text("ordinary-text")])]): Slide {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    slides: [{ id: "slide-1", elements }],
  }).slides[0]!;
}

function masterSlide(overrides: Record<string, unknown> = {}): Slide {
  return {
    id: "slide-1",
    elements: [],
    rootDefinitionId: "master-1",
    ...overrides,
  } as unknown as Slide;
}

function invalidPresentation(slide: Slide, rootDefinitions: unknown[] = []): Presentation {
  return {
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    rootDefinitions,
    slides: [slide],
  } as unknown as Presentation;
}

describe("materializeSlide", () => {
  it("materializes an ordinary Slide as an independent slide-owned projection", () => {
    const slide = ordinarySlide();
    const source = presentation(slide);
    const projection = materializeSlide(source, source.slides[0]!);

    expect(projection.kind).toBe("materialized-slide");
    expect(projection.slide).toEqual(slide);
    expect(projection.slide).not.toBe(slide);
    expect(projection.ownershipByStructuralId.get("ordinary-root")).toBe("slide");
    expect(projection.ownershipByStructuralId.get("ordinary-text")).toBe("slide");

    projection.slide.title = "Changed";
    (projection.slide.elements[0] as { children: PresentationElement[] }).children[0] = text("changed");
    expect(source.slides[0]?.title).toBe("");
    expect((source.slides[0]?.elements[0] as { children: PresentationElement[] }).children[0]?.id).toBe("ordinary-text");
  });

  it("materializes an explicit Root Definition into one root element", () => {
    const root = container("master-root", [container("target", [text("master-child")])]);
    const slide = masterSlide({
      localRootChildren: [{ targetContainerId: "target", children: [text("local-child")] }],
    });
    const source = presentation(slide, [definition(root, ["target"])]);
    const projection = materializeSlide(source, source.slides[0]!);

    expect(projection.slide.elements).toHaveLength(1);
    expect(projection.slide.elements[0]).toMatchObject({ id: "master-root", type: "container" });
    expect(projection.slide).not.toHaveProperty("rootDefinitionId");
    expect(projection.slide).not.toHaveProperty("localRootChildren");
    expect(projection.ownershipByStructuralId.get("master-root")).toBe("master");
    expect(projection.ownershipByStructuralId.get("master-child")).toBe("master");
    expect(projection.ownershipByStructuralId.get("local-child")).toBe("slide");
  });

  it("inherits the Presentation default Root Definition", () => {
    const root = container("default-root", [container("default-target", [])]);
    const slide = { id: "slide-1", elements: [], localRootChildren: [{ targetContainerId: "default-target", children: [text("local")] }] };
    const source = presentation(slide, [definition(root, ["default-target"])], { defaultRootDefinitionId: "master-1" });
    const projection = materializeSlide(source, source.slides[0]!);

    expect(projection.slide.elements[0]?.id).toBe("default-root");
    expect(((projection.slide.elements[0] as { children: PresentationElement[] }).children[0] as { children: PresentationElement[] }).children[0]?.id).toBe("local");
  });

  it("appends local children to nested Container, table, and Topics targets", () => {
    const table = {
      id: "table",
      type: "table" as const,
      mode: "structured" as const,
      columns: [{ id: "column", header: slot("header", [container("table-target", [])]) }],
      rows: [{ id: "row", cells: [slot("cell")] }],
    };
    const topics = {
      id: "topics",
      type: "topics" as const,
      items: [{ id: "item", content: slot("topic-content", [container("topic-target", [])]), children: [] }],
    };
    const root = container("root", [container("nested", [container("nested-target", [])]), table, topics]);
    const slide = masterSlide({
      localRootChildren: [
        { targetContainerId: "nested-target", children: [text("nested-local")] },
        { targetContainerId: "table-target", children: [text("table-local")] },
        { targetContainerId: "topic-target", children: [text("topic-local")] },
      ],
    });
    const source = presentation(slide, [definition(root, ["nested-target", "table-target", "topic-target"])]);
    const projection = materializeSlide(source, source.slides[0]!);
    const copiedRoot = projection.slide.elements[0] as Extract<PresentationElement, { type: "container" }>;
    const copiedTable = copiedRoot.children[1] as Extract<PresentationElement, { type: "table"; mode: "structured" }>;
    const copiedTopics = copiedRoot.children[2] as Extract<PresentationElement, { type: "topics" }>;

    expect((copiedRoot.children[0] as Extract<PresentationElement, { type: "container" }>).children[0]).toMatchObject({ id: "nested-target" });
    expect((copiedRoot.children[0] as Extract<PresentationElement, { type: "container" }>).children[0]).toMatchObject({ children: [{ id: "nested-local" }] });
    expect(copiedTable.columns[0]?.header.children).toMatchObject([{ id: "table-target", children: [{ id: "table-local" }] }]);
    expect(copiedTopics.items[0]?.content.children).toMatchObject([{ id: "topic-target", children: [{ id: "topic-local" }] }]);
    expect(projection.ownershipByStructuralId.get("column")).toBe("master");
    expect(projection.ownershipByStructuralId.get("header")).toBe("master");
    expect(projection.ownershipByStructuralId.get("item")).toBe("master");
    expect(projection.ownershipByStructuralId.get("table-local")).toBe("slide");
    expect(projection.ownershipByStructuralId.get("topic-local")).toBe("slide");

    (copiedTable.columns[0]!.header.children[0] as Extract<PresentationElement, { type: "container" }>).children.push(text("changed-table"));
    (copiedTopics.items[0]!.content.children[0] as Extract<PresentationElement, { type: "container" }>).children.push(text("changed-topic"));
    const sourceTable = source.rootDefinitions?.[0]?.root as Extract<PresentationElement, { type: "container" }>;
    const sourceTableElement = sourceTable.children[1] as Extract<PresentationElement, { type: "table"; mode: "structured" }>;
    const sourceTopicsElement = sourceTable.children[2] as Extract<PresentationElement, { type: "topics" }>;
    expect(sourceTableElement.columns[0]!.header.children[0]).toMatchObject({ id: "table-target", children: [] });
    expect(sourceTopicsElement.items[0]!.content.children[0]).toMatchObject({ id: "topic-target", children: [] });
  });

  it("preserves Master-before-local ordering and separates multiple targets", () => {
    const root = container("root", [
      container("first-target", [text("first-master")]),
      container("second-target", [text("second-master")]),
    ]);
    const slide = masterSlide({
      localRootChildren: [
        { targetContainerId: "first-target", children: [text("first-local")] },
        { targetContainerId: "second-target", children: [text("second-local")] },
      ],
    });
    const source = presentation(slide, [definition(root, ["first-target", "second-target"])]);
    const projection = materializeSlide(source, source.slides[0]!);
    const copiedRoot = projection.slide.elements[0] as Extract<PresentationElement, { type: "container" }>;

    expect((copiedRoot.children[0] as Extract<PresentationElement, { type: "container" }>).children.map((child) => child.id)).toEqual(["first-master", "first-local"]);
    expect((copiedRoot.children[1] as Extract<PresentationElement, { type: "container" }>).children.map((child) => child.id)).toEqual(["second-master", "second-local"]);
  });

  it("preserves IDs, style references, and palette references without resolving them", () => {
    const root = container("root", [container("target", [text("master-text")], { linkedStyleId: "master-style" })]);
    const local = text("local-text", "Local", {
      variant: "heading",
      style: { color: { kind: "palette", colorId: "accent" } },
    });
    const slide = masterSlide({ localRootChildren: [{ targetContainerId: "target", children: [local] }] });
    const source = presentation(slide, [definition(root, ["target"])], {
      linkedStyles: [{ id: "master-style", name: "Master", layout: { children: { direction: "column" } } }],
      textStyles: [{ id: "heading", name: "Heading", role: "title", typography: { fontSize: 20 } }],
      palette: { colors: [{ id: "accent", name: "Accent", value: "#ff0000" }] },
    });
    const projection = materializeSlide(source, source.slides[0]!);
    const copiedRoot = projection.slide.elements[0] as Extract<PresentationElement, { type: "container" }>;
    const copiedTarget = copiedRoot.children[0] as Extract<PresentationElement, { type: "container" }>;
    const copiedLocal = copiedTarget.children[1] as Extract<PresentationElement, { type: "text" }>;

    expect(copiedTarget.linkedStyleId).toBe("master-style");
    expect(copiedLocal.variant).toBe("heading");
    expect(copiedLocal.style?.color).toEqual({ kind: "palette", colorId: "accent" });
    expect(copiedTarget.id).toBe("target");
    expect(copiedLocal.id).toBe("local-text");
  });

  it("deep-copies Master, nested structural, local, and metadata values", () => {
    const root = container("root", [container("target", [container("nested-master", [text("master-text")])])]);
    const slide = masterSlide({
      title: "Original",
      localRootChildren: [{ targetContainerId: "target", children: [container("local", [text("local-text")])] }],
    });
    const source = presentation(slide, [definition(root, ["target"])]);
    const projection = materializeSlide(source, source.slides[0]!);
    const copiedRoot = projection.slide.elements[0] as Extract<PresentationElement, { type: "container" }>;
    const copiedTarget = copiedRoot.children[0] as Extract<PresentationElement, { type: "container" }>;

    copiedRoot.children.push(text("new-master-root-child"));
    copiedTarget.children[0] = text("changed-master");
    (copiedTarget.children[1] as Extract<PresentationElement, { type: "container" }>).children[0] = text("changed-local");
    projection.slide.title = "Changed";

    expect(source.slides[0]?.title).toBe("Original");
    expect(source.rootDefinitions?.[0]?.root).toMatchObject({
      id: "root",
      children: [{
        id: "target",
        children: [{
          id: "nested-master",
          children: [{ id: "master-text" }],
        }],
      }],
    });
    expect(source.slides[0]?.localRootChildren?.[0]?.children[0]).toMatchObject({
      id: "local",
      children: [{ id: "local-text" }],
    });
  });

  it.each([
    ["dangling definition", {
      schemaVersion: 1,
      id: "presentation-1",
      title: "Presentation",
      slides: [masterSlide()],
    } as unknown as Presentation],
    ["unauthorized target", invalidPresentation(masterSlide({ localRootChildren: [{ targetContainerId: "target", children: [text("local")] }] }), [definition(container("target"), [])])],
    ["populated Master-backed elements", invalidPresentation(masterSlide({ elements: [text("ordinary")] }), [definition(container("root"))])],
  ])("throws for impossible %s state", (_name, source) => {
    expect(() => materializeSlide(source, source.slides[0]!)).toThrow();
  });

  it("rejects an unexpected non-plain value in manually constructed input", () => {
    const invalid = {
      ...ordinarySlide([]),
      elements: [{ id: "interactive", type: "interactive", widget: "function-plot", config: { bad: new Date() } }],
    } as unknown as Slide;

    const source = {
      schemaVersion: 1,
      id: "presentation-1",
      title: "Presentation",
      slides: [invalid],
    } as unknown as Presentation;
    expect(() => materializeSlide(source, invalid)).toThrow("Cannot materialize a non-plain canonical object.");
  });
});
