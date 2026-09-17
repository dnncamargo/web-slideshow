import type { PowerShowElement } from "@powershow/document-schema";

import { findContentSlotById, findElementById } from "./element-hierarchy";
import type { ClipboardSourceParentKind } from "./clipboard-session";

export type ClipboardPasteDestination =
  | { kind: "slide" }
  | { kind: "container"; id: string }
  | { kind: "content-slot"; id: string };

export function resolveClipboardPasteDestination(
  sourceParentKind: ClipboardSourceParentKind,
  elements: readonly PowerShowElement[],
  selectedElement: PowerShowElement | null,
  selectedContentSlotId: string | null,
): ClipboardPasteDestination | null {
  switch (sourceParentKind) {
    case "slide":
      return { kind: "slide" };
    case "container":
      return selectedElement?.type === "container" &&
        findElementById(elements, selectedElement.id)?.type === "container"
        ? { kind: "container", id: selectedElement.id }
        : null;
    case "content-slot":
      return selectedContentSlotId !== null &&
        findContentSlotById(elements, selectedContentSlotId) !== null
        ? { kind: "content-slot", id: selectedContentSlotId }
        : null;
  }
}
