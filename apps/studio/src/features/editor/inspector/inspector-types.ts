import type {
  ElementStyle,
  FontResource,
  PowerShowElement,
} from "@powershow/document-schema";

export type ElementInspectorUpdate = (
  update: (element: PowerShowElement) => PowerShowElement,
) => void;

export type UpdateElementStyle = (
  update: (style: ElementStyle | undefined) => ElementStyle,
) => void;

export interface FontResourceControls {
  fontResources: readonly FontResource[];

  onAddFontResource: (fontResource: FontResource) => void;

  onRemoveFontResource: (fontResourceId: string) => void;

  isFontFamilyInUse: (family: string) => boolean;
}

export interface TypedInspectorProps<
  TElement extends PowerShowElement,
> {
  element: TElement;

  onUpdate: ElementInspectorUpdate;
}

export interface TypographyInspectorProps<
  TElement extends PowerShowElement,
> extends TypedInspectorProps<TElement> {
  fontResourceControls: FontResourceControls;
}
