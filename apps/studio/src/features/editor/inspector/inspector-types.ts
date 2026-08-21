import type {
  ElementStyle,
  FontFaceResource,
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

  onAddFontFace: (family: string, face: FontFaceResource) => void;

  onRemoveFontFace: (fontResourceId: string, faceIndex: number) => void;

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

export interface TopicsAuthoringControls {
  onAddTopLevelTopic: (topicsId: string) => string | null;

  onAddChildTopic: (
    topicsId: string,
    topicItemId: string,
  ) => string | null;
}

export interface TableAuthoringControls {
  onAddColumn: (tableId: string) => void;

  onRemoveColumn: (tableId: string, index: number) => void;

  onAddRow: (tableId: string) => void;

  onRemoveRow: (tableId: string, index: number) => void;

  onShowHeaderChange: (tableId: string, showHeader: boolean) => void;
}
