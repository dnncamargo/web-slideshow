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

function representativeRootPresentation() {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-runtime-acceptance",
    title: "Root runtime acceptance",
    description: "",
    aspectRatio: "16:9",
    rootDefinitions: [{
      id: "root-a",
      name: "Root Definition A",
      root: {
        id: "root-a-container",
        type: "container",
        children: [
          { id: "root-a-text", type: "text", content: "Master text" },
          { id: "root-a-gallery", type: "gallery", items: [{ src: "/master.png", alt: "Master" }] },
          { id: "root-a-scripted", type: "scripted", title: "Master scripted", html: "", css: "", script: "", ports: [{ id: "action", label: "Action", kind: "action" }] },
          { id: "root-a-receiver", type: "container", children: [] },
        ],
      },
      localChildTargetIds: ["root-a-receiver"],
    }],
    slides: [
      { id: "slide-ordinary", elements: [{ id: "ordinary-text", type: "text", content: "Ordinary" }] },
      {
        id: "slide-root-a",
        rootDefinitionId: "root-a",
        elements: [],
        localRootChildren: [{
          targetContainerId: "root-a-receiver",
          children: [
            { id: "local-text", type: "text", content: "Local text" },
            { id: "local-gallery", type: "gallery", items: [{ src: "/local.png", alt: "Local" }] },
            { id: "local-scripted", type: "scripted", title: "Local scripted", html: "", css: "", script: "", ports: [{ id: "action", label: "Action", kind: "action" }] },
          ],
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

  it("projects the canonical Root-backed slide into an effective runtime Slide", () => {
    const presentation = representativeRootPresentation();
    const before = structuredClone(presentation);
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });

    projection.goTo(1);
    const effective = projection.getCurrentSlide();

    expect(effective).toBeDefined();
    expect(effective).not.toHaveProperty("rootDefinitionId");
    expect(effective).not.toHaveProperty("localRootChildren");
    expect(effective?.elements).toHaveLength(1);
    expect(root.querySelector('[data-presentation-id="root-a-text"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-id="root-a-gallery"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-id="root-a-scripted"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-id="local-text"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-id="local-gallery"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-id="local-scripted"]')).not.toBeNull();
    expect(root.textContent).toContain("Master text");
    expect(root.textContent).toContain("Local text");
    expect(root.textContent!.indexOf("Master text")).toBeLessThan(root.textContent!.indexOf("Local text"));
    expect(presentation).toEqual(before);
    expect(presentation.slides[1]).toMatchObject({ rootDefinitionId: "root-a", elements: [] });
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
