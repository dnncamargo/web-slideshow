import type {
  ElementStyle,
  PowerShowElement,
} from "@powershow/document-schema";

export type ElementInspectorUpdate = (
  update: (element: PowerShowElement) => PowerShowElement,
) => void;

export type UpdateElementStyle = (
  update: (style: ElementStyle | undefined) => ElementStyle,
) => void;

export interface TypedInspectorProps<
  TElement extends PowerShowElement,
> {
  element: TElement;

  onUpdate: ElementInspectorUpdate;
}
