import type { PowerShowElement } from "@powershow/document-schema";

import {
  findContentSlotById,
  findElementById,
  findElementLocation,
} from "./element-hierarchy";

export type ClipboardPasteDestination =
  | { kind: "slide" }
  | { kind: "container"; id: string }
  | { kind: "content-slot"; id: string };

export function resolveClipboardPasteDestination(
  elements: readonly PowerShowElement[],
  snapshotElementId: string,
  selectedElement: PowerShowElement | null,
  selectedContentSlotId: string | null,
): ClipboardPasteDestination | null {
  if (
    selectedElement?.id === snapshotElementId &&
    findElementById(elements, snapshotElementId) !== null
  ) {
    const location = findElementLocation(elements, snapshotElementId);
    if (location) {
      return location.parentRef.kind === "slide"
        ? { kind: "slide" }
        : location.parentRef.kind === "container"
          ? { kind: "container", id: location.parentRef.id }
          : { kind: "content-slot", id: location.parentRef.id };
    }
  }

  if (
    selectedElement?.type === "container" &&
    findElementById(elements, selectedElement.id)?.type === "container"
  ) {
    return { kind: "container", id: selectedElement.id };
  }

  if (
    selectedContentSlotId !== null &&
    findContentSlotById(elements, selectedContentSlotId) !== null
  ) {
    return { kind: "content-slot", id: selectedContentSlotId };
  }

  return { kind: "slide" };
}
