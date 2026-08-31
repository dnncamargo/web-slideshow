import type { PowerShowElement } from "./elements";
import type { Slide } from "./slide";

/** Visits slide elements in canonical pre-order, recursively entering Containers. */
export function visitSlideElements(
  slide: Slide,
  visit: (element: PowerShowElement) => void,
): void {
  function visitElement(element: PowerShowElement): void {
    visit(element);

    if (element.type === "container") {
      element.children.forEach(visitElement);
    }
  }

  slide.elements.forEach(visitElement);
}
