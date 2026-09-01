// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { projectGalleryTargets } from "../src/features/control/presenter/presenter-slide-preview";

function gallery(id: string, itemCount = 3): HTMLDivElement {
  const root = document.createElement("div");
  root.dataset.powershowType = "gallery";
  root.dataset.powershowId = id;
  for (let index = 0; index < itemCount; index += 1) {
    const item = document.createElement("div");
    item.className = index === 0 ? "powershow-gallery-item powershow-gallery-item-active" : "powershow-gallery-item";
    item.dataset.powershowGalleryIndex = String(index);
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

    const projected = arbitrary.querySelectorAll<HTMLElement>(".powershow-gallery-item");
    expect(projected[2]?.classList.contains("powershow-gallery-item-active")).toBe(true);
    expect(projected[2]?.getAttribute("aria-hidden")).toBeNull();
    expect(projected[0]?.style.visibility).toBe("hidden");
    expect(other.querySelectorAll(".powershow-gallery-item")[0]?.classList.contains("powershow-gallery-item-active")).toBe(true);
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

    const firstItems = first.querySelectorAll<HTMLElement>(".powershow-gallery-item");
    const secondItems = second.querySelectorAll<HTMLElement>(".powershow-gallery-item");
    expect(firstItems[1]?.classList.contains("powershow-gallery-item-active")).toBe(true);
    expect(secondItems[0]?.classList.contains("powershow-gallery-item-active")).toBe(true);

    projectGalleryTargets(root, []);
    expect(firstItems[0]?.classList.contains("powershow-gallery-item-active")).toBe(true);
    expect(firstItems[2]?.style.visibility).toBe("hidden");

    projectGalleryTargets(root, [{ elementId: "first", targetIndex: 99 }]);
    expect(firstItems[0]?.classList.contains("powershow-gallery-item-active")).toBe(true);

    projectGalleryTargets(root, [{ elementId: "unknown", targetIndex: 1 }]);
    expect(firstItems[0]?.classList.contains("powershow-gallery-item-active")).toBe(true);
  });
});
