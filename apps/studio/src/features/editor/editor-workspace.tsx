"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { CSSProperties } from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

import {
  disposeRendererRuntime,
  getPlotAnimationController,
  hydrateRendererRuntime,
  paletteColorCssVariableName,
  renderFontResources,
  renderSlide,
  fitLogicalSlideGeometry,
  resolveLogicalSlideSize,
  type PlotAnimationController,
  type FittedSlideGeometry,
} from "@web-slideshow/renderer";
import {
  Button,
  HoverScrollText,
  Separator,
  Status,
  Topbar,
  TopbarActions,
  TopbarLocale,
  TopbarTitle,
} from "@web-slideshow/ui";

import {
  PresentationSchema,
  materializeSlide,
  addPresentationPaletteColor as addPaletteEntry,
  removePresentationPaletteColor as removePaletteEntry,
  renamePresentationPaletteColor as renamePaletteEntry,
  updatePresentationPaletteColorValue,
  resolveLinkedContainerStyle,
  type Color,
  type ColorValue,
  type ContainerLayout,
  type ElementEffect,
  type ElementTypography,
  type LinkedContainerStyle,
  type LinkedContainerStyleVisual,
  type LinkedTopicsStyle,
} from "@web-slideshow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";
import type { CustomLibraryRepository } from "@/features/custom-library/custom-library-repository";
import type { CustomLibraryItemDraft } from "@/features/custom-library/custom-library-item";
import type { CustomLibraryApplyOutcome } from "@/features/custom-library/custom-library-apply-picker";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type { CustomLibraryPaletteRepository } from "@/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryPaletteAddOutcome } from "@/features/custom-library/custom-library-palette-add-picker";
import { addCustomLibraryPaletteToPresentation } from "@/features/custom-library/custom-library-palette-apply";
import type { CustomLibraryFontDraft } from "@/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "@/features/custom-library/custom-library-font-repository";
import { addCustomLibraryFontToPresentation } from "@/features/custom-library/custom-library-font-apply";
import {
  applyCustomLibraryItemToPresentation,
  type CustomLibraryElementOwner,
} from "@/features/custom-library/custom-library-item-apply";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { LocaleSelector } from "@/features/i18n/locale-selector";
import { DangerConfirmDialog } from "@/features/app/danger-confirm-dialog";
import { ProductSurfaceBrand } from "@/features/app/product-surface-brand";

import { ElementInspector } from "./element-inspector";
import { AuthoringHistoryContext, type AuthoringHistoryContextValue } from "./authoring-history-context";
import { ElementTreePanel } from "./element-tree-panel";
import { ClipboardPanel, HistoryPanel } from "./clipboard-panel";
import {
  addClipboardEntry,
  clearDisposableClipboardEntries,
  createPendingClipboardCut,
  createClipboardEntry,
  EMPTY_CLIPBOARD_SESSION,
  pinClipboardEntry,
  removeClipboardEntry,
  unpinClipboardEntry,
  type ClipboardSessionState,
  type PendingClipboardCut,
} from "./clipboard-session";
import {
  EDITOR_AUTOSAVE_DELAY_MS,
  editorSaveReducer,
  isAutosaveEligible,
  isSaveEnabled,
  resolveSaveStatus,
  resolveWorkspaceSaveStatus,
} from "./editor-save-state";
import {
  createInitialEditorPublishState,
  editorPublishReducer,
  isPublishEnabled,
  resolvePublishButtonLabelStatus,
} from "./editor-publish-state";
import type { PresentationNotesRepository } from "@/features/persistence/presentation-notes-repository";
import { SlideNotesWorkspace } from "./notes/slide-notes-workspace";
import { useEditorNotes } from "./notes/use-editor-notes";
import { CustomResourcesWorkspace } from "./resources/custom-resources-workspace";
import {
  resolveCanvasEmbedPointerTarget,
  resolveCanvasPointerHit,
  resolveCanvasPointerSelection,
} from "./canvas-pointer-selection-helpers";
import { isAuthoredPresentationLink } from "./canvas-link-interception";
import {
  isInsideContainerFitSurface,
  measureContainerFitSourceSize,
  updateContainerFit,
  type ContainerFitMode,
} from "./container-fit-authoring";
import {
  getEffectiveImageFocalPoint,
  getImageFocalPointFromClientPosition,
  type ImageFocalPoint,
} from "./inspector/sections/image-focal-point-helpers";
import {
  areImageCropsEqual,
  normalizeCropCanvasValue,
  resolveCropCanvasRect,
  resolveSourcePreviewBounds,
  resolveCropPointerValue,
  type CropCanvasBounds,
  type CropCanvasHandle,
  type CropCanvasOperation,
} from "./crop-canvas-geometry";
import { getEffectiveImageCrop } from "./inspector/sections/image-crop-helpers";
import {
  buildCanvasSnapCandidates,
  resolveCanvasAxisSnap,
  type CanvasBounds,
  type CanvasSnapCandidate,
  type CanvasSnapGuide,
} from "./canvas-snap-helpers";
import {
  CANVAS_IMAGE_CORNER_DIRECTIONS,
  DEFAULT_IMAGE_PROPORTION_PRESERVED,
  getCanvasResizeCursor,
  getCanvasResizeDeltas,
  isCanvasResizable,
  resolveProportionalResize,
  toLogicalCanvasResizeDelta,
  type CanvasResizeDirection,
} from "./canvas-resize-helpers";
import {
  getContainerCanvasResizeDirections,
  isContainerCanvasDraggable,
  updateContainerForCanvasDrag,
  updateContainerForCanvasResize,
  type ContainerCanvasDragGeometry,
  type ContainerCanvasResizeGeometry,
} from "./container-canvas-geometry";
import {
  updateCanonicalTextForCanvasDrag,
  updateCanonicalImageForCanvasDrag,
  updateCanonicalSurfaceForCanvasDrag,
  updateCanonicalElementForCanvasDrag,
  updateImageForCanvasResize,
  updateSurfaceForCanvasResize,
  type CanonicalTextCanvasGeometry,
} from "./canonical-text-canvas-geometry";

import { editorDemoPresentation } from "./editor-demo-presentation";

import { findElementById, updateElementById } from "./element-tree";
import { findAncestorContainers, findElementLocation, visitElements, type ElementParentRef } from "./element-hierarchy";
import { getElementLabel } from "./element-tree-helpers";
import { createTextStyleFromText, detachTextStyle } from "./text-typography-authoring";

import { presentationUsesFontFamily } from "./font-resource-helpers";
import { addCustomTextStyle, areTextStyleDefinitionsEqualForAuthoring, ensureStructuredTableTextStyles, ensureTopicsTextStyle, findTextStyleUsageLocations, isTextStyleUsed, listPresentationTextStyles, propagateTextStyleDefinitionChanges, removeUnusedCustomTextStyle, resetFundamentalTextStyleOverride, updateCustomTextStyle, upsertFundamentalTextStyleOverride, type TextStyleUsageLocation } from "./text-style-helpers";
import type { TextStyleLayoutProperties, TextStyleRole, TextStyleVisualProperties, TextStyleTypographyProperties } from "@web-slideshow/document-schema";
import { parseAuthoringLength } from "@web-slideshow/theme/element-style-defaults";
import { PresentationColorPaletteProvider } from "./inspector/sections/presentation-color-palette";
import { PickedColorsProvider } from "./inspector/sections/picked-colors-provider";
import { addPickedColor, removePickedColor } from "./inspector/sections/picked-colors-helpers";
import {
  attachLinkedContainerStyleToElement,
  detachLinkedContainerStyleFromElement,
  attachLinkedTopicsStyleToElement,
  detachLinkedTopicsStyleFromElement,
  createLinkedStyleFromContainerElement,
  createLinkedStyleFromTopicsElement,
  canCreateLinkedStyleFromContainer,
  canCreateLinkedStyleFromTopics,
  attachLinkedCodeStyleToElement,
  attachLinkedTerminalStyleToElement,
  attachLinkedTableStyleToElement,
  attachLinkedDividerStyleToElement,
  detachLinkedCodeStyleFromElement,
  detachLinkedTerminalStyleFromElement,
  detachLinkedTableStyleFromElement,
  detachLinkedDividerStyleFromElement,
  canCreateLinkedStyleFromCode,
  canCreateLinkedStyleFromTerminal,
  canCreateLinkedStyleFromSimpleTable,
  canCreateLinkedStyleFromStructuredTable,
  canCreateLinkedStyleFromDivider,
  createLinkedStyleFromCodeElement,
  createLinkedStyleFromTerminalElement,
  createLinkedStyleFromSimpleTableElement,
  createLinkedStyleFromStructuredTableElement,
  createLinkedStyleFromDividerElement,
  updateLinkedTopicsStyle,
  updateLinkedStyle,
  renameLinkedStyle,
  removeUnusedLinkedStyle,
  clearLinkedContainerStyleProperty,
  clearLinkedTopicsStyleProperty,
  type LinkedTopicsStyleProperty,
} from "./linked-style-authoring";
import { attachLinkedStyleToMatchingContainers, type LinkedStyleContainerLocation, type LinkedStyleUsageLocation } from "./linked-style-bulk-authoring";
import { createLinkedStyleWithProperty, LINKED_STYLE_PROPERTY_ORDER, type LinkedStyleAuthorableProperty, type LinkedStyleProperty } from "./linked-style-property-authoring";
import { updatePresentationAuthoringTrees } from "./presentation-authoring-trees";

// ============================================================
// BEGIN: SLIDE OPERATIONS
// ============================================================

import {
  createSlideFromPreset,
  duplicateSlideWithUniqueIds,
  moveSlide,
} from "./slide-operations";

import type { SlideLayoutPreset } from "./slide-operations";
import {
  createRootDefinitionFromPreset,
  deleteRootDefinition,
  getSlideRootDefinitionAssignmentBlocker,
  renameRootDefinition,
  setSlideRootDefinition,
  type RootDefinitionLifecycleFailure,
} from "./root-definition-lifecycle";

// ============================================================
// END: SLIDE OPERATIONS
// ============================================================

// ============================================================
// BEGIN: ELEMENT CRUD
// ============================================================

import { ElementCrudControls } from "./element-crud-controls";
import { ContainerDeletionDialog } from "./container-deletion-dialog";

// ============================================================
// BEGIN: ELEMENT OPERATIONS
// ============================================================

import {
  appendElementToContainer,
  appendElementToContentSlot,
  addColumnToStructuredTable,
  addRowToStructuredTable,
  createDefaultTopicItem,
  createElement,
  attachImageToGallery,
  detachGalleryItemToImage,
  duplicateElement,
  findElementSiblingPosition,
  insertElementAfterId,
  moveElement,
  moveElementToSiblingIndexById,
  moveColumnInStructuredTable,
  moveRowInStructuredTable,
  reorderGalleryItem,
  removeColumnFromStructuredTable,
  removeElementById,
  unwrapContainerPreservingChildren,
  removeRowFromStructuredTable,
  setStructuredTableShowHeader,
  appendTopicItemToTopics,
  appendChildTopicItemToTopics,
  indentTopicItem,
  moveTopicItemToSiblingIndex,
  outdentTopicItem,
  resolveAddElementDestination,
} from "./element-operations";
import {
  moveClipboardElementInElements,
  resolveClipboardPasteDestination,
} from "./clipboard-operations";

import type { PlotPreviewControls, TableAuthoringControls } from "./inspector/inspector-types";
import type { TableStructuralSelection } from "./table-tree-helpers";
import { createQrImageElement } from "./qr-image-authoring";
import { collectPresentationAuthoringIds } from "./presentation-authoring-trees";
import { useChromeOsNativeSelectCompat } from "../app/chrome-os-native-select-compat";
import {
  beginHistoryTransaction,
  applyUntrackedHistoryUpdate,
  cancelHistoryTransaction,
  commitHistory,
  commitHistoryTransaction,
  createHistoryState,
  redoHistory,
  resetHistory,
  undoHistory,
  updateHistoryTransaction,
  type EditorHistoryState,
  type HistoryActionMeta,
} from "./editor-history-state";
import { reconcileSelectedElementAfterReplay } from "./editor-history-selection-reconciliation";
import {
  isRootDefinitionTarget,
  isProtectedRootContainer,
  replaceAuthoringElements,
  resolveAuthoringElements,
  resolveAuthoringTarget,
  resolveCanonicalRootContainerId,
  updateAuthoringElements,
  type AuthoringTarget,
} from "./authoring-target";
import { setRootDefinitionLocalChildTarget } from "./root-definition-lifecycle";
import {
  isAuthorizedLocalRootReceiver,
  findLocalRootChildOwner,
  resolveOwnedAuthoringTree,
  replaceOwnedAuthoringTree,
  updateOwnedAuthoringTree,
  updateLocalRootChildren,
  updateLocalRootElement,
} from "./slide-local-root-authoring";

// ============================================================
// END: ELEMENT OPERATIONS
// ============================================================

import type { ElementCreateType } from "./element-operations";

// ============================================================
// END: ELEMENT CRUD
// ============================================================

import styles from "./editor-workspace.module.css";

// ============================================================
// BEGIN: TIPOS DO DOCUMENTO
// ============================================================

import type {
  GalleryElement,
  PresentationElement,
  Presentation,
  Slide,
} from "@web-slideshow/document-schema";

// ============================================================
// END: TIPOS DO DOCUMENTO
// ============================================================

// ============================================================
// BEGIN: SLIDE LAYOUT PICKER
// ============================================================

import { SlideLayoutPicker } from "./slide-layout-picker";
import { updatePresentationTitle } from "./presentation-title";

type RootLocalContentTargetError = {
  rootDefinitionId: string;
  containerId: string;
  reason: RootDefinitionLifecycleFailure;
};

// ============================================================
// END: SLIDE LAYOUT PICKER
// ============================================================

// ============================================================
// BEGIN: TIPOS DO EDITOR
// ============================================================

interface SelectedElementInfo {
  id: string;
  type: string;

  /**
   * Transient insertion context: the canonical ContentSlot id of the
   * TopicItem whose content area was clicked on the canvas. Not a selection
   * of TopicItem/ContentSlot as PresentationElements.
   */
  contentSlotId?: string | null;
}

function isRootDefinitionGenericInspectorElement(element: PresentationElement): boolean {
  return element.type === "container"
    || element.type === "text"
    || element.type === "image"
    || element.type === "gallery"
    || element.type === "code"
    || element.type === "plot"
    || element.type === "terminal"
    || element.type === "divider"
    || element.type === "embed"
    || element.type === "scripted"
    || element.type === "blocks"
    || element.type === "topics"
    || element.type === "table";
}

type EditorPanelView = "inspector" | "elements" | "clipboard" | "history";

interface GalleryItemSelection {
  galleryId: string;
  itemIndex: number;
}

type ImageMediaAuthoringTarget =
  | { kind: "image"; elementId: string }
  | { kind: "gallery-item"; galleryId: string; itemIndex: number };

type OwnedImageMediaAuthoringTarget = {
  authoringTarget: AuthoringTarget;
  mediaTarget: ImageMediaAuthoringTarget;
};

type GalleryItem = GalleryElement["items"][number];
type ImageMediaValue = Extract<PresentationElement, { type: "image" }> | GalleryItem;

function areImageMediaTargetsEqual(
  left: OwnedImageMediaAuthoringTarget | null,
  right: OwnedImageMediaAuthoringTarget | null,
): boolean {
  if (!left || !right) return left === right;
  if (!areAuthoringTargetsEqual(left.authoringTarget, right.authoringTarget)) return false;
  const leftMedia = left.mediaTarget;
  const rightMedia = right.mediaTarget;
  if (leftMedia.kind !== rightMedia.kind) return false;
  return leftMedia.kind === "image"
    ? leftMedia.elementId === (rightMedia.kind === "image" ? rightMedia.elementId : "")
    : rightMedia.kind === "gallery-item" && leftMedia.galleryId === rightMedia.galleryId && leftMedia.itemIndex === rightMedia.itemIndex;
}

function imageMediaTargetKey(target: OwnedImageMediaAuthoringTarget): string {
  const ownerKey = target.authoringTarget.kind === "slide"
    ? `slide:${target.authoringTarget.slideIndex}`
    : `root-definition:${target.authoringTarget.rootDefinitionId}`;
  const mediaKey = target.mediaTarget.kind === "image"
    ? `image:${target.mediaTarget.elementId}`
    : `gallery-item:${target.mediaTarget.galleryId}:${target.mediaTarget.itemIndex}`;
  return `${ownerKey}:${mediaKey}`;
}

function areLinkedStyleColorValuesEqual(
  left: ColorValue | undefined,
  right: ColorValue | undefined,
): boolean {
  if (typeof left === "string" || typeof right === "string") return left === right;
  if (left === undefined || right === undefined) return left === right;
  return left.kind === right.kind && left.kind === "palette" && left.colorId === right.colorId;
}

function areLinkedStyleGradientValuesEqual(
  left: NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["gradient"]> | undefined,
  right: NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["gradient"]> | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.type !== right.type) return false;
  if (left.type === "linear" && right.type === "linear" && left.angle !== right.angle) return false;
  if (left.type === "radial" && right.type === "radial" && left.shape !== right.shape) return false;
  if (left.stops.length !== right.stops.length) return false;
  return left.stops.every((stop, index) => {
    const other = right.stops[index];
    return other !== undefined
      && stop.position === other.position
      && areLinkedStyleColorValuesEqual(stop.color, other.color);
  });
}

function areLinkedStyleBorderValuesEqual(
  left: NonNullable<LinkedContainerStyleVisual["border"]> | undefined,
  right: NonNullable<LinkedContainerStyleVisual["border"]> | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.width === right.width
    && left.style === right.style
    && areLinkedStyleColorValuesEqual(left.color, right.color)
    && areLinkedStyleGradientValuesEqual(left.gradient, right.gradient);
}

function areLinkedStylePatternValuesEqual(
  left: NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["pattern"]> | undefined,
  right: NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["pattern"]> | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.image === right.image
    && left.size === right.size
    && left.position === right.position
    && left.repeat === right.repeat
    && left.opacity === right.opacity;
}

function areLinkedStyleShadowValuesEqual(
  left: NonNullable<ElementEffect["shadow"]> | undefined,
  right: NonNullable<ElementEffect["shadow"]> | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.x === right.x
    && left.y === right.y
    && left.blur === right.blur
    && left.spread === right.spread
    && left.inset === right.inset
    && areLinkedStyleColorValuesEqual(left.color, right.color);
}

function areLinkedStyleTypographyValuesEqual(
  left: ElementTypography | undefined,
  right: ElementTypography | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  const fields = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "textAlign", "lineHeight",
    "letterSpacing", "textTransform", "whiteSpace", "textWrapStyle", "overflowWrap",
    "textDecorationLine",
  ] as const;
  return fields.every((field) => left[field] === right[field])
    && areLinkedStyleColorValuesEqual(left.textDecorationColor, right.textDecorationColor)
    && (left.textStroke === undefined || right.textStroke === undefined
      ? left.textStroke === right.textStroke
      : left.textStroke.width === right.textStroke.width
        && areLinkedStyleColorValuesEqual(left.textStroke.color, right.textStroke.color));
}

function areLinkedStyleLayoutValuesEqual(
  left: ContainerLayout | undefined,
  right: ContainerLayout | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  const fields = [
    "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "margin",
    "marginTop", "marginRight", "marginBottom", "marginLeft", "padding", "paddingTop",
    "paddingRight", "paddingBottom", "paddingLeft", "overflow", "position", "top", "right",
    "bottom", "left", "flexShrink",
  ] as const;
  if (!fields.every((field) => left[field] === right[field])) return false;
  if (left.children === undefined || right.children === undefined) return left.children === right.children;
  const childFields = ["mode", "direction", "gap", "distribution", "horizontalAlign", "verticalAlign"] as const;
  if (!childFields.every((field) => left.children?.[field] === right.children?.[field])) return false;
  if (left.children.fit === undefined || right.children.fit === undefined) return left.children.fit === right.children.fit;
  return left.children.fit.mode === right.children.fit.mode
    && left.children.fit.sourceWidth === right.children.fit.sourceWidth
    && left.children.fit.sourceHeight === right.children.fit.sourceHeight;
}

function areLinkedStyleVisualValuesEqual(
  left: LinkedContainerStyleVisual | undefined,
  right: LinkedContainerStyleVisual | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (!areLinkedStyleColorValuesEqual(left.color, right.color) || left.borderRadius !== right.borderRadius) return false;
  if (left.background === undefined || right.background === undefined) {
    return left.background === right.background && areLinkedStyleBorderValuesEqual(left.border, right.border);
  }
  return areLinkedStyleColorValuesEqual(left.background.color, right.background.color)
    && areLinkedStyleGradientValuesEqual(left.background.gradient, right.background.gradient)
    && areLinkedStylePatternValuesEqual(left.background.pattern, right.background.pattern)
    && areLinkedStyleBorderValuesEqual(left.border, right.border);
}

function areLinkedStyleEffectValuesEqual(
  left: ElementEffect | undefined,
  right: ElementEffect | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.opacity === right.opacity && areLinkedStyleShadowValuesEqual(left.shadow, right.shadow);
}

function areLinkedContainerStyleDefinitionsEqual(
  left: LinkedContainerStyle | undefined,
  right: LinkedContainerStyle | undefined,
): boolean {
  return left !== undefined && right !== undefined
    && left.id === right.id
    && left.name === right.name
    && areLinkedStyleLayoutValuesEqual(left.layout, right.layout)
    && areLinkedStyleVisualValuesEqual(left.style, right.style)
    && areLinkedStyleTypographyValuesEqual(left.typography, right.typography)
    && areLinkedStyleEffectValuesEqual(left.effect, right.effect);
}

function getLinkedContainerStylePropertyValue(style: LinkedContainerStyle | undefined, property: LinkedStyleProperty): unknown {
  switch (property) {
    case "layoutMode": return style?.layout?.children?.mode;
    case "direction": return style?.layout?.children?.direction;
    case "gap": return style?.layout?.children?.gap;
    case "distribution": return style?.layout?.children?.distribution;
    case "horizontalAlign": return style?.layout?.children?.horizontalAlign;
    case "verticalAlign": return style?.layout?.children?.verticalAlign;
    case "overflow": return style?.layout?.overflow;
    case "fit": return undefined;
    case "position": return style?.layout?.position;
    case "top": return style?.layout?.top;
    case "right": return style?.layout?.right;
    case "bottom": return style?.layout?.bottom;
    case "left": return style?.layout?.left;
    case "width": return style?.layout?.width;
    case "height": return style?.layout?.height;
    case "preserveSize": return style?.layout?.flexShrink;
    case "padding": return style?.layout?.padding;
    case "paddingTop": return style?.layout?.paddingTop;
    case "paddingRight": return style?.layout?.paddingRight;
    case "paddingBottom": return style?.layout?.paddingBottom;
    case "paddingLeft": return style?.layout?.paddingLeft;
    case "margin": return style?.layout?.margin;
    case "marginTop": return style?.layout?.marginTop;
    case "marginRight": return style?.layout?.marginRight;
    case "marginBottom": return style?.layout?.marginBottom;
    case "marginLeft": return style?.layout?.marginLeft;
    case "color": return style?.style?.color;
    case "backgroundColor": return style?.style?.background?.color;
    case "gradient": return style?.style?.background?.gradient;
    case "pattern": return style?.style?.background?.pattern;
    case "border": return style?.style?.border;
    case "borderRadius": return style?.style?.borderRadius;
    case "opacity": return style?.effect?.opacity;
    case "shadow": return style?.effect?.shadow;
  }
}

function areLinkedContainerStylePropertyValuesEqual(
  property: LinkedStyleProperty,
  left: unknown,
  right: unknown,
): boolean {
  if (property === "color" || property === "backgroundColor") {
    return areLinkedStyleColorValuesEqual(left as ColorValue | undefined, right as ColorValue | undefined);
  }
  if (property === "gradient") {
    return areLinkedStyleGradientValuesEqual(left as NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["gradient"]> | undefined, right as NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["gradient"]> | undefined);
  }
  if (property === "pattern") {
    return areLinkedStylePatternValuesEqual(left as NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["pattern"]> | undefined, right as NonNullable<NonNullable<LinkedContainerStyleVisual["background"]>["pattern"]> | undefined);
  }
  if (property === "border") {
    return areLinkedStyleBorderValuesEqual(left as NonNullable<LinkedContainerStyleVisual["border"]> | undefined, right as NonNullable<LinkedContainerStyleVisual["border"]> | undefined);
  }
  if (property === "shadow") {
    return areLinkedStyleShadowValuesEqual(left as NonNullable<ElementEffect["shadow"]> | undefined, right as NonNullable<ElementEffect["shadow"]> | undefined);
  }
  return Object.is(left, right);
}

function changedLinkedContainerStyleProperties(
  before: LinkedContainerStyle | undefined,
  after: LinkedContainerStyle | undefined,
): Exclude<LinkedStyleProperty, "fit">[] {
  return LINKED_STYLE_PROPERTY_ORDER
    .filter((property): property is Exclude<LinkedStyleProperty, "fit"> => property !== "fit")
    .filter((property) => !areLinkedContainerStylePropertyValuesEqual(
      property,
      getLinkedContainerStylePropertyValue(before, property),
      getLinkedContainerStylePropertyValue(after, property),
    ));
}

function updateCanonicalElements(
  presentation: ReturnType<typeof PresentationSchema.parse>,
  matches: (element: PresentationElement) => boolean,
  update: (element: PresentationElement) => PresentationElement,
): ReturnType<typeof PresentationSchema.parse> {
  return updatePresentationAuthoringTrees(presentation, (elements) => {
    const matchingIds: string[] = [];
    visitElements(elements, (element) => {
      if (matches(element)) matchingIds.push(element.id);
    });
    return matchingIds.reduce(
      (current, id) => updateElementById(current, id, update),
      elements as PresentationElement[],
    );
  });
}

function propagateLinkedContainerStyleDefinitionChanges(
  presentation: ReturnType<typeof PresentationSchema.parse>,
  linkedStyleId: string,
  before: LinkedContainerStyle | undefined,
  after: LinkedContainerStyle | undefined,
): ReturnType<typeof PresentationSchema.parse> {
  const changedProperties = changedLinkedContainerStyleProperties(before, after);
  if (changedProperties.length === 0) return presentation;
  return updateCanonicalElements(
    presentation,
    (element) => element.type === "container" && element.linkedStyleId === linkedStyleId,
    (element) => element.type !== "container"
      ? element
      : changedProperties.reduce((current, property) => clearLinkedContainerStyleProperty(current, property), element),
  );
}

function areLinkedTopicsStyleColorsEqual(
  left: ColorValue | undefined,
  right: ColorValue | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (typeof left === "string" || typeof right === "string") return left === right;
  return left.kind === right.kind && left.colorId === right.colorId;
}

function areLinkedTopicsStyleLayoutsEqual(
  left: LinkedTopicsStyle["layout"],
  right: LinkedTopicsStyle["layout"],
): boolean {
  return left?.position === right?.position
    && left?.top === right?.top
    && left?.right === right?.right
    && left?.bottom === right?.bottom
    && left?.left === right?.left
    && left?.margin === right?.margin
    && left?.marginTop === right?.marginTop
    && left?.marginRight === right?.marginRight
    && left?.marginBottom === right?.marginBottom
    && left?.marginLeft === right?.marginLeft;
}

function areLinkedTopicsStyleDefinitionsEqual(
  left: LinkedTopicsStyle | undefined,
  right: LinkedTopicsStyle | undefined,
): boolean {
  return left !== undefined && right !== undefined
    && left.target === right.target
    && left.id === right.id
    && left.name === right.name
    && left.kind === right.kind
    && areLinkedTopicsStyleLayoutsEqual(left.layout, right.layout)
    && left.rootMarkerStyle === right.rootMarkerStyle
    && areLinkedTopicsStyleColorsEqual(left.markerColor, right.markerColor)
    && left.itemGap === right.itemGap;
}

const LINKED_TOPICS_MASTER_PROPERTY_ORDER = ["margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "itemGap", "kind", "rootMarkerStyle", "markerColor"] as const satisfies readonly LinkedTopicsStyleProperty[];

function getLinkedTopicsStylePropertyValue(style: LinkedTopicsStyle | undefined, property: (typeof LINKED_TOPICS_MASTER_PROPERTY_ORDER)[number]): unknown {
  if (style === undefined) return undefined;
  if (property === "kind" || property === "rootMarkerStyle" || property === "markerColor" || property === "itemGap") return style[property];
  return style.layout?.[property];
}

function areLinkedTopicsStylePropertyValuesEqual(
  property: (typeof LINKED_TOPICS_MASTER_PROPERTY_ORDER)[number],
  left: unknown,
  right: unknown,
): boolean {
  if (property === "markerColor") return areLinkedTopicsStyleColorsEqual(left as ColorValue | undefined, right as ColorValue | undefined);
  if (property === "margin" || property === "marginTop" || property === "marginRight" || property === "marginBottom" || property === "marginLeft") {
    if (left === undefined || right === undefined) return left === right;
    const leftLength = parseAuthoringLength(left as number | string);
    const rightLength = parseAuthoringLength(right as number | string);
    if (leftLength !== undefined && rightLength !== undefined) return leftLength.value === rightLength.value && leftLength.unit === rightLength.unit;
  }
  return Object.is(left, right);
}

function changedLinkedTopicsStyleProperties(
  before: LinkedTopicsStyle | undefined,
  after: LinkedTopicsStyle | undefined,
): (typeof LINKED_TOPICS_MASTER_PROPERTY_ORDER)[number][] {
  return LINKED_TOPICS_MASTER_PROPERTY_ORDER.filter((property) => !areLinkedTopicsStylePropertyValuesEqual(
    property,
    getLinkedTopicsStylePropertyValue(before, property),
    getLinkedTopicsStylePropertyValue(after, property),
  ));
}

function propagateLinkedTopicsStyleDefinitionChanges(
  presentation: ReturnType<typeof PresentationSchema.parse>,
  linkedStyleId: string,
  before: LinkedTopicsStyle | undefined,
  after: LinkedTopicsStyle | undefined,
): ReturnType<typeof PresentationSchema.parse> {
  const changedProperties = changedLinkedTopicsStyleProperties(before, after);
  if (changedProperties.length === 0) return presentation;
  return updateCanonicalElements(
    presentation,
    (element) => element.type === "topics" && element.linkedStyleId === linkedStyleId,
    (element) => element.type !== "topics"
      ? element
      : changedProperties.reduce((current, property) => clearLinkedTopicsStyleProperty(current, property), element),
  );
}

function findCanvasElementById(canvas: HTMLElement, id: string): HTMLElement | null {
  return Array.from(canvas.querySelectorAll<HTMLElement>("[data-presentation-id]"))
    .find((candidate) => candidate.dataset.presentationId === id) ?? null;
}

function findCanvasGalleryItem(
  canvas: HTMLElement,
  galleryId: string,
  itemIndex: number,
): HTMLElement | null {
  const gallery = Array.from(
    canvas.querySelectorAll<HTMLElement>("[data-presentation-id][data-presentation-type]"),
  ).find(
    (candidate) =>
      candidate.dataset.presentationType === "gallery" &&
      candidate.dataset.presentationId === galleryId,
  );
  if (!gallery) return null;
  return Array.from(
    gallery.querySelectorAll<HTMLElement>("[data-presentation-gallery-index]"),
  ).find((candidate) => Number(candidate.dataset.presentationGalleryIndex) === itemIndex) ?? null;
}

type AuthoredContainerFit = {
  mode: ContainerFitMode;
  sourceWidth: number;
  sourceHeight: number;
};

function areAuthoredContainerFitsEqual(
  left: AuthoredContainerFit | undefined,
  right: AuthoredContainerFit | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.mode === right.mode &&
    left.sourceWidth === right.sourceWidth &&
    left.sourceHeight === right.sourceHeight;
}

interface PendingElementDeletion {
  target: AuthoringTarget;
  elementId: string;
  elementType: PresentationElement["type"];
}

interface PendingQrSelection {
  target: AuthoringTarget;
  sourceElementId: string;
  qrElementId: string;
  qrSource: string;
  beforePresentation: Presentation;
}

interface PendingResourceSelection {
  target: AuthoringTarget;
  elementId: string;
  elementType: "text" | "container";
  styleId: string;
}

function areAuthoringTargetsEqual(
  left: AuthoringTarget,
  right: AuthoringTarget,
): boolean {
  if (left.kind !== right.kind) return false;
  return left.kind === "slide"
    ? left.slideIndex === (right as Extract<AuthoringTarget, { kind: "slide" }>).slideIndex
    : left.rootDefinitionId === (right as Extract<AuthoringTarget, { kind: "root-definition" }>).rootDefinitionId;
}

interface PendingStyleDetach {
  kind: "text-style" | "linked-style";
  styleId: string;
  styleName: string;
  target: AuthoringTarget;
  elementId: string;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.matches("input, textarea, select, [contenteditable]") ||
    target.closest("[contenteditable]") !== null
  );
}

interface CanvasDragState {
  pointerId: number;
  authoringTarget: AuthoringTarget;
  elementId: string;
  elementType: PresentationElement["type"];
  target: HTMLElement;
  initialTranslate: string;
  startClientX: number;
  startClientY: number;
  parentWidthPx: number;
  parentHeightPx: number;
  scaleX: number;
  scaleY: number;
  containerGeometry?: ContainerCanvasDragGeometry;
  canonicalTextGeometry?: CanonicalTextCanvasGeometry;
  deltaX: number;
  deltaY: number;
  initialBounds: CanvasBounds;
  candidates: CanvasSnapCandidate[];
  guideBounds: CanvasBounds;
}

interface CanvasResizeOverlay {
  elementId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CanvasResizeState {
  pointerId: number;
  authoringTarget: AuthoringTarget;
  elementId: string;
  elementType: PresentationElement["type"];
  handle: HTMLElement;
  direction: CanvasResizeDirection;
  startClientX: number;
  startClientY: number;
  parentWidthPx: number;
  parentHeightPx: number;
  scaleX: number;
  scaleY: number;
  initialWidthPx: number;
  initialHeightPx: number;
  initialOverlay: CanvasResizeOverlay;
  containerResizeGeometry?: ContainerCanvasResizeGeometry;
  canonicalTextResizeGeometry?: CanonicalTextCanvasGeometry;
  deltaX: number;
  deltaY: number;
  candidates: CanvasSnapCandidate[];
  guideBounds: CanvasBounds;
}

type CanvasResizeLayoutField =
  | "position"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "width"
  | "height";

type CanvasResizeLayout = Partial<Record<CanvasResizeLayoutField, unknown>>;

function hasCanvasResizeLayoutChange(
  before: PresentationElement,
  after: PresentationElement,
): boolean {
  const beforeLayout = before.layout as CanvasResizeLayout | undefined;
  const afterLayout = after.layout as CanvasResizeLayout | undefined;
  const fields: readonly CanvasResizeLayoutField[] = [
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "width",
    "height",
  ];

  return fields.some((field) => beforeLayout?.[field] !== afterLayout?.[field]);
}

interface CanvasFocalOverlay {
  target: OwnedImageMediaAuthoringTarget;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CanvasFocalDragState {
  pointerId: number;
  target: OwnedImageMediaAuthoringTarget;
  handle: HTMLElement;
  bounds: CanvasFocalOverlay;
}

interface CanvasCropOverlay extends CropCanvasBounds {
  target: OwnedImageMediaAuthoringTarget;
  source: string;
  crop: CropCanvasBounds;
}

interface CanvasCropAppearance extends CropCanvasBounds {
  border: string;
  borderRadius: string;
  boxShadow: string;
}

interface CanvasCropDragState {
  pointerId: number;
  target: OwnedImageMediaAuthoringTarget;
  operation: CropCanvasOperation;
  startClientX: number;
  startClientY: number;
  initialCrop: NonNullable<Extract<PresentationElement, { type: "image" }>["crop"]>;
  previewBounds: CropCanvasBounds;
}

const CANVAS_RESIZE_DIRECTIONS: readonly CanvasResizeDirection[] = [
  "nw",
  "n",
  "ne",
  "w",
  "e",
  "sw",
  "s",
  "se",
];

// ============================================================
// END: TIPOS DO EDITOR
// ============================================================

// ============================================================
// BEGIN: EDITOR WORKSPACE
//
// Responsabilidades deste componente:
//
// - manter a Presentation em estado local;
// - controlar slide selecionado;
// - controlar elemento selecionado;
// - renderizar o slide com @web-slideshow/renderer;
// - localizar/atualizar elementos na árvore;
// - montar a estrutura visual do Editor.
//
// A UI específica de cada tipo de elemento pertence a
// element-inspector.tsx.
// ============================================================

export function EditorWorkspace({
  initialPresentation,
  onSave,
  onPublish,
  notesRepository,
  customLibraryRepository,
  customLibraryPaletteRepository,
  customLibraryFontRepository,
  initialAuthoringTarget,
}: {
  initialPresentation?: Presentation;
  onSave?: (presentation: Presentation) => Promise<void>;
  onPublish?: () => Promise<void>;
  notesRepository?: PresentationNotesRepository;
  customLibraryRepository?: CustomLibraryRepository;
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  customLibraryFontRepository?: CustomLibraryFontRepository;
  initialAuthoringTarget?: AuthoringTarget;
} = {}) {
  const { locale, t } = useStudioI18n();
  const chromeOsNativeSelectCompat = useChromeOsNativeSelectCompat();

  // ==========================================================
  // BEGIN: DOCUMENTO EDITÁVEL
  // ==========================================================

  const initialEditableRef = useRef<Presentation | null>(null);

  if (initialEditableRef.current === null) {
    initialEditableRef.current = initialPresentation
      ? structuredClone(initialPresentation)
      : structuredClone(editorDemoPresentation);
  }

  // History owns the one editable Presentation. The compatibility setter is
  // deliberately an untracked boundary for CP3 authoring surfaces: changing
  // one of those surfaces resets the stack, so an old entry can never undo
  // through an untracked mutation. This is temporary and mechanically
  // removable as each continuous surface moves to transactions.
  const [history, dispatchHistory] = useReducer(
    (state: EditorHistoryState, action:
      | { type: "commit"; update: (current: Presentation) => Presentation; meta: HistoryActionMeta }
      | { type: "transaction-begin"; key: string; meta: HistoryActionMeta }
      | { type: "transaction-update"; key: string; update: (current: Presentation) => Presentation }
      | { type: "transaction-commit"; key?: string }
      | { type: "transaction-cancel"; key?: string }
      | { type: "untracked"; update: Presentation | ((current: Presentation) => Presentation) }
      | { type: "undo" }
      | { type: "redo" }
      | { type: "reset"; next: Presentation }) => {
      switch (action.type) {
        case "commit": return commitHistory(state, action.update(state.present), action.meta);
        case "transaction-begin": return beginHistoryTransaction(state, action.key, action.meta);
        case "transaction-update": return updateHistoryTransaction(state, action.key, action.update(state.present));
        case "transaction-commit": return commitHistoryTransaction(state, action.key);
        case "transaction-cancel": return cancelHistoryTransaction(state, action.key);
        case "untracked": {
          const next = typeof action.update === "function"
            ? action.update(state.present)
            : action.update;
          return applyUntrackedHistoryUpdate(state, next);
        }
        case "undo": return undoHistory(state);
        case "redo": return redoHistory(state);
        case "reset": return resetHistory(action.next);
      }
    },
    initialEditableRef.current,
    createHistoryState,
  );
  const presentation = history.present;
  const authoringIntentRef = useRef<
    | { type: "continuous"; key: string; target: AuthoringTarget }
    | { type: "discrete"; meta: HistoryActionMeta; target: AuthoringTarget }
    | null
  >(null);
  const authoringTransactionTargetRef = useRef<{ key: string; target: AuthoringTarget } | null>(null);
  const setPresentation = (
    update: Presentation | ((current: Presentation) => Presentation),
  ) => {
    if (rootDefinitionModeRef.current) return;
    dispatchHistory({
      type: "untracked",
      update,
    });
  };
  function commitPresentationAction(
    meta: HistoryActionMeta,
    update: (current: Presentation) => Presentation,
  ): void {
    if (rootDefinitionModeRef.current) return;
    dispatchHistory({ type: "transaction-commit" });
    authoringTransactionTargetRef.current = null;
    dispatchHistory({ type: "commit", meta, update });
  }

  function commitPresentationGlobalAction(
    meta: HistoryActionMeta,
    update: (current: Presentation) => Presentation,
  ): void {
    dispatchHistory({ type: "transaction-commit" });
    authoringTransactionTargetRef.current = null;
    dispatchHistory({ type: "commit", meta, update });
  }

  function commitAuthoringAction(
    target: AuthoringTarget,
    meta: HistoryActionMeta,
    update: (current: Presentation, target: AuthoringTarget) => Presentation,
  ): void {
    dispatchHistory({ type: "transaction-commit" });
    authoringTransactionTargetRef.current = null;
    dispatchHistory({
      type: "commit",
      meta,
      update: (current) => update(current, target),
    });
  }

  function beginPresentationTransaction(key: string, meta: HistoryActionMeta): void {
    if (rootDefinitionModeRef.current) return;
    dispatchHistory({ type: "transaction-begin", key, meta });
    authoringTransactionTargetRef.current = null;
  }

  function updatePresentationTransaction(
    key: string,
    update: (current: Presentation) => Presentation,
  ): void {
    if (rootDefinitionModeRef.current) return;
    dispatchHistory({ type: "transaction-update", key, update });
  }

  function finishPresentationTransaction(key?: string): void {
    dispatchHistory({ type: "transaction-commit", ...(key === undefined ? {} : { key }) });
    if (
      key === undefined ||
      authoringTransactionTargetRef.current?.key === key
    ) {
      authoringTransactionTargetRef.current = null;
    }
  }

  function beginAuthoringTransaction(key: string, meta: HistoryActionMeta): void {
    dispatchHistory({ type: "transaction-begin", key, meta });
    if (authoringTransactionTargetRef.current?.key !== key) {
      authoringTransactionTargetRef.current = { key, target: authoringTarget };
    }
  }

  function applyTextStyleDefinitionUpdate(
    fallbackMeta: HistoryActionMeta,
    update: (current: Presentation) => Presentation,
  ): void {
    const intent = authoringIntentRef.current;
    if (intent?.type === "continuous") {
      dispatchHistory({ type: "transaction-update", key: intent.key, update });
    } else if (intent?.type === "discrete") {
      dispatchHistory({ type: "commit", meta: intent.meta, update });
    } else {
      commitPresentationGlobalAction(fallbackMeta, update);
    }
  }

  function applyLinkedStyleDefinitionUpdate(
    fallbackMeta: HistoryActionMeta,
    update: (current: Presentation) => Presentation,
  ): void {
    const intent = authoringIntentRef.current;
    if (intent?.type === "continuous") {
      dispatchHistory({ type: "transaction-update", key: intent.key, update });
    } else if (intent?.type === "discrete") {
      dispatchHistory({ type: "commit", meta: intent.meta, update });
    } else {
      commitPresentationGlobalAction(fallbackMeta, update);
    }
  }

  function applyPresentationPaletteUpdate(
    fallbackMeta: HistoryActionMeta,
    update: (current: Presentation) => Presentation,
  ): void {
    const intent = authoringIntentRef.current;
    if (intent?.type === "continuous") {
      dispatchHistory({ type: "transaction-update", key: intent.key, update });
    } else if (intent?.type === "discrete") {
      dispatchHistory({ type: "commit", meta: intent.meta, update });
    } else {
      commitPresentationGlobalAction(fallbackMeta, update);
    }
  }

  const authoringHistory: AuthoringHistoryContextValue = {
    begin: beginAuthoringTransaction,
    update: (key, callback) => {
      authoringIntentRef.current = {
        type: "continuous",
        key,
        target: authoringTransactionTargetRef.current?.target ?? authoringTarget,
      };
      try { callback(); } finally { authoringIntentRef.current = null; }
    },
    finish: finishPresentationTransaction,
    discrete: (meta, callback) => {
      finishPresentationTransaction();
      authoringIntentRef.current = {
        type: "discrete",
        meta,
        target: authoringTarget,
      };
      try { callback(); } finally { authoringIntentRef.current = null; }
    },
  };

  const [saveState, dispatchSave] = useReducer(editorSaveReducer, {
    lastSavedPresentation: initialEditableRef.current,
    isSaving: false,
    hasSaveError: false,
    failedPresentation: null,
  });

  const [publishState, dispatchPublish] = useReducer(
    editorPublishReducer,
    undefined,
    createInitialEditorPublishState,
  );

  // ==========================================================
  // END: DOCUMENTO EDITÁVEL
  // ==========================================================

  // ==========================================================
  // BEGIN: SELEÇÃO
  // ==========================================================

  const [selectedSlideIndex, setSelectedSlideIndex] = useState(() =>
    initialAuthoringTarget?.kind === "slide" &&
    initialAuthoringTarget.slideIndex >= 0 &&
    initialAuthoringTarget.slideIndex < presentation.slides.length
      ? initialAuthoringTarget.slideIndex
      : 0,
  );
  const [authoringTarget, setAuthoringTarget] = useState<AuthoringTarget>(() =>
    initialAuthoringTarget && resolveAuthoringTarget(presentation, initialAuthoringTarget)
      ? initialAuthoringTarget
      : { kind: "slide", slideIndex: 0 },
  );
  const rootDefinitionMode = isRootDefinitionTarget(authoringTarget);
  const rootDefinitionModeRef = useRef(false);
  rootDefinitionModeRef.current = rootDefinitionMode;
  const [pickedColors, setPickedColors] = useState<readonly Color[]>([]);

  const [selectedElement, setSelectedElement] =
    useState<SelectedElementInfo | null>(null);
  const pendingQrSelectionRef = useRef<PendingQrSelection | null>(null);
  const pendingResourceSelectionRef = useRef<PendingResourceSelection | null>(null);
  const [galleryItemSelection, setGalleryItemSelection] =
    useState<GalleryItemSelection | null>(null);
  const [selectedTableStructuralNode, setSelectedTableStructuralNode] =
    useState<TableStructuralSelection>(null);
  const [pendingElementDeletion, setPendingElementDeletion] =
    useState<PendingElementDeletion | null>(null);
  const [pendingTextStyleReset, setPendingTextStyleReset] = useState<"title" | "subtitle" | "body" | "caption" | null>(null);
  const [pendingStyleDetach, setPendingStyleDetach] = useState<PendingStyleDetach | null>(null);

  useEffect(() => {
    const pending = pendingQrSelectionRef.current;
    if (!pending) return;

    if (!areAuthoringTargetsEqual(authoringTarget, pending.target)) {
      pendingQrSelectionRef.current = null;
      return;
    }

    if (presentation === pending.beforePresentation) return;

    pendingQrSelectionRef.current = null;
    const elements = resolveOwnedAuthoringTree(presentation, pending.target, pending.sourceElementId)?.elements ?? null;
    const source = elements ? findElementById(elements, pending.sourceElementId) : undefined;
    const qr = elements ? findElementById(elements, pending.qrElementId) : undefined;
    if (
      !source ||
      !qr ||
      qr.type !== "image" ||
      qr.src !== pending.qrSource
    ) {
      return;
    }

    setSelectedElement({ id: qr.id, type: "image" });
  }, [authoringTarget, presentation]);

  const [rightPanelMode, setRightPanelMode] = useState<
    "editor" | "resources" | "notes"
  >("editor");
  const [resourceSections, setResourceSections] = useState<Record<string, boolean>>({});
  const resourcePresentationId = useRef(presentation.id);
  useEffect(() => {
    if (resourcePresentationId.current !== presentation.id) {
      resourcePresentationId.current = presentation.id;
      setResourceSections({});
    }
  }, [presentation.id]);

  const [editorPanelView, setEditorPanelView] =
    useState<EditorPanelView>("inspector");
  const editorPanelTabsRef = useRef<HTMLDivElement>(null);
  const scrollEditorPanelTabs = (amount: number) => {
    const tabStrip = editorPanelTabsRef.current;
    if (!tabStrip) return;
    if (typeof tabStrip.scrollBy === "function") {
      tabStrip.scrollBy({ left: amount, behavior: "smooth" });
    } else {
      tabStrip.scrollLeft += amount;
    }
  };
  const [clipboardSession, setClipboardSession] =
    useState<ClipboardSessionState>(EMPTY_CLIPBOARD_SESSION);
  const [pendingCut, setPendingCut] = useState<PendingClipboardCut | null>(null);
  const clipboardPresentationId = useRef(presentation.id);
  useEffect(() => {
    if (clipboardPresentationId.current !== presentation.id) {
      clipboardPresentationId.current = presentation.id;
      setClipboardSession(EMPTY_CLIPBOARD_SESSION);
      setPendingCut(null);
    }
  }, [presentation.id]);

  const [preserveImageProportion, setPreserveImageProportion] =
    useState<boolean>(DEFAULT_IMAGE_PROPORTION_PRESERVED);
  const [focalEditingTarget, setFocalEditingTarget] =
    useState<OwnedImageMediaAuthoringTarget | null>(null);
  const [cropEditingTarget, setCropEditingTarget] =
    useState<OwnedImageMediaAuthoringTarget | null>(null);

  // ==========================================================
  // END: SELEÇÃO
  // ==========================================================

  // ==========================================================
  // BEGIN: NEW OWNER CREATION
  //
  // Estado exclusivamente do Editor.
  // Não faz parte do documento.
  // ==========================================================

  const [newSlidePreset, setNewSlidePreset] =
    useState<SlideLayoutPreset>("blank");

  const [creationError, setCreationError] = useState<string | null>(null);
  const [slideRootDefinitionError, setSlideRootDefinitionError] = useState<string | null>(null);
  const [rootLocalContentTargetError, setRootLocalContentTargetError] = useState<RootLocalContentTargetError | null>(null);

  useEffect(() => {
    setRootLocalContentTargetError((current) => {
      if (
        current === null ||
        authoringTarget.kind !== "root-definition" ||
        current.rootDefinitionId !== authoringTarget.rootDefinitionId ||
        selectedElement?.type !== "container" ||
        current.containerId !== selectedElement.id
      ) {
        return null;
      }
      return current;
    });
  }, [authoringTarget, selectedElement]);

  // ==========================================================
  // END: NEW OWNER CREATION
  // ==========================================================

  // ==========================================================
  // BEGIN: VISIBILIDADE DO LAYOUT PICKER
  //
  // Estado exclusivo da interface do Editor.
  //
  // Não pertence à Presentation.
  // ==========================================================

  const [isSlideLayoutPickerOpen, setIsSlideLayoutPickerOpen] = useState(false);

  // ==========================================================
  // END: VISIBILIDADE DO LAYOUT PICKER
  // ==========================================================

  // ==========================================================
  // BEGIN: REFERÊNCIA DO CANVAS
  //
  // Usada apenas para aplicar o outline visual da seleção.
  // ==========================================================

  const slideCanvasRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const [canvasGeometry, setCanvasGeometry] = useState<FittedSlideGeometry>(
    () => fitLogicalSlideGeometry(presentation.aspectRatio, 0, 0),
  );
  const canvasDragRef = useRef<CanvasDragState | null>(null);
  const canvasResizeRef = useRef<CanvasResizeState | null>(null);
  const canvasFocalDragRef = useRef<CanvasFocalDragState | null>(null);
  const canvasCropDragRef = useRef<CanvasCropDragState | null>(null);
  const [canvasResizeOverlay, setCanvasResizeOverlay] =
    useState<CanvasResizeOverlay | null>(null);
  const [canvasGuides, setCanvasGuides] = useState<CanvasSnapGuide[]>([]);
  const [canvasGuideBounds, setCanvasGuideBounds] =
    useState<CanvasBounds | null>(null);
  const [canvasFocalOverlay, setCanvasFocalOverlay] =
    useState<CanvasFocalOverlay | null>(null);
  const [canvasFocalPreview, setCanvasFocalPreview] =
    useState<ImageFocalPoint | null>(null);
  const [canvasCropOverlay, setCanvasCropOverlay] =
    useState<CanvasCropOverlay | null>(null);
  const [canvasCropPreview, setCanvasCropPreview] = useState<
    NonNullable<Extract<PresentationElement, { type: "image" }>["crop"]> | null
  >(null);
  const [cropSourceMetrics, setCropSourceMetrics] = useState<{
    key: string;
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const [canvasCropAppearance, setCanvasCropAppearance] =
    useState<CanvasCropAppearance | null>(null);
  const [cropMeasureVersion, setCropMeasureVersion] = useState(0);

  function setCropEditingMode(target: OwnedImageMediaAuthoringTarget | null) {
    if (target === null) {
      canvasCropDragRef.current = null;
      setCanvasCropPreview(null);
    }
    setCropEditingTarget(target);
  }

  function closeCanvasMediaEditing() {
    canvasCropDragRef.current = null;
    canvasFocalDragRef.current = null;
    setCanvasCropPreview(null);
    setCanvasFocalPreview(null);
    setCanvasCropOverlay(null);
    setCanvasFocalOverlay(null);
    setCanvasCropAppearance(null);
    setCropSourceMetrics(null);
    setCropEditingTarget(null);
    setFocalEditingTarget(null);
  }

  // ==========================================================
  // END: REFERÊNCIA DO CANVAS
  // ==========================================================

  // ==========================================================
  // BEGIN: ACTIVE AUTHORING WORKSPACE
  // ==========================================================

  const retainedSlideIndex = Math.max(
    0,
    Math.min(selectedSlideIndex, Math.max(0, presentation.slides.length - 1)),
  );
  const resolvedAuthoringTarget = resolveAuthoringTarget(presentation, authoringTarget);
  const selectedSlide = resolvedAuthoringTarget?.slide ?? presentation.slides[retainedSlideIndex];
  const retainedSlide = presentation.slides[retainedSlideIndex];
  const materializedSlideProjection = useMemo(() => {
    if (!selectedSlide || authoringTarget.kind !== "slide") return null;
    return materializeSlide(presentation, selectedSlide);
  }, [authoringTarget.kind, presentation, selectedSlide]);
  const effectiveSlide = authoringTarget.kind === "slide"
    ? materializedSlideProjection?.slide ?? selectedSlide
    : selectedSlide;
  const effectiveElements = effectiveSlide?.elements ?? [];
  const materializedOwnership = materializedSlideProjection?.ownershipByStructuralId ?? null;
  const rootBackedSlide = authoringTarget.kind === "slide"
    && selectedSlide !== undefined
    && (selectedSlide.rootDefinitionId ?? presentation.defaultRootDefinitionId) !== undefined;
  const slideRootDefinitionAssignmentBlocker = selectedSlide
    ? getSlideRootDefinitionAssignmentBlocker(presentation, selectedSlide)
    : null;

  useEffect(() => {
    if (rootBackedSlide) setPendingCut(null);
  }, [rootBackedSlide]);
  const rootDefinition = rootDefinitionMode && authoringTarget.kind === "root-definition"
    ? presentation.rootDefinitions?.find((definition) => definition.id === authoringTarget.rootDefinitionId)
    : undefined;

  // ==========================================================
  // END: ACTIVE AUTHORING WORKSPACE
  // ==========================================================

  // ==========================================================
  // BEGIN: NOTAS PRIVADAS
  //
  // O ciclo de vida das notas (carregamento, edição local,
  // autosave e persistência) vive em useEditorNotes. Este
  // componente apenas conecta o hook ao slide selecionado e
  // decide se o workspace de Notas substitui a coluna direita.
  // ==========================================================

  const editorNotes = useEditorNotes({
    presentationId: presentation.id,
    notesRepository,
    selectedSlideId: retainedSlide?.id ?? "",
    enabled: rightPanelMode === "notes" && !rootDefinitionMode,
  });

  useEffect(() => {
    if (resolvedAuthoringTarget) return;
    const safeTarget: AuthoringTarget = { kind: "slide", slideIndex: retainedSlideIndex };
    setAuthoringTarget(safeTarget);
    setSelectedSlideIndex(retainedSlideIndex);
    setSelectedElement(null);
    setGalleryItemSelection(null);
    setSelectedTableStructuralNode(null);
    setPendingElementDeletion(null);
    setPendingStyleDetach(null);
    setPendingTextStyleReset(null);
    setPendingCut(null);
    closeCanvasMediaEditing();
    setRightPanelMode("editor");
  }, [authoringTarget, presentation, resolvedAuthoringTarget, retainedSlideIndex]);

  useEffect(() => {
    if (rootDefinitionMode && rightPanelMode === "notes") {
      setRightPanelMode("editor");
    }
  }, [rootDefinitionMode, rightPanelMode]);

  const previousAuthoringTargetRef = useRef<AuthoringTarget | null>(null);
  useEffect(() => {
    const previous = previousAuthoringTargetRef.current;
    previousAuthoringTargetRef.current = authoringTarget;
    if (!previous || areAuthoringTargetsEqual(previous, authoringTarget)) return;

    closeCanvasMediaEditing();
    clearCanvasDragPreview();
    canvasResizeRef.current = null;
    setCanvasResizeOverlay(null);
    setCanvasGuides([]);
    setCanvasGuideBounds(null);
  }, [authoringTarget]);

  useEffect(() => {
    if (rootDefinitionMode) {
      setSelectedElement(null);
      setGalleryItemSelection(null);
      setSelectedTableStructuralNode(null);
      setPendingElementDeletion(null);
      setPendingStyleDetach(null);
      setPendingTextStyleReset(null);
      setPendingCut(null);
      closeCanvasMediaEditing();
      clearCanvasDragPreview();
      canvasResizeRef.current = null;
      setCanvasResizeOverlay(null);
      setCanvasGuides([]);
      setCanvasGuideBounds(null);
    }
  }, [rootDefinitionMode]);

  useEffect(() => {
    const pending = pendingResourceSelectionRef.current;
    if (!pending) return;
    if (!areAuthoringTargetsEqual(authoringTarget, pending.target)) {
      pendingResourceSelectionRef.current = null;
      return;
    }

    const elements = resolveAuthoringElements(presentation, pending.target);
    const element = elements ? findElementById(elements, pending.elementId) : null;
    const valid = pending.elementType === "text"
      ? element?.type === "text" && element.variant === pending.styleId && element.styleDetached !== true
      : element?.type === "container" && element.linkedStyleId === pending.styleId;
    pendingResourceSelectionRef.current = null;
    if (!valid || !element) return;
    setSelectedElement({ id: element.id, type: pending.elementType });
  }, [authoringTarget, presentation]);

  useEffect(() => {
    if (!pendingElementDeletion) return;
    const elements = pendingElementDeletion.target.kind === "slide"
      ? (() => {
          const slide = presentation.slides[pendingElementDeletion.target.slideIndex];
          return slide ? materializeSlide(presentation, slide).slide.elements : null;
        })()
      : resolveAuthoringElements(presentation, pendingElementDeletion.target);
    const element = elements
      ? findElementById(elements, pendingElementDeletion.elementId)
      : null;
    if (
      !areAuthoringTargetsEqual(authoringTarget, pendingElementDeletion.target) ||
      !element ||
      element.type !== pendingElementDeletion.elementType ||
      isProtectedRootContainer(
        presentation,
        pendingElementDeletion.target,
        pendingElementDeletion.elementId,
      )
    ) {
      setPendingElementDeletion(null);
    }
  }, [authoringTarget, pendingElementDeletion, presentation]);

  useEffect(() => {
    if (!rootDefinitionMode && authoringTarget.kind === "slide" && authoringTarget.slideIndex !== retainedSlideIndex) {
      setAuthoringTarget({ kind: "slide", slideIndex: retainedSlideIndex });
    }
  }, [authoringTarget, retainedSlideIndex, rootDefinitionMode]);

  // ==========================================================
  // END: NOTAS PRIVADAS
  // ==========================================================

  // ==========================================================
  // BEGIN: ELEMENTO REAL SELECIONADO
  //
  // selectedElement guarda apenas dados de seleção da UI.
  // Aqui encontramos o objeto real dentro do documento.
  // ==========================================================

  const selectedDocumentElement = useMemo<PresentationElement | null>(() => {
    if (!selectedSlide || !selectedElement) {
      return null;
    }

    return findElementById(effectiveElements, selectedElement.id);
  }, [effectiveElements, selectedElement, selectedSlide]);
  const selectedElementOwner = selectedDocumentElement && materializedOwnership
    ? materializedOwnership.get(selectedDocumentElement.id)
    : undefined;
  const selectedMasterElement = rootBackedSlide && selectedDocumentElement !== null
    && findLocalRootChildOwner(presentation, selectedSlideIndex, selectedDocumentElement.id) === null;
  const elementStyleApplyAllowed = rootDefinitionMode
    ? selectedDocumentElement !== null
    : !rootBackedSlide
      || (selectedDocumentElement !== null && !selectedMasterElement);
  const rootDefinitionInspectorReadOnly = rootDefinitionMode
    && (selectedDocumentElement === null || !isRootDefinitionGenericInspectorElement(selectedDocumentElement))
    || (!rootDefinitionMode && selectedMasterElement);

  const currentImageMediaTarget = useMemo<OwnedImageMediaAuthoringTarget | null>(() => {
    if (selectedDocumentElement?.type === "image") {
      return {
        authoringTarget,
        mediaTarget: { kind: "image", elementId: selectedDocumentElement.id },
      };
    }
    if (
      selectedDocumentElement?.type === "gallery" &&
      galleryItemSelection?.galleryId === selectedDocumentElement.id &&
      galleryItemSelection.itemIndex >= 0 &&
      galleryItemSelection.itemIndex < selectedDocumentElement.items.length
    ) {
      return {
        authoringTarget,
        mediaTarget: {
          kind: "gallery-item",
          galleryId: selectedDocumentElement.id,
          itemIndex: galleryItemSelection.itemIndex,
        },
      };
    }
    return null;
  }, [authoringTarget, galleryItemSelection, selectedDocumentElement]);

  function resolveImageMediaTarget(
    target: OwnedImageMediaAuthoringTarget,
    sourcePresentation: Presentation = presentation,
  ): ImageMediaValue | null {
    const elements = target.authoringTarget.kind === "slide"
      ? (() => {
          const slide = sourcePresentation.slides[target.authoringTarget.slideIndex];
          return slide && (slide.rootDefinitionId ?? sourcePresentation.defaultRootDefinitionId) !== undefined
            ? materializeSlide(sourcePresentation, slide).slide.elements
            : slide?.elements ?? null;
        })()
      : resolveAuthoringElements(sourcePresentation, target.authoringTarget);
    if (!elements) return null;
    if (target.mediaTarget.kind === "image") {
      const element = findElementById(elements, target.mediaTarget.elementId);
      return element?.type === "image" ? element : null;
    }
    const gallery = findElementById(elements, target.mediaTarget.galleryId);
    return gallery?.type === "gallery" ? gallery.items[target.mediaTarget.itemIndex] ?? null : null;
  }

  function applyImageMediaTargetUpdate(
    current: Presentation,
    target: OwnedImageMediaAuthoringTarget,
    update: (media: ImageMediaValue) => ImageMediaValue,
  ): Presentation {
    const anchorId = target.mediaTarget.kind === "image" ? target.mediaTarget.elementId : target.mediaTarget.galleryId;
    const elements = resolveOwnedAuthoringTree(current, target.authoringTarget, anchorId)?.elements ?? null;
    if (!elements) return current;

    const mediaTarget = target.mediaTarget;
    const nextElements = mediaTarget.kind === "image"
      ? updateElementById(elements, mediaTarget.elementId, (element) => {
          if (element.type !== "image") return element;
          const next = update(element);
          return next === element ? element : next as typeof element;
        })
      : updateElementById(elements, mediaTarget.galleryId, (element) => {
          if (element.type !== "gallery") return element;
          const item = element.items[mediaTarget.itemIndex];
          if (!item) return element;
          const nextItem = update(item);
          if (nextItem === item) return element;
          return {
            ...element,
            items: element.items.map((currentItem, itemIndex) =>
              itemIndex === mediaTarget.itemIndex ? nextItem as typeof currentItem : currentItem,
            ),
          };
        });

    return nextElements === elements
      ? current
      : replaceOwnedAuthoringTree(current, target.authoringTarget, anchorId, nextElements);
  }

  useEffect(() => {
    const gallery = selectedDocumentElement?.type === "gallery"
      ? selectedDocumentElement
      : null;
    setGalleryItemSelection((current) => {
      if (!gallery || gallery.items.length === 0) return null;
      if (current?.galleryId !== gallery.id) return { galleryId: gallery.id, itemIndex: 0 };
      return { galleryId: gallery.id, itemIndex: Math.min(current.itemIndex, gallery.items.length - 1) };
    });
  }, [selectedDocumentElement?.id, selectedDocumentElement?.type, selectedDocumentElement?.type === "gallery" ? selectedDocumentElement.items.length : undefined]);

  function selectClipboardEntry(entryId: string): void {
    setPendingCut(null);
    setClipboardSession((current) =>
      current.entries.some((entry) => entry.id === entryId)
        ? { ...current, selectedEntryId: entryId }
        : current,
    );
  }

  function copySelectedElement(): boolean {
    if (!selectedDocumentElement || !selectedElementPosition) {
      return false;
    }

    const entry = createClipboardEntry(
      selectedDocumentElement,
    );
    setPendingCut(null);
    setClipboardSession((current) => ({
      ...addClipboardEntry(current, entry),
      selectedEntryId: entry.id,
    }));
    return true;
  }

  function cutSelectedElement(): boolean {
    if (rootBackedSlide) return false;
    if (!selectedDocumentElement || !selectedElementPosition || !selectedSlide) {
      return false;
    }
    if (isProtectedRootContainer(presentation, authoringTarget, selectedDocumentElement.id)) {
      return false;
    }

    setPendingCut(
      createPendingClipboardCut(
        selectedDocumentElement,
        authoringTarget.kind === "slide"
          ? { kind: "slide", slideId: selectedSlide.id }
          : { kind: "root-definition", rootDefinitionId: authoringTarget.rootDefinitionId },
      ),
    );
    setClipboardSession((current) => ({ ...current, selectedEntryId: null }));
    return true;
  }

  function pasteClipboardEntry(entryId: string): boolean {
    if (rootBackedSlide) return false;
    const target = authoringTarget;
    const entry = clipboardSession.entries.find(
      (candidate) => candidate.id === entryId,
    );
    if (!entry) {
      return false;
    }

    const selectedElementAtPaste = selectedDocumentElement;
    const selectedContentSlotId = selectedElement?.contentSlotId ?? null;
    const initialElements = resolveAuthoringElements(history.present, target);
    if (
      !initialElements ||
      !resolveClipboardPasteDestination(
        initialElements,
        entry.element.id,
        selectedElementAtPaste,
        selectedContentSlotId,
        target.kind === "root-definition"
          ? resolveCanonicalRootContainerId(history.present, target)
          : null,
      )
    ) return false;

    commitAuthoringAction(
      target,
      { kind: "element.paste", labelKey: "history.element.paste", labelParams: { elementType: entry.element.type } },
      (current, authoringTarget) => {
        const elements = resolveAuthoringElements(current, authoringTarget);
        if (!elements) return current;
        const destination = resolveClipboardPasteDestination(
          elements,
          entry.element.id,
          selectedElementAtPaste,
          selectedContentSlotId,
          authoringTarget.kind === "root-definition"
            ? resolveCanonicalRootContainerId(current, authoringTarget)
            : null,
        );
        if (!destination) return current;
        const usedIds = collectPresentationAuthoringIds(current);
        const pastedElement = duplicateElement(entry.element, usedIds);
        const nextElements = destination.kind === "slide"
          ? [...elements, pastedElement]
          : destination.kind === "container"
            ? appendElementToContainer(elements, destination.id, pastedElement)
            : appendElementToContentSlot(elements, destination.id, pastedElement);
        if (nextElements === elements) return current;
        return replaceAuthoringElements(current, authoringTarget, nextElements);
      },
    );
    return true;
  }

  function pastePendingCut(): boolean {
    if (rootBackedSlide) return false;
    if (!pendingCut) return false;

    const target = authoringTarget;
    const source = pendingCut.source;
    const sourceMatchesTarget = source.kind === "slide"
      ? target.kind === "slide"
      : target.kind === "root-definition" && target.rootDefinitionId === source.rootDefinitionId;
    if (!sourceMatchesTarget) {
      setPendingCut(null);
      return false;
    }

    const sourceTarget: AuthoringTarget = source.kind === "slide"
      ? {
          kind: "slide",
          slideIndex: history.present.slides.findIndex((slide) => slide.id === source.slideId),
        }
      : { kind: "root-definition", rootDefinitionId: source.rootDefinitionId };
    const sourceElements = resolveAuthoringElements(history.present, sourceTarget);
    const receiverElements = resolveAuthoringElements(history.present, target);
    const selectedElementAtPaste = selectedDocumentElement;
    const selectedContentSlotId = selectedElement?.contentSlotId ?? null;
    if (!sourceElements) {
      setPendingCut(null);
      return false;
    }
    if (!findElementById(sourceElements, pendingCut.sourceElementId)) {
      setPendingCut(null);
      return false;
    }
    if (
      !receiverElements ||
      (target.kind === "root-definition" &&
        isProtectedRootContainer(history.present, target, pendingCut.sourceElementId))
    ) return false;

    const initialMove = moveClipboardElementInElements(
      history.present,
      sourceElements,
      receiverElements,
      pendingCut.sourceElementId,
      selectedElementAtPaste,
      selectedContentSlotId,
      source.kind === "root-definition" ||
        (target.kind === "slide" && sourceTarget.kind === "slide" && sourceTarget.slideIndex === target.slideIndex),
      target.kind === "root-definition"
        ? resolveCanonicalRootContainerId(history.present, target)
        : null,
    );
    if (!initialMove) {
      if (!findElementById(sourceElements, pendingCut.sourceElementId)) {
        setPendingCut(null);
      }
      return false;
    }

    commitAuthoringAction(
      target,
      { kind: "element.move", labelKey: "history.element.move" },
      (current) => {
        const currentSourceTarget: AuthoringTarget = source.kind === "slide"
          ? {
              kind: "slide",
              slideIndex: current.slides.findIndex((slide) => slide.id === source.slideId),
            }
          : { kind: "root-definition", rootDefinitionId: source.rootDefinitionId };
        const currentSourceElements = resolveAuthoringElements(current, currentSourceTarget);
        const currentReceiverElements = resolveAuthoringElements(current, target);
        if (!currentSourceElements || !currentReceiverElements) return current;
        const result = moveClipboardElementInElements(
          current,
          currentSourceElements,
          currentReceiverElements,
          pendingCut.sourceElementId,
          selectedElementAtPaste,
          selectedContentSlotId,
          source.kind === "root-definition" ||
            (target.kind === "slide" && currentSourceTarget.kind === "slide" && currentSourceTarget.slideIndex === target.slideIndex),
          target.kind === "root-definition"
            ? resolveCanonicalRootContainerId(current, target)
            : null,
        );
        if (!result) return current;

        const afterReceiver = replaceAuthoringElements(current, target, result.receiverElements);
        return source.kind === "root-definition"
          ? afterReceiver
          : replaceAuthoringElements(afterReceiver, currentSourceTarget, result.sourceElements);
      },
    );
    setPendingCut(null);
    return true;
  }

  function reconcileAfterHistoryReplay(next: Presentation): void {
    const nextSlideIndex = Math.max(
      0,
      Math.min(selectedSlideIndex, Math.max(0, next.slides.length - 1)),
    );
    const nextTarget = resolveAuthoringTarget(next, authoringTarget)
      ? authoringTarget
      : { kind: "slide" as const, slideIndex: nextSlideIndex };
    setSelectedSlideIndex(nextSlideIndex);
    setAuthoringTarget(nextTarget);
    setSelectedElement((current) => reconcileSelectedElementAfterReplay(current, next, nextTarget));
    setGalleryItemSelection(null);
    setSelectedTableStructuralNode(null);
    setPendingElementDeletion(null);
    setPendingStyleDetach(null);
    setPendingTextStyleReset(null);
    setPendingCut(null);
    closeCanvasMediaEditing();
    clearCanvasDragPreview();
    canvasResizeRef.current = null;
    setCanvasResizeOverlay(null);
    setCanvasGuides([]);
    setCanvasGuideBounds(null);
  }

  function undoEditorHistory(): boolean {
    if (history.transaction !== undefined) {
      dispatchHistory({ type: "transaction-commit" });
      authoringTransactionTargetRef.current = null;
    }
    if (history.past.length === 0 && history.transaction === undefined) return false;
    const nextState = undoHistory(history);
    dispatchHistory({ type: "undo" });
    reconcileAfterHistoryReplay(nextState.present);
    return true;
  }

  function redoEditorHistory(): boolean {
    if (history.transaction !== undefined) {
      dispatchHistory({ type: "transaction-commit" });
      authoringTransactionTargetRef.current = null;
    }
    if (history.future.length === 0 && history.transaction === undefined) return false;
    const nextState = redoHistory(history);
    dispatchHistory({ type: "redo" });
    reconcileAfterHistoryReplay(nextState.present);
    return true;
  }

  function requestElementDeletion() {
    if (!selectedDocumentElement || pendingElementDeletion !== null) {
      return;
    }
    if (selectedMasterElement) {
      return;
    }
    if (isProtectedRootContainer(presentation, authoringTarget, selectedDocumentElement.id)) {
      return;
    }

    setPendingElementDeletion({
      target: authoringTarget,
      elementId: selectedDocumentElement.id,
      elementType: selectedDocumentElement.type,
    });
  }

  useEffect(() => {
    if (rightPanelMode !== "editor" && rightPanelMode !== "resources") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.defaultPrevented ||
        isEditableKeyboardTarget(event.target)
      ) {
        return;
      }

      const modifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifierPressed && !event.altKey && key === "z") {
        const replayed = event.shiftKey ? redoEditorHistory() : undoEditorHistory();
        if (replayed) event.preventDefault();
        return;
      }

      if (
        modifierPressed &&
        !event.altKey &&
        !event.shiftKey &&
        key === "c"
      ) {
        if (copySelectedElement()) {
          event.preventDefault();
        }
        return;
      }

      if (
        modifierPressed &&
        !event.altKey &&
        !event.shiftKey &&
        key === "x"
      ) {
        if (cutSelectedElement()) {
          event.preventDefault();
        }
        return;
      }

      if (
        modifierPressed &&
        !event.altKey &&
        !event.shiftKey &&
        key === "v"
      ) {
        const pasted = pendingCut
          ? pastePendingCut()
          : clipboardSession.selectedEntryId !== null
            ? pasteClipboardEntry(clipboardSession.selectedEntryId)
            : false;
        if (pasted) {
          event.preventDefault();
        }
        return;
      }

      if (
        event.key !== "Delete" ||
        pendingElementDeletion !== null ||
        !selectedDocumentElement
      ) {
        return;
      }

      event.preventDefault();
      requestElementDeletion();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    clipboardSession,
    pendingCut,
    pendingElementDeletion,
    presentation,
    history,
    rightPanelMode,
    selectedElement,
    selectedDocumentElement,
    selectedSlide,
    selectedSlideIndex,
  ]);

  // ==========================================================
  // BEGIN: POSIÇÃO DO ELEMENTO SELECIONADO
  //
  // Exemplo:
  //
  // container
  // ├── text
  // ├── image   ← index 1 / count 3
  // └── code
  //
  // Isso permite determinar se Move Up / Move Down estão
  // disponíveis sem colocar essa lógica na UI.
  // ==========================================================

  const selectedElementPosition = useMemo(() => {
    if (!selectedSlide || !selectedElement) {
      return null;
    }

    return findElementSiblingPosition(
      effectiveElements,
      selectedElement.id,
    );
  }, [effectiveElements, selectedElement, selectedSlide]);

  const selectedElementParent = useMemo(() => {
    if (
      !selectedSlide ||
      selectedElementPosition?.parentRef.kind !== "container"
    ) {
      return null;
    }

    const parent = findElementById(
      effectiveElements,
      selectedElementPosition.parentRef.id,
    );

    return parent?.type === "container" ? parent : null;
  }, [effectiveElements, selectedElementPosition, selectedSlide]);

  const selectedAncestorContainers = useMemo(() => {
    if (!selectedDocumentElement) return [];
    return findAncestorContainers(effectiveElements, selectedDocumentElement.id);
  }, [effectiveElements, selectedDocumentElement]);

  // ==========================================================
  // END: POSIÇÃO DO ELEMENTO SELECIONADO
  // ==========================================================

  // ==========================================================
  // END: ELEMENTO REAL SELECIONADO
  // ==========================================================

  // ==========================================================
  // BEGIN: RENDERIZAÇÃO DO SLIDE
  //
  // O Editor usa o mesmo renderer do Player.
  // ==========================================================

  const renderedSlideModel = useMemo(() => {
    if (!selectedSlide) return undefined;
    return authoringTarget.kind === "slide"
      ? materializedSlideProjection?.slide
      : selectedSlide;
  }, [authoringTarget.kind, materializedSlideProjection, selectedSlide]);

  const renderedSlide = useMemo(
    () => renderedSlideModel ? renderSlide(renderedSlideModel, { presentation }) : "",
    [renderedSlideModel, presentation],
  );

  const renderedSlideHtml = useMemo(
    () => ({ __html: renderedSlide }),
    [renderedSlide],
  );

  const renderedPaletteStyle = useMemo(() => {
    const style: CSSProperties & Record<`--${string}`, string> = {};

    for (const color of presentation.palette?.colors ?? []) {
      style[paletteColorCssVariableName(color.id) as `--${string}`] = color.value;
    }

    return style;
  }, [presentation.palette?.colors]);

  const renderedFontResources = useMemo(
    () => renderFontResources(presentation.resources?.fonts),
    [presentation.resources?.fonts],
  );
  const displayedCanvasFocalPoint =
    currentImageMediaTarget
      ? (canvasFocalPreview ?? getEffectiveImageFocalPoint(resolveImageMediaTarget(currentImageMediaTarget)?.focalPoint))
      : null;

  useEffect(() => {
    const viewport = canvasViewportRef.current;

    if (!viewport) {
      return;
    }

    const measure = () => {
      const logical = resolveLogicalSlideSize(presentation.aspectRatio);
      const usableWidth = Math.max(0, viewport.clientWidth - 64);
      const usableHeight = Math.max(0, viewport.clientHeight - 64);
      const geometry = fitLogicalSlideGeometry(
        presentation.aspectRatio,
        Math.min(usableWidth, logical.logicalWidth),
        usableHeight,
      );

      setCanvasGeometry(geometry);
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(viewport);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [presentation.aspectRatio]);

  useEffect(() => {
    const canvas = slideCanvasRef.current;
    if (canvas && renderedSlideModel !== undefined) {
      hydrateRendererRuntime(canvas, {
        plotAnimations: {
          slide: renderedSlideModel,
          autoplay: false,
        },
      });
    } else if (canvas) {
      hydrateRendererRuntime(canvas);
    }
  }, [canvasGeometry, renderedSlide, renderedSlideModel]);

  useEffect(() => {
    const canvas = slideCanvasRef.current;
    return () => {
      if (canvas) disposeRendererRuntime(canvas);
    };
  }, []);

  // ==========================================================
  // END: RENDERIZAÇÃO DO SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: OUTLINE DO ELEMENTO SELECIONADO
  //
  // O HTML do slide é produzido fora do React.
  // Após cada atualização, localizamos o elemento selecionado
  // e aplicamos uma classe exclusiva do Editor.
  // ==========================================================

  useEffect(() => {
    const canvas = slideCanvasRef.current;

    if (!canvas) {
      return;
    }

    const previousSelections = canvas.querySelectorAll(
      ".studio-editor-selected",
    );

    previousSelections.forEach((element) => {
      element.classList.remove("studio-editor-selected");
    });

    const previousDraggables = canvas.querySelectorAll(
      ".studio-editor-draggable",
    );

    previousDraggables.forEach((element) => {
      element.classList.remove("studio-editor-draggable");
    });

    const previousPendingCuts = canvas.querySelectorAll(
      ".studio-editor-pending-cut",
    );

    previousPendingCuts.forEach((element) => {
      element.classList.remove("studio-editor-pending-cut");
    });

    const candidates = canvas.querySelectorAll<HTMLElement>(
      "[data-presentation-id]",
    );

    candidates.forEach((candidate) => {
      const id = candidate.dataset.presentationId;
      const documentElement = id
        ? findElementById(selectedSlide?.elements ?? [], id)
        : null;

      if (documentElement) {
        if (id === pendingCut?.sourceElementId) {
          candidate.classList.add("studio-editor-pending-cut");
        }

        const draggable =
          documentElement.type === "container"
            ? isContainerCanvasDraggable(documentElement)
            : documentElement.type === "text"
              ? documentElement.layout?.position === "absolute"
              : documentElement.type === "image" || documentElement.type === "gallery" || documentElement.type === "embed" || documentElement.type === "scripted" || documentElement.type === "code" || documentElement.type === "terminal" || documentElement.type === "table" || documentElement.type === "blocks"
                ? documentElement.layout?.position === "absolute"
              : documentElement.type === "divider" || documentElement.type === "topics" || documentElement.type === "plot" || documentElement.type === "interactive"
                  ? documentElement.layout?.position === "absolute"
                  : false;

        if (
          draggable &&
          !isProtectedRootContainer(presentation, authoringTarget, id ?? "") &&
          !isInsideContainerFitSurface(candidate)
        ) {
          candidate.classList.add("studio-editor-draggable");
        }
      }
    });

    if (!selectedElement) {
      setCanvasResizeOverlay(null);
      return;
    }

    const target = Array.from(candidates).find(
      (element) => element.dataset.presentationId === selectedElement.id,
    );

    target?.classList.add("studio-editor-selected");

    if (
      !target ||
      !selectedDocumentElement ||
      isProtectedRootContainer(presentation, authoringTarget, selectedDocumentElement.id) ||
      !isCanvasResizable(selectedDocumentElement) ||
      isInsideContainerFitSurface(target)
    ) {
      setCanvasResizeOverlay(null);
      return;
    }

    const bounds = target.getBoundingClientRect();

    const nextOverlay: CanvasResizeOverlay = {
      elementId: selectedDocumentElement.id,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    setCanvasResizeOverlay((current) =>
      current &&
      current.elementId === nextOverlay.elementId &&
      current.left === nextOverlay.left &&
      current.top === nextOverlay.top &&
      current.width === nextOverlay.width &&
      current.height === nextOverlay.height
        ? current
        : nextOverlay,
    );
  }, [
    canvasGeometry,
    locale,
    renderedSlide,
    selectedDocumentElement,
    selectedElement,
    selectedSlide,
    pendingCut,
    authoringTarget,
    presentation,
  ]);

  useEffect(() => {
    const canvas = slideCanvasRef.current;
    if (!canvas) return;
    canvas.querySelectorAll<HTMLElement>("[data-presentation-type=gallery][data-presentation-id]").forEach((gallery) => {
      const isSelected = gallery.dataset.presentationId === galleryItemSelection?.galleryId;
      const selectedIndex = isSelected ? galleryItemSelection?.itemIndex ?? 0 : 0;
      gallery.querySelectorAll<HTMLElement>("[data-presentation-gallery-index]").forEach((item) => {
        const active = Number(item.dataset.presentationGalleryIndex) === selectedIndex;
        item.classList.toggle("presentation-gallery-item-active", active);
        item.style.setProperty("visibility", active ? "visible" : "hidden");
        item.style.setProperty("pointer-events", active ? "auto" : "none");
        item.setAttribute("aria-hidden", active ? "false" : "true");
      });
    });
  }, [canvasGeometry, galleryItemSelection, renderedSlide]);

  useEffect(() => {
    if (!focalEditingTarget || !areImageMediaTargetsEqual(focalEditingTarget, currentImageMediaTarget)) {
      setCanvasFocalOverlay(null);
      setCanvasFocalPreview(null);
      canvasFocalDragRef.current = null;
      if (focalEditingTarget) setFocalEditingTarget(null);
      return;
    }

    const canvas = slideCanvasRef.current;
    const target = canvas
      ? focalEditingTarget.mediaTarget.kind === "image"
        ? findCanvasElementById(canvas, focalEditingTarget.mediaTarget.elementId)
        : findCanvasGalleryItem(canvas, focalEditingTarget.mediaTarget.galleryId, focalEditingTarget.mediaTarget.itemIndex)
      : null;

    if (!target) {
      setCanvasFocalOverlay(null);
      return;
    }

    const bounds = target.getBoundingClientRect();

    setCanvasFocalOverlay({
      target: focalEditingTarget,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }, [canvasGeometry, currentImageMediaTarget, focalEditingTarget, renderedSlide]);

  useEffect(() => {
    if (!cropEditingTarget || !areImageMediaTargetsEqual(cropEditingTarget, currentImageMediaTarget)) {
      setCanvasCropOverlay(null);
      setCanvasCropPreview(null);
      setCropSourceMetrics(null);
      setCanvasCropAppearance(null);
      canvasCropDragRef.current = null;
      if (cropEditingTarget) setCropEditingMode(null);
      return;
    }

    const media = resolveImageMediaTarget(cropEditingTarget);
    if (!media) {
      setCropEditingMode(null);
      return;
    }
    const canvas = slideCanvasRef.current;
    const target = canvas
      ? cropEditingTarget.mediaTarget.kind === "image"
        ? findCanvasElementById(canvas, cropEditingTarget.mediaTarget.elementId)
        : findCanvasGalleryItem(canvas, cropEditingTarget.mediaTarget.galleryId, cropEditingTarget.mediaTarget.itemIndex)
      : null;
    const sourceKey = `${imageMediaTargetKey(cropEditingTarget)}:${media.src}`;
    const preview = cropSourceMetrics?.key === sourceKey && target
      ? resolveSourcePreviewBounds(
          getCanvasBounds(target),
          cropSourceMetrics.width,
          cropSourceMetrics.height,
        )
      : null;

    if (target) {
      const mediaTarget = cropEditingTarget.mediaTarget;
      const appearanceTarget = mediaTarget.kind === "gallery-item"
        ? Array.from(canvas?.querySelectorAll<HTMLElement>("[data-presentation-id][data-presentation-type]") ?? [])
            .find((candidate) => candidate.dataset.presentationType === "gallery" && candidate.dataset.presentationId === mediaTarget.galleryId) ?? null
        : target;
      if (!appearanceTarget) {
        setCanvasCropAppearance(null);
      } else {
        const computed = getComputedStyle(appearanceTarget);
        const bounds = getCanvasBounds(appearanceTarget);
      setCanvasCropAppearance({
        ...bounds,
        border: computed.border || appearanceTarget.style.border || "",
        borderRadius: computed.borderRadius || appearanceTarget.style.borderRadius || "0px",
        boxShadow: computed.boxShadow || appearanceTarget.style.boxShadow || "none",
      });
      }
    } else {
      setCanvasCropAppearance(null);
    }

    if (!preview) {
      setCanvasCropOverlay(null);
      return;
    }

    const crop = canvasCropPreview ?? getEffectiveImageCrop(media.crop);
    setCanvasCropOverlay({
      ...preview,
      target: cropEditingTarget,
      source: media.src,
      crop: resolveCropCanvasRect(preview, crop),
    });
  }, [canvasGeometry, cropEditingTarget, cropSourceMetrics, canvasCropPreview, currentImageMediaTarget, renderedSlide, cropMeasureVersion, presentation]);

  useEffect(() => {
    if (!cropEditingTarget) return;
    const handleResize = () => {
      setCropMeasureVersion((current) => current + 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [cropEditingTarget]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const hasMediaEditing = Boolean(
          canvasCropDragRef.current ||
            canvasFocalDragRef.current ||
            cropEditingTarget ||
            focalEditingTarget,
        );
        if (pendingCut && !hasMediaEditing) {
          setPendingCut(null);
          return;
        }
        if (canvasCropDragRef.current) {
          canvasCropDragRef.current = null;
          setCanvasCropPreview(null);
        }
        setCanvasCropOverlay(null);
        setCropEditingMode(null);
        setFocalEditingTarget(null);
        setCanvasFocalPreview(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cropEditingTarget, focalEditingTarget, pendingCut]);

  // ==========================================================
  // END: OUTLINE DO ELEMENTO SELECIONADO
  // ==========================================================

  // ==========================================================
  // BEGIN: TROCA DE SLIDE
  //
  // A seleção de elemento é limpa ao trocar de slide.
  // ==========================================================

  function selectSlide(index: number) {
    if (rootDefinitionMode) return;
    selectSlideFromResourceUsage(index);
  }

  function selectSlideFromResourceUsage(index: number) {
    if (!presentation.slides[index]) return;
    finishPresentationTransaction();
    setSelectedSlideIndex(index);
    setAuthoringTarget({ kind: "slide", slideIndex: index });

    setSelectedElement(null);
  }

  function exitRootDefinitionEditing(): void {
    if (!rootDefinitionMode) return;
    finishPresentationTransaction();
    setSelectedSlideIndex(retainedSlideIndex);
    setAuthoringTarget({ kind: "slide", slideIndex: retainedSlideIndex });
    setSelectedElement(null);
    setGalleryItemSelection(null);
    setSelectedTableStructuralNode(null);
    setPendingElementDeletion(null);
    setPendingStyleDetach(null);
    setPendingTextStyleReset(null);
    setPendingCut(null);
    closeCanvasMediaEditing();
    clearCanvasDragPreview();
    canvasResizeRef.current = null;
    setCanvasResizeOverlay(null);
    setCanvasGuides([]);
    setCanvasGuideBounds(null);
    setRightPanelMode("editor");
  }

  function openRootDefinition(rootDefinitionId: string): void {
    const definition = presentation.rootDefinitions?.find((candidate) => candidate.id === rootDefinitionId);
    if (!definition) return;
    finishPresentationTransaction();
    setAuthoringTarget({ kind: "root-definition", rootDefinitionId });
    setSelectedElement(null);
    setGalleryItemSelection(null);
    setSelectedTableStructuralNode(null);
    setPendingElementDeletion(null);
    setPendingStyleDetach(null);
    setPendingTextStyleReset(null);
    setPendingCut(null);
    closeCanvasMediaEditing();
    clearCanvasDragPreview();
    canvasResizeRef.current = null;
    setCanvasResizeOverlay(null);
    setCanvasGuides([]);
    setCanvasGuideBounds(null);
    setRightPanelMode("editor");
  }

  // ==========================================================
  // END: TROCA DE SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: SELEÇÃO PELO CANVAS
  //
  // Event delegation:
  // procuramos o ancestral mais próximo com data-presentation-id.
  // ==========================================================

  function clearCanvasDragPreview() {
    const drag = canvasDragRef.current;

    if (!drag) {
      return;
    }

    if (drag.initialTranslate) {
      drag.target.style.setProperty("translate", drag.initialTranslate);
    } else {
      drag.target.style.removeProperty("translate");
    }

    canvasDragRef.current = null;
    clearCanvasGuides();
  }

  function getCanvasLayoutParent(
    canvas: HTMLDivElement,
    elementId: string,
  ): HTMLElement | null {
    if (!selectedSlide) {
      return null;
    }

    const position = findElementSiblingPosition(
      effectiveElements,
      elementId,
    );

    if (!position) {
      return null;
    }

    if (position.parentRef.kind === "slide") {
      const documentElement = findElementById(
        effectiveElements,
        elementId,
      );

      if (documentElement?.type === "container") {
        return canvas.querySelector<HTMLElement>(".presentation-slide-content");
      }

      return canvas.querySelector<HTMLElement>(".presentation-slide");
    }

    if (position.parentRef.kind === "content-slot") {
      return null;
    }

    if (position.parentRef.kind !== "container") {
      return null;
    }

    const parent = findElementById(
      effectiveElements,
      position.parentRef.id,
    );

    return parent?.type === "container"
      ? findCanvasElementById(canvas, parent.id)
      : null;
  }

  function getCanvasBounds(element: HTMLElement): CanvasBounds {
    const bounds = element.getBoundingClientRect();

    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  }

  function getCanvasSnapCandidates(
    parent: HTMLElement,
    selectedId: string,
  ): { candidates: CanvasSnapCandidate[]; parentBounds: CanvasBounds } {
    const parentBounds = getCanvasBounds(parent);
    const siblings = Array.from(parent.children).flatMap((child) => {
      if (
        !(child instanceof HTMLElement) ||
        child.dataset.presentationId === selectedId
      ) {
        return [];
      }

      return child.matches("[data-presentation-id]")
        ? [getCanvasBounds(child)]
        : [];
    });

    return {
      candidates: buildCanvasSnapCandidates(parentBounds, siblings),
      parentBounds,
    };
  }

  function parseComputedStylePx(
    value: string | undefined,
  ): number | undefined {
    if (!value) {
      return undefined;
    }

    const numeric = Number.parseFloat(value);

    return Number.isFinite(numeric) ? numeric : undefined;
  }

  function getContainerCanvasResizeGeometryForTarget(
    target: HTMLElement,
    layoutParent: HTMLElement,
    parentBounds: CanvasBounds,
    scaleX: number,
    scaleY: number,
    isAbsolute: boolean,
  ): ContainerCanvasResizeGeometry {
    const parentComputed = getComputedStyle(layoutParent);
    const parentClientWidth = layoutParent.clientWidth || parentBounds.width;
    const parentClientHeight = layoutParent.clientHeight || parentBounds.height;

    // Absolute percentage width/height resolves against the parent client
    // (containing-block) box, excluding its border. Flow percentage sizing
    // resolves against the direct parent content box, derived from the
    // client box minus its computed paddings.
    const parentWidthPx = isAbsolute
      ? parentClientWidth
      : Math.max(
          0,
          parentClientWidth -
            (parseComputedStylePx(parentComputed.paddingLeft) ?? 0) -
            (parseComputedStylePx(parentComputed.paddingRight) ?? 0),
        );
    const parentHeightPx = isAbsolute
      ? parentClientHeight
      : Math.max(
          0,
          parentClientHeight -
            (parseComputedStylePx(parentComputed.paddingTop) ?? 0) -
            (parseComputedStylePx(parentComputed.paddingBottom) ?? 0),
        );

    // Authored canonical width/height map to CSS content width/height.
    // Prefer the computed content-box value; never use the border-box
    // offsetWidth/offsetHeight as the authored baseline.
    const computed = getComputedStyle(target);
    const computedWidthPx = parseComputedStylePx(computed.width);
    const computedHeightPx = parseComputedStylePx(computed.height);
    const elementBounds = target.getBoundingClientRect();
    const parentClientLeft =
      parentBounds.left + layoutParent.clientLeft * scaleX;
    const parentClientTop =
      parentBounds.top + layoutParent.clientTop * scaleY;

    return {
      parentWidthPx,
      parentHeightPx,
      initialWidthPx:
        computedWidthPx !== undefined && computedWidthPx > 0
          ? computedWidthPx
          : elementBounds.width / scaleX,
      initialHeightPx:
        computedHeightPx !== undefined && computedHeightPx > 0
          ? computedHeightPx
          : elementBounds.height / scaleY,
      initialLeftPx: (elementBounds.left - parentClientLeft) / scaleX,
      initialTopPx: (elementBounds.top - parentClientTop) / scaleY,
      initialRightPx:
        (parentClientLeft + parentClientWidth * scaleX - elementBounds.right) /
        scaleX,
      initialBottomPx:
        (parentClientTop + parentClientHeight * scaleY - elementBounds.bottom) /
        scaleY,
    };
  }

  function clearCanvasGuides() {
    setCanvasGuides([]);
    setCanvasGuideBounds(null);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (cropEditingTarget) {
      return;
    }
    const target = event.target;

    if (!(target instanceof Element) || !selectedSlide) {
      return;
    }

    const iframeElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[data-presentation-type="embed"][data-presentation-id],' +
          ' [data-presentation-type="scripted"][data-presentation-id]',
      ),
    );
    const embedTarget = resolveCanvasEmbedPointerTarget(
      { clientX: event.clientX, clientY: event.clientY },
      iframeElements.map((iframeElement) => {
        const bounds = iframeElement.getBoundingClientRect();

        return {
          id: iframeElement.dataset.presentationId ?? "",
          type:
            iframeElement.dataset.presentationType === "scripted"
              ? ("scripted" as const)
              : ("embed" as const),
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        };
      }),
    );
    const ordinaryTarget = target.closest<HTMLElement>("[data-presentation-id]");
    const { elementTarget, target: hitTarget } = resolveCanvasPointerHit({
      embeds: iframeElements,
      embedTarget,
      ordinaryTarget,
    });
    const contentSlotTarget = target.closest<HTMLElement>(
      "[data-presentation-content-slot-id]",
    );
    const selection = resolveCanvasPointerSelection(
      hitTarget,
      effectiveElements,
    );

    if (!selection) {
      finishPresentationTransaction();
      setSelectedElement(null);

      return;
    }

    const contentSlotId = contentSlotTarget?.dataset.presentationContentSlotId;

    if (
      selectedElement?.id !== selection.id ||
      selectedElement.type !== selection.type ||
      selectedElement?.contentSlotId !== (contentSlotId ?? null)
    ) {
      finishPresentationTransaction();
    }
    setSelectedElement({
      id: selection.id,
      type: selection.type,
      contentSlotId: contentSlotId ?? null,
    });

    const draggable =
      selection.documentElement.type === "container"
        ? isContainerCanvasDraggable(selection.documentElement)
        : selection.documentElement.type === "text"
          ? selection.documentElement.layout?.position === "absolute"
        : selection.documentElement.type === "image" || selection.documentElement.type === "gallery" || selection.documentElement.type === "embed" || selection.documentElement.type === "scripted" || selection.documentElement.type === "code" || selection.documentElement.type === "terminal" || selection.documentElement.type === "table" || selection.documentElement.type === "blocks"
            ? selection.documentElement.layout?.position === "absolute"
          : selection.documentElement.type === "divider" || selection.documentElement.type === "topics" || selection.documentElement.type === "plot" || selection.documentElement.type === "interactive"
            ? selection.documentElement.layout?.position === "absolute"
            : false;

    if (elementTarget && isInsideContainerFitSurface(elementTarget)) {
      return;
    }

    if (isProtectedRootContainer(presentation, authoringTarget, selection.id)) {
      return;
    }

    if (!draggable || !elementTarget) {
      return;
    }

    const layoutParent = getCanvasLayoutParent(
      event.currentTarget,
      selection.id,
    );

    if (!layoutParent) {
      return;
    }

    const parentBounds = layoutParent.getBoundingClientRect();
    const logicalWidth = layoutParent.offsetWidth || parentBounds.width;
    const logicalHeight = layoutParent.offsetHeight || parentBounds.height;

    if (logicalWidth <= 0 || logicalHeight <= 0) {
      return;
    }

    const scaleX = parentBounds.width / logicalWidth || 1;
    const scaleY = parentBounds.height / logicalHeight || 1;

    let containerGeometry: ContainerCanvasDragGeometry | undefined;
    let canonicalTextGeometry: CanonicalTextCanvasGeometry | undefined;

    if (selection.documentElement.type === "container") {
      const clientWidth = layoutParent.clientWidth || parentBounds.width;
      const clientHeight = layoutParent.clientHeight || parentBounds.height;
      const parentClientLeft =
        parentBounds.left + layoutParent.clientLeft * scaleX;
      const parentClientTop =
        parentBounds.top + layoutParent.clientTop * scaleY;
      const elementBounds = elementTarget.getBoundingClientRect();

      containerGeometry = {
        parentWidthPx: clientWidth,
        parentHeightPx: clientHeight,
        initialLeftPx: (elementBounds.left - parentClientLeft) / scaleX,
        initialTopPx: (elementBounds.top - parentClientTop) / scaleY,
        initialRightPx:
          (parentClientLeft + clientWidth * scaleX - elementBounds.right) /
          scaleX,
        initialBottomPx:
          (parentClientTop + clientHeight * scaleY - elementBounds.bottom) /
          scaleY,
      };
    } else if (selection.documentElement.type === "text" || selection.documentElement.type === "image" || selection.documentElement.type === "gallery" || selection.documentElement.type === "embed" || selection.documentElement.type === "scripted" || selection.documentElement.type === "code" || selection.documentElement.type === "terminal" || selection.documentElement.type === "table" || selection.documentElement.type === "blocks" || selection.documentElement.type === "divider" || selection.documentElement.type === "topics" || selection.documentElement.type === "plot" || selection.documentElement.type === "interactive") {
      canonicalTextGeometry = getContainerCanvasResizeGeometryForTarget(
        elementTarget,
        layoutParent,
        parentBounds,
        scaleX,
        scaleY,
        true,
      );
    }

    event.preventDefault();
    elementTarget.setPointerCapture(event.pointerId);
    const snap = getCanvasSnapCandidates(layoutParent, selection.id);
    setCanvasGuideBounds(snap.parentBounds);
    canvasDragRef.current = {
      pointerId: event.pointerId,
      authoringTarget,
      elementId: selection.id,
      elementType: selection.documentElement.type,
      target: elementTarget,
      initialTranslate: elementTarget.style.getPropertyValue("translate"),
      startClientX: event.clientX,
      startClientY: event.clientY,
      parentWidthPx: logicalWidth,
      parentHeightPx: logicalHeight,
      scaleX,
      scaleY,
      ...(containerGeometry ? { containerGeometry } : {}),
      ...(canonicalTextGeometry ? { canonicalTextGeometry } : {}),
      deltaX: 0,
      deltaY: 0,
      initialBounds: getCanvasBounds(elementTarget),
      candidates: snap.candidates,
      guideBounds: snap.parentBounds,
    };
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = canvasDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const rawClientX = event.clientX - drag.startClientX;
    const rawClientY = event.clientY - drag.startClientY;
    const xSnap = resolveCanvasAxisSnap(
      "x",
      [
        drag.initialBounds.left + rawClientX,
        drag.initialBounds.left + drag.initialBounds.width / 2 + rawClientX,
        drag.initialBounds.left + drag.initialBounds.width + rawClientX,
      ],
      drag.candidates,
      event.altKey,
    );
    const ySnap = resolveCanvasAxisSnap(
      "y",
      [
        drag.initialBounds.top + rawClientY,
        drag.initialBounds.top + drag.initialBounds.height / 2 + rawClientY,
        drag.initialBounds.top + drag.initialBounds.height + rawClientY,
      ],
      drag.candidates,
      event.altKey,
    );

    drag.deltaX = (rawClientX + xSnap.correction) / drag.scaleX;
    drag.deltaY = (rawClientY + ySnap.correction) / drag.scaleY;
    setCanvasGuides(
      [xSnap.guide, ySnap.guide].filter(
        (guide): guide is CanvasSnapGuide => guide !== null,
      ),
    );
    drag.target.style.setProperty(
      "translate",
      `${drag.deltaX}px ${drag.deltaY}px`,
    );
  }

  function commitCanvasDrag() {
    const drag = canvasDragRef.current;

    if (!drag || (drag.deltaX === 0 && drag.deltaY === 0)) {
      clearCanvasDragPreview();
      return;
    }

    clearCanvasDragPreview();
    commitAuthoringAction(
      drag.authoringTarget,
      {
        kind: "canvas.drag",
        labelKey: "history.element.setting",
        labelParams: { setting: "canvas.drag" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, drag.elementId)?.elements ?? null;
        const element = elements ? findElementById(elements, drag.elementId) : null;
        if (
          !elements ||
          !element ||
          element.type !== drag.elementType ||
          isProtectedRootContainer(current, authoringTarget, drag.elementId)
        ) {
          return current;
        }

        const nextElements = updateElementById(elements, drag.elementId, (currentElement) => {
          if (currentElement.type !== drag.elementType) return currentElement;
          if (currentElement.type === "container") {
            return drag.containerGeometry
              ? updateContainerForCanvasDrag(
                  currentElement,
                  drag.deltaX,
                  drag.deltaY,
                  drag.containerGeometry,
                )
              : currentElement;
          }
          if (currentElement.type === "text") {
            return drag.canonicalTextGeometry
              ? updateCanonicalTextForCanvasDrag(currentElement, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
              : currentElement;
          }
          if (currentElement.type === "image") {
            return drag.canonicalTextGeometry
              ? updateCanonicalImageForCanvasDrag(currentElement, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
              : currentElement;
          }
          if (currentElement.type === "gallery" || currentElement.type === "embed" || currentElement.type === "scripted" || currentElement.type === "code" || currentElement.type === "terminal" || currentElement.type === "table" || currentElement.type === "blocks") {
            return drag.canonicalTextGeometry
              ? updateCanonicalSurfaceForCanvasDrag(currentElement, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
              : currentElement;
          }
          if (currentElement.type === "divider" || currentElement.type === "topics" || currentElement.type === "plot" || currentElement.type === "interactive") {
            return updateCanonicalElementForCanvasDrag(currentElement, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry ?? {
              parentWidthPx: drag.parentWidthPx,
              parentHeightPx: drag.parentHeightPx,
              initialLeftPx: 0,
              initialTopPx: 0,
              initialRightPx: 0,
              initialBottomPx: 0,
              initialWidthPx: 0,
              initialHeightPx: 0,
            });
          }
          return currentElement;
        });

        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, drag.elementId, nextElements);
      },
    );
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (canvasDragRef.current?.pointerId === event.pointerId) {
      commitCanvasDrag();
    }
  }

  function handleCanvasPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (canvasDragRef.current?.pointerId === event.pointerId) {
      clearCanvasDragPreview();
    }
  }

  function handleCropPointerDown(
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
    operation: "move" | CropCanvasHandle,
  ) {
    const overlay = canvasCropOverlay;
    const target = cropEditingTarget;
    const image = target ? resolveImageMediaTarget(target) : null;
    if (!overlay || !image || !target) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasCropDragRef.current = {
      pointerId: event.pointerId,
      target,
      operation,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialCrop: getEffectiveImageCrop(image.crop),
      previewBounds: overlay,
    };
  }

  function handleCropPointerMove(event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    const drag = canvasCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setCanvasCropPreview(resolveCropPointerValue(
      drag.initialCrop,
      drag.operation,
      drag.startClientX,
      drag.startClientY,
      drag.previewBounds,
      event.clientX,
      event.clientY,
    ));
  }

  function commitCanvasCrop(crop: NonNullable<CanvasCropDragState["initialCrop"]>, target: OwnedImageMediaAuthoringTarget) {
    const normalized = normalizeCropCanvasValue(crop);
    commitAuthoringAction(
      target.authoringTarget,
      {
        kind: "canvas.crop",
        labelKey: "history.element.setting",
        labelParams: { setting: "media.crop" },
      },
      (current) => {
        const authored = resolveImageMediaTarget(target, current);
        if (!authored || areImageCropsEqual(authored.crop, normalized)) return current;
        return applyImageMediaTargetUpdate(current, target, (media) => ({ ...media, crop: normalized }));
      },
    );
  }

  function handleCropPointerUp(event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    const drag = canvasCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const crop = resolveCropPointerValue(
      drag.initialCrop,
      drag.operation,
      drag.startClientX,
      drag.startClientY,
      drag.previewBounds,
      event.clientX,
      event.clientY,
    );
    canvasCropDragRef.current = null;
    setCanvasCropPreview(null);
    commitCanvasCrop(crop, drag.target);
  }

  function handleCropPointerCancel(event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    if (canvasCropDragRef.current?.pointerId !== event.pointerId) return;
    canvasCropDragRef.current = null;
    setCanvasCropPreview(null);
  }

  // ==========================================================
  // BEGIN: LINK ACTIVATION SUPPRESSION
  //
  // Authored presentation links render as native anchors through the
  // shared renderer. Inside the Editor they must not navigate, but
  // the href stays in the document so Player and Watch continue to
  // use native anchor behavior. Selection, drag and resize use
  // pointer events and are unaffected by click suppression.
  // ==========================================================

  function handleCanvasLinkClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isAuthoredPresentationLink(event.target)) {
      event.preventDefault();
    }
  }

  // ==========================================================
  // END: LINK ACTIVATION SUPPRESSION
  // ==========================================================

  function clearCanvasResizePreview() {
    const resize = canvasResizeRef.current;

    if (!resize) {
      return;
    }

    setCanvasResizeOverlay(resize.initialOverlay);
    canvasResizeRef.current = null;
    clearCanvasGuides();
  }

  function handleResizePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    direction: CanvasResizeDirection,
  ) {
    if (cropEditingTarget || !selectedDocumentElement || !canvasResizeOverlay || !selectedSlide) {
      return;
    }

    const channelAllowDirections =
      selectedDocumentElement.type === "container"
        ? getContainerCanvasResizeDirections(selectedDocumentElement)
        : null;

    if (
      channelAllowDirections !== null &&
      !channelAllowDirections.includes(direction)
    ) {
      return;
    }

    const canvas = slideCanvasRef.current;

    if (!canvas || !isCanvasResizable(selectedDocumentElement)) {
      return;
    }

    if (isProtectedRootContainer(presentation, authoringTarget, selectedDocumentElement.id)) {
      return;
    }

    const target = Array.from(
      canvas.querySelectorAll<HTMLElement>("[data-presentation-id]"),
    ).find(
      (candidate) =>
        candidate.dataset.presentationId === selectedDocumentElement.id,
    );
    const layoutParent = getCanvasLayoutParent(
      canvas,
      selectedDocumentElement.id,
    );

    if (!target || !layoutParent) {
      return;
    }

    if (isInsideContainerFitSurface(target)) {
      return;
    }

    const parentBounds = layoutParent.getBoundingClientRect();
    const logicalWidth = layoutParent.offsetWidth || parentBounds.width;
    const logicalHeight = layoutParent.offsetHeight || parentBounds.height;

    if (logicalWidth <= 0 || logicalHeight <= 0) {
      return;
    }

    const scaleX = parentBounds.width / logicalWidth || 1;
    const scaleY = parentBounds.height / logicalHeight || 1;

    let containerResizeGeometry: ContainerCanvasResizeGeometry | undefined;
    let canonicalTextResizeGeometry: CanonicalTextCanvasGeometry | undefined;

    if (selectedDocumentElement.type === "container") {
      containerResizeGeometry = getContainerCanvasResizeGeometryForTarget(
        target,
        layoutParent,
        parentBounds,
        scaleX,
        scaleY,
        selectedDocumentElement.layout?.position === "absolute",
      );
    } else if (selectedDocumentElement.type === "image" || selectedDocumentElement.type === "gallery" || selectedDocumentElement.type === "embed" || selectedDocumentElement.type === "scripted" || selectedDocumentElement.type === "code" || selectedDocumentElement.type === "terminal" || selectedDocumentElement.type === "table" || selectedDocumentElement.type === "blocks" || selectedDocumentElement.type === "plot") {
      canonicalTextResizeGeometry = getContainerCanvasResizeGeometryForTarget(
        target,
        layoutParent,
        parentBounds,
        scaleX,
        scaleY,
        selectedDocumentElement.layout?.position === "absolute",
      );
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const snap = getCanvasSnapCandidates(
      layoutParent,
      selectedDocumentElement.id,
    );
    setCanvasGuideBounds(snap.parentBounds);
    canvasResizeRef.current = {
      pointerId: event.pointerId,
      authoringTarget,
      elementId: selectedDocumentElement.id,
      elementType: selectedDocumentElement.type,
      handle: event.currentTarget,
      direction,
      startClientX: event.clientX,
      startClientY: event.clientY,
      parentWidthPx: logicalWidth,
      parentHeightPx: logicalHeight,
      scaleX,
      scaleY,
      initialWidthPx:
        (canonicalTextResizeGeometry?.initialWidthPx ?? (target.offsetWidth || target.getBoundingClientRect().width)),
      initialHeightPx:
        (canonicalTextResizeGeometry?.initialHeightPx ?? (target.offsetHeight || target.getBoundingClientRect().height)),
      initialOverlay: canvasResizeOverlay,
      ...(containerResizeGeometry
        ? { containerResizeGeometry }
        : {}),
      ...(canonicalTextResizeGeometry
        ? { canonicalTextResizeGeometry }
        : {}),
      deltaX: 0,
      deltaY: 0,
      candidates: snap.candidates,
      guideBounds: snap.parentBounds,
    };
  }

  function handleResizePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const resize = canvasResizeRef.current;

    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    const rawClientX = event.clientX - resize.startClientX;
    const rawClientY = event.clientY - resize.startClientY;
    const movesWest = resize.direction.includes("w");
    const movesEast = resize.direction.includes("e");
    const movesNorth = resize.direction.includes("n");
    const movesSouth = resize.direction.includes("s");
    const xSnap = resolveCanvasAxisSnap(
      "x",
      movesWest
        ? [resize.initialOverlay.left + rawClientX]
        : movesEast
          ? [
              resize.initialOverlay.left +
                resize.initialOverlay.width +
                rawClientX,
            ]
          : [],
      resize.candidates,
      event.altKey,
    );
    const ySnap = resolveCanvasAxisSnap(
      "y",
      movesNorth
        ? [resize.initialOverlay.top + rawClientY]
        : movesSouth
          ? [
              resize.initialOverlay.top +
                resize.initialOverlay.height +
                rawClientY,
            ]
          : [],
      resize.candidates,
      event.altKey,
    );

    resize.deltaX = toLogicalCanvasResizeDelta(
      rawClientX + xSnap.correction,
      resize.scaleX,
    );
    resize.deltaY = toLogicalCanvasResizeDelta(
      rawClientY + ySnap.correction,
      resize.scaleY,
    );
    setCanvasGuides(
      [xSnap.guide, ySnap.guide].filter(
        (guide): guide is CanvasSnapGuide => guide !== null,
      ),
    );
    const locked =
      selectedDocumentElement?.type === "image" && preserveImageProportion;
    const previewDeltas = locked
      ? null
      : getCanvasResizeDeltas(resize.direction, resize.deltaX, resize.deltaY);

    setCanvasResizeOverlay({
      ...resize.initialOverlay,
      left:
        resize.initialOverlay.left +
        getCanvasResizeDeltas(resize.direction, resize.deltaX, resize.deltaY)
          .offsetX *
          resize.scaleX,
      top:
        resize.initialOverlay.top +
        getCanvasResizeDeltas(resize.direction, resize.deltaX, resize.deltaY)
          .offsetY *
          resize.scaleY,
      width:
        (locked
          ? resolveProportionalResize(
              resize.direction,
              resize.deltaX,
              resize.deltaY,
              resize.initialWidthPx,
              resize.initialHeightPx,
            ).width
          : Math.max(1, resize.initialWidthPx + (previewDeltas?.width ?? 0))) *
        resize.scaleX,
      height:
        (locked
          ? resolveProportionalResize(
              resize.direction,
              resize.deltaX,
              resize.deltaY,
              resize.initialWidthPx,
              resize.initialHeightPx,
            ).height
          : Math.max(
              1,
              resize.initialHeightPx + (previewDeltas?.height ?? 0),
            )) * resize.scaleY,
    });
  }

  function commitCanvasResize() {
    const resize = canvasResizeRef.current;

    if (!resize || (resize.deltaX === 0 && resize.deltaY === 0)) {
      clearCanvasResizePreview();
      return;
    }

    canvasResizeRef.current = null;
    clearCanvasGuides();
    commitAuthoringAction(
      resize.authoringTarget,
      {
        kind: "canvas.resize",
        labelKey: "history.element.setting",
        labelParams: { setting: "canvas.resize" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, resize.elementId)?.elements ?? null;
        const element = elements ? findElementById(elements, resize.elementId) : null;
        if (
          !elements ||
          !element ||
          element.type !== resize.elementType ||
          isProtectedRootContainer(current, authoringTarget, resize.elementId)
        ) {
          return current;
        }

        const nextElements = updateElementById(
          elements,
          resize.elementId,
          (currentElement) => {
            if (currentElement.type !== resize.elementType) return currentElement;
            const element = currentElement;
            let nextElement: PresentationElement = element;

            if (element.type === "container") {
              if (!resize.containerResizeGeometry) {
                return element;
              }

              nextElement = updateContainerForCanvasResize(
                element,
                resize.direction,
                resize.deltaX,
                resize.deltaY,
                resize.containerResizeGeometry,
              );
            } else if (element.type === "image") {
              const proportional = preserveImageProportion
                ? resolveProportionalResize(
                    resize.direction,
                    resize.deltaX,
                    resize.deltaY,
                    resize.initialWidthPx,
                    resize.initialHeightPx,
                  )
                : undefined;
              nextElement = resize.canonicalTextResizeGeometry
                ? updateImageForCanvasResize(
                    element,
                    resize.direction,
                    resize.deltaX,
                    resize.deltaY,
                    resize.canonicalTextResizeGeometry,
                    proportional,
                  )
                : element;
            } else if (
              element.type === "gallery" ||
              element.type === "embed" ||
              element.type === "scripted" ||
              element.type === "code" ||
              element.type === "terminal" ||
              element.type === "table" ||
              element.type === "blocks" ||
              element.type === "plot"
            ) {
              nextElement = resize.canonicalTextResizeGeometry
                ? updateSurfaceForCanvasResize(
                    element,
                    resize.direction,
                    resize.deltaX,
                    resize.deltaY,
                    resize.canonicalTextResizeGeometry,
                  )
                : element;
            }

            return hasCanvasResizeLayoutChange(element, nextElement)
              ? nextElement
              : element;
          },
        );

        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, resize.elementId, nextElements);
      },
    );
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (canvasResizeRef.current?.pointerId === event.pointerId) {
      commitCanvasResize();
    }
  }

  function handleResizePointerCancel(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (canvasResizeRef.current?.pointerId === event.pointerId) {
      clearCanvasResizePreview();
    }
  }

  function getCanvasFocalPoint(
    overlay: CanvasFocalOverlay,
    clientX: number,
    clientY: number,
  ): ImageFocalPoint {
    return getImageFocalPointFromClientPosition(overlay, clientX, clientY);
  }

  function handleFocalPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!canvasFocalOverlay || !focalEditingTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasFocalDragRef.current = {
      pointerId: event.pointerId,
      target: focalEditingTarget,
      handle: event.currentTarget,
      bounds: canvasFocalOverlay,
    };
  }

  function handleFocalPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = canvasFocalDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setCanvasFocalPreview(
      getCanvasFocalPoint(drag.bounds, event.clientX, event.clientY),
    );
  }

  function commitCanvasFocalPoint(
    focalPoint: ImageFocalPoint,
    target: OwnedImageMediaAuthoringTarget,
  ) {
    commitAuthoringAction(
      target.authoringTarget,
      {
        kind: "canvas.focalPoint",
        labelKey: "history.element.setting",
        labelParams: { setting: "media.focalPoint" },
      },
      (current) => {
        const authored = resolveImageMediaTarget(target, current);
        if (
          !authored ||
          (authored.focalPoint?.x === focalPoint.x && authored.focalPoint?.y === focalPoint.y)
        ) {
          return current;
        }
        return applyImageMediaTargetUpdate(current, target, (media) => ({ ...media, focalPoint }));
      },
    );
  }

  function handleFocalPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = canvasFocalDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const focalPoint = getCanvasFocalPoint(
      drag.bounds,
      event.clientX,
      event.clientY,
    );

    event.preventDefault();
    event.stopPropagation();
    canvasFocalDragRef.current = null;
    setCanvasFocalPreview(null);
    commitCanvasFocalPoint(focalPoint, drag.target);
  }

  function handleFocalPointerCancel(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (canvasFocalDragRef.current?.pointerId === event.pointerId) {
      canvasFocalDragRef.current = null;
      setCanvasFocalPreview(null);
    }
  }

  // ==========================================================
  // END: SELEÇÃO PELO CANVAS
  // ==========================================================

  // ==========================================================
  // BEGIN: ATUALIZAÇÃO DO ELEMENTO SELECIONADO
  //
  // Esta é a única operação de escrita que o Inspector precisa
  // conhecer nesta fase.
  //
  // A função mantém a atualização imutável e funciona também
  // com elementos aninhados em containers.
  // ==========================================================

  function updateSelectedElement(
    update: (element: PresentationElement) => PresentationElement,
  ) {
    if (!selectedElement) {
      return;
    }

    const intent = authoringIntentRef.current;
    const writeTarget = intent?.target ?? authoringTarget;
    const applyUpdate = (current: Presentation): Presentation => {
      if (
        writeTarget.kind === "slide" &&
        (current.slides[writeTarget.slideIndex]?.rootDefinitionId ?? current.defaultRootDefinitionId) !== undefined &&
        findLocalRootChildOwner(current, writeTarget.slideIndex, selectedElement.id) !== null
      ) {
        return updateLocalRootElement(current, writeTarget.slideIndex, selectedElement.id, update);
      }
      return updateAuthoringElements(current, writeTarget, (elements) =>
        updateElementById(elements, selectedElement.id, update));
    };
    if (intent?.type === "continuous") {
      dispatchHistory({ type: "transaction-update", key: intent.key, update: applyUpdate });
    } else if (intent?.type === "discrete") {
      dispatchHistory({ type: "commit", meta: intent.meta, update: applyUpdate });
    } else {
      dispatchHistory({ type: "untracked", update: applyUpdate });
    }
  }

  function runSelectedPlotPreview(command: (controller: PlotAnimationController) => void): void {
    if (selectedDocumentElement?.type !== "plot") return;
    const canvas = slideCanvasRef.current;
    if (!canvas) return;
    const controller = getPlotAnimationController(canvas, selectedDocumentElement.id);
    if (controller) command(controller);
  }

  const plotPreviewControls: PlotPreviewControls | undefined = selectedDocumentElement?.type === "plot"
    ? {
      onPlay: () => runSelectedPlotPreview((controller) => controller.play()),
      onPause: () => runSelectedPlotPreview((controller) => controller.pause()),
      onReset: () => runSelectedPlotPreview((controller) => controller.reset()),
    }
    : undefined;

  function attachSelectedContainerLinkedStyle(linkedStyleId: string): void {
    if (selectedDocumentElement?.type !== "container") return;
    const target = authoringTarget;
    const containerId = selectedDocumentElement.id;
    commitAuthoringAction(
      target,
      {
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "container.linkedStyle" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, containerId)?.elements ?? null;
        if (!elements) return current;
        const currentContainer = findElementById(elements, containerId);
        if (currentContainer?.type !== "container") return current;
        if (currentContainer.linkedStyleId === linkedStyleId) return current;
        const nextContainer = attachLinkedContainerStyleToElement(current, currentContainer, linkedStyleId);
        if (nextContainer === null) return current;
        const nextElements = updateElementById(elements, containerId, () => nextContainer);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, containerId, nextElements);
      },
    );
  }

  function detachSelectedContainerLinkedStyle(): void {
    if (selectedDocumentElement?.type !== "container") return;
    const target = authoringTarget;
    const containerId = selectedDocumentElement.id;
    const expectedLinkedStyleId = selectedDocumentElement.linkedStyleId;
    if (expectedLinkedStyleId === undefined) return;
    commitAuthoringAction(
      target,
      {
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "container.linkedStyle" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, containerId)?.elements ?? null;
        if (!elements) return current;
        const currentContainer = findElementById(elements, containerId);
        if (currentContainer?.type !== "container" || currentContainer.linkedStyleId !== expectedLinkedStyleId) return current;
        const nextContainer = detachLinkedContainerStyleFromElement(current, currentContainer);
        if (nextContainer === null) return current;
        const nextElements = updateElementById(elements, containerId, () => nextContainer);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, containerId, nextElements);
      },
    );
  }

  function attachSelectedTopicsLinkedStyle(linkedStyleId: string): void {
    if (selectedDocumentElement?.type !== "topics") return;
    const target = authoringTarget;
    const topicsId = selectedDocumentElement.id;
    commitAuthoringAction(
      target,
      {
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.linkedStyle" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, topicsId)?.elements ?? null;
        if (!elements) return current;
        const currentTopics = findElementById(elements, topicsId);
        if (currentTopics?.type !== "topics") return current;
        if (currentTopics.linkedStyleId === linkedStyleId) return current;
        const nextTopics = attachLinkedTopicsStyleToElement(current, currentTopics, linkedStyleId);
        if (nextTopics === null) return current;
        const nextElements = updateElementById(elements, topicsId, () => nextTopics);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, topicsId, nextElements);
      },
    );
  }

  function detachSelectedTopicsLinkedStyle(): void {
    if (selectedDocumentElement?.type !== "topics") return;
    const target = authoringTarget;
    const topicsId = selectedDocumentElement.id;
    const expectedLinkedStyleId = selectedDocumentElement.linkedStyleId;
    if (expectedLinkedStyleId === undefined) return;
    commitAuthoringAction(
      target,
      {
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.linkedStyle" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, topicsId)?.elements ?? null;
        if (!elements) return current;
        const currentTopics = findElementById(elements, topicsId);
        if (currentTopics?.type !== "topics" || currentTopics.linkedStyleId !== expectedLinkedStyleId) return current;
        const nextTopics = detachLinkedTopicsStyleFromElement(current, currentTopics);
        if (nextTopics === null) return current;
        const nextElements = updateElementById(elements, topicsId, () => nextTopics);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, topicsId, nextElements);
      },
    );
  }

  function attachSelectedLinkedTargetStyle(linkedStyleId: string): void {
    const selected = selectedDocumentElement;
    if (!selected || (selected.type !== "code" && selected.type !== "terminal" && selected.type !== "table" && selected.type !== "divider")) return;
    const target = authoringTarget;
    const elementId = selected.id;
    const expectedType = selected.type;
    commitAuthoringAction(target, { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle" } }, (current, currentTarget) => {
      const elements = resolveOwnedAuthoringTree(current, currentTarget, elementId)?.elements ?? null;
      if (!elements) return current;
      const currentElement = findElementById(elements, elementId);
      if (!currentElement || currentElement.type !== expectedType || currentElement.linkedStyleId === linkedStyleId) return current;
      const nextElement = currentElement.type === "code" ? attachLinkedCodeStyleToElement(current, currentElement, linkedStyleId)
        : currentElement.type === "terminal" ? attachLinkedTerminalStyleToElement(current, currentElement, linkedStyleId)
          : currentElement.type === "table" ? attachLinkedTableStyleToElement(current, currentElement, linkedStyleId)
            : attachLinkedDividerStyleToElement(current, currentElement, linkedStyleId);
      if (nextElement === null) return current;
      return replaceOwnedAuthoringTree(current, currentTarget, elementId, updateElementById(elements, elementId, () => nextElement));
    });
  }

  function detachSelectedLinkedTargetStyle(): void {
    const selected = selectedDocumentElement;
    if (!selected || (selected.type !== "code" && selected.type !== "terminal" && selected.type !== "table" && selected.type !== "divider") || selected.linkedStyleId === undefined) return;
    const target = authoringTarget;
    const elementId = selected.id;
    const expectedType = selected.type;
    const expectedLinkedStyleId = selected.linkedStyleId;
    commitAuthoringAction(target, { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle" } }, (current, currentTarget) => {
      const elements = resolveOwnedAuthoringTree(current, currentTarget, elementId)?.elements ?? null;
      if (!elements) return current;
      const currentElement = findElementById(elements, elementId);
      if (!currentElement || currentElement.type !== expectedType || currentElement.linkedStyleId !== expectedLinkedStyleId) return current;
      const nextElement = currentElement.type === "code" ? detachLinkedCodeStyleFromElement(current, currentElement)
        : currentElement.type === "terminal" ? detachLinkedTerminalStyleFromElement(current, currentElement)
          : currentElement.type === "table" ? detachLinkedTableStyleFromElement(current, currentElement)
            : detachLinkedDividerStyleFromElement(current, currentElement);
      if (nextElement === null) return current;
      return replaceOwnedAuthoringTree(current, currentTarget, elementId, updateElementById(elements, elementId, () => nextElement));
    });
  }

  function handleContainerFitModeChange(mode: ContainerFitMode | null): boolean {
    if (selectedDocumentElement?.type !== "container") return false;

    const target = authoringTarget;
    const containerId = selectedDocumentElement.id;
    const renderTimeLocalFit = selectedDocumentElement.layout?.children?.fit;
    const renderTimeEffectiveFit = resolveLinkedContainerStyle(presentation, selectedDocumentElement).layout?.children?.fit;
    const requiresMeasurement = mode !== null &&
      renderTimeLocalFit === undefined &&
      renderTimeEffectiveFit === undefined;
    let measuredSourceSize: { sourceWidth: number; sourceHeight: number } | undefined;

    if (requiresMeasurement) {
      const target = slideCanvasRef.current === null
        ? null
        : findCanvasElementById(slideCanvasRef.current, containerId);
      const measured = target === null ? null : measureContainerFitSourceSize(target);
      if (measured === null) return false;
      measuredSourceSize = measured;
    }

    commitAuthoringAction(
      target,
      {
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "container.childrenFit" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, containerId)?.elements ?? null;
        if (!elements) return current;
        const currentElement = findElementById(elements, containerId);
        if (currentElement?.type !== "container") return current;

        const currentLocalFit = currentElement.layout?.children?.fit;
        const currentEffectiveFit = resolveLinkedContainerStyle(current, currentElement).layout?.children?.fit;
        const base = currentLocalFit === undefined && currentEffectiveFit !== undefined
          ? {
              ...currentElement,
              layout: {
                ...currentElement.layout,
                children: {
                  ...currentElement.layout?.children,
                  fit: { ...currentEffectiveFit },
                },
              },
            }
          : currentElement;
        const currentRequiresMeasurement = mode !== null &&
          currentLocalFit === undefined &&
          currentEffectiveFit === undefined;

        if (currentRequiresMeasurement && measuredSourceSize === undefined) return current;

        const updated = updateContainerFit(
          base,
          mode,
          currentRequiresMeasurement ? measuredSourceSize : undefined,
        );
        if (updated === null) return current;

        const updatedLocalFit = updated.layout?.children?.fit;
        if (areAuthoredContainerFitsEqual(currentLocalFit, updatedLocalFit)) return current;

        const nextElements = updateElementById(elements, containerId, () => updated);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, containerId, nextElements);
      },
    );
    return true;
  }

  // ==========================================================
  // BEGIN: EXPLICIT SAVE
  // ==========================================================

  const saveStatus = resolveSaveStatus(saveState, presentation);
  const workspaceSaveStatus = resolveWorkspaceSaveStatus(saveStatus, {
    presentationHasSaveError:
      saveState.hasSaveError && saveState.failedPresentation === presentation,
    notesPending: editorNotes.hasPending,
    notesSaving: editorNotes.isSaving,
    notesHasSaveError: editorNotes.hasSaveError,
  });
  const saveEnabled = isSaveEnabled(
    saveState,
    presentation,
    onSave !== undefined,
  );
  const autosaveEligible = isAutosaveEligible(
    saveState,
    presentation,
    onSave !== undefined,
  );

  // Shared save pipeline. Both the explicit Save button and debounced
  // autosave schedule the current Presentation snapshot through this function.
  function requestSave(snapshot: Presentation) {
    if (!onSave || saveState.isSaving) {
      return;
    }

    dispatchSave({ type: "save-start" });

    onSave(snapshot)
      .then(() => {
        dispatchSave({ type: "save-success", presentation: snapshot });
      })
      .catch((error) => {
        console.error("Failed to save presentation", error);
        dispatchSave({ type: "save-error", presentation: snapshot });
      });
  }

  function handleSave() {
    if (saveEnabled) {
      requestSave(presentation);
    }

    if (editorNotes.hasPending) {
      editorNotes.flush();
    }
  }

  // Debounced autosave on canonical Presentation identity change. Resets on
  // every new Presentation; only schedules when the snapshot is eligible.
  useEffect(() => {
    if (!autosaveEligible) {
      return;
    }

    const snapshot = presentation;
    const timer = window.setTimeout(() => {
      requestSave(snapshot);
    }, EDITOR_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [presentation, autosaveEligible]);

  // ==========================================================
  // END: EXPLICIT SAVE
  // ==========================================================

  // ==========================================================
  // BEGIN: EXPLICIT PUBLISH
  // ==========================================================

  const publishLabelStatus = resolvePublishButtonLabelStatus(
    publishState,
    presentation,
  );
  const publishEnabled = isPublishEnabled(
    publishState,
    saveStatus,
    onPublish !== undefined,
  );

  // When the canonical Presentation root changes, a previous local publish
  // success no longer reflects the current snapshot. Return to the normal
  // idle action state.
  useEffect(() => {
    if (
      publishState.status === "success" &&
      presentation !== publishState.publishedPresentation
    ) {
      dispatchPublish({ type: "publish-reset" });
    }
  }, [presentation, publishState]);

  function handlePublish() {
    if (!onPublish || publishState.status === "publishing") {
      return;
    }

    if (saveStatus !== "clean") {
      return;
    }

    dispatchPublish({ type: "publish-start" });

    onPublish()
      .then(() => {
        dispatchPublish({ type: "publish-success", presentation });
      })
      .catch((error) => {
        console.error("Failed to publish presentation", error);
        dispatchPublish({ type: "publish-error" });
      });
  }

  // ==========================================================
  // END: EXPLICIT PUBLISH
  // ==========================================================

  function addNamedPresentationPaletteColor(name: string, color: Color) {
    commitPresentationGlobalAction(
      {
        kind: "palette.add",
        labelKey: "history.element.setting",
        labelParams: { setting: "palette.add" },
      },
      (current) => {
        const result = addPaletteEntry(current, name, color);
        return result.ok ? result.presentation : current;
      },
    );
  }

  function removePresentationPaletteColor(colorId: string) {
    commitPresentationGlobalAction(
      {
        kind: "palette.remove",
        labelKey: "history.element.setting",
        labelParams: { setting: "palette.remove" },
      },
      (current) => {
        const result = removePaletteEntry(current, colorId);
        return result.ok ? result.presentation : current;
      },
    );
  }

  function updateNamedPresentationPaletteColor(
    colorId: string,
    patch: { name: string; value: Color },
  ) {
    applyPresentationPaletteUpdate(
      {
        kind: "palette.definition",
        labelKey: "history.element.setting",
        labelParams: { setting: "palette.definition" },
      },
      (current) => {
        const currentColor = current.palette?.colors.find((color) => color.id === colorId);
        if (!currentColor) return current;
        const renamed = renamePaletteEntry(current, colorId, patch.name);
        if (!renamed.ok) return current;
        const updated = updatePresentationPaletteColorValue(renamed.presentation, colorId, patch.value);
        if (!updated.ok) return current;
        const nextColor = updated.presentation.palette?.colors.find((color) => color.id === colorId);
        if (!nextColor || (
          nextColor.id === currentColor.id
          && nextColor.name === currentColor.name
          && nextColor.value === currentColor.value
        )) return current;
        return updated.presentation;
      },
    );
  }

  function addCustomLibraryPalette(palette: CustomLibraryPaletteDraft): CustomLibraryPaletteAddOutcome {
    const result = addCustomLibraryPaletteToPresentation(presentation, palette);
    if (!result.ok) return { ok: false, reason: result.reason };
    commitPresentationGlobalAction(
      {
        kind: "palette.import",
        labelKey: "history.element.setting",
        labelParams: { setting: "palette.import" },
      },
      (current) => {
        const currentResult = addCustomLibraryPaletteToPresentation(current, palette);
        return currentResult.ok ? currentResult.presentation : current;
      },
    );
    return { ok: true };
  }

  function addCustomLibraryFont(font: CustomLibraryFontDraft) {
    const result = addCustomLibraryFontToPresentation(presentation, font);
    if (result.kind === "unchanged" || result.kind === "conflict") {
      return { kind: result.kind, addedFaces: 0 };
    }

    commitPresentationGlobalAction(
      {
        kind: "font.import",
        labelKey: "history.element.setting",
        labelParams: { setting: "font.import" },
      },
      (current) => {
        const currentResult = addCustomLibraryFontToPresentation(current, font);
        return currentResult.kind === "added" || currentResult.kind === "merged"
          ? currentResult.presentation
          : current;
      },
    );
    return { kind: result.kind, addedFaces: result.addedFaces };
  }

  function removePresentationFont(fontResourceId: string): "removed" | "in-use" | "not-found" {
    const fontResource = presentation.resources?.fonts?.find((font) => font.id === fontResourceId);
    if (!fontResource) return "not-found";
    if (presentationUsesFontFamily(presentation, fontResource.family)) return "in-use";

    commitPresentationGlobalAction(
      {
        kind: "font.remove",
        labelKey: "history.element.setting",
        labelParams: { setting: "font.remove" },
      },
      (current) => {
        const fonts = current.resources?.fonts;
        const currentFont = fonts?.find((font) => font.id === fontResourceId);
        if (!fonts || !currentFont) return current;
        if (presentationUsesFontFamily(current, currentFont.family)) return current;
        const remainingFonts = fonts.filter((font) => font.id !== fontResourceId);
        if (remainingFonts.length > 0) {
          return { ...current, resources: { ...current.resources, fonts: remainingFonts } };
        }
        if (current.resources && Object.keys(current.resources).some((key) => key !== "fonts")) {
          const { fonts: _fonts, ...remainingResources } = current.resources;
          return { ...current, resources: remainingResources };
        }
        const { resources: _resources, ...presentationWithoutResources } = current;
        return presentationWithoutResources;
      },
    );
    return "removed";
  }

  function updateFundamentalTextStyle(id: "title" | "subtitle" | "body" | "caption", patch: { style?: TextStyleVisualProperties; typography?: TextStyleTypographyProperties; layout?: TextStyleLayoutProperties }): void {
    applyTextStyleDefinitionUpdate(
      { kind: "textStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "textStyle.definition" } },
      (current) => {
        const before = current.textStyles?.find((style) => style.id === id);
        const candidate = upsertFundamentalTextStyleOverride(current, id, patch);
        const after = candidate.textStyles?.find((style) => style.id === id);
        if (areTextStyleDefinitionsEqualForAuthoring(before, after)) return current;
        return propagateTextStyleDefinitionChanges(candidate, id, before, after);
      },
    );
  }
  function resetFundamentalTextStyle(id: "title" | "subtitle" | "body" | "caption"): void {
    applyTextStyleDefinitionUpdate(
      { kind: "textStyle.reset", labelKey: "history.element.setting", labelParams: { setting: "textStyle.reset" } },
      (current) => {
        const before = current.textStyles?.find((style) => style.id === id);
        if (before === undefined) return current;
        const candidate = resetFundamentalTextStyleOverride(current, id);
        return propagateTextStyleDefinitionChanges(candidate, id, before, undefined);
      },
    );
  }
  function requestResetFundamentalTextStyle(id: "title" | "subtitle" | "body" | "caption") { setPendingTextStyleReset(id); }
  function addTextStyle(name: string, role: TextStyleRole): void {
    if (!name.trim()) return;
    applyTextStyleDefinitionUpdate(
      { kind: "textStyle.add", labelKey: "history.element.setting", labelParams: { setting: "textStyle.add" } },
      (current) => addCustomTextStyle(current, name, role),
    );
  }
  function createTextStyleFromSelectedText(name: string): void {
    if (selectedDocumentElement?.type !== "text") return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const textId = selectedDocumentElement.id;
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      { kind: "textStyle.createFromText", labelKey: "history.element.setting", labelParams: { setting: "textStyle.createFromText" } },
      (current, currentTarget) => {
        const elements = resolveOwnedAuthoringTree(current, currentTarget, textId)?.elements ?? null;
        const text = elements ? findElementById(elements, textId) : undefined;
        if (text?.type !== "text") return current;
        const created = createTextStyleFromText(current, text, trimmedName);
        if (!created) return current;
        return updateOwnedAuthoringTree(created.presentation, currentTarget, textId, (currentElements) =>
          updateElementById(currentElements, textId, (element) => element.type === "text" ? created.text : element),
        );
      },
    );
  }
  function updateTextStyle(id: string, patch: { name?: string; role?: TextStyleRole; style?: TextStyleVisualProperties; typography?: TextStyleTypographyProperties; layout?: TextStyleLayoutProperties }): void {
    applyTextStyleDefinitionUpdate(
      { kind: "textStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "textStyle.definition" } },
      (current) => {
        const before = current.textStyles?.find((style) => style.id === id);
        if (before === undefined || !("name" in before)) return current;
        const candidate = updateCustomTextStyle(current, id, patch);
        const after = candidate.textStyles?.find((style) => style.id === id);
        if (areTextStyleDefinitionsEqualForAuthoring(before, after)) return current;
        return propagateTextStyleDefinitionChanges(candidate, id, before, after);
      },
    );
  }
  function removeTextStyle(id: string): void {
    applyTextStyleDefinitionUpdate(
      { kind: "textStyle.remove", labelKey: "history.element.setting", labelParams: { setting: "textStyle.remove" } },
      (current) => removeUnusedCustomTextStyle(current, id) ?? current,
    );
  }
  function updatePresentationLinkedStyle(id: string, patch: Parameters<typeof updateLinkedStyle>[2]): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } },
      (current) => {
        const before = current.linkedStyles?.find((style) => style.id === id);
        if (before === undefined || ("target" in before && before.target === "topics")) return current;
        const afterPresentation = updateLinkedStyle(current, id, patch);
        const after = afterPresentation.linkedStyles?.find((style) => style.id === id);
        if (after === undefined || ("target" in after && after.target === "topics") || areLinkedContainerStyleDefinitionsEqual(before, after)) return current;
        return propagateLinkedContainerStyleDefinitionChanges(afterPresentation, id, before, after);
      },
    );
  }
  function createPresentationLinkedStyle(name: string, property: LinkedStyleAuthorableProperty): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.add", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.add" } },
      (current) => {
        const created = createLinkedStyleWithProperty(current, name, property);
        return created.linkedStyleId === undefined || created.presentation === current ? current : created.presentation;
      },
    );
  }
  function updatePresentationLinkedTopicsStyle(id: string, patch: Parameters<typeof updateLinkedTopicsStyle>[2]): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } },
      (current) => {
        const before = current.linkedStyles?.find((style) => style.id === id);
        if (before === undefined || !("target" in before) || before.target !== "topics") return current;
        const candidate = updateLinkedTopicsStyle(current, id, patch);
        const after = candidate.linkedStyles?.find((style) => style.id === id);
        if (after === undefined || !("target" in after) || after.target !== "topics") return current;
        return propagateLinkedTopicsStyleDefinitionChanges(candidate, id, before, after);
      },
    );
  }
  function createLinkedStyleFromSelectedElement(name: string): void {
    if (!name.trim()) return;
    if (!selectedDocumentElement || !["container", "topics", "code", "terminal", "table", "divider"].includes(selectedDocumentElement.type)) return;

    const target = authoringTarget;
    const elementId = selectedDocumentElement.id;
    const expectedType = selectedDocumentElement.type;

    commitAuthoringAction(
      target,
      {
        kind: "linkedStyle.createFromElement",
        labelKey: "history.element.setting",
        labelParams: { setting: "linkedStyle.createFromElement" },
      },
      (current, currentTarget) => {
        const elements = resolveOwnedAuthoringTree(current, currentTarget, elementId)?.elements ?? null;
        const currentElement = elements ? findElementById(elements, elementId) : undefined;
        if (!currentElement || currentElement.type !== expectedType) return current;

        if (expectedType === "container") {
          if (currentElement.type !== "container" || !canCreateLinkedStyleFromContainer(currentElement)) return current;
          const candidate = createLinkedStyleFromContainerElement(current, currentElement, name);
          return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) =>
            updateElementById(currentElements, elementId, (element) => element.type === "container" ? candidate.element : element),
          );
        }
        if (expectedType === "topics") {
          if (currentElement.type !== "topics" || !canCreateLinkedStyleFromTopics(currentElement)) return current;
          const candidate = createLinkedStyleFromTopicsElement(current, currentElement, name);
          return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) => updateElementById(currentElements, elementId, (element) => element.type === "topics" ? candidate.element : element));
        }
        if (expectedType === "code" && currentElement.type === "code" && canCreateLinkedStyleFromCode(currentElement)) {
          const candidate = createLinkedStyleFromCodeElement(current, currentElement, name);
          return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) => updateElementById(currentElements, elementId, (element) => element.type === "code" ? candidate.element : element));
        }
        if (expectedType === "terminal" && currentElement.type === "terminal" && canCreateLinkedStyleFromTerminal(currentElement)) {
          const candidate = createLinkedStyleFromTerminalElement(current, currentElement, name);
          return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) => updateElementById(currentElements, elementId, (element) => element.type === "terminal" ? candidate.element : element));
        }
        if (expectedType === "table" && currentElement.type === "table") {
          if (currentElement.mode === "structured" && canCreateLinkedStyleFromStructuredTable(currentElement)) {
            const candidate = createLinkedStyleFromStructuredTableElement(current, currentElement, name);
            return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) => updateElementById(currentElements, elementId, (element) => element.type === "table" ? candidate.element : element));
          }
          if (currentElement.mode !== "structured" && canCreateLinkedStyleFromSimpleTable(currentElement)) {
            const candidate = createLinkedStyleFromSimpleTableElement(current, currentElement, name);
            return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) => updateElementById(currentElements, elementId, (element) => element.type === "table" ? candidate.element : element));
          }
        }
        if (expectedType === "divider" && currentElement.type === "divider" && canCreateLinkedStyleFromDivider(currentElement)) {
          const candidate = createLinkedStyleFromDividerElement(current, currentElement, name);
          return candidate === null ? current : updateOwnedAuthoringTree(candidate.presentation, currentTarget, elementId, (currentElements) => updateElementById(currentElements, elementId, (element) => element.type === "divider" ? candidate.element : element));
        }
        return current;
      },
    );
  }
  function renamePresentationLinkedStyle(id: string, name: string): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } },
      (current) => {
        const before = current.linkedStyles?.find((style) => style.id === id);
        if (before === undefined || ("target" in before && before.target === "topics")) return current;
        const afterPresentation = renameLinkedStyle(current, id, name);
        const after = afterPresentation.linkedStyles?.find((style) => style.id === id);
        return after !== undefined && !(("target" in after) && after.target === "topics") && !areLinkedContainerStyleDefinitionsEqual(before, after)
          ? afterPresentation
          : current;
      },
    );
  }
  function removePresentationLinkedStyle(id: string): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.remove", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.remove" } },
      (current) => {
        const target = current.linkedStyles?.find((style) => style.id === id);
        if (target === undefined || ("target" in target && target.target === "topics")) return current;
        return removeUnusedLinkedStyle(current, id) ?? current;
      },
    );
  }
  function renamePresentationLinkedTopicsStyle(id: string, name: string): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } },
      (current) => {
        const before = current.linkedStyles?.find((style) => style.id === id);
        if (before === undefined || !("target" in before) || before.target !== "topics") return current;
        const candidate = renameLinkedStyle(current, id, name);
        const after = candidate.linkedStyles?.find((style) => style.id === id);
        if (after === undefined || !("target" in after) || after.target !== "topics" || areLinkedTopicsStyleDefinitionsEqual(before, after) === true) return current;
        return candidate;
      },
    );
  }
  function removePresentationLinkedTopicsStyle(id: string): void {
    applyLinkedStyleDefinitionUpdate(
      { kind: "linkedStyle.remove", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.remove" } },
      (current) => {
        const target = current.linkedStyles?.find((style) => style.id === id);
        if (target === undefined || !("target" in target) || target.target !== "topics") return current;
        return removeUnusedLinkedStyle(current, id) ?? current;
      },
    );
  }
  function attachLinkedStyleMatches(id: string): void {
    commitPresentationGlobalAction(
      {
        kind: "linkedStyle.attachMatches",
        labelKey: "history.element.setting",
        labelParams: { setting: "linkedStyle.attachMatches" },
      },
      (current) => {
        const linkedStyle = current.linkedStyles?.find((style) => style.id === id);
        if (linkedStyle === undefined || ("target" in linkedStyle && linkedStyle.target === "topics")) return current;

        const result = attachLinkedStyleToMatchingContainers(current, id);
        return result.attachedLocations.length === 0 || result.presentation === current ? current : result.presentation;
      },
    );
  }
  function selectLinkedStyleContainer(location: LinkedStyleUsageLocation, linkedStyleId: string): void {
    const elements = resolveAuthoringElements(presentation, location.target);
    const element = elements ? findElementById(elements, location.elementId) : null;
    if (element?.type !== "container" || element.linkedStyleId !== linkedStyleId) return;
    if (location.target.kind === "slide") setSelectedSlideIndex(location.target.slideIndex);
    if (!areAuthoringTargetsEqual(authoringTarget, location.target)) {
      pendingResourceSelectionRef.current = { target: location.target, elementId: element.id, elementType: "container", styleId: linkedStyleId };
      setAuthoringTarget(location.target);
      setSelectedElement(null);
      return;
    }
    setSelectedElement({ id: element.id, type: "container" });
  }

  function selectTextStyleElement(location: TextStyleUsageLocation, styleId: string): void {
    const elements = resolveAuthoringElements(presentation, location.target);
    const element = elements ? findElementById(elements, location.elementId) : null;
    if (element?.type !== "text" || element.variant !== styleId || element.styleDetached === true) return;
    if (location.target.kind === "slide") setSelectedSlideIndex(location.target.slideIndex);
    if (!areAuthoringTargetsEqual(authoringTarget, location.target)) {
      pendingResourceSelectionRef.current = { target: location.target, elementId: element.id, elementType: "text", styleId };
      setAuthoringTarget(location.target);
      setSelectedElement(null);
      return;
    }
    setSelectedElement({ id: element.id, type: "text" });
  }

  function requestTextStyleDetach(styleId: string, styleName: string, location: TextStyleUsageLocation): void {
    setPendingStyleDetach({ kind: "text-style", styleId, styleName, target: location.target, elementId: location.elementId });
  }

  function requestLinkedStyleDetach(styleId: string, styleName: string, location: LinkedStyleUsageLocation): void {
    setPendingStyleDetach({ kind: "linked-style", styleId, styleName, target: location.target, elementId: location.elementId });
  }

  function confirmStyleDetach(): void {
    const pending = pendingStyleDetach;
    if (!pending) return;
    if (pending.kind === "text-style") {
      commitAuthoringAction(
        pending.target,
        {
          kind: "element.setting",
          labelKey: "history.element.setting",
          labelParams: { setting: "text.style" },
        },
        (current, target) => {
          const elements = resolveAuthoringElements(current, target);
          if (!elements) return current;
          if (!listPresentationTextStyles(current).some(({ id }) => id === pending.styleId)) return current;
          const element = findElementById(elements, pending.elementId);
          if (element?.type !== "text" || element.variant !== pending.styleId || element.styleDetached === true) return current;
          const nextElements = updateElementById(
            elements,
            pending.elementId,
            (element) => element.type === "text" ? detachTextStyle(current, element) : element,
          );
          return nextElements === elements ? current : replaceAuthoringElements(current, target, nextElements);
        },
      );
    } else {
      commitAuthoringAction(
        pending.target,
        {
          kind: "element.setting",
          labelKey: "history.element.setting",
          labelParams: { setting: "container.linkedStyle" },
        },
        (current, target) => {
          const elements = resolveAuthoringElements(current, target);
          const element = elements ? findElementById(elements, pending.elementId) : undefined;
          if (element?.type !== "container" || element.linkedStyleId !== pending.styleId) return current;
          const linkedStyle = current.linkedStyles?.find((style) => style.id === pending.styleId);
          if (linkedStyle === undefined || ("target" in linkedStyle && linkedStyle.target === "topics")) return current;
          const detached = detachLinkedContainerStyleFromElement(current, element);
          if (detached === null || !elements) return current;
          const nextElements = updateElementById(elements, pending.elementId, (candidate) => candidate.type === "container" ? detached : candidate);
          return nextElements === elements ? current : replaceAuthoringElements(current, target, nextElements);
        },
      );
    }
    setPendingStyleDetach(null);
  }

  // ==========================================================
  // BEGIN: ADD ELEMENT
  //
  // Regra:
  //
  // nenhuma seleção
  //   → raiz do slide
  //
  // container selecionado
  //   → filho do container
  //
  // outro elemento selecionado
  //   → irmão imediatamente depois
  // ==========================================================

  function addElement(type: ElementCreateType) {
    const usedIds = collectPresentationAuthoringIds(presentation);
    const newElement = createElement(type, usedIds);
    const target = authoringTarget;

    if (rootBackedSlide && target.kind === "slide") {
      const selectedId = selectedElement?.id ?? null;
      const selectedOwner = selectedId === null
        ? undefined
        : selectedMasterElement
          ? "master"
          : findLocalRootChildOwner(presentation, target.slideIndex, selectedId) !== null
            ? "slide"
            : undefined;
      const receiverId = selectedOwner === "master"
        ? selectedDocumentElement?.type === "container" ? selectedDocumentElement.id : null
        : selectedId === null
          ? null
          : findLocalRootChildOwner(presentation, target.slideIndex, selectedId)?.targetContainerId ?? null;
      if (receiverId === null) return;

      commitAuthoringAction(
        target,
        {
          kind: "element.add",
          labelKey: "history.element.add",
          labelParams: { elementType: type },
        },
        (current) => {
          const prepared = type === "table"
            ? ensureStructuredTableTextStyles(current).presentation
            : type === "topics"
              ? ensureTopicsTextStyle(current)
              : current;
          const slide = prepared.slides[target.slideIndex];
          if (!slide) return current;
          const projected = materializeSlide(prepared, slide).slide;
          const destination = selectedOwner === "master"
            ? { kind: "append-container" as const, containerId: receiverId }
            : resolveAddElementDestination(
                projected.elements,
                selectedId,
                newElement,
                selectedElement?.contentSlotId ?? null,
              );
          return updateLocalRootChildren(prepared, target.slideIndex, receiverId, (children) => {
            if (selectedOwner === "master") {
              return [...children, newElement];
            }
            switch (destination.kind) {
              case "append-container":
                return appendElementToContainer(children, destination.containerId, newElement);
              case "append-content-slot":
                return appendElementToContentSlot(children, destination.contentSlotId, newElement);
              case "insert-after":
                return insertElementAfterId(children, destination.targetId, newElement);
              case "slide-root":
                return children;
            }
          });
        },
      );
      setSelectedElement({ id: newElement.id, type: newElement.type });
      return;
    }

    commitAuthoringAction(
      target,
      {
        kind: "element.add",
        labelKey: "history.element.add",
        labelParams: { elementType: type },
      },
      (current, authoringTarget) => {
        const prepared = type === "table"
          ? ensureStructuredTableTextStyles(current).presentation
          : type === "topics"
            ? ensureTopicsTextStyle(current)
            : current;
        const preparedElements = resolveAuthoringElements(prepared, authoringTarget);
        if (!preparedElements) return current;

        const selectedElementId = selectedElement?.id ?? null;
        if (
          selectedElementId !== null &&
          !findElementById(preparedElements, selectedElementId)
        ) {
          return current;
        }

        const rootContainerId = authoringTarget.kind === "root-definition"
          ? resolveCanonicalRootContainerId(prepared, authoringTarget)
          : null;

        const destination = resolveAddElementDestination(
          preparedElements,
          selectedElementId,
          newElement,
          selectedElement?.contentSlotId ?? null,
        );

        const resolvedDestination =
          authoringTarget.kind === "root-definition" && selectedElementId === null
            ? { kind: "append-container" as const, containerId: rootContainerId }
            : destination;
        if (
          resolvedDestination.kind === "append-container" &&
          resolvedDestination.containerId === null
        ) {
          return current;
        }

        let nextElements: PresentationElement[];
        switch (resolvedDestination.kind) {
          case "slide-root":
            nextElements = [...preparedElements, newElement];
            break;

          case "append-container":
            if (resolvedDestination.containerId === null) return current;
            nextElements = appendElementToContainer(
              preparedElements,
              resolvedDestination.containerId,
              newElement,
            );
            break;

          case "append-content-slot":
            nextElements = appendElementToContentSlot(
              preparedElements,
              resolvedDestination.contentSlotId,
              newElement,
            );
            break;

          case "insert-after":
            nextElements = insertElementAfterId(
              preparedElements,
              resolvedDestination.targetId,
              newElement,
            );
            break;
        }

        if (nextElements === preparedElements) return current;
        return replaceAuthoringElements(prepared, authoringTarget, nextElements);
      },
    );

    setSelectedElement({
      id: newElement.id,

      type: newElement.type,
    });
  }

  function createQrFromSelectedLink(href: string): void {
    if (selectedMasterElement) return;
    if (
      !selectedDocumentElement ||
      (selectedDocumentElement.type !== "text" &&
        selectedDocumentElement.type !== "image" &&
        selectedDocumentElement.type !== "container") ||
      !selectedDocumentElement.link ||
      selectedDocumentElement.link.href !== href
    ) {
      return;
    }

    const target = authoringTarget;
    const sourceElementId = selectedElement?.id;
    if (!sourceElementId || isProtectedRootContainer(presentation, target, sourceElementId)) {
      return;
    }

    const newElement = createQrImageElement(href, collectPresentationAuthoringIds(presentation));
    if (!newElement) return;

    pendingQrSelectionRef.current = {
      target,
      sourceElementId,
      qrElementId: newElement.id,
      qrSource: newElement.src,
      beforePresentation: presentation,
    };

    commitAuthoringAction(
      target,
      {
        kind: "element.add",
        labelKey: "history.element.add",
        labelParams: { elementType: "image" },
      },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, sourceElementId)?.elements ?? null;
        if (!elements) return current;
        const currentSource = findElementById(elements, sourceElementId);
        if (
          !currentSource ||
          (currentSource.type !== "text" &&
            currentSource.type !== "image" &&
            currentSource.type !== "container") ||
          !currentSource.link ||
          currentSource.link.href !== href
        ) {
          return current;
        }
        if (isProtectedRootContainer(current, authoringTarget, sourceElementId)) return current;

        if (collectPresentationAuthoringIds(current).has(newElement.id)) return current;
        const nextElements = insertElementAfterId(
          elements,
          sourceElementId,
          newElement,
        );
        if (nextElements === elements) return current;
        return replaceOwnedAuthoringTree(current, authoringTarget, sourceElementId, nextElements);
      },
    );
  }

  // ==========================================================
  // END: ADD ELEMENT
  // ==========================================================

  function applyCustomLibraryItem(
    item: CustomLibraryItemDraft,
  ): CustomLibraryApplyOutcome {
    if (!selectedSlide) {
      return { ok: false, reason: "invalid-recipe-application" };
    }

    const slideIndex = selectedSlideIndex;
    const selectedElementId = selectedElement?.contentSlotId != null
      ? null
      : selectedElement?.id ?? null;
    const target = authoringTarget;
    const owner: CustomLibraryElementOwner = {
      resolveElements: (current) => resolveOwnedAuthoringTree(
        current,
        target,
        selectedElementId ?? undefined,
      )?.elements ?? null,
      replaceElements: (current, elements) => {
        const next = selectedElementId === null
          ? replaceAuthoringElements(current, target, elements)
          : replaceOwnedAuthoringTree(current, target, selectedElementId, elements);
        return next === current ? null : next;
      },
    };

    if (!owner.resolveElements(presentation)) {
      return { ok: false, reason: "invalid-recipe-application" };
    }

    const preflightResult = applyCustomLibraryItemToPresentation(
      item,
      presentation,
      slideIndex,
      selectedElementId,
      owner,
    );

    if (!preflightResult.ok) {
      return preflightResult;
    }

    let currentResult: ReturnType<typeof applyCustomLibraryItemToPresentation> = preflightResult;
    commitAuthoringAction(
      target,
      {
        kind: "customLibrary.apply",
        labelKey: "history.element.setting",
        labelParams: { setting: "customLibrary.apply" },
      },
      (current) => {
        const result = applyCustomLibraryItemToPresentation(
          item,
          current,
          slideIndex,
          selectedElementId,
          owner,
        );
        currentResult = result;
        return result.ok ? result.presentation : current;
      },
    );

    if (!currentResult.ok) {
      return currentResult;
    }

    const appliedElements = owner.resolveElements(preflightResult.presentation) ?? [];
    const appliedElement = findElementById(appliedElements, preflightResult.appliedElementId);
    if (appliedElement) {
      setSelectedElement({
        id: appliedElement.id,
        type: appliedElement.type,
        contentSlotId: null,
      });
    }

    return { ok: true };
  }

  // ==========================================================
  // BEGIN: ADD TOP LEVEL TOPIC
  //
  // Cria um novo TopicItem canônico (com IDs únicos em toda a
  // apresentação) e o acrescenta ao TopicsElement identificado
  // por topicsId.
  //
  // A operação de criação é independente de React e fica em
  // element-operations. Aqui apenas anexamos o item ao documento
  // e deixamos a seleção atual intacta.
  // ==========================================================

  function addTopLevelTopic(topicsId: string): string | null {
    const usedIds = collectPresentationAuthoringIds(presentation);
    const created = createDefaultTopicItem(usedIds);
    const target = authoringTarget;
    const elements = resolveOwnedAuthoringTree(presentation, target, topicsId)?.elements ?? null;

    if (!elements) {
      return null;
    }

    // Dry-run somente para validar o alvo e preservar o contrato
    // string | null. O resultado NÃO é reaproveitado na escrita.
    if (
      appendTopicItemToTopics(
        elements,
        topicsId,
        created.item,
      ) === elements
    ) {
      return null;
    }

    commitAuthoringAction(
      target,
      {
        kind: "topics.add",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.add" },
      },
      (current, authoringTarget) => {
        const prepared = ensureTopicsTextStyle(current);
        const preparedElements = resolveOwnedAuthoringTree(prepared, authoringTarget, topicsId)?.elements ?? null;
        if (!preparedElements) return current;

        const elements = appendTopicItemToTopics(
          preparedElements,
          topicsId,
          created.item,
        );

        return elements === preparedElements
          ? current
          : replaceOwnedAuthoringTree(prepared, authoringTarget, topicsId, elements);
      },
    );

    return created.item.id;
  }

  function addChildTopic(topicsId: string, topicItemId: string): string | null {
    const usedIds = collectPresentationAuthoringIds(presentation);
    const created = createDefaultTopicItem(usedIds);
    const target = authoringTarget;
    const elements = resolveOwnedAuthoringTree(presentation, target, topicsId)?.elements ?? null;

    if (!elements) {
      return null;
    }

    // Valida o par proprietário + TopicItem.
    // O array produzido aqui NÃO é usado na escrita React.
    if (
      appendChildTopicItemToTopics(
        elements,
        topicsId,
        topicItemId,
        created.item,
      ) === elements
    ) {
      return null;
    }

    commitAuthoringAction(
      target,
      {
        kind: "topics.add",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.add" },
      },
      (current, authoringTarget) => {
        const prepared = ensureTopicsTextStyle(current);
        const preparedElements = resolveOwnedAuthoringTree(prepared, authoringTarget, topicsId)?.elements ?? null;
        if (!preparedElements) return current;

        const elements = appendChildTopicItemToTopics(
          preparedElements,
          topicsId,
          topicItemId,
          created.item,
        );

        return elements === preparedElements
          ? current
          : replaceOwnedAuthoringTree(prepared, authoringTarget, topicsId, elements);
      },
    );

    return created.item.id;
  }

  // ==========================================================
  // END: ADD TOP LEVEL TOPIC
  // ==========================================================

  // END: BLOCKS AUTHORING CONTROLS
  // ==========================================================

  // ==========================================================
  // BEGIN: DUPLICATE ELEMENT
  //
  // A duplicação sempre cria um irmão imediatamente depois do
  // elemento original.
  //
  // Containers são clonados recursivamente com novos IDs.
  // ==========================================================

  function duplicateSelectedElement() {
    if (!selectedDocumentElement) {
      return;
    }
    if (isProtectedRootContainer(presentation, authoringTarget, selectedDocumentElement.id)) {
      return;
    }

    const sourceElementId = selectedDocumentElement.id;
    const usedIds = collectPresentationAuthoringIds(presentation);
    const duplicatedElement = duplicateElement(selectedDocumentElement, usedIds);
    const target = authoringTarget;

    if (rootBackedSlide && target.kind === "slide") {
      const owner = findLocalRootChildOwner(presentation, target.slideIndex, sourceElementId);
      if (!owner) return;
      commitAuthoringAction(
        target,
        {
          kind: "element.duplicate",
          labelKey: "history.element.duplicate",
          labelParams: { elementType: selectedDocumentElement.type },
        },
        (current) => updateOwnedAuthoringTree(
          current,
          target,
          sourceElementId,
          (children) => insertElementAfterId(children, sourceElementId, duplicatedElement),
        ),
      );
      setSelectedElement({ id: duplicatedElement.id, type: duplicatedElement.type });
      return;
    }

    commitAuthoringAction(
      target,
      {
        kind: "element.duplicate",
        labelKey: "history.element.duplicate",
        labelParams: { elementType: selectedDocumentElement.type },
      },
      (current, authoringTarget) => {
        const currentElements = resolveAuthoringElements(current, authoringTarget);
        const source = currentElements
          ? findElementById(currentElements, sourceElementId)
          : null;
        if (
          !currentElements ||
          !source ||
          source.type !== selectedDocumentElement.type ||
          isProtectedRootContainer(current, authoringTarget, sourceElementId)
        ) {
          return current;
        }

        const nextElements = insertElementAfterId(
          currentElements,
          sourceElementId,
          duplicatedElement,
        );
        if (nextElements === currentElements) return current;
        return replaceAuthoringElements(current, authoringTarget, nextElements);
      },
    );

    setSelectedElement({
      id: duplicatedElement.id,

      type: duplicatedElement.type,
    });
  }

  // ==========================================================
  // END: DUPLICATE ELEMENT
  // ==========================================================

  // ==========================================================
  // BEGIN: DELETE ELEMENT
  // ==========================================================

  function confirmElementDeletion() {
    if (!pendingElementDeletion) {
      return;
    }

    const deletion = pendingElementDeletion;
    const current = history.present;
    if (!areAuthoringTargetsEqual(authoringTarget, deletion.target)) {
      setPendingElementDeletion(null);
      return;
    }
    if (deletion.target.kind === "slide" && (deletion.target.slideIndex === selectedSlideIndex)) {
      const slideIndex = deletion.target.slideIndex;
      const projected = materializeSlide(current, current.slides[slideIndex]!);
      const localOwner = findLocalRootChildOwner(current, slideIndex, deletion.elementId);
      const localElement = findElementById(projected.slide.elements, deletion.elementId);
      if (localOwner && localElement?.type === deletion.elementType) {
        commitAuthoringAction(
          deletion.target,
          { kind: "element.delete", labelKey: "history.element.delete", labelParams: { elementType: deletion.elementType } },
          (currentPresentation) => updateLocalRootChildren(
            currentPresentation,
            slideIndex,
            localOwner.targetContainerId,
            (children) => removeElementById(children, deletion.elementId),
          ),
        );
        setSelectedElement((currentSelection) => currentSelection?.id === deletion.elementId ? null : currentSelection);
        setPendingElementDeletion(null);
        return;
      }
    }
    const currentElements = resolveAuthoringElements(current, deletion.target);
    const currentElement = currentElements
      ? findElementById(currentElements, deletion.elementId)
      : null;
    if (
      !currentElements ||
      !currentElement ||
      currentElement.type !== deletion.elementType ||
      isProtectedRootContainer(current, deletion.target, deletion.elementId)
    ) {
      setPendingElementDeletion(null);
      return;
    }

    commitAuthoringAction(
      deletion.target,
      { kind: "element.delete", labelKey: "history.element.delete", labelParams: { elementType: deletion.elementType } },
      (currentPresentation, target) => {
        const elements = resolveAuthoringElements(currentPresentation, target);
        const element = elements
          ? findElementById(elements, deletion.elementId)
          : null;
        if (
          !elements ||
          !element ||
          element.type !== deletion.elementType ||
          isProtectedRootContainer(currentPresentation, target, deletion.elementId)
        ) {
          return currentPresentation;
        }
        return replaceAuthoringElements(
          currentPresentation,
          target,
          removeElementById(elements, deletion.elementId),
        );
      },
    );

    setSelectedElement((current) =>
      current?.id === deletion.elementId ? null : current,
    );
    setPendingElementDeletion(null);
  }

  function confirmContainerDeletionPreservingChildren() {
    if (!pendingElementDeletion || pendingElementDeletion.elementType !== "container") {
      return;
    }

    const deletion = pendingElementDeletion;
    const current = history.present;
    if (deletion.target.kind === "slide" && deletion.target.slideIndex === selectedSlideIndex) {
      const slideIndex = deletion.target.slideIndex;
      const projected = materializeSlide(current, current.slides[slideIndex]!);
      const localOwner = findLocalRootChildOwner(current, slideIndex, deletion.elementId);
      const localElement = findElementById(projected.slide.elements, deletion.elementId);
      if (localOwner && localElement?.type === "container") {
        commitAuthoringAction(
          deletion.target,
          { kind: "element.deleteContainerPreserveChildren", labelKey: "history.element.deleteContainerPreserveChildren" },
          (currentPresentation) => updateLocalRootChildren(
            currentPresentation,
            slideIndex,
            localOwner.targetContainerId,
            (children) => unwrapContainerPreservingChildren(children, deletion.elementId).elements,
          ),
        );
        setSelectedElement((currentSelection) => currentSelection?.id === deletion.elementId ? null : currentSelection);
        setPendingElementDeletion(null);
        return;
      }
    }
    const currentElements = resolveAuthoringElements(current, deletion.target);
    const currentElement = currentElements
      ? findElementById(currentElements, deletion.elementId)
      : null;
    if (
      !areAuthoringTargetsEqual(authoringTarget, deletion.target) ||
      !currentElements ||
      !currentElement ||
      currentElement.type !== "container" ||
      isProtectedRootContainer(current, deletion.target, deletion.elementId)
    ) {
      setPendingElementDeletion(null);
      return;
    }

    commitAuthoringAction(
      deletion.target,
      {
        kind: "element.deleteContainerPreserveChildren",
        labelKey: "history.element.deleteContainerPreserveChildren",
      },
      (currentPresentation, target) => {
        const elements = resolveAuthoringElements(currentPresentation, target);
        const element = elements
          ? findElementById(elements, deletion.elementId)
          : null;
        if (
          !elements ||
          element?.type !== "container" ||
          isProtectedRootContainer(currentPresentation, target, deletion.elementId)
        ) {
          return currentPresentation;
        }

        const result = unwrapContainerPreservingChildren(elements, deletion.elementId);
        if (!result.changed) return currentPresentation;

        return replaceAuthoringElements(currentPresentation, target, result.elements);
      },
    );

    setSelectedElement((current) => current?.id === deletion.elementId ? null : current);
    setPendingElementDeletion(null);
  }

  // ==========================================================
  // END: DELETE ELEMENT
  // ==========================================================

  // ==========================================================
  // END: ATUALIZAÇÃO DO ELEMENTO SELECIONADO
  // ==========================================================

  // ==========================================================
  // BEGIN: UPDATE DO SLIDE SELECIONADO
  //
  // Essa função será nossa API interna para propriedades do
  // próprio slide, começando pelo título.
  // ==========================================================

  function updateSelectedSlide(update: (slide: Slide) => Slide) {
    setPresentation((current) => ({
      ...current,

      slides: current.slides.map((slide, index) =>
        index === selectedSlideIndex ? update(slide) : slide,
      ),
    }));
  }

  // ==========================================================
  // END: UPDATE DO SLIDE SELECIONADO
  // ==========================================================
  // ==========================================================
  // BEGIN: CREATE SLIDE FROM PRESET
  // ==========================================================

  function addSlide(preset: SlideLayoutPreset) {
    const insertionIndex = Math.min(
      selectedSlideIndex + 1,
      presentation.slides.length,
    );

    const usedIds = collectPresentationAuthoringIds(presentation);
    const newSlide = createSlideFromPreset(preset, usedIds);

    commitPresentationGlobalAction(
      { kind: "slide.add", labelKey: "history.slide.add" },
      (current) => ({
        ...current,
        slides: [...current.slides.slice(0, insertionIndex), newSlide, ...current.slides.slice(insertionIndex)],
      }),
    );

    setSelectedSlideIndex(insertionIndex);
    setAuthoringTarget({ kind: "slide", slideIndex: insertionIndex });

    setSelectedElement(null);

    // ========================================================
    // BEGIN: FECHAR PICKER APÓS CRIAÇÃO
    // ========================================================

    setIsSlideLayoutPickerOpen(false);

    // ========================================================
    // END: FECHAR PICKER APÓS CRIAÇÃO
    // ========================================================
  }

  // ==========================================================
  // END: CREATE SLIDE FROM PRESET
  // ==========================================================

  function addRootDefinition(preset: SlideLayoutPreset) {
    const rootDefinitionBaseName = t("creation.rootDefinition");
    const existingNames = new Set(
      (presentation.rootDefinitions ?? []).map((definition) => definition.name.trim()),
    );
    let ordinal = 1;
    let name = `${rootDefinitionBaseName} ${ordinal}`;
    while (existingNames.has(name)) {
      ordinal += 1;
      name = `${rootDefinitionBaseName} ${ordinal}`;
    }

    const result = createRootDefinitionFromPreset(presentation, preset, name);
    if (!result.ok) {
      setCreationError(
        result.reason === "invalid-name"
          ? t("creation.invalidName")
          : t("creation.invalidResult"),
      );
      return;
    }

    commitPresentationGlobalAction(
      { kind: "rootDefinition.add", labelKey: "history.rootDefinition.add" },
      () => result.presentation,
    );
    setAuthoringTarget({ kind: "root-definition", rootDefinitionId: result.value });
    setSelectedElement(null);
    setCreationError(null);
    setIsSlideLayoutPickerOpen(false);
  }

  function renamePresentationRootDefinition(rootDefinitionId: string, name: string) {
    const result = renameRootDefinition(presentation, rootDefinitionId, name);
    if (!result.ok) return result.reason;
    commitPresentationGlobalAction(
      { kind: "rootDefinition.rename", labelKey: "history.rootDefinition.rename" },
      (current) => {
        const currentResult = renameRootDefinition(current, rootDefinitionId, name);
        return currentResult.ok ? currentResult.presentation : current;
      },
    );
    return null;
  }

  function deletePresentationRootDefinition(rootDefinitionId: string) {
    const result = deleteRootDefinition(presentation, rootDefinitionId);
    if (!result.ok) return result.reason;
    commitPresentationGlobalAction(
      { kind: "rootDefinition.delete", labelKey: "history.rootDefinition.delete" },
      (current) => {
        const currentResult = deleteRootDefinition(current, rootDefinitionId);
        return currentResult.ok ? currentResult.presentation : current;
      },
    );
    return null;
  }

  function changeSlideRootDefinition(rootDefinitionId: string): void {
    const nextRootDefinitionId = rootDefinitionId || undefined;
    const result = setSlideRootDefinition(presentation, selectedSlide.id, nextRootDefinitionId);
    if (!result.ok) {
      setSlideRootDefinitionError(result.reason);
      return;
    }
    commitPresentationGlobalAction(
      { kind: "rootDefinition.assign", labelKey: "history.rootDefinition.assign" },
      (current) => {
        const currentResult = setSlideRootDefinition(current, selectedSlide.id, nextRootDefinitionId);
        return currentResult.ok ? currentResult.presentation : current;
      },
    );
    setSlideRootDefinitionError(null);
  }

  function changeRootLocalContentTarget(containerId: string, allowed: boolean): void {
    if (authoringTarget.kind !== "root-definition") return;
    const rootDefinitionId = authoringTarget.rootDefinitionId;
    const result = setRootDefinitionLocalChildTarget(
      presentation,
      rootDefinitionId,
      containerId,
      allowed,
    );
    if (!result.ok) {
      setRootLocalContentTargetError({
        rootDefinitionId,
        containerId,
        reason: result.reason,
      });
      return;
    }

    commitPresentationGlobalAction(
      {
        kind: "rootDefinition.localContentTarget",
        labelKey: "history.rootDefinition.localContentTarget",
      },
      (current) => {
        const currentResult = setRootDefinitionLocalChildTarget(
          current,
          rootDefinitionId,
          containerId,
          allowed,
        );
        return currentResult.ok ? currentResult.presentation : current;
      },
    );
    setRootLocalContentTargetError(null);
  }

  function createSlideFromPicker() {
    addSlide(newSlidePreset);
    setCreationError(null);
  }

  function createRootFromPicker() {
    addRootDefinition("blank");
  }
  // ==========================================================
  // BEGIN: DUPLICATE SLIDE
  //
  // A cópia também é inserida imediatamente depois do atual.
  //
  // slide-operations.ts renova recursivamente todos os IDs.
  // ==========================================================

  function duplicateSelectedSlide() {
    if (rootDefinitionMode || !selectedSlide) {
      return;
    }

    const insertionIndex = selectedSlideIndex + 1;

    const usedIds = collectPresentationAuthoringIds(presentation);
    const duplicatedSlide = duplicateSlideWithUniqueIds(selectedSlide, usedIds);

    commitPresentationAction(
      { kind: "slide.duplicate", labelKey: "history.slide.duplicate" },
      (current) => ({
        ...current,
        slides: [...current.slides.slice(0, insertionIndex), duplicatedSlide, ...current.slides.slice(insertionIndex)],
      }),
    );

    setSelectedSlideIndex(insertionIndex);

    setSelectedElement(null);
  }

  // ==========================================================
  // END: DUPLICATE SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: DELETE SLIDE
  //
  // Por enquanto mantemos pelo menos um slide no Editor.
  //
  // Depois da remoção:
  //
  // - se existe slide na mesma posição, ele é selecionado;
  // - caso contrário, selecionamos o anterior.
  // ==========================================================

  function deleteSelectedSlide() {
    if (rootDefinitionMode || !selectedSlide || presentation.slides.length <= 1) {
      return;
    }

    const confirmed = window.confirm(
      t("slides.deleteConfirm", {
        title: selectedSlide.title || t("slides.untitled"),
      }),
    );

    if (!confirmed) {
      return;
    }

    const nextSlides = presentation.slides.filter(
      (_slide, index) => index !== selectedSlideIndex,
    );

    const nextIndex = Math.min(selectedSlideIndex, nextSlides.length - 1);

    commitPresentationAction(
      { kind: "slide.delete", labelKey: "history.slide.delete" },
      (current) => ({
      ...current,
      slides: current.slides.filter(
        (_slide, index) => index !== selectedSlideIndex,
      ),
      }),
    );

    setSelectedSlideIndex(nextIndex);

    setSelectedElement(null);
  }

  // ==========================================================
  // END: DELETE SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: MOVE SELECTED SLIDE
  //
  // offset:
  //
  // -1 → move para cima
  // +1 → move para baixo
  //
  // O elemento selecionado NÃO é limpo.
  //
  // Como o slide inteiro está apenas mudando de posição,
  // podemos continuar editando o mesmo elemento depois do
  // movimento.
  // ==========================================================

  function moveSelectedSlide(offset: -1 | 1) {
    if (rootDefinitionMode) return;
    const targetIndex = selectedSlideIndex + offset;

    if (targetIndex < 0 || targetIndex >= presentation.slides.length) {
      return;
    }

    commitPresentationAction(
      { kind: "slide.move", labelKey: "history.slide.move" },
      (current) => ({
        ...current,
        slides: moveSlide(current.slides, selectedSlideIndex, targetIndex),
      }),
    );

    setSelectedSlideIndex(targetIndex);
  }

  // ==========================================================
  // END: MOVE SELECTED SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: MOVE SELECTED ELEMENT
  //
  // Move apenas entre irmãos.
  //
  // A seleção permanece intacta porque o elemento continua
  // tendo exatamente o mesmo ID.
  // ==========================================================

  function moveSelectedElementTo(targetIndex: number) {
    if (!selectedElement || !selectedElementPosition) {
      return;
    }

    commitPresentationAction(
      { kind: "element.move", labelKey: "history.element.move" },
      (current) => {
        const currentSlide = current.slides[selectedSlideIndex];
        if (!currentSlide) return current;

        const nextElements = moveElementToSiblingIndexById(
          currentSlide.elements,
          selectedElement.id,
          targetIndex,
        );

        if (nextElements === currentSlide.elements) return current;

        return {
          ...current,
          slides: current.slides.map((slide, index) =>
            index === selectedSlideIndex ? { ...slide, elements: nextElements } : slide,
          ),
        };
      },
    );
  }

  function moveElementInTree(options: Parameters<typeof moveElement>[1]) {
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      { kind: "element.move", labelKey: "history.element.move" },
      (current, authoringTarget) => {
        const currentElements = resolveAuthoringElements(current, authoringTarget);
        if (!currentElements) return current;

        const source = findElementLocation(currentElements, options.elementId);
        if (!source) return current;

        const canonicalRootId = resolveCanonicalRootContainerId(current, authoringTarget);
        if (
          canonicalRootId !== null &&
          (options.elementId === canonicalRootId || options.targetParentRef.kind === "slide")
        ) {
          return current;
        }

        const areElementParentRefsEqual = (
          left: ElementParentRef,
          right: ElementParentRef,
        ): boolean => {
          switch (left.kind) {
            case "slide":
              return right.kind === "slide";
            case "container":
              return right.kind === "container" && left.id === right.id;
            case "content-slot":
              return right.kind === "content-slot" && left.id === right.id;
          }
        };

        if (
          areElementParentRefsEqual(source.parentRef, options.targetParentRef) &&
          ((options.targetIndex !== undefined && options.targetIndex === source.index) ||
            (options.targetIndex === undefined && source.index === source.count - 1))
        ) {
          return current;
        }

        const result = moveElement(currentElements, options);
        if (!result.moved) return current;

        return replaceAuthoringElements(current, authoringTarget, result.elements);
      },
    );
  }

  function moveTopicItemInTree(
    topicsId: string,
    topicItemId: string,
    targetIndex: number,
  ) {
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      {
        kind: "topics.move",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.move" },
      },
      (current, authoringTarget) => {
        const currentElements = resolveAuthoringElements(current, authoringTarget);
        if (!currentElements) return current;

        const nextElements = moveTopicItemToSiblingIndex(
          currentElements,
          topicsId,
          topicItemId,
          targetIndex,
        );

        return nextElements === currentElements
          ? current
          : replaceAuthoringElements(current, authoringTarget, nextElements);
      },
    );
  }

  function indentTopicItemInTree(topicsId: string, topicItemId: string) {
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      {
        kind: "topics.indent",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.indent" },
      },
      (current, authoringTarget) => {
        const currentElements = resolveAuthoringElements(current, authoringTarget);
        if (!currentElements) return current;

        const nextElements = indentTopicItem(
          currentElements,
          topicsId,
          topicItemId,
        );

        return nextElements === currentElements
          ? current
          : replaceAuthoringElements(current, authoringTarget, nextElements);
      },
    );
  }

  function outdentTopicItemInTree(topicsId: string, topicItemId: string) {
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      {
        kind: "topics.outdent",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.outdent" },
      },
      (current, authoringTarget) => {
        const currentElements = resolveAuthoringElements(current, authoringTarget);
        if (!currentElements) return current;

        const nextElements = outdentTopicItem(
          currentElements,
          topicsId,
          topicItemId,
        );

        return nextElements === currentElements
          ? current
          : replaceAuthoringElements(current, authoringTarget, nextElements);
      },
    );
  }

  function applyGalleryStructureDrop(options: Parameters<Parameters<typeof ElementTreePanel>[0]["onGalleryStructureDrop"]>[0]) {
    const authoringTargetAtStart = authoringTarget;
    const elements = resolveAuthoringElements(presentation, authoringTargetAtStart);
    if (!elements) return;

    const source = options.source;
    const target = options.target;
    const resolveOperation = (elements: PresentationElement[], usedIds: Set<string>) => {
      if (source.kind === "gallery-item") {
        if (target.kind === "gallery-item") {
          const gallery = findElementById(elements, source.galleryId);
          const targetGallery = findElementById(elements, target.galleryId);
          if (
            source.galleryId !== target.galleryId ||
            gallery?.type !== "gallery" ||
            targetGallery?.type !== "gallery" ||
            !gallery.items[source.itemIndex] ||
            !targetGallery.items[target.itemIndex]
          ) return null;

          const finalIndex = options.intent === "before"
            ? target.itemIndex - (source.itemIndex < target.itemIndex ? 1 : 0)
            : target.itemIndex + (source.itemIndex < target.itemIndex ? 0 : 1);
          return {
            kind: "move" as const,
            galleryId: source.galleryId,
            outcome: reorderGalleryItem(elements, source.galleryId, source.itemIndex, finalIndex),
          };
        }

        const currentTarget = findElementById(elements, target.element.id);
        if (
          currentTarget === null ||
          currentTarget.type !== target.element.type ||
          (options.intent === "inside" && currentTarget.type !== "container") ||
          (authoringTargetAtStart.kind === "root-definition" &&
            target.element.id === resolveCanonicalRootContainerId(presentation, authoringTargetAtStart) &&
            options.intent !== "inside")
        ) return null;

        return {
          kind: "detach" as const,
          galleryId: source.galleryId,
          outcome: detachGalleryItemToImage(
            elements,
            usedIds,
            source.galleryId,
            source.itemIndex,
            target.element.id,
            options.intent,
          ),
        };
      }

      if (target.kind === "gallery-item" && options.intent !== "inside") {
        const gallery = findElementById(elements, target.galleryId);
        if (
          gallery?.type !== "gallery" ||
          !gallery.items[target.itemIndex]
        ) return null;

        return {
          kind: "attach" as const,
          galleryId: target.galleryId,
          outcome: attachImageToGallery(
            elements,
            source.elementId,
            target.galleryId,
            target.itemIndex + (options.intent === "after" ? 1 : 0),
          ),
        };
      }

      if (target.kind === "element" && target.element.type === "gallery" && options.intent === "inside") {
        const gallery = findElementById(elements, target.element.id);
        if (gallery?.type !== "gallery") return null;

        return {
          kind: "attach" as const,
          galleryId: gallery.id,
          outcome: attachImageToGallery(
            elements,
            source.elementId,
            gallery.id,
            gallery.items.length,
          ),
        };
      }

      return null;
    };

    const resolved = resolveOperation(
      elements,
      collectPresentationAuthoringIds(presentation),
    );
    if (!resolved?.outcome.changed) return;

    const meta: HistoryActionMeta = {
      kind: `gallery.${resolved.kind}`,
      labelKey: "history.element.setting",
      labelParams: { setting: `gallery.${resolved.kind}` },
    };
    const expectedImageId = resolved.kind === "detach" ? resolved.outcome.imageId : undefined;

    closeCanvasMediaEditing();
    commitAuthoringAction(authoringTargetAtStart, meta, (current, authoringTarget) => {
      const currentElements = resolveAuthoringElements(current, authoringTarget);
      if (!currentElements) return current;

      const currentResolved = resolveOperation(
        currentElements,
        collectPresentationAuthoringIds(current),
      );
      if (
        !currentResolved?.outcome.changed ||
        currentResolved.kind !== resolved.kind ||
        (expectedImageId !== undefined && currentResolved.outcome.imageId !== expectedImageId)
      ) return current;

      return replaceAuthoringElements(current, authoringTarget, currentResolved.outcome.elements);
    });

    if (resolved.outcome.imageId) {
      setSelectedElement({ id: resolved.outcome.imageId, type: "image" });
      setGalleryItemSelection(null);
    } else if (resolved.outcome.galleryItemIndex !== undefined) {
      const galleryId = resolved.galleryId;
      if (!galleryId) return;
      setSelectedElement({ id: galleryId, type: "gallery" });
      setGalleryItemSelection({ galleryId, itemIndex: resolved.outcome.galleryItemIndex });
    }
  }

  function moveGalleryItemInTree(
    galleryId: string,
    itemIndex: number,
    offset: -1 | 1,
  ) {
    const target = authoringTarget;
    const elements = resolveAuthoringElements(presentation, target);
    if (!elements) return;
    const outcome = reorderGalleryItem(
      elements,
      galleryId,
      itemIndex,
      itemIndex + offset,
    );
    if (!outcome.changed || outcome.galleryItemIndex === undefined) return;

    closeCanvasMediaEditing();
    commitAuthoringAction(
      target,
      {
        kind: "gallery.move",
        labelKey: "history.element.setting",
        labelParams: { setting: "gallery.move" },
      },
      (current, authoringTarget) => {
        const currentElements = resolveAuthoringElements(current, authoringTarget);
        if (!currentElements) return current;

        const currentOutcome = reorderGalleryItem(
          currentElements,
          galleryId,
          itemIndex,
          itemIndex + offset,
        );
        if (!currentOutcome.changed) return current;

        return replaceAuthoringElements(current, authoringTarget, currentOutcome.elements);
      },
    );
    setSelectedElement({ id: galleryId, type: "gallery" });
    setGalleryItemSelection({ galleryId, itemIndex: outcome.galleryItemIndex });
  }

  // ==========================================================
  // END: MOVE SELECTED ELEMENT
  // ==========================================================

  // ==========================================================
  // BEGIN: STRUCTURED TABLE AUTHORING CONTROLS
  //
  // Structural Table mutations need globally-unique IDs, so they
  // prepare the full Presentation but mutate only the captured
  // AuthoringTarget tree.
  // ==========================================================

  function resolveStructuredTableInTarget(
    current: Presentation,
    target: AuthoringTarget,
    tableId: string,
  ): Extract<PresentationElement, { type: "table"; mode: "structured" }> | null {
    const elements = resolveOwnedAuthoringTree(current, target, tableId)?.elements ?? null;
    const element = elements ? findElementById(elements, tableId) : null;
    return element?.type === "table" && element.mode === "structured" ? element : null;
  }

  const tableAuthoringControls: TableAuthoringControls = {
    onAddColumn: (tableId) => {
      const target = authoringTarget;
      commitAuthoringAction(
        target,
        {
          kind: "table.addColumn",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.addColumn" },
        },
        (current, authoringTarget) => {
          const prepared = ensureStructuredTableTextStyles(current).presentation;
          const elements = resolveOwnedAuthoringTree(prepared, authoringTarget, tableId)?.elements ?? null;
          if (!elements || !resolveStructuredTableInTarget(prepared, authoringTarget, tableId)) return current;
          const usedIds = collectPresentationAuthoringIds(prepared);
          const nextElements = addColumnToStructuredTable(elements, tableId, usedIds);
          return nextElements === elements
            ? current
            : replaceOwnedAuthoringTree(prepared, authoringTarget, tableId, nextElements);
        },
      );
    },

    onRemoveColumn: (tableId, index) => {
      const target = authoringTarget;
      const currentTable = resolveStructuredTableInTarget(history.present, target, tableId);
      const expectedColumnId = currentTable?.columns[index]?.id;
      if (expectedColumnId === undefined) return;

      commitAuthoringAction(
        target,
        {
          kind: "table.removeColumn",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.removeColumn" },
        },
        (current, authoringTarget) => {
          const table = resolveStructuredTableInTarget(current, authoringTarget, tableId);
          if (table?.columns[index]?.id !== expectedColumnId) return current;
          const elements = resolveOwnedAuthoringTree(current, authoringTarget, tableId)?.elements ?? null;
          if (!elements) return current;
          const nextElements = removeColumnFromStructuredTable(elements, tableId, index);
          return nextElements === elements
            ? current
            : replaceOwnedAuthoringTree(current, authoringTarget, tableId, nextElements);
        },
      );
    },

    onAddRow: (tableId) => {
      const target = authoringTarget;
      commitAuthoringAction(
        target,
        {
          kind: "table.addRow",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.addRow" },
        },
        (current, authoringTarget) => {
          const prepared = ensureStructuredTableTextStyles(current).presentation;
          const elements = resolveOwnedAuthoringTree(prepared, authoringTarget, tableId)?.elements ?? null;
          if (!elements || !resolveStructuredTableInTarget(prepared, authoringTarget, tableId)) return current;
          const usedIds = collectPresentationAuthoringIds(prepared);
          const nextElements = addRowToStructuredTable(elements, tableId, usedIds);
          return nextElements === elements
            ? current
            : replaceOwnedAuthoringTree(prepared, authoringTarget, tableId, nextElements);
        },
      );
    },

    onRemoveRow: (tableId, index) => {
      const target = authoringTarget;
      const currentTable = resolveStructuredTableInTarget(history.present, target, tableId);
      const expectedRowId = currentTable?.rows[index]?.id;
      if (expectedRowId === undefined) return;

      commitAuthoringAction(
        target,
        {
          kind: "table.removeRow",
          labelKey: "history.element.setting",
          labelParams: { setting: "table.removeRow" },
        },
        (current, authoringTarget) => {
          const table = resolveStructuredTableInTarget(current, authoringTarget, tableId);
          if (table?.rows[index]?.id !== expectedRowId) return current;
          const elements = resolveOwnedAuthoringTree(current, authoringTarget, tableId)?.elements ?? null;
          if (!elements) return current;
          const nextElements = removeRowFromStructuredTable(elements, tableId, index);
          return nextElements === elements
            ? current
            : replaceOwnedAuthoringTree(current, authoringTarget, tableId, nextElements);
        },
      );
    },

    onShowHeaderChange: (tableId, showHeader) => {
      const target = authoringTarget;
      const currentTable = resolveStructuredTableInTarget(history.present, target, tableId);
      if (!currentTable || currentTable.showHeader === showHeader) return;
      commitAuthoringAction(
        target,
        { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "table.showHeader" } },
        (current, authoringTarget) => {
          const elements = resolveOwnedAuthoringTree(current, authoringTarget, tableId)?.elements ?? null;
          if (!elements) return current;
          const nextElements = setStructuredTableShowHeader(elements, tableId, showHeader);
          return nextElements === elements
            ? current
            : replaceOwnedAuthoringTree(current, authoringTarget, tableId, nextElements);
        },
      );
    },
  };

  function moveTableColumnInTree(tableId: string, columnId: string, offset: -1 | 1): void {
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      { kind: "table.moveColumn", labelKey: "history.element.setting", labelParams: { setting: "table.moveColumn" } },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, tableId)?.elements ?? null;
        if (!elements) return current;
        const nextElements = moveColumnInStructuredTable(elements, tableId, columnId, offset);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, tableId, nextElements);
      },
    );
  }

  function moveTableRowInTree(tableId: string, rowId: string, offset: -1 | 1): void {
    const target = authoringTarget;
    commitAuthoringAction(
      target,
      { kind: "table.moveRow", labelKey: "history.element.setting", labelParams: { setting: "table.moveRow" } },
      (current, authoringTarget) => {
        const elements = resolveOwnedAuthoringTree(current, authoringTarget, tableId)?.elements ?? null;
        if (!elements) return current;
        const nextElements = moveRowInStructuredTable(elements, tableId, rowId, offset);
        return nextElements === elements
          ? current
          : replaceOwnedAuthoringTree(current, authoringTarget, tableId, nextElements);
      },
    );
  }

  // ==========================================================
  // END: STRUCTURED TABLE AUTHORING CONTROLS
  // ==========================================================

  // ==========================================================
  // BEGIN: EMPTY STATE
  // ==========================================================

  if (!selectedSlide) {
    return (
      <main className={styles.emptyState}>
        <span>{t("slides.emptyPresentation")}</span>
      </main>
    );
  }

  // ==========================================================
  // END: EMPTY STATE
  // ==========================================================

  return (
    <main className={styles.editor}>
      {/* =====================================================
          BEGIN: TOP BAR
          ===================================================== */}

      {/* ==========================================================
    BEGIN: TOP BAR
    ========================================================== */}

      <Topbar
        className={
          chromeOsNativeSelectCompat
            ? styles.chromeOsNativeSelectCompatTopbar
            : undefined
        }
      >
        {/* ========================================================
      BEGIN: BRAND
      ======================================================== */}

        <ProductSurfaceBrand surface="editor" />

        {/* ========================================================
      END: BRAND
      ======================================================== */}

        {/* ========================================================
      BEGIN: PRESENTATION TITLE
      ======================================================== */}

        <TopbarTitle title={presentation.title}>
          <input
            className={styles.presentationTitleInput}
            value={presentation.title}
            aria-label={t("topbar.editor")}
            onFocus={() => beginPresentationTransaction("presentation:title", { kind: "presentation.rename", labelKey: "history.presentation.rename" })}
            onChange={(event) => {
              const title = event.target.value;
              updatePresentationTransaction("presentation:title", (current) =>
                updatePresentationTitle(current, title),
              );
            }}
            onBlur={() => finishPresentationTransaction("presentation:title")}
          />
        </TopbarTitle>

        {/* ========================================================
      END: PRESENTATION TITLE
      ======================================================== */}

        {/* ========================================================
      BEGIN: TOPBAR CONTROLS
      ======================================================== */}

        <TopbarActions>
          <Separator />

          {/* ======================================================
        BEGIN: SAVE STATUS
        ====================================================== */}

          <Status
            tone={
              workspaceSaveStatus === "error"
                ? "danger"
                : workspaceSaveStatus === "clean"
                  ? "success"
                  : "neutral"
            }
          >
            {onSave === undefined
              ? t("topbar.localDraft")
              : workspaceSaveStatus === "saving"
                ? t("topbar.saving")
                : workspaceSaveStatus === "error"
                  ? t("topbar.saveFailed")
                  : workspaceSaveStatus === "dirty"
                    ? t("topbar.unsavedChanges")
                    : t("topbar.saved")}
          </Status>

          {/* ======================================================
        END: SAVE STATUS
        ====================================================== */}

          {/* ======================================================
        BEGIN: SAVE BUTTON
        ====================================================== */}

          {onSave && (
            <Button
              variant="primary"
              size="compact"
              disabled={!saveEnabled && !editorNotes.hasPending}
              onClick={handleSave}
            >
              {t("topbar.save")}
            </Button>
          )}

          {/* ======================================================
        END: SAVE BUTTON
        ====================================================== */}

          {/* ======================================================
        BEGIN: PUBLISH BUTTON
        ====================================================== */}

          {onPublish && (
            <Button
              variant="primary"
              size="compact"
              disabled={!publishEnabled}
              onClick={handlePublish}
            >
              {publishLabelStatus === "publishing"
                ? t("topbar.publishing")
                : publishLabelStatus === "success"
                  ? t("topbar.published")
                  : publishLabelStatus === "error"
                    ? t("topbar.publishFailed")
                    : t("topbar.publish")}
            </Button>
          )}

          {/* ======================================================
        END: PUBLISH BUTTON
        ====================================================== */}
        </TopbarActions>

        {/* ========================================================
      END: TOPBAR CONTROLS
      ======================================================== */}
        <TopbarLocale>
          <LocaleSelector />
        </TopbarLocale>
      </Topbar>

      {/* ==========================================================
    END: TOP BAR
    ========================================================== */}
      {/* =====================================================
          BEGIN: WORKSPACE
          ===================================================== */}

      <div className={styles.workspace}>
        {/* ===================================================
            BEGIN: SLIDE SIDEBAR
            =================================================== */}

        <aside className={styles.slideSidebar}>
          {/* ==========================================================
    BEGIN: SLIDES HEADER
    ========================================================== */}
          <div className={`${styles.panelHeader} ${styles.slidePanelHeader}`}>
            <span>{t("slides.title")}</span>

            <button
              type="button"
              className={styles.slideHeaderButton}
              aria-expanded={isSlideLayoutPickerOpen}
              onClick={() => {
                setCreationError(null);
                setIsSlideLayoutPickerOpen((current) => {
                  if (current) return false;
                  return true;
                });
              }}
            >
              <span>
                {isSlideLayoutPickerOpen ? t("slides.close") : t("slides.new")}
              </span>
            </button>
          </div>
          {/* ==========================================================
    END: SLIDES HEADER
    ========================================================== */}
          {/* ==========================================================
    BEGIN: CONDITIONAL SLIDE LAYOUT PICKER
    ========================================================== */}

          <div className={styles.slideLayoutPickerSlot}>
            {isSlideLayoutPickerOpen && (
              <SlideLayoutPicker
                value={newSlidePreset}
                onChange={setNewSlidePreset}
                onCreate={createSlideFromPicker}
                onCreateRoot={createRootFromPicker}
                error={creationError}
              />
            )}
          </div>

          {/* ==========================================================
    END: CONDITIONAL SLIDE LAYOUT PICKER
    ========================================================== */}
          <div className={styles.slideList}>
            {presentation.slides.map((slide, index) => {
              const selected = index === selectedSlideIndex;

              return (
                <button
                  key={slide.id}
                  type="button"
                  className={
                    selected ? styles.slideItemSelected : styles.slideItem
                  }
                  disabled={rootDefinitionMode}
                  onClick={() => {
                    selectSlide(index);
                  }}
                >
                  <span className={styles.slideNumber}>{index + 1}</span>

                  <HoverScrollText text={slide.title || t("slides.untitled")} />
                </button>
              );
            })}
          </div>
          {/* =================================================
              BEGIN: SLIDE ACTIONS
              ================================================= */}

          <form autoComplete="off" className={styles.slideActions}>
            {/* ===============================================
                MOVE UP
                =============================================== */}

            <button
              type="button"
              className={styles.slideActionButton}
              disabled={rootDefinitionMode || selectedSlideIndex === 0}
              onClick={() => {
                moveSelectedSlide(-1);
              }}
              title={t("slides.moveUpTitle")}
            >
              <span>{t("slides.up")}</span>
            </button>

            {/* ===============================================
                MOVE DOWN
                =============================================== */}

            <button
              type="button"
              className={styles.slideActionButton}
              disabled={rootDefinitionMode || selectedSlideIndex === presentation.slides.length - 1}
              onClick={() => {
                moveSelectedSlide(1);
              }}
              title={t("slides.moveDownTitle")}
            >
              <span>{t("slides.down")}</span>
            </button>

            {/* ===============================================
                DUPLICATE
                =============================================== */}

            <button
              type="button"
              className={styles.slideActionButton}
              disabled={rootDefinitionMode}
              onClick={duplicateSelectedSlide}
            >
              <span>{t("slides.duplicate")}</span>
            </button>

            {/* ===============================================
                DELETE
                =============================================== */}

            <button
              type="button"
              className={`${styles.slideActionButton} ${styles.slideActionDanger}`}
              disabled={rootDefinitionMode || presentation.slides.length <= 1}
              onClick={deleteSelectedSlide}
            >
              <span>{t("slides.delete")}</span>
            </button>
          </form>
          {/* =================================================
              END: SLIDE ACTIONS
              ================================================= */}
        </aside>

        {/* ===================================================
            END: SLIDE SIDEBAR
            =================================================== */}

        {/* ===================================================
            BEGIN: CANVAS
            =================================================== */}

        <section className={styles.canvasArea}>
          <div className={styles.canvasToolbar}>
            <span data-authoring-target={rootDefinitionMode ? "root-definition" : "slide"}>
              {rootDefinitionMode && rootDefinition
                ? t("editor.masterContext", { name: rootDefinition.name })
                : t("slides.current", { number: selectedSlideIndex + 1 })}
            </span>

            <span>
              {selectedDocumentElement
                ? `${t(ELEMENT_TYPE_MESSAGE_KEYS[selectedDocumentElement.type])} · ${selectedDocumentElement.id}`
                : t("canvas.noElementSelected")}
            </span>

            <span className={styles.canvasToolbarRight}>
              {rootDefinitionMode && (
                <button
                  type="button"
                  className={`${styles.notesToggle} ${styles.notesToggleActive} ${styles.masterExitAction}`}
                  onClick={exitRootDefinitionEditing}
                >
                  {t("editor.exitMasterEditing")}
                </button>
              )}

              <button
                type="button"
                className={
                  rightPanelMode === "resources"
                    ? `${styles.notesToggle} ${styles.notesToggleActive}`
                    : styles.notesToggle
                }
                aria-pressed={rightPanelMode === "resources"}
                disabled={false}
                onClick={() => {
                  setRightPanelMode((current) =>
                    current === "resources" ? "editor" : "resources",
                  );
                }}
              >
                {t("editor.customResources")}
              </button>

              <button
                type="button"
                className={
                  rightPanelMode === "notes"
                    ? `${styles.notesToggle} ${styles.notesToggleActive}`
                    : styles.notesToggle
                }
                aria-pressed={rightPanelMode === "notes"}
                disabled={rootDefinitionMode}
                onClick={() => {
                  if (rootDefinitionMode) return;
                  setRightPanelMode((current) =>
                    current === "notes" ? "editor" : "notes",
                  );
                }}
              >
                {t("notes.toggle")}
              </button>

              <span>{presentation.aspectRatio}</span>
            </span>
          </div>

          <div ref={canvasViewportRef} className={styles.canvasViewport}>
            {renderedFontResources && (
              <style data-presentation-font-resources>
                {renderedFontResources}
              </style>
            )}

            <div
              className={styles.canvasStage}
              style={{
                width: `${canvasGeometry.physicalWidth}px`,
                height: `${canvasGeometry.physicalHeight}px`,
              }}
            >
              <div
                ref={slideCanvasRef}
                className={styles.slideCanvas}
                style={{
                  ...renderedPaletteStyle,
                  width: `${canvasGeometry.logicalWidth}px`,
                  height: `${canvasGeometry.logicalHeight}px`,
                  transform: `scale(${canvasGeometry.scale})`,
                }}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerCancel}
                onLostPointerCapture={handleCanvasPointerCancel}
                onClick={handleCanvasLinkClick}
                dangerouslySetInnerHTML={renderedSlideHtml}
              />
            </div>
            {cropEditingTarget && currentImageMediaTarget && areImageMediaTargetsEqual(cropEditingTarget, currentImageMediaTarget) && (
              <img
                key={`${imageMediaTargetKey(cropEditingTarget)}:${resolveImageMediaTarget(cropEditingTarget)?.src ?? ""}`}
                className={styles.canvasCropSourceLoader}
                src={resolveImageMediaTarget(cropEditingTarget)?.src ?? ""}
                alt=""
                draggable={false}
                data-crop-source-key={`${imageMediaTargetKey(cropEditingTarget)}:${resolveImageMediaTarget(cropEditingTarget)?.src ?? ""}`}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  const media = resolveImageMediaTarget(cropEditingTarget);
                  const sourceKey = `${imageMediaTargetKey(cropEditingTarget)}:${media?.src ?? ""}`;
                  if (
                    !media || sourceKey !== image.getAttribute("data-crop-source-key")
                  ) return;
                  setCropSourceMetrics({
                    key: sourceKey,
                    src: media.src,
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  });
                }}
                onError={(event) => {
                  if (cropEditingTarget) {
                    setCropSourceMetrics(null);
                  }
                }}
              />
            )}
            {cropEditingTarget && canvasCropAppearance && (
              <div
                className={styles.canvasCropAppearanceFrame}
                aria-hidden="true"
                style={{
                  left: `${canvasCropAppearance.left}px`,
                  top: `${canvasCropAppearance.top}px`,
                  width: `${canvasCropAppearance.width}px`,
                  height: `${canvasCropAppearance.height}px`,
                  border: canvasCropAppearance.border,
                  borderRadius: canvasCropAppearance.borderRadius,
                  boxShadow: canvasCropAppearance.boxShadow,
                }}
              />
            )}
            {cropEditingTarget && canvasCropOverlay && (
              <div
                className={styles.canvasCropSourcePreview}
                style={{
                  left: `${canvasCropOverlay.left}px`,
                  top: `${canvasCropOverlay.top}px`,
                  width: `${canvasCropOverlay.width}px`,
                  height: `${canvasCropOverlay.height}px`,
                }}
              >
                <img
                  className={styles.canvasCropSourceImage}
                  src={canvasCropOverlay.source}
                  alt=""
                  draggable={false}
                />
                {canvasCropOverlay && (
                  <>
                    <div className={styles.canvasCropMaskTop} style={{ height: `${Math.max(0, canvasCropOverlay.crop.top - canvasCropOverlay.top)}px` }} />
                    <div className={styles.canvasCropMaskLeft} style={{ left: 0, top: `${canvasCropOverlay.crop.top - canvasCropOverlay.top}px`, width: `${Math.max(0, canvasCropOverlay.crop.left - canvasCropOverlay.left)}px`, height: `${canvasCropOverlay.crop.height}px` }} />
                    <div className={styles.canvasCropMaskRight} style={{ left: `${canvasCropOverlay.crop.left - canvasCropOverlay.left + canvasCropOverlay.crop.width}px`, top: `${canvasCropOverlay.crop.top - canvasCropOverlay.top}px`, right: 0, height: `${canvasCropOverlay.crop.height}px` }} />
                    <div className={styles.canvasCropMaskBottom} style={{ top: `${canvasCropOverlay.crop.top - canvasCropOverlay.top + canvasCropOverlay.crop.height}px`, left: 0, right: 0, bottom: 0 }} />
                    <div
                      className={styles.canvasCropSelection}
                      style={{ left: `${canvasCropOverlay.crop.left - canvasCropOverlay.left}px`, top: `${canvasCropOverlay.crop.top - canvasCropOverlay.top}px`, width: `${canvasCropOverlay.crop.width}px`, height: `${canvasCropOverlay.crop.height}px` }}
                    >
                      <div
                        className={styles.canvasCropMoveSurface}
                        onPointerDown={(event) => handleCropPointerDown(event, "move")}
                        onPointerMove={handleCropPointerMove}
                        onPointerUp={handleCropPointerUp}
                        onPointerCancel={handleCropPointerCancel}
                        onLostPointerCapture={handleCropPointerCancel}
                      />
                      {(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const).map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          aria-label={`Crop ${direction}`}
                          className={`${styles.canvasCropHandle} ${styles[`canvasCropHandle${direction.toUpperCase()}`]}`}
                          onPointerDown={(event) => handleCropPointerDown(event, direction)}
                          onPointerMove={handleCropPointerMove}
                          onPointerUp={handleCropPointerUp}
                          onPointerCancel={handleCropPointerCancel}
                          onLostPointerCapture={handleCropPointerCancel}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {canvasResizeOverlay && !cropEditingTarget && (
              <div
                className={styles.canvasResizeOverlay}
                style={{
                  left: `${canvasResizeOverlay.left}px`,
                  top: `${canvasResizeOverlay.top}px`,
                  width: `${canvasResizeOverlay.width}px`,
                  height: `${canvasResizeOverlay.height}px`,
                }}
              >
                {(selectedDocumentElement?.type === "image" &&
                preserveImageProportion
                  ? CANVAS_IMAGE_CORNER_DIRECTIONS
                  : selectedDocumentElement?.type === "container"
                    ? getContainerCanvasResizeDirections(selectedDocumentElement)
                    : CANVAS_RESIZE_DIRECTIONS
                ).map((direction) => (
                  <button
                    key={direction}
                    className={`${styles.canvasResizeHandle} ${styles[`canvasResizeHandle${direction.toUpperCase()}`]}`}
                    type="button"
                    aria-label={`Resize ${direction}`}
                    title={`Resize ${direction}`}
                    style={{ cursor: getCanvasResizeCursor(direction) }}
                    onPointerDown={(event) =>
                      handleResizePointerDown(event, direction)
                    }
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    onPointerCancel={handleResizePointerCancel}
                    onLostPointerCapture={handleResizePointerCancel}
                  />
                ))}
              </div>
            )}
            {canvasGuideBounds &&
              canvasGuides.map((guide) => (
                <div
                  key={`${guide.axis}-${guide.value}`}
                  className={
                    guide.axis === "x"
                      ? styles.canvasGuideVertical
                      : styles.canvasGuideHorizontal
                  }
                  style={
                    guide.axis === "x"
                      ? {
                          left: `${guide.value}px`,
                          top: `${canvasGuideBounds.top}px`,
                          height: `${canvasGuideBounds.height}px`,
                        }
                      : {
                          left: `${canvasGuideBounds.left}px`,
                          top: `${guide.value}px`,
                          width: `${canvasGuideBounds.width}px`,
                        }
                  }
                />
              ))}
            {canvasFocalOverlay &&
              !cropEditingTarget &&
              displayedCanvasFocalPoint &&
              focalEditingTarget &&
              currentImageMediaTarget &&
              areImageMediaTargetsEqual(focalEditingTarget, currentImageMediaTarget) && (
                <button
                  className={styles.canvasFocalMarker}
                  type="button"
                  aria-label={t("image.focalPoint")}
                  title={t("image.focalPoint")}
                  style={{
                    left: `${canvasFocalOverlay.left + (displayedCanvasFocalPoint.x / 100) * canvasFocalOverlay.width}px`,
                    top: `${canvasFocalOverlay.top + (displayedCanvasFocalPoint.y / 100) * canvasFocalOverlay.height}px`,
                  }}
                  onPointerDown={handleFocalPointerDown}
                  onPointerMove={handleFocalPointerMove}
                  onPointerUp={handleFocalPointerUp}
                  onPointerCancel={handleFocalPointerCancel}
                  onLostPointerCapture={handleFocalPointerCancel}
                >
                  ⊕
                </button>
              )}
          </div>
        </section>

        {/* ===================================================
            END: CANVAS
            =================================================== */}

        {/* ===================================================
            BEGIN: INSPECTOR
            =================================================== */}

        {rightPanelMode === "notes" ? (
          <SlideNotesWorkspace
            note={editorNotes.note}
            status={editorNotes.status}
            hasCurrentSaveError={editorNotes.hasCurrentSaveError}
            onChange={editorNotes.onChange}
          />
        ) : rightPanelMode === "resources" ? (
          <CustomResourcesWorkspace
            customLibraryPaletteRepository={customLibraryPaletteRepository}
            customLibraryFontRepository={customLibraryFontRepository}
            customLibraryRepository={customLibraryRepository}
            presentationColors={presentation.palette?.colors ?? []}
            presentationFonts={presentation.resources?.fonts ?? []}
            onAddLibraryPalette={addCustomLibraryPalette}
            onAddLibraryFont={addCustomLibraryFont}
            onApplyElementStyle={applyCustomLibraryItem}
            allowElementStyleApply={elementStyleApplyAllowed}
            onAddPresentationColor={addNamedPresentationPaletteColor}
            onUpdatePresentationColor={updateNamedPresentationPaletteColor}
            onRemovePresentationColor={removePresentationPaletteColor}
            onRemovePresentationFont={removePresentationFont}
            isPresentationFontInUse={(family) => presentationUsesFontFamily(presentation, family)}
            presentationTextStyles={presentation.textStyles ?? []}
            presentation={presentation}
            authoringHistory={authoringHistory}
            onUpdateFundamentalTextStyle={updateFundamentalTextStyle}
            onResetFundamentalTextStyle={requestResetFundamentalTextStyle}
            onAddTextStyle={addTextStyle}
            onCreateTextStyleFromSelected={createTextStyleFromSelectedText}
            onUpdateTextStyle={updateTextStyle}
            onRemoveTextStyle={removeTextStyle}
             isTextStyleInUse={(id) => isTextStyleUsed(presentation, id)}
             onUpdateLinkedStyle={updatePresentationLinkedStyle}
             onUpdateLinkedTopicsStyle={updatePresentationLinkedTopicsStyle}
             onCreateLinkedStyle={createPresentationLinkedStyle}
             onRenameLinkedStyle={renamePresentationLinkedStyle}
             onRenameLinkedTopicsStyle={renamePresentationLinkedTopicsStyle}
             onRemoveLinkedStyle={removePresentationLinkedStyle}
             onRemoveLinkedTopicsStyle={removePresentationLinkedTopicsStyle}
             onAttachLinkedStyleMatches={attachLinkedStyleMatches}
             onSelectLinkedStyleContainer={selectLinkedStyleContainer}
             onSelectTextStyleElement={selectTextStyleElement}
             onSelectRootDefinitionSlide={selectSlideFromResourceUsage}
             onRequestDetachLinkedStyle={requestLinkedStyleDetach}
             onRequestDetachTextStyleElement={requestTextStyleDetach}
            selectedElement={selectedDocumentElement}
            activeRootDefinitionId={authoringTarget.kind === "root-definition" ? authoringTarget.rootDefinitionId : undefined}
            onOpenRootDefinition={openRootDefinition}
            onRenameRootDefinition={renamePresentationRootDefinition}
            onDeleteRootDefinition={deletePresentationRootDefinition}
            onCreateLinkedStyleFromSelected={createLinkedStyleFromSelectedElement}
             resourceSections={resourceSections}
             onResourceSectionChange={(id, open) => setResourceSections((current) => ({ ...current, [id]: open }))}
           />
        ) : (
          <aside className={styles.inspector}>
            <div className={styles.panelHeader + " " + styles.editorPanelTabHeader}>
              <button
                className={styles.panelGroupSwitch}
                type="button"
                aria-label={t("editor.scrollTabsEarlier")}
                onClick={() => scrollEditorPanelTabs(-70)}
              >
                ‹
              </button>
              <div
                className={styles.panelTabViewport}
                ref={editorPanelTabsRef}
              >
                <div className={styles.panelTabStrip}>
                  <button className={editorPanelView === "inspector" ? styles.rightPanelTabActive : styles.rightPanelTab} type="button" aria-pressed={editorPanelView === "inspector"} onClick={() => setEditorPanelView("inspector")}>{t("inspector.title")}</button>
                  <button className={editorPanelView === "elements" ? styles.rightPanelTabActive : styles.rightPanelTab} type="button" aria-pressed={editorPanelView === "elements"} onClick={() => setEditorPanelView("elements")}>{t("tree.elements")}</button>
                  <button className={editorPanelView === "clipboard" ? styles.rightPanelTabActive : styles.rightPanelTab} type="button" aria-pressed={editorPanelView === "clipboard"} onClick={() => setEditorPanelView("clipboard")}>{t("editor.clipboard")}</button>
                  <button className={editorPanelView === "history" ? styles.rightPanelTabActive : styles.rightPanelTab} type="button" aria-pressed={editorPanelView === "history"} onClick={() => setEditorPanelView("history")}>{t("editor.history")}</button>
                </div>
              </div>
              <button
                className={styles.panelGroupSwitch}
                type="button"
                aria-label={t("editor.scrollTabsLater")}
                onClick={() => scrollEditorPanelTabs(70)}
              >
                ›
              </button>
            </div>

            <div
              className={`${styles.inspectorContent} ${
                chromeOsNativeSelectCompat
                  ? styles.chromeOsNativeSelectCompatInspector
                  : ""
              }`}
            >
              {(() => {
                switch (editorPanelView) {
                  case "clipboard":
                    return (
                <ClipboardPanel
                  session={clipboardSession}
                  pendingCut={pendingCut}
                  pendingCutLabel={t("editor.pendingCut")}
                  presentation={presentation}
                  canPaste={!rootBackedSlide}
                  clearLabel={t("editor.clearClipboard")}
                  emptyLabel={t("editor.clipboardEmpty")}
                  pinnedLabel={t("editor.pinnedSnapshots")}
                  onClear={() => {
                    setPendingCut(null);
                    setClipboardSession(clearDisposableClipboardEntries);
                  }}
                  onSelect={selectClipboardEntry}
                  onPaste={(entryId) => {
                    selectClipboardEntry(entryId);
                    pasteClipboardEntry(entryId);
                  }}
                  onCancelPendingCut={() => setPendingCut(null)}
                  pinLabel={t("editor.pinSnapshot")}
                  unpinLabel={t("editor.unpinSnapshot")}
                  removeLabel={t("editor.removeSnapshot")}
                  onPin={(entryId) =>
                    setClipboardSession((current) =>
                      current.entries.find((entry) => entry.id === entryId)?.pinned
                        ? unpinClipboardEntry(current, entryId)
                        : pinClipboardEntry(current, entryId),
                    )
                  }
                  onRemove={(entryId) =>
                    setClipboardSession((current) => removeClipboardEntry(current, entryId))
                  }
                  typeLabel={(element) =>
                    getElementLabel(element, t(ELEMENT_TYPE_MESSAGE_KEYS[element.type]))
                  }
                />
                    );
                  case "history":
                    return (
                      <HistoryPanel
                        pastActions={history.past.map((entry) => entry.action)}
                        futureActions={history.future.map((entry) => entry.action)}
                        emptyLabel={t("editor.historyEmpty")}
                        appliedLabel={t("editor.historyApplied")}
                        redoLabel={t("editor.historyRedo")}
                        translate={t}
                      />
                    );
                  case "elements":
                    return (
                      <ElementTreePanel
                  key={selectedSlide.id}
                  slide={effectiveSlide ?? selectedSlide}
                  selectedElementId={selectedElement?.id ?? null}
                  selectedContentSlotId={selectedElement?.contentSlotId ?? null}
                  selectedGalleryItemIndex={
                    selectedElement?.id === galleryItemSelection?.galleryId
                      ? galleryItemSelection?.itemIndex ?? null
                      : null
                  }
                  onSelectElement={(selection) => {
                    if (selection.type === "gallery") {
                      closeCanvasMediaEditing();
                      setGalleryItemSelection(
                        selection.galleryItemIndex === null ||
                          selection.galleryItemIndex === undefined
                          ? selectedDocumentElement?.type === "gallery" &&
                              selectedDocumentElement.id === selection.id &&
                              selectedDocumentElement.items.length > 0
                            ? { galleryId: selection.id, itemIndex: 0 }
                            : null
                          : {
                              galleryId: selection.id,
                              itemIndex: selection.galleryItemIndex,
                          },
                      );
                    }
                    if (
                      selectedElement?.id !== selection.id ||
                      selectedElement.type !== selection.type ||
                      selectedElement.contentSlotId !== selection.contentSlotId
                    ) {
                      finishPresentationTransaction();
                      setSelectedElement({
                        id: selection.id,
                        type: selection.type,
                        contentSlotId: selection.contentSlotId,
                      });
                    }
                  }}
                  onMoveElement={moveElementInTree}
                  onMoveTopicItem={moveTopicItemInTree}
                  onIndentTopicItem={indentTopicItemInTree}
                  onOutdentTopicItem={outdentTopicItemInTree}
                  onMoveGalleryItem={moveGalleryItemInTree}
                  onGalleryStructureDrop={applyGalleryStructureDrop}
                  onMoveTableColumn={moveTableColumnInTree}
                  onMoveTableRow={moveTableRowInTree}
                  workspaceRootContainerId={rootDefinitionMode ? resolveCanonicalRootContainerId(presentation, authoringTarget) : undefined}
                  disableMovement={rootBackedSlide}
                   selectedTableStructuralNode={selectedTableStructuralNode}
                   onSelectTableStructuralNode={setSelectedTableStructuralNode}
                   customLibraryRepository={customLibraryRepository}
                   onBrowseElementStyles={() => {
                     if (elementStyleApplyAllowed) setRightPanelMode("resources");
                   }}
                   palette={presentation.palette}
                   fontResources={presentation.resources?.fonts}
                   textStyles={presentation.textStyles}
                   linkedStyles={presentation.linkedStyles}
                 />
                    );
                  case "inspector":
                  default:
                    return (
                      <>
                  {/* =================================================
                BEGIN: ELEMENT CRUD CONTROLS
                ================================================= */}

                  {/* ==========================================================
     BEGIN: ELEMENT CRUD CONTROLS
     ========================================================== */}

                  <ElementCrudControls
                    selectedElement={selectedDocumentElement}
                    selectedContentSlotId={
                      selectedElement?.contentSlotId ?? null
                    }
                    canDuplicate={
                      Boolean(selectedDocumentElement) &&
                      !selectedMasterElement &&
                      !(
                        rootDefinitionMode &&
                        selectedDocumentElement !== null &&
                        isProtectedRootContainer(
                          presentation,
                          authoringTarget,
                          selectedDocumentElement.id,
                        )
                      )
                    }
                    canDelete={
                      Boolean(selectedDocumentElement) &&
                      !selectedMasterElement &&
                      !(
                        rootDefinitionMode &&
                        selectedDocumentElement !== null &&
                        isProtectedRootContainer(
                          presentation,
                          authoringTarget,
                          selectedDocumentElement.id,
                        )
                      )
                    }
                    canAdd={
                      !rootBackedSlide || (
                        (selectedDocumentElement !== null &&
                          findLocalRootChildOwner(presentation, selectedSlideIndex, selectedDocumentElement.id) !== null) ||
                        (selectedDocumentElement?.type === "container" &&
                          isAuthorizedLocalRootReceiver(
                            presentation,
                            selectedSlide!,
                            selectedDocumentElement.id,
                          ))
                      )
                    }
                    noSelectionDestination={
                      rootDefinitionMode ? "root-container" : "slide-root"
                    }
                    onAdd={addElement}
                    onDuplicate={duplicateSelectedElement}
                    onDelete={requestElementDeletion}
                  />

                  {/* ==========================================================
    END: ELEMENT CRUD CONTROLS
    ========================================================== */}

                  {/* =================================================
                 END: ELEMENT CRUD CONTROLS
                 ================================================= */}
                  {selectedDocumentElement ? (
                    <PickedColorsProvider
                      colors={pickedColors}
                      onPickColor={(color) => {
                        setPickedColors((current) => addPickedColor(current, color));
                      }}
                      onRemoveColor={(color) => {
                        setPickedColors((current) => removePickedColor(current, color));
                      }}
                    >
                      <PresentationColorPaletteProvider
                        colors={presentation.palette?.colors ?? []}
                      >
                        <AuthoringHistoryContext.Provider value={authoringHistory}>
                        <ElementInspector
                          element={selectedDocumentElement}
                          readOnly={rootDefinitionInspectorReadOnly}
                          onUpdate={updateSelectedElement}
                          plotPreviewControls={plotPreviewControls}
                          onContainerFitModeChange={handleContainerFitModeChange}
                          preserveImageProportion={preserveImageProportion}
                          onPreserveImageProportionChange={
                            setPreserveImageProportion
                          }
                          focalEditing={Boolean(focalEditingTarget && areImageMediaTargetsEqual(focalEditingTarget, currentImageMediaTarget))}
                          onFocalEditingChange={(editing) => {
                            setFocalEditingTarget(editing ? currentImageMediaTarget : null);
                            if (editing) setCropEditingMode(null);
                          }}
                          cropEditing={Boolean(cropEditingTarget && areImageMediaTargetsEqual(cropEditingTarget, currentImageMediaTarget))}
                          onCropEditingChange={(editing) => {
                            setCropEditingMode(editing ? currentImageMediaTarget : null);
                            if (editing) setFocalEditingTarget(null);
                          }}
                          fontResources={presentation.resources?.fonts ?? []}
                          presentation={presentation}
                          onCreateQrFromLink={
                            selectedMasterElement ||
                            (selectedDocumentElement && isProtectedRootContainer(
                              presentation,
                              authoringTarget,
                              selectedDocumentElement.id,
                            ))
                              ? undefined
                              : createQrFromSelectedLink
                          }
                          rootLocalContentReceiver={
                            rootDefinitionMode && selectedDocumentElement.type === "container"
                              ? {
                                  allowed: (rootDefinition?.localChildTargetIds ?? []).includes(selectedDocumentElement.id),
                                  onChange: (allowed) => changeRootLocalContentTarget(selectedDocumentElement.id, allowed),
                                  feedback: rootLocalContentTargetError?.rootDefinitionId === authoringTarget.rootDefinitionId &&
                                    rootLocalContentTargetError.containerId === selectedDocumentElement.id &&
                                    rootLocalContentTargetError.reason === "in-use"
                                    ? t("inspector.rootLocalContentInUse")
                                    : null,
                                }
                              : undefined
                          }
                          onAttachLinkedStyle={attachSelectedContainerLinkedStyle}
                          onDetachLinkedStyle={detachSelectedContainerLinkedStyle}
                          onAttachLinkedTopicsStyle={attachSelectedTopicsLinkedStyle}
                          onDetachLinkedTopicsStyle={detachSelectedTopicsLinkedStyle}
                          onAttachLinkedTargetStyle={attachSelectedLinkedTargetStyle}
                          onDetachLinkedTargetStyle={detachSelectedLinkedTargetStyle}
                          parent={selectedElementParent}
                          ancestorContainers={selectedAncestorContainers}
                          layerControls={
                            rootDefinitionMode
                              ? null
                              : selectedElementPosition
                              ? {
                                  index: selectedElementPosition.index,
                                  count: selectedElementPosition.count,
                                  onMoveTo: moveSelectedElementTo,
                                }
                              : null
                          }
                          galleryItemIndex={galleryItemSelection?.galleryId === selectedDocumentElement.id ? galleryItemSelection.itemIndex : null}
                          onGalleryItemIndexChange={(index) => {
                            closeCanvasMediaEditing();
                            if (selectedDocumentElement.type === "gallery") {
                              setGalleryItemSelection(index === null ? null : { galleryId: selectedDocumentElement.id, itemIndex: index });
                            }
                          }}
                          topicsAuthoringControls={{
                            onAddTopLevelTopic: addTopLevelTopic,
                            onAddChildTopic: addChildTopic,
                          }}
                          tableAuthoringControls={tableAuthoringControls}
                          selectedTableStructuralNode={selectedTableStructuralNode}
                          onSelectTableStructuralNode={setSelectedTableStructuralNode}
                        />
                        </AuthoringHistoryContext.Provider>
                      </PresentationColorPaletteProvider>
                    </PickedColorsProvider>
                  ) : rootDefinitionMode && rootDefinition ? (
                    <>
                      <div className={styles.inspectorGroup}>
                        <span className={styles.inspectorLabel}>{t("editor.masterContext", { name: rootDefinition.name })}</span>
                        <strong>{rootDefinition.name}</strong>
                      </div>
                      <div className={styles.inspectorGroup}>
                        <span className={styles.inspectorLabel}>{t("inspector.id")}</span>
                        <code>{rootDefinition.id}</code>
                      </div>
                      <div className={styles.nextStep}>
                        <span>{t("editor.masterReadOnly")}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* =============================================
                    BEGIN: SLIDE INSPECTOR
                    ============================================= */}

                      {/* ===========================================
                    BEGIN: SLIDE TITLE
                    =========================================== */}

                      <label className={styles.field}>
                        <span>{t("inspector.titleField")}</span>

                        <input
                          type="text"
                          value={selectedSlide.title}
                          placeholder={t("slides.untitled")}
                          onFocus={() => beginPresentationTransaction(`slide:${selectedSlide.id}:title`, { kind: "slide.rename", labelKey: "history.slide.rename" })}
                          onChange={(event) => {
                            const title = event.target.value;

                            updatePresentationTransaction(`slide:${selectedSlide.id}:title`, (current) => ({
                              ...current,
                              slides: current.slides.map((slide) => slide.id === selectedSlide.id ? { ...slide, title } : slide),
                            }));
                          }}
                          onBlur={() => finishPresentationTransaction(`slide:${selectedSlide.id}:title`)}
                        />
                      </label>

                      <label className={styles.field}>
                        <span>{t("inspector.rootDefinition")}</span>
                        <select
                          data-slide-root-definition
                          disabled={slideRootDefinitionAssignmentBlocker !== null}
                          value={selectedSlide.rootDefinitionId ?? ""}
                          onChange={(event) => changeSlideRootDefinition(event.target.value)}
                        >
                          <option value="">
                            {presentation.defaultRootDefinitionId
                              ? t("inspector.usePresentationDefault", {
                                  name: presentation.rootDefinitions?.find((definition) => definition.id === presentation.defaultRootDefinitionId)?.name ?? presentation.defaultRootDefinitionId,
                                })
                              : t("inspector.noRootDefinition")}
                          </option>
                          {(presentation.rootDefinitions ?? []).map((definition) => (
                            <option key={definition.id} value={definition.id}>{definition.name}</option>
                          ))}
                        </select>
                        {slideRootDefinitionAssignmentBlocker === "ordinary-content" ? <span className={styles.status}>{t("inspector.rootDefinitionOrdinaryContent")}</span> : null}
                        {slideRootDefinitionAssignmentBlocker === "local-root-content" ? <span className={styles.status}>{t("inspector.rootDefinitionIncompatible")}</span> : null}
                        {slideRootDefinitionError === "incompatible" ? <span className={styles.status} role="alert">{t("inspector.rootDefinitionIncompatible")}</span> : null}
                        {slideRootDefinitionError === "root-not-found" ? <span className={styles.status} role="alert">{t("inspector.rootDefinitionUnavailable")}</span> : null}
                      </label>

                      {/* ===========================================
                    END: SLIDE TITLE
                    =========================================== */}

                      <div className={styles.inspectorGroup}>
                        <span className={styles.inspectorLabel}>
                          {t("inspector.id")}
                        </span>

                        <code>{selectedSlide.id}</code>
                      </div>

                      <div className={styles.inspectorGroup}>
                        <span className={styles.inspectorLabel}>
                          {t("inspector.rootElements")}
                        </span>

                        <strong>{effectiveElements.length}</strong>
                      </div>

                      <div className={styles.nextStep}>
                        <span>{t("inspector.selectElementHint")}</span>
                      </div>

                      {/* =============================================
                    END: SLIDE INSPECTOR
                    ============================================= */}
                    </>
                  )}
                      </>
                    );
                }
              })()}
            </div>
          </aside>
        )}

        {/* ===================================================
            END: INSPECTOR
            =================================================== */}
      </div>

      {pendingElementDeletion ? (() => {
        const pendingElements = resolveAuthoringElements(
          presentation,
          pendingElementDeletion.target,
        );
        const preserveAvailable = pendingElementDeletion.elementType === "container" &&
          pendingElements !== null &&
          unwrapContainerPreservingChildren(pendingElements, pendingElementDeletion.elementId).changed;

        if (preserveAvailable) {
          return <ContainerDeletionDialog
            title={t("elementCrud.deleteDialogTitle")}
            message={t("elementCrud.deleteContainerChoiceMessage", { id: pendingElementDeletion.elementId })}
            cancelLabel={t("elementCrud.cancel")}
            deleteAllLabel={t("elementCrud.deleteContainerAndChildren")}
            preserveChildrenLabel={t("elementCrud.deleteContainerPreserveChildren")}
            onCancel={() => setPendingElementDeletion(null)}
            onDeleteAll={confirmElementDeletion}
            onPreserveChildren={confirmContainerDeletionPreservingChildren}
          />;
        }

        return <DangerConfirmDialog
          title={t("elementCrud.deleteDialogTitle")}
          message={pendingElementDeletion.elementType === "container"
            ? t("elementCrud.deleteContainerConfirm", { id: pendingElementDeletion.elementId })
            : t("elementCrud.deleteElementConfirm", {
                id: pendingElementDeletion.elementId,
                type: t(ELEMENT_TYPE_MESSAGE_KEYS[pendingElementDeletion.elementType]),
              })}
          confirmLabel={t("elementCrud.delete")}
          cancelLabel={t("elementCrud.cancel")}
          initialFocus="confirm"
          onCancel={() => setPendingElementDeletion(null)}
          onConfirm={confirmElementDeletion}
        />;
      })() : null}

      {pendingTextStyleReset ? (() => {
        const styleName = t(`customResources.role.${pendingTextStyleReset}`);
        const count = findTextStyleUsageLocations(presentation, pendingTextStyleReset).length;
        return <DangerConfirmDialog
          title={t("customResources.resetTextStyleTitle", { style: styleName })}
          message={t(count === 0 ? "customResources.resetTextStyleNone" : count === 1 ? "customResources.resetTextStyleOne" : "customResources.resetTextStyleMany", { style: styleName, count })}
          confirmLabel={t("customResources.confirmResetTextStyle", { style: styleName })}
          cancelLabel={t("elementCrud.cancel")}
          onCancel={() => setPendingTextStyleReset(null)}
          onConfirm={() => { resetFundamentalTextStyle(pendingTextStyleReset); setPendingTextStyleReset(null); }}
        />;
      })() : null}

      {pendingStyleDetach ? <DangerConfirmDialog
        title={t("customResources.detachStyleTitle", { style: pendingStyleDetach.styleName })}
        message={t("customResources.detachStyleMessage")}
        confirmLabel={t("customResources.detachStyleConfirm")}
        cancelLabel={t("elementCrud.cancel")}
        onCancel={() => setPendingStyleDetach(null)}
        onConfirm={confirmStyleDetach}
      /> : null}

      {/* =====================================================
          END: WORKSPACE
          ===================================================== */}
    </main>
  );
}

// ============================================================
// END: EDITOR WORKSPACE
// ============================================================
