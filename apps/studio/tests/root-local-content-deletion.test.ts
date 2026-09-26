import { describe, expect, it } from "vitest";

import {
  materializeSlide,
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import { preserveRootDefinitionContainerDeletion } from "../src/features/editor/root-local-content-deletion";

type Container = Extract<PresentationElement, { type: "container" }>;

function text(id: string, content = id): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function container(id: string, children: PresentationElement[] = []): Container {
  return { id, type: "container", hidden: false, children };
}

function localRecord(targetContainerId: string, childId: string, content = childId) {
  return { targetContainerId, children: [text(childId, content)] };
}

function presentation(options: {
  rootChildren?: PresentationElement[];
  targets?: string[];
  slides?: Presentation["slides"];
  defaultRootDefinitionId?: string;
} = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-content-deletion",
    title: "Root local content deletion",
    defaultRootDefinitionId: options.defaultRootDefinitionId,
    slides: options.slides ?? [{
      id: "slide-1",
      title: "Slide 1",
      elements: [],
      rootDefinitionId: "root-1",
      localRootChildren: [localRecord("receiver", "local-child")],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: options.targets ?? ["receiver"],
      root: container("root", options.rootChildren ?? [container("parent", [container("receiver")])]),
    }],
  });
}

function root(presentationValue: Presentation): Container {
  const value = presentationValue.rootDefinitions?.[0]?.root;
  if (!value) throw new Error("Expected Root Definition");
  return value;
}

function resultPresentation(result: ReturnType<typeof preserveRootDefinitionContainerDeletion>): Presentation {
  if (!result.ok) throw new Error(`Expected successful deletion, got ${result.reason}`);
  return result.presentation;
}

describe("Root Definition local-content container deletion", () => {
  it("reproduces the empty in-use receiver case and transfers local content to its parent", () => {
    const source = presentation();
    const result = resultPresentation(preserveRootDefinitionContainerDeletion(source, "root-1", "receiver"));

    expect(root(result).children).toEqual([container("parent")]);
    expect(result.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["parent"]);
    expect(result.slides[0]?.localRootChildren).toEqual([localRecord("parent", "local-child")]);
    expect(PresentationSchema.safeParse(result).success).toBe(true);
    expect(source.rootDefinitions?.[0]?.root.children[0]).toMatchObject({ id: "parent" });
    expect(source.slides[0]?.localRootChildren?.[0]?.targetContainerId).toBe("receiver");
  });

  it("promotes master children and keeps transferred local children after them", () => {
    const source = presentation({
      rootChildren: [container("parent", [
        text("before"),
        container("receiver", [text("master-child")]),
      ])],
    });
    const result = resultPresentation(preserveRootDefinitionContainerDeletion(source, "root-1", "receiver"));

    expect(root(result).children[0]).toEqual(container("parent", [text("before"), text("master-child")]));
    expect(result.slides[0]?.localRootChildren).toEqual([localRecord("parent", "local-child")]);
    const before = materializeSlide(source, source.slides[0]!).slide;
    const after = materializeSlide(result, result.slides[0]!).slide;
    expect((before.elements[0] as Container).children[0]?.id).toBe("parent");
    expect((after.elements[0] as Container).children[0]?.id).toBe("parent");
    expect(((after.elements[0] as Container).children[0] as Container).children.map((element) => element.id)).toEqual([
      "before",
      "master-child",
      "local-child",
    ]);
  });

  it("merges transferred children before existing parent-local children", () => {
    const source = presentation({
      rootChildren: [container("parent", [container("receiver", [text("master-child")])])],
      targets: ["receiver", "parent"],
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
        localRootChildren: [localRecord("receiver", "transferred"), localRecord("parent", "existing")],
      }],
    });
    const result = resultPresentation(preserveRootDefinitionContainerDeletion(source, "root-1", "receiver"));

    expect(result.slides[0]?.localRootChildren).toEqual([{
      targetContainerId: "parent",
      children: [text("transferred"), text("existing")],
    }]);
    expect(result.slides[0]?.localRootChildren?.filter((record) => record.targetContainerId === "parent")).toHaveLength(1);
  });

  it("transfers explicit and inherited usages for every affected Slide", () => {
    const source = PresentationSchema.parse({
      ...presentation({ defaultRootDefinitionId: "root-1" }),
      slides: [
        { id: "explicit", title: "Explicit", summary: "", speakerNotes: "", elements: [], rootDefinitionId: "root-1", localRootChildren: [localRecord("receiver", "explicit-local")] },
        { id: "inherited", title: "Inherited", summary: "", speakerNotes: "", elements: [], localRootChildren: [localRecord("receiver", "inherited-local")] },
        { id: "other", title: "Other", summary: "", speakerNotes: "", elements: [], rootDefinitionId: "root-2", localRootChildren: [localRecord("other-receiver", "other-local")] },
      ],
      rootDefinitions: [
        {
          id: "root-1",
          name: "Root 1",
          localChildTargetIds: ["receiver"],
          root: container("root", [container("parent", [container("receiver")])]),
        },
        {
          id: "root-2",
          name: "Root 2",
          localChildTargetIds: ["other-receiver"],
          root: container("other-root", [container("other-receiver")]),
        },
      ],
    });
    const result = resultPresentation(preserveRootDefinitionContainerDeletion(source, "root-1", "receiver"));

    expect(result.slides[0]?.localRootChildren?.[0]?.targetContainerId).toBe("parent");
    expect(result.slides[1]?.localRootChildren?.[0]?.targetContainerId).toBe("parent");
    expect(result.slides[2]?.localRootChildren?.[0]?.targetContainerId).toBe("other-receiver");
    expect(result.rootDefinitions?.[1]).toEqual(source.rootDefinitions?.[1]);
  });

  it("fails closed when the receiver is not the last direct master child", () => {
    const source = presentation({
      rootChildren: [container("parent", [container("receiver"), text("after")])],
    });
    const result = preserveRootDefinitionContainerDeletion(source, "root-1", "receiver");

    expect(result).toEqual({ ok: false, reason: "not-last-master-child" });
    expect(result.ok ? result.presentation : source).toEqual(source);
  });

  it("fails closed when the receiver parent is a ContentSlot", () => {
    const source = presentation({
      rootChildren: [{
        id: "topics",
        type: "topics",
        hidden: false,
        kind: "unordered",
        items: [{
          id: "item",
          content: { id: "item-content", children: [container("receiver")] },
          children: [],
        }],
      }],
    });
    const result = preserveRootDefinitionContainerDeletion(source, "root-1", "receiver");

    expect(result).toEqual({ ok: false, reason: "parent-not-container" });
    expect(result.ok ? result.presentation : source).toEqual(source);
  });

  it("protects the canonical Root Container", () => {
    const source = presentation({
      rootChildren: [],
      targets: ["root"],
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
        localRootChildren: [localRecord("root", "local-child")],
      }],
    });
    const result = preserveRootDefinitionContainerDeletion(source, "root-1", "root");

    expect(result).toEqual({ ok: false, reason: "canonical-root" });
  });

  it("leaves descendant receiver authorizations and records untouched", () => {
    const source = presentation({
      rootChildren: [container("parent", [container("receiver", [container("descendant")])])],
      targets: ["receiver", "descendant"],
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
        localRootChildren: [localRecord("receiver", "receiver-local"), localRecord("descendant", "descendant-local")],
      }],
    });
    const result = resultPresentation(preserveRootDefinitionContainerDeletion(source, "root-1", "receiver"));

    expect(result.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["descendant", "parent"]);
    expect(result.slides[0]?.localRootChildren?.map((record) => record.targetContainerId)).toEqual(["parent", "descendant"]);
    expect((root(result).children[0] as Container).children[0]).toEqual(container("descendant"));
  });

  it("reports non-receiver deletion for ordinary Root Definition preserve behavior", () => {
    const source = presentation({
      rootChildren: [container("parent", [container("ordinary", [text("child")])])],
      targets: [],
      slides: [{ id: "slide-1", title: "Slide 1", summary: "", speakerNotes: "", elements: [], rootDefinitionId: "root-1" }],
    });
    expect(preserveRootDefinitionContainerDeletion(source, "root-1", "ordinary")).toEqual({
      ok: false,
      reason: "not-local-receiver",
    });
  });
});
