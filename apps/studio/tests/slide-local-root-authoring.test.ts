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
});
