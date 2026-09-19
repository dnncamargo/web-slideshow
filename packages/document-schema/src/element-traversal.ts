import type { PresentationElement } from "./elements";
import type { Slide } from "./slide";

/** Visits slide elements in canonical pre-order, recursively entering Containers. */
export function visitSlideElements(
  slide: Slide,
  visit: (element: PresentationElement) => void,
): void {
  function visitElement(element: PresentationElement): void {
    visit(element);

    if (element.type === "container") {
      element.children.forEach(visitElement);
    }
  }

  slide.elements.forEach(visitElement);
}
