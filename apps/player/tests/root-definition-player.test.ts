// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { mountProjectionSurface } from "../src/projection-surface";

function rootPresentation() {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-player",
    title: "Root Player",
    description: "",
    aspectRatio: "16:9",
    defaultRootDefinitionId: "master-default",
    rootDefinitions: [
      {
        id: "master-default",
        name: "Default master",
        root: {
          id: "default-root",
          type: "container",
          children: [{
            id: "default-content",
            type: "container",
            children: [{ id: "default-master-text", type: "text", content: "Default master" }],
          }],
        },
        localChildTargetIds: ["default-content"],
      },
      {
        id: "master-explicit",
        name: "Explicit master",
        root: {
          id: "explicit-root",
          type: "container",
          children: [{
            id: "explicit-content",
            type: "container",
            children: [{ id: "explicit-master-text", type: "text", content: "Explicit master" }],
          }],
        },
        localChildTargetIds: ["explicit-content"],
      },
    ],
    slides: [
      {
        id: "slide-default",
        elements: [],
        localRootChildren: [{
          targetContainerId: "default-content",
          children: [{ id: "default-local-text", type: "text", content: "Default local" }],
        }],
      },
      {
        id: "slide-explicit",
        rootDefinitionId: "master-explicit",
        elements: [],
        localRootChildren: [{
          targetContainerId: "explicit-content",
          children: [{ id: "explicit-local-text", type: "text", content: "Explicit local" }],
        }],
      },
    ],
  });
}

describe("Player Root Definition projection", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders default and explicit masters with local children in order", () => {
    const projection = mountProjectionSurface(root, rootPresentation(), { transition: "none" });
    const first = projection.getCurrentSlide();

    expect(first).toBeDefined();
    expect(first).not.toHaveProperty("rootDefinitionId");
    expect(first).not.toHaveProperty("localRootChildren");
    expect(root.textContent).toContain("Default master");
    expect(root.textContent).toContain("Default local");
    expect(root.textContent!.indexOf("Default master")).toBeLessThan(root.textContent!.indexOf("Default local"));
    expect(root.querySelector('[data-presentation-type="root"]')).toBeNull();

    projection.goTo(1);
    const second = projection.getCurrentSlide();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(root.textContent).toContain("Explicit master");
    expect(root.textContent).toContain("Explicit local");
    expect(root.querySelector('[data-presentation-id="explicit-local-text"]')).not.toBeNull();
    projection.destroy();
  });

  it("reuses the retained effective slide during resize hydration", () => {
    const projection = mountProjectionSurface(root, rootPresentation(), { transition: "none" });
    const retained = projection.getCurrentSlide();
    window.dispatchEvent(new Event("resize"));
    expect(projection.getCurrentSlide()).toBe(retained);
    projection.destroy();
  });
});
