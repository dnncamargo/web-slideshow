import { describe, expect, it } from "vitest";

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
