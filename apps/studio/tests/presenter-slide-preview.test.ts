// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  projectCheckboxTargets,
  projectGalleryTargets,
} from "../src/features/control/presenter/presenter-slide-preview";

function gallery(id: string, itemCount = 3): HTMLDivElement {
  const root = document.createElement("div");
  root.dataset.presentationType = "gallery";
  root.dataset.presentationId = id;
  for (let index = 0; index < itemCount; index += 1) {
    const item = document.createElement("div");
    item.className = index === 0 ? "presentation-gallery-item presentation-gallery-item-active" : "presentation-gallery-item";
    item.dataset.presentationGalleryIndex = String(index);
    if (index > 0) {
      item.style.visibility = "hidden";
      item.style.pointerEvents = "none";
      item.setAttribute("aria-hidden", "true");
    }
    root.appendChild(item);
  }
  return root;
}

describe("Presenter Gallery preview projection", () => {
  it("projects valid exact Gallery targets and leaves invalid targets at the renderer default", () => {
    const root = document.createElement("div");
    const arbitrary = gallery("gallery / façade [1]");
    const other = gallery("other");
    root.append(arbitrary, other);

    projectGalleryTargets(root, [
      { elementId: "gallery / façade [1]", targetIndex: 2 },
      { elementId: "other", targetIndex: 9 },
      { elementId: "missing", targetIndex: 1 },
    ]);

    const projected = arbitrary.querySelectorAll<HTMLElement>(".presentation-gallery-item");
    expect(projected[2]?.classList.contains("presentation-gallery-item-active")).toBe(true);
    expect(projected[2]?.getAttribute("aria-hidden")).toBeNull();
    expect(projected[0]?.style.visibility).toBe("hidden");
    expect(other.querySelectorAll(".presentation-gallery-item")[0]?.classList.contains("presentation-gallery-item-active")).toBe(true);
  });

  it("resets previous projections before applying the current target set", () => {
    const root = document.createElement("div");
    const first = gallery("first");
    const second = gallery("second");
    root.append(first, second);

    projectGalleryTargets(root, [
      { elementId: "first", targetIndex: 2 },
      { elementId: "second", targetIndex: 1 },
    ]);
    projectGalleryTargets(root, [{ elementId: "first", targetIndex: 1 }]);

    const firstItems = first.querySelectorAll<HTMLElement>(".presentation-gallery-item");
    const secondItems = second.querySelectorAll<HTMLElement>(".presentation-gallery-item");
    expect(firstItems[1]?.classList.contains("presentation-gallery-item-active")).toBe(true);
    expect(secondItems[0]?.classList.contains("presentation-gallery-item-active")).toBe(true);

    projectGalleryTargets(root, []);
    expect(firstItems[0]?.classList.contains("presentation-gallery-item-active")).toBe(true);
    expect(firstItems[2]?.style.visibility).toBe("hidden");

    projectGalleryTargets(root, [{ elementId: "first", targetIndex: 99 }]);
    expect(firstItems[0]?.classList.contains("presentation-gallery-item-active")).toBe(true);

    projectGalleryTargets(root, [{ elementId: "unknown", targetIndex: 1 }]);
    expect(firstItems[0]?.classList.contains("presentation-gallery-item-active")).toBe(true);
  });
});

function checkboxOwner(id: string, checkboxId: string): HTMLDivElement {
  const owner = document.createElement("div");
  owner.dataset.presentationId = id;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.presentationCheckbox = "true";
  input.dataset.presentationCheckboxId = checkboxId;
  owner.append(input);
  return owner;
}

describe("Presenter Checkbox preview projection", () => {
  it("uses exact owner and checkbox identity, including nested-owner isolation", () => {
    const root = document.createElement("div");
    const outer = checkboxOwner("outer / [1]", "outer-item");
    const nested = checkboxOwner("nested / [1]", "nested-item");
    outer.append(nested);
    root.append(outer);

    projectCheckboxTargets(root, [
      { slot: 0, elementId: "nested / [1]", checkboxId: "nested-item", state: "intermediate" },
      { slot: 1, elementId: "outer / [1]", checkboxId: "outer-item", state: "checked" },
    ]);

    const inputs = root.querySelectorAll<HTMLInputElement>("input");
    expect(inputs[0]?.checked).toBe(true);
    expect(inputs[1]?.indeterminate).toBe(true);
    expect(inputs[0]?.getAttribute("aria-checked")).toBe("true");
    expect(inputs[1]?.getAttribute("aria-checked")).toBe("mixed");
  });

  it("is a safe no-op for missing exact targets", () => {
    const root = document.createElement("div");
    root.append(checkboxOwner("known", "known-item"));
    projectCheckboxTargets(root, [
      { slot: 0, elementId: "missing", checkboxId: "known-item", state: "checked" },
      { slot: 1, elementId: "known", checkboxId: "missing", state: "checked" },
    ]);
    expect(root.querySelector<HTMLInputElement>("input")?.checked).toBe(false);
  });
});
