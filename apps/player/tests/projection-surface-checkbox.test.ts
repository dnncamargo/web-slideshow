// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { mountProjectionSurface } from "../src/projection-surface";

function presentation() {
  const topics = (id: string, checkboxId: string) => ({
    id,
    type: "topics" as const,
    hidden: false,
    kind: "checkbox" as const,
    checkboxMode: "three-state" as const,
    items: [{ id: checkboxId, content: { id: `${checkboxId}-content`, children: [] }, children: [] }],
  });
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "checkbox-player",
    title: "Checkbox Player",
    slides: [
      { id: "slide-1", elements: [{ id: "container-1", type: "container", hidden: false, children: [topics("outer", "outer-item"), topics("nested", "nested-item")] }] },
      { id: "slide-2", elements: [topics("second", "second-item")] },
    ],
  });
}

function input(root: HTMLElement, ownerId: string, checkboxId: string): HTMLInputElement | null {
  const owner = Array.from(root.querySelectorAll<HTMLElement>("[data-presentation-id]"))
    .find((candidate) => candidate.dataset.presentationId === ownerId);
  return owner === undefined
    ? null
    : Array.from(owner.querySelectorAll<HTMLInputElement>("input[data-presentation-checkbox='true']"))
      .find((candidate) => candidate.dataset.presentationCheckboxId === checkboxId) ?? null;
}

describe("Player ProjectionSurface Checkbox Control", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("stores off-page absolute state, applies it after rendering, reapplies it, and keeps local divergence local", () => {
    const root = document.body.appendChild(document.createElement("div"));
    const projection = mountProjectionSurface(root, presentation(), { transition: "none" });
    const outer = () => input(root, "outer", "outer-item");

    projection.setCheckboxControlState(0, "slide-2", "second", "second-item", "checked");
    expect(outer()?.checked).toBe(false);

    projection.goTo(1);
    expect(input(root, "second", "second-item")?.checked).toBe(true);
    projection.goTo(0);
    expect(outer()?.checked).toBe(false);

    projection.setCheckboxControlState(0, "slide-1", "outer", "outer-item", "intermediate");
    expect(outer()?.indeterminate).toBe(true);
    outer()?.click();
    expect(outer()?.checked).toBe(true);
    expect(outer()?.indeterminate).toBe(false);

    projection.goTo(1);
    projection.goTo(0);
    expect(outer()?.indeterminate).toBe(true);
    projection.destroy();
  });

  it("replaces same-slot identities and applies unchecked exactly", () => {
    const root = document.body.appendChild(document.createElement("div"));
    const projection = mountProjectionSurface(root, presentation(), { transition: "none" });
    projection.setCheckboxControlState(0, "slide-1", "outer", "outer-item", "checked");
    projection.setCheckboxControlState(0, "slide-1", "nested", "nested-item", "unchecked");
    projection.goTo(1);
    projection.goTo(0);
    expect(input(root, "outer", "outer-item")?.checked).toBe(false);
    expect(input(root, "nested", "nested-item")?.checked).toBe(false);
    projection.destroy();
  });
});
