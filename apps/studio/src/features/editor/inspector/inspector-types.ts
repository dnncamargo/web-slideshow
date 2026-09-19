import type {
  ElementEffect,
  ElementTypography,
  ElementVisualStyle,
  ResizablePositionedLayout,
  SurfaceVisualStyle,
  FontResource,
  Presentation,
  PresentationElement,
} from "@web-slideshow/document-schema";

export type ElementInspectorUpdate = (
  update: (element: PresentationElement) => PresentationElement,
) => void;

export type CreateQrCodeFromLink = (href: string) => void;

export interface PlotPreviewControls {
  onPlay(): void;
  onPause(): void;
  onReset(): void;
}

export type UpdateElementTypography = (
  update: (
    typography: ElementTypography | undefined,
  ) => ElementTypography,
) => void;

export type UpdateElementVisualStyle = (
  update: (
    style: ElementVisualStyle | undefined,
  ) => ElementVisualStyle,
) => void;

export type UpdateElementEffect = (
  update: (effect: ElementEffect | undefined) => ElementEffect,
) => void;

export type UpdateSurfaceStyle = (
  update: (style: SurfaceVisualStyle | undefined) => SurfaceVisualStyle,
) => void;

export type UpdateElementLayout = (
  update: (layout: ResizablePositionedLayout | undefined) => ResizablePositionedLayout | undefined,
) => void;

export interface TypedInspectorProps<
  TElement extends PresentationElement,
> {
  element: TElement;

  onUpdate: ElementInspectorUpdate;
}

export interface TypographyInspectorProps<
  TElement extends PresentationElement,
> extends TypedInspectorProps<TElement> {
  fontResources: readonly FontResource[];

  presentation?: Presentation;
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
