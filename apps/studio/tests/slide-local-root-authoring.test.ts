import { describe, expect, it } from "vitest";

import { PresentationSchema, materializeSlide, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import {
  findLocalRootChildOwner,
  isAuthorizedLocalRootReceiver,
  updateLocalRootChildren,
  updateLocalRootElement,
} from "../src/features/editor/slide-local-root-authoring";

function text(id: string, content = id): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "local-root-authoring",
    title: "Local root authoring",
    defaultRootDefinitionId: "root-definition",
    slides: [{ id: "slide-1", title: "Slide", elements: [] }],
    rootDefinitions: [{
      id: "root-definition",
      name: "Root",
      localChildTargetIds: ["receiver"],
      root: {
        id: "root",
        type: "container",
        hidden: false,
        children: [{ id: "receiver", type: "container", hidden: false, children: [text("master-text")] }],
      },
    }],
  });
}

describe("slide-local-root-authoring", () => {
  it("creates, updates, and removes validated local receiver records without touching slide.elements", () => {
    const initial = presentation();
    expect(isAuthorizedLocalRootReceiver(initial, initial.slides[0]!, "receiver")).toBe(true);
    expect(isAuthorizedLocalRootReceiver(initial, initial.slides[0]!, "root")).toBe(false);

    const added = updateLocalRootChildren(initial, 0, "receiver", () => [text("local-text", "Local")]);
    expect(added.slides[0]!.elements).toEqual([]);
    expect(added.slides[0]!.localRootChildren).toEqual([{
      targetContainerId: "receiver",
      children: [text("local-text", "Local")],
    }]);
    expect(materializeSlide(added, added.slides[0]!).slide.elements[0]).toMatchObject({
      type: "container",
      children: [{
        type: "container",
        id: "receiver",
        children: [text("master-text"), text("local-text", "Local")],
      }],
    });

    const updated = updateLocalRootElement(added, 0, "local-text", (element) =>
      element.type === "text" ? { ...element, content: "Edited" } : element,
    );
    expect(findLocalRootChildOwner(updated, 0, "local-text")).toMatchObject({
      targetContainerId: "receiver",
      recordIndex: 0,
    });
    expect(updated.slides[0]!.localRootChildren?.[0]?.children[0]).toMatchObject({ content: "Edited" });

    const removed = updateLocalRootChildren(updated, 0, "receiver", () => []);
    expect(removed.slides[0]!.localRootChildren).toBeUndefined();
    expect(removed.slides[0]!.elements).toEqual([]);
  });

  it("rejects writes to unauthorized receivers and invalid canonical output", () => {
    const initial = presentation();
    const unchanged = updateLocalRootChildren(initial, 0, "root", () => [text("not-allowed")]);
    expect(unchanged).toBe(initial);
  });

  it("reuses one receiver record and resolves nested local ownership immutably", () => {
    const initial = presentation();
    const nested = {
      id: "local-container",
      type: "container" as const,
      hidden: false,
      children: [text("nested-text")],
    };
    const withContainer = updateLocalRootChildren(initial, 0, "receiver", () => [nested]);
    const withSibling = updateLocalRootChildren(withContainer, 0, "receiver", (children) => [...children, text("sibling")]);

    expect(withContainer).not.toBe(initial);
    expect(withContainer.slides[0]!.localRootChildren).toHaveLength(1);
    expect(withSibling.slides[0]!.localRootChildren).toHaveLength(1);
    expect(findLocalRootChildOwner(withSibling, 0, "nested-text")).toMatchObject({ targetContainerId: "receiver" });
    const updated = updateLocalRootElement(withSibling, 0, "nested-text", (element) =>
      element.type === "text" ? { ...element, content: "Nested edited" } : element,
    );
    expect(updated.slides[0]!.localRootChildren?.[0]?.children[0]).toMatchObject({
      id: "local-container",
      children: [{ id: "nested-text", content: "Nested edited" }],
    });
    expect(initial.slides[0]!.localRootChildren).toBeUndefined();
    expect(withSibling.slides[0]!.localRootChildren?.[0]?.children[0]).toEqual(nested);
    expect(PresentationSchema.safeParse(updated).success).toBe(true);
    const duplicated = updateLocalRootChildren(updated, 0, "receiver", (children) => [...children, text("nested-copy")]);
    expect(duplicated.slides[0]!.localRootChildren?.[0]?.children).toHaveLength(3);
  });
});
