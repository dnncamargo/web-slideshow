import type {
  ElementEffect,
  ElementTypography,
  ElementVisualStyle,
  ResizablePositionedLayout,
  SurfaceVisualStyle,
  FontResource,
  PowerShowElement,
} from "@powershow/document-schema";

export type ElementInspectorUpdate = (
  update: (element: PowerShowElement) => PowerShowElement,
) => void;

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
  TElement extends PowerShowElement,
> {
  element: TElement;

  onUpdate: ElementInspectorUpdate;
}

export interface TypographyInspectorProps<
  TElement extends PowerShowElement,
> extends TypedInspectorProps<TElement> {
  fontResources: readonly FontResource[];
}

export interface TopicsAuthoringControls {
  onAddTopLevelTopic: (topicsId: string) => string | null;

  onAddChildTopic: (
    topicsId: string,
    topicItemId: string,
  ) => string | null;
}

/**
 * Blocks authoring controls for the composable Blocks model.
 *
 * Only operations that allocate presentation-wide authoring IDs live
 * here: text/literal edits, category assignment, shape editing, remove,
 * and reorder require no ID allocation and use the Inspector onUpdate
 * path. Each handler returns the freshly created block/part id or null
 * when the target is stale/invalid or creation is refused.
 */
export interface BlocksAuthoringControls {
  onAddRootBlock: (blocksId: string) => string | null;

  onAddScopeChild: (
    blocksId: string,
    scopeBlockId: string,
  ) => string | null;

  onAddTextPart: (
    blocksId: string,
    blockItemId: string,
  ) => string | null;

  onAddSocketPart: (
    blocksId: string,
    blockItemId: string,
  ) => string | null;

  onCreateSocketValue: (
    blocksId: string,
    ownerBlockId: string,
    socketPartId: string,
  ) => string | null;
}

export interface TableAuthoringControls {
  onAddColumn: (tableId: string) => void;

  onRemoveColumn: (tableId: string, index: number) => void;

  onAddRow: (tableId: string) => void;

  onRemoveRow: (tableId: string, index: number) => void;

  onShowHeaderChange: (tableId: string, showHeader: boolean) => void;
}
