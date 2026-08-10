import type { PowerShowElement } from "@powershow/document-schema";

export type ElementInspectorUpdate = (
  update: (element: PowerShowElement) => PowerShowElement,
) => void;

export interface TypedInspectorProps<
  TElement extends PowerShowElement,
> {
  element: TElement;

  onUpdate: ElementInspectorUpdate;
}
