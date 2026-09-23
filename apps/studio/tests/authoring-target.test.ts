import { describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";
import {
  isProtectedRootContainer,
  replaceAuthoringElements,
  resolveAuthoringElements,
  resolveAuthoringSlide,
  resolveCanonicalRootContainerId,
  updateAuthoringElements,
  type AuthoringTarget,
} from "../src/features/editor/authoring-target";
import { reconcileSelectedElementAfterReplay } from "../src/features/editor/editor-history-selection-reconciliation";

function text(id: string, content = id): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function container(id: string, children: PresentationElement[] = []): Extract<PresentationElement, { type: "container" }> {
  return { id, type: "container", hidden: false, children };
}

function makePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    slides: [
      { id: "slide-1", elements: [text("slide-1-text")] },
      { id: "slide-2", elements: [text("slide-2-text")] },
    ],
    rootDefinitions: [
      {
        id: "root-1",
        name: "Root One",
        root: container("root-1-container", [text("root-1-text")]),
      },
      {
        id: "root-2",
        name: "Root Two",
        root: container("root-2-container", [text("root-2-text")]),
      },
    ],
  });
}

const rootTarget: AuthoringTarget = { kind: "root-definition", rootDefinitionId: "root-1" };

describe("authoring target resolution", () => {
  it("resolves the requested canonical Slide", () => {
    const presentation = makePresentation();
    expect(resolveAuthoringSlide(presentation, { kind: "slide", slideIndex: 1 })).toBe(presentation.slides[1]);
    expect(resolveAuthoringElements(presentation, { kind: "slide", slideIndex: 1 })).toBe(presentation.slides[1]?.elements);
  });

  it("resolves a Root Definition without materializing it", () => {
    const presentation = makePresentation();
    const root = presentation.rootDefinitions?.[0]?.root;
    const projection = resolveAuthoringSlide(presentation, rootTarget);

    expect(projection).toMatchObject({
      title: "Root One",
      summary: "",
      speakerNotes: "",
      elements: [root],
    });
    expect(resolveAuthoringElements(presentation, rootTarget)).toEqual([root]);
    expect(projection?.elements[0]).toBe(root);
    expect(projection?.id).not.toBe(presentation.slides[0]?.id);
    expect(JSON.stringify(presentation)).not.toContain(projection?.id ?? "");
  });

  it("safely reports unresolved targets", () => {
    const presentation = makePresentation();
    expect(resolveAuthoringSlide(presentation, { kind: "slide", slideIndex: 99 })).toBeNull();
    expect(resolveAuthoringSlide(presentation, { kind: "root-definition", rootDefinitionId: "missing" })).toBeNull();
    expect(replaceAuthoringElements(presentation, { kind: "slide", slideIndex: 99 }, [])).toBe(presentation);
    expect(replaceAuthoringElements(presentation, { kind: "root-definition", rootDefinitionId: "missing" }, [container("x")])).toBe(presentation);
  });
});

describe("authoring target replacement", () => {
  it("updates only the selected Slide", () => {
    const presentation = makePresentation();
    const next = replaceAuthoringElements(presentation, { kind: "slide", slideIndex: 1 }, [container("new-slide-root")]);

    expect(next.slides[1]?.elements).toEqual([container("new-slide-root")]);
    expect(next.slides[0]).toBe(presentation.slides[0]);
    expect(next.rootDefinitions).toBe(presentation.rootDefinitions);
  });

  it("updates only the selected Root Definition", () => {
    const presentation = makePresentation();
    const nextRoot = container("root-1-container", [text("replacement")]);
    const next = replaceAuthoringElements(presentation, rootTarget, [nextRoot]);

    expect(next.rootDefinitions?.[0]?.root).toBe(nextRoot);
    expect(next.rootDefinitions?.[1]).toBe(presentation.rootDefinitions?.[1]);
    expect(next.slides).toBe(presentation.slides);
  });

  it.each([
    ["zero roots", []],
    ["multiple roots", [container("root-1-container"), container("extra")]],
    ["non-Container root", [text("root-1-container")]],
    ["changed root id", [container("changed-id")]],
  ])("rejects %s", (_label, elements) => {
    const presentation = makePresentation();
    expect(replaceAuthoringElements(presentation, rootTarget, elements)).toBe(presentation);
  });

  it("prunes unused receiver IDs when a Root subtree is removed", () => {
    const base = makePresentation();
    const presentation = PresentationSchema.parse({
      ...base,
      rootDefinitions: [{
        id: "root-1",
        name: "Root One",
        localChildTargetIds: ["root-1-container", "nested"],
        root: container("root-1-container", [container("nested")]),
      }, base.rootDefinitions?.[1]],
    });
    const next = replaceAuthoringElements(presentation, rootTarget, [container("root-1-container")]);
    expect(next.rootDefinitions?.[0]?.root).toEqual(container("root-1-container"));
    expect(next.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["root-1-container"]);
    expect(PresentationSchema.safeParse(next).success).toBe(true);
  });

  it.each(["direct target", "ancestor target"] as const)("blocks removal of an in-use receiver (%s)", (caseName) => {
    const base = makePresentation();
    const root = caseName === "direct target"
      ? container("root-1-container", [container("nested")])
      : container("root-1-container", [container("parent", [container("nested")])]);
    const source = PresentationSchema.parse({
      ...base,
      rootDefinitions: [{ id: "root-1", name: "Root One", localChildTargetIds: ["nested"], root }, base.rootDefinitions?.[1]],
      defaultRootDefinitionId: "root-1",
      slides: [{ id: "slide-1", title: "", summary: "", speakerNotes: "", elements: [], localRootChildren: [{ targetContainerId: "nested", children: [text("local")] }] }],
    });
    const before = structuredClone(source);
    const replacement = caseName === "direct target"
      ? container("root-1-container")
      : container("root-1-container", [container("parent")]);
    expect(replaceAuthoringElements(source, rootTarget, [replacement])).toBe(source);
    expect(source).toEqual(before);
  });

  it("preserves surviving authorized descendants when deleting an unused parent", () => {
    const base = makePresentation();
    const source = PresentationSchema.parse({
      ...base,
      rootDefinitions: [{
        id: "root-1",
        name: "Root One",
        localChildTargetIds: ["parent", "survivor"],
        root: container("root-1-container", [container("parent", [text("child")]), container("survivor")]),
      }, base.rootDefinitions?.[1]],
    });
    const next = replaceAuthoringElements(source, rootTarget, [container("root-1-container", [container("survivor")])]);
    expect(next.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["survivor"]);
    expect(next.rootDefinitions?.[0]?.root.children).toEqual([container("survivor")]);
  });
});

describe("target-aware element updates", () => {
  it("updates a Slide target and invokes the callback once", () => {
    const presentation = makePresentation();
    let calls = 0;
    const next = updateAuthoringElements(
      presentation,
      { kind: "slide", slideIndex: 1 },
      (elements) => {
        calls += 1;
        return [text("slide-2-updated")];
      },
    );

    expect(calls).toBe(1);
    expect(next.slides[1]?.elements).toEqual([text("slide-2-updated")]);
    expect(next.slides[0]).toBe(presentation.slides[0]);
    expect(next.rootDefinitions).toBe(presentation.rootDefinitions);
  });

  it("updates only the requested Root Definition", () => {
    const presentation = makePresentation();
    const next = updateAuthoringElements(presentation, rootTarget, (elements) => [
      container("root-1-container", [
        ...(elements[0]?.type === "container" ? elements[0].children : []),
        text("updated"),
      ]),
    ]);

    expect(next.rootDefinitions?.[0]?.root.children.at(-1)).toEqual(text("updated"));
    expect(next.rootDefinitions?.[1]).toBe(presentation.rootDefinitions?.[1]);
    expect(next.slides).toBe(presentation.slides);
  });

  it("leaves the original Presentation untouched for unresolved targets", () => {
    const presentation = makePresentation();
    const update = vi.fn(() => [text("unexpected")]);

    expect(updateAuthoringElements(presentation, { kind: "root-definition", rootDefinitionId: "missing" }, update)).toBe(presentation);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns the original Presentation when the callback returns the same array", () => {
    const presentation = makePresentation();
    expect(updateAuthoringElements(presentation, rootTarget, (elements) => elements)).toBe(presentation);
  });

  it("retains the Root Container invariant through the update helper", () => {
    const presentation = makePresentation();
    expect(updateAuthoringElements(presentation, rootTarget, () => [container("changed-root-id")])).toBe(presentation);
  });

  it("does not persist the synthetic Root Definition workspace Slide", () => {
    const presentation = makePresentation();
    const next = updateAuthoringElements(presentation, rootTarget, (elements) => elements);

    expect(JSON.stringify(next)).not.toContain("root-definition-workspace:");
    expect(next.slides).toBe(presentation.slides);
  });
});

describe("Root Container helpers", () => {
  it("protects only the canonical Root Container", () => {
    const presentation = makePresentation();
    expect(resolveCanonicalRootContainerId(presentation, rootTarget)).toBe("root-1-container");
    expect(isProtectedRootContainer(presentation, rootTarget, "root-1-container")).toBe(true);
    expect(isProtectedRootContainer(presentation, rootTarget, "root-1-text")).toBe(false);
    expect(isProtectedRootContainer(presentation, { kind: "slide", slideIndex: 0 }, "root-1-container")).toBe(false);
  });
});

describe("history selection reconciliation", () => {
  it("retains surviving Slide selections and clears contentSlotId", () => {
    const presentation = makePresentation();
    expect(reconcileSelectedElementAfterReplay(
      { id: "slide-1-text", type: "text", contentSlotId: "stale-slot" },
      presentation,
      { kind: "slide", slideIndex: 0 },
    )).toEqual({ id: "slide-1-text", type: "text", contentSlotId: null });
  });

  it("retains Root Definition descendants and clears disappeared selections", () => {
    const presentation = makePresentation();
    expect(reconcileSelectedElementAfterReplay(
      { id: "root-1-text", type: "text", contentSlotId: "stale-slot" },
      presentation,
      rootTarget,
    )).toEqual({ id: "root-1-text", type: "text", contentSlotId: null });

    const changed = replaceAuthoringElements(presentation, rootTarget, [container("root-1-container")]);
    expect(reconcileSelectedElementAfterReplay(
      { id: "root-1-text", type: "text", contentSlotId: "stale-slot" },
      changed,
      rootTarget,
    )).toBeNull();
  });
});

describe("schema compatibility", () => {
  it("keeps schemaVersion 1 and accepts valid Root Definition replacement", () => {
    const presentation = makePresentation();
    const next = replaceAuthoringElements(presentation, rootTarget, [container("root-1-container", [text("new")])]);
    expect(next.schemaVersion).toBe(1);
    expect(PresentationSchema.safeParse(next).success).toBe(true);
  });
});
