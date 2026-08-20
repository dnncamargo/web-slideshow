"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { PointerEvent as ReactPointerEvent } from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

import { renderFontResources, renderSlide } from "@powershow/renderer";

import {
  FontFaceResourceSchema,
  FontResourceSchema,
  getFontResourceFaces,
} from "@powershow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { LocaleSelector } from "@/features/i18n/locale-selector";

import { ElementInspector } from "./element-inspector";
import { ElementTreePanel } from "./element-tree-panel";
import {
  EDITOR_AUTOSAVE_DELAY_MS,
  editorSaveReducer,
  isAutosaveEligible,
  isSaveEnabled,
  resolveSaveStatus,
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
import { resolveCanvasPointerSelection } from "./canvas-pointer-selection-helpers";
import { isAuthoredPowerShowLink } from "./canvas-link-interception";
import {
  getEffectiveImageFocalPoint,
  getImageFocalPointFromClientPosition,
  type ImageFocalPoint,
} from "./inspector/sections/image-focal-point-helpers";
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
  getCanvasResizePlacementAdjustment,
  isCanvasResizable,
  resolveProportionalResize,
  toLogicalCanvasResizeDelta,
  type CanvasResizeDirection,
  updateStyleForCanvasResize,
  updateStyleForProportionalResize,
} from "./canvas-resize-helpers";
import {
  isCanvasDraggable,
  updatePlacementForCanvasDrag,
} from "./inspector/sections/element-placement-helpers";

import { editorDemoPresentation } from "./editor-demo-presentation";

import { findElementById, updateElementById } from "./element-tree";

import {
  areFontFacesEquivalent,
  createFontResourceId,
  normalizeFontFamily,
  presentationUsesFontFamily,
} from "./font-resource-helpers";
import {
  addPaletteColor,
  movePaletteColor,
  removePaletteColor,
} from "./inspector/sections/color-palette-helpers";
import { PresentationColorPaletteProvider } from "./inspector/sections/presentation-color-palette";
import { RecentColorsProvider } from "./inspector/sections/recent-colors-provider";
import {
  addRecentColor,
  clearRecentColors,
  moveRecentColor,
} from "./inspector/sections/recent-colors-helpers";

// ============================================================
// BEGIN: SLIDE OPERATIONS
// ============================================================

import {
  createSlideFromPreset,
  duplicateSlideWithUniqueIds,
  moveSlide,
} from "./slide-operations";

import type { SlideLayoutPreset } from "./slide-operations";

// ============================================================
// END: SLIDE OPERATIONS
// ============================================================

// ============================================================
// BEGIN: ELEMENT CRUD
// ============================================================

import { ElementCrudControls } from "./element-crud-controls";

// ============================================================
// BEGIN: ELEMENT OPERATIONS
// ============================================================

import {
  appendElementToContainer,
  appendElementToContentSlot,
  createDefaultTopicItem,
  createElement,
  duplicateElement,
  findElementSiblingPosition,
  insertElementAfterId,
  moveElement,
  moveElementToSiblingIndexById,
  removeElementById,
  appendTopicItemToTopics,
  appendChildTopicItemToTopics,
  resolveAddElementDestination,
} from "./element-operations";

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
  Color,
  FontFaceResource,
  PowerShowElement,
  Presentation,
  Slide,
} from "@powershow/document-schema";

// ============================================================
// END: TIPOS DO DOCUMENTO
// ============================================================

// ============================================================
// BEGIN: SLIDE LAYOUT PICKER
// ============================================================

import { SlideLayoutPicker } from "./slide-layout-picker";

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
   * of TopicItem/ContentSlot as PowerShowElements.
   */
  contentSlotId?: string | null;
}

interface CanvasDragState {
  pointerId: number;
  elementId: string;
  target: HTMLElement;
  initialTranslate: string;
  startClientX: number;
  startClientY: number;
  parentWidthPx: number;
  parentHeightPx: number;
  scaleX: number;
  scaleY: number;
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
  elementId: string;
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
  deltaX: number;
  deltaY: number;
  candidates: CanvasSnapCandidate[];
  guideBounds: CanvasBounds;
}

interface CanvasFocalOverlay {
  elementId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CanvasFocalDragState {
  pointerId: number;
  imageId: string;
  handle: HTMLElement;
  bounds: CanvasFocalOverlay;
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
// - renderizar o slide com @powershow/renderer;
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
}: {
  initialPresentation?: Presentation;
  onSave?: (presentation: Presentation) => Promise<void>;
  onPublish?: () => Promise<void>;
  notesRepository?: PresentationNotesRepository;
} = {}) {
  const { locale, t } = useStudioI18n();

  // ==========================================================
  // BEGIN: DOCUMENTO EDITÁVEL
  // ==========================================================

  const initialEditableRef = useRef<Presentation | null>(null);

  if (initialEditableRef.current === null) {
    initialEditableRef.current = initialPresentation
      ? structuredClone(initialPresentation)
      : structuredClone(editorDemoPresentation);
  }

  const [presentation, setPresentation] = useState<Presentation>(
    initialEditableRef.current,
  );

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

  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);

  const [selectedElement, setSelectedElement] =
    useState<SelectedElementInfo | null>(null);

  const [rightPanelView, setRightPanelView] = useState<
    "inspector" | "elements"
  >("inspector");

  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const [preserveImageProportion, setPreserveImageProportion] =
    useState<boolean>(DEFAULT_IMAGE_PROPORTION_PRESERVED);
  const [focalEditingImageId, setFocalEditingImageId] = useState<string | null>(
    null,
  );

  // ==========================================================
  // END: SELEÇÃO
  // ==========================================================

  // ==========================================================
  // BEGIN: NEW SLIDE PRESET
  //
  // Estado exclusivamente do Editor.
  // Não faz parte do documento.
  // ==========================================================

  const [newSlidePreset, setNewSlidePreset] =
    useState<SlideLayoutPreset>("blank");

  // ==========================================================
  // END: NEW SLIDE PRESET
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
  const canvasDragRef = useRef<CanvasDragState | null>(null);
  const canvasResizeRef = useRef<CanvasResizeState | null>(null);
  const canvasFocalDragRef = useRef<CanvasFocalDragState | null>(null);
  const [canvasResizeOverlay, setCanvasResizeOverlay] =
    useState<CanvasResizeOverlay | null>(null);
  const [canvasGuides, setCanvasGuides] = useState<CanvasSnapGuide[]>([]);
  const [canvasGuideBounds, setCanvasGuideBounds] =
    useState<CanvasBounds | null>(null);
  const [canvasFocalOverlay, setCanvasFocalOverlay] =
    useState<CanvasFocalOverlay | null>(null);
  const [canvasFocalPreview, setCanvasFocalPreview] =
    useState<ImageFocalPoint | null>(null);

  // ==========================================================
  // END: REFERÊNCIA DO CANVAS
  // ==========================================================

  // ==========================================================
  // BEGIN: SLIDE ATUAL
  // ==========================================================

  const selectedSlide = presentation.slides[selectedSlideIndex];

  // ==========================================================
  // END: SLIDE ATUAL
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
    selectedSlideId: selectedSlide?.id ?? "",
    enabled: isNotesOpen,
  });

  // ==========================================================
  // END: NOTAS PRIVADAS
  // ==========================================================

  // ==========================================================
  // BEGIN: ELEMENTO REAL SELECIONADO
  //
  // selectedElement guarda apenas dados de seleção da UI.
  // Aqui encontramos o objeto real dentro do documento.
  // ==========================================================

  const selectedDocumentElement = useMemo<PowerShowElement | null>(() => {
    if (!selectedSlide || !selectedElement) {
      return null;
    }

    return findElementById(selectedSlide.elements, selectedElement.id);
  }, [selectedSlide, selectedElement]);

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
      selectedSlide.elements,
      selectedElement.id,
    );
  }, [selectedSlide, selectedElement]);

  const selectedElementParent = useMemo(() => {
    if (
      !selectedSlide ||
      selectedElementPosition?.parentRef.kind !== "container"
    ) {
      return null;
    }

    const parent = findElementById(
      selectedSlide.elements,
      selectedElementPosition.parentRef.id,
    );

    return parent?.type === "container" ? parent : null;
  }, [selectedElementPosition, selectedSlide]);

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

  const renderedSlide = useMemo(() => {
    if (!selectedSlide) {
      return "";
    }

    return renderSlide(selectedSlide);
  }, [selectedSlide]);

  const renderedFontResources = useMemo(
    () => renderFontResources(presentation.resources?.fonts),
    [presentation.resources?.fonts],
  );
  const displayedCanvasFocalPoint =
    selectedDocumentElement?.type === "image"
      ? (canvasFocalPreview ??
        getEffectiveImageFocalPoint(selectedDocumentElement.focalPoint))
      : null;

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
      ".powershow-editor-selected",
    );

    previousSelections.forEach((element) => {
      element.classList.remove("powershow-editor-selected");
    });

    const previousDraggables = canvas.querySelectorAll(
      ".powershow-editor-draggable",
    );

    previousDraggables.forEach((element) => {
      element.classList.remove("powershow-editor-draggable");
    });

    const candidates = canvas.querySelectorAll<HTMLElement>(
      "[data-powershow-id]",
    );

    candidates.forEach((candidate) => {
      const id = candidate.dataset.powershowId;
      const documentElement = id
        ? findElementById(selectedSlide?.elements ?? [], id)
        : null;

      if (documentElement && isCanvasDraggable(documentElement.style)) {
        candidate.classList.add("powershow-editor-draggable");
      }
    });

    if (!selectedElement) {
      setCanvasResizeOverlay(null);
      return;
    }

    const target = Array.from(candidates).find(
      (element) => element.dataset.powershowId === selectedElement.id,
    );

    target?.classList.add("powershow-editor-selected");

    if (
      !target ||
      !selectedDocumentElement ||
      !isCanvasResizable(selectedDocumentElement)
    ) {
      setCanvasResizeOverlay(null);
      return;
    }

    const bounds = target.getBoundingClientRect();

    setCanvasResizeOverlay({
      elementId: selectedDocumentElement.id,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }, [
    locale,
    renderedSlide,
    selectedDocumentElement,
    selectedElement,
    selectedSlide,
  ]);

  useEffect(() => {
    if (
      !focalEditingImageId ||
      selectedDocumentElement?.type !== "image" ||
      selectedDocumentElement.id !== focalEditingImageId
    ) {
      setCanvasFocalOverlay(null);
      setCanvasFocalPreview(null);

      if (focalEditingImageId) {
        setFocalEditingImageId(null);
      }

      return;
    }

    const canvas = slideCanvasRef.current;
    const target = canvas
      ? Array.from(
          canvas.querySelectorAll<HTMLElement>("[data-powershow-id]"),
        ).find(
          (candidate) => candidate.dataset.powershowId === focalEditingImageId,
        )
      : undefined;

    if (!target) {
      setCanvasFocalOverlay(null);
      return;
    }

    const bounds = target.getBoundingClientRect();

    setCanvasFocalOverlay({
      elementId: focalEditingImageId,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }, [focalEditingImageId, renderedSlide, selectedDocumentElement]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocalEditingImageId(null);
        setCanvasFocalPreview(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ==========================================================
  // END: OUTLINE DO ELEMENTO SELECIONADO
  // ==========================================================

  // ==========================================================
  // BEGIN: TROCA DE SLIDE
  //
  // A seleção de elemento é limpa ao trocar de slide.
  // ==========================================================

  function selectSlide(index: number) {
    setSelectedSlideIndex(index);

    setSelectedElement(null);
  }

  // ==========================================================
  // END: TROCA DE SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: SELEÇÃO PELO CANVAS
  //
  // Event delegation:
  // procuramos o ancestral mais próximo com data-powershow-id.
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
      selectedSlide.elements,
      elementId,
    );

    if (!position) {
      return null;
    }

    if (position.parentRef.kind === "slide") {
      return canvas.querySelector<HTMLElement>(".powershow-slide");
    }

    if (position.parentRef.kind === "content-slot") {
      return null;
    }

    if (position.parentRef.kind !== "container") {
      return null;
    }

    {
      const { id } = position.parentRef;
      return (
        Array.from(
          canvas.querySelectorAll<HTMLElement>("[data-powershow-id]"),
        ).find((candidate) => candidate.dataset.powershowId === id) ?? null
      );
    }
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
        child.dataset.powershowId === selectedId
      ) {
        return [];
      }

      return child.matches("[data-powershow-id]")
        ? [getCanvasBounds(child)]
        : [];
    });

    return {
      candidates: buildCanvasSnapCandidates(parentBounds, siblings),
      parentBounds,
    };
  }

  function clearCanvasGuides() {
    setCanvasGuides([]);
    setCanvasGuideBounds(null);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element) || !selectedSlide) {
      return;
    }

    const elementTarget = target.closest<HTMLElement>("[data-powershow-id]");
    const contentSlotTarget = target.closest<HTMLElement>(
      "[data-powershow-content-slot-id]",
    );
    const selection = resolveCanvasPointerSelection(
      elementTarget
        ? {
            id: elementTarget.dataset.powershowId,
            type: elementTarget.dataset.powershowType,
          }
        : null,
      selectedSlide.elements,
    );

    if (!selection) {
      setSelectedElement(null);

      return;
    }

    const contentSlotId = contentSlotTarget?.dataset.powershowContentSlotId;

    setSelectedElement({
      id: selection.id,
      type: selection.type,
      contentSlotId: contentSlotId ?? null,
    });

    if (!isCanvasDraggable(selection.documentElement.style) || !elementTarget) {
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

    event.preventDefault();
    elementTarget.setPointerCapture(event.pointerId);
    const snap = getCanvasSnapCandidates(layoutParent, selection.id);
    setCanvasGuideBounds(snap.parentBounds);
    canvasDragRef.current = {
      pointerId: event.pointerId,
      elementId: selection.id,
      target: elementTarget,
      initialTranslate: elementTarget.style.getPropertyValue("translate"),
      startClientX: event.clientX,
      startClientY: event.clientY,
      parentWidthPx: logicalWidth,
      parentHeightPx: logicalHeight,
      scaleX: parentBounds.width / logicalWidth || 1,
      scaleY: parentBounds.height / logicalHeight || 1,
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
    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === selectedSlideIndex
          ? {
              ...slide,
              elements: updateElementById(
                slide.elements,
                drag.elementId,
                (element) => {
                  const style = updatePlacementForCanvasDrag(
                    element.style,
                    drag.deltaX,
                    drag.deltaY,
                    drag.parentWidthPx,
                    drag.parentHeightPx,
                  );

                  return style === element.style
                    ? element
                    : { ...element, style };
                },
              ),
            }
          : slide,
      ),
    }));
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

  // ==========================================================
  // BEGIN: LINK ACTIVATION SUPPRESSION
  //
  // Authored PowerShow links render as native anchors through the
  // shared renderer. Inside the Editor they must not navigate, but
  // the href stays in the document so Player and Watch continue to
  // use native anchor behavior. Selection, drag and resize use
  // pointer events and are unaffected by click suppression.
  // ==========================================================

  function handleCanvasLinkClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isAuthoredPowerShowLink(event.target)) {
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
    if (!selectedDocumentElement || !canvasResizeOverlay || !selectedSlide) {
      return;
    }

    const canvas = slideCanvasRef.current;

    if (!canvas || !isCanvasResizable(selectedDocumentElement)) {
      return;
    }

    const target = Array.from(
      canvas.querySelectorAll<HTMLElement>("[data-powershow-id]"),
    ).find(
      (candidate) =>
        candidate.dataset.powershowId === selectedDocumentElement.id,
    );
    const layoutParent = getCanvasLayoutParent(
      canvas,
      selectedDocumentElement.id,
    );

    if (!target || !layoutParent) {
      return;
    }

    const parentBounds = layoutParent.getBoundingClientRect();
    const logicalWidth = layoutParent.offsetWidth || parentBounds.width;
    const logicalHeight = layoutParent.offsetHeight || parentBounds.height;

    if (logicalWidth <= 0 || logicalHeight <= 0) {
      return;
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
      elementId: selectedDocumentElement.id,
      handle: event.currentTarget,
      direction,
      startClientX: event.clientX,
      startClientY: event.clientY,
      parentWidthPx: logicalWidth,
      parentHeightPx: logicalHeight,
      scaleX: parentBounds.width / logicalWidth || 1,
      scaleY: parentBounds.height / logicalHeight || 1,
      initialWidthPx:
        target.offsetWidth || target.getBoundingClientRect().width,
      initialHeightPx:
        target.offsetHeight || target.getBoundingClientRect().height,
      initialOverlay: canvasResizeOverlay,
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
    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === selectedSlideIndex
          ? {
              ...slide,
              elements: updateElementById(
                slide.elements,
                resize.elementId,
                (element) => {
                  const locked =
                    element.type === "image" && preserveImageProportion;
                  const resizedStyle = locked
                    ? updateStyleForProportionalResize(
                        element.style,
                        resize.direction,
                        resize.deltaX,
                        resize.deltaY,
                        resize.initialWidthPx,
                        resize.initialHeightPx,
                        resize.parentWidthPx,
                        resize.parentHeightPx,
                      )
                    : updateStyleForCanvasResize(
                        element.style,
                        resize.direction,
                        resize.deltaX,
                        resize.deltaY,
                        resize.initialWidthPx,
                        resize.initialHeightPx,
                        resize.parentWidthPx,
                        resize.parentHeightPx,
                      );
                  const adjustment = getCanvasResizePlacementAdjustment(
                    resize.direction,
                    resize.deltaX,
                    resize.deltaY,
                    element.style?.placement?.anchor,
                  );
                  const style = updatePlacementForCanvasDrag(
                    resizedStyle,
                    adjustment.x,
                    adjustment.y,
                    resize.parentWidthPx,
                    resize.parentHeightPx,
                  );

                  return style === element.style
                    ? element
                    : { ...element, style };
                },
              ),
            }
          : slide,
      ),
    }));
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
    if (!canvasFocalOverlay || !focalEditingImageId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasFocalDragRef.current = {
      pointerId: event.pointerId,
      imageId: focalEditingImageId,
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
    imageId: string,
  ) {
    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === selectedSlideIndex
          ? {
              ...slide,
              elements: updateElementById(slide.elements, imageId, (element) =>
                element.type === "image" ? { ...element, focalPoint } : element,
              ),
            }
          : slide,
      ),
    }));
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
    commitCanvasFocalPoint(focalPoint, drag.imageId);
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
    update: (element: PowerShowElement) => PowerShowElement,
  ) {
    if (!selectedElement) {
      return;
    }

    setPresentation((current) => ({
      ...current,

      slides: current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        return {
          ...slide,

          elements: updateElementById(
            slide.elements,
            selectedElement.id,
            update,
          ),
        };
      }),
    }));
  }

  // ==========================================================
  // BEGIN: EXPLICIT SAVE
  // ==========================================================

  const saveStatus = resolveSaveStatus(saveState, presentation);
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
    if (
      presentation === saveState.lastSavedPresentation ||
      saveState.isSaving
    ) {
      return;
    }

    requestSave(presentation);
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

  function addFontFace(family: string, face: FontFaceResource) {
    setPresentation((current) => {
      const parsedFace = FontFaceResourceSchema.safeParse(face);
      const trimmedFamily = family.trim();

      if (!parsedFace.success || !trimmedFamily) {
        return current;
      }

      const currentFonts = current.resources?.fonts ?? [];
      const normalizedFamily = normalizeFontFamily(trimmedFamily);
      const existingIndex = currentFonts.findIndex(
        (registeredFont) =>
          normalizeFontFamily(registeredFont.family) === normalizedFamily,
      );

      if (existingIndex === -1) {
        const newResource = FontResourceSchema.safeParse({
          id: createFontResourceId(
            trimmedFamily,
            currentFonts.map((fontResource) => fontResource.id),
          ),
          family: trimmedFamily,
          faces: [parsedFace.data],
        });

        if (!newResource.success) {
          return current;
        }

        return {
          ...current,
          resources: {
            ...current.resources,
            fonts: [...currentFonts, newResource.data],
          },
        };
      }

      const existingResource = currentFonts[existingIndex];

      if (!existingResource) {
        return current;
      }

      const existingFaces = getFontResourceFaces(existingResource);
      const duplicate = existingFaces.some((existingFace) =>
        areFontFacesEquivalent(existingFace, parsedFace.data),
      );

      if (duplicate) {
        return current;
      }

      const updatedResource = FontResourceSchema.safeParse({
        id: existingResource.id,
        family: existingResource.family,
        faces: [...existingFaces, parsedFace.data],
      });

      if (!updatedResource.success) {
        return current;
      }

      return {
        ...current,
        resources: {
          ...current.resources,
          fonts: currentFonts.map((fontResource, index) =>
            index === existingIndex ? updatedResource.data : fontResource,
          ),
        },
      };
    });
  }

  function removeFontFace(fontResourceId: string, faceIndex: number) {
    setPresentation((current) => {
      const currentFonts = current.resources?.fonts;
      const fontResourceIndex = currentFonts?.findIndex(
        (registeredFont) => registeredFont.id === fontResourceId,
      );
      const fontResource =
        fontResourceIndex === undefined || fontResourceIndex < 0
          ? undefined
          : currentFonts?.[fontResourceIndex];

      if (!currentFonts || !fontResource || fontResourceIndex === undefined) {
        return current;
      }

      const faces = getFontResourceFaces(fontResource);

      if (faceIndex < 0 || faceIndex >= faces.length) {
        return current;
      }

      if (faces.length === 1) {
        if (presentationUsesFontFamily(current, fontResource.family)) {
          return current;
        }

        return {
          ...current,
          resources: {
            ...current.resources,
            fonts: currentFonts.filter(
              (_registeredFont, index) => index !== fontResourceIndex,
            ),
          },
        };
      }

      const updatedResource = FontResourceSchema.safeParse({
        id: fontResource.id,
        family: fontResource.family,
        faces: faces.filter((_face, index) => index !== faceIndex),
      });

      if (!updatedResource.success) {
        return current;
      }

      return {
        ...current,
        resources: {
          ...current.resources,
          fonts: currentFonts.map((registeredFont, index) =>
            index === fontResourceIndex ? updatedResource.data : registeredFont,
          ),
        },
      };
    });
  }

  function addPresentationPaletteColor(color: Color) {
    setPresentation((current) => {
      const colors = addPaletteColor(current.palette?.colors ?? [], color);

      if (colors === current.palette?.colors) {
        return current;
      }

      return {
        ...current,
        palette: { colors: [...colors] },
      };
    });
  }

  function removePresentationPaletteColor(index: number) {
    setPresentation((current) => {
      const currentColors = current.palette?.colors;

      if (!currentColors || index < 0 || index >= currentColors.length) {
        return current;
      }

      const colors = removePaletteColor(currentColors, index);

      if (colors.length === 0) {
        const { palette: _palette, ...presentationWithoutPalette } = current;

        return presentationWithoutPalette;
      }

      return {
        ...current,
        palette: { colors: [...colors] },
      };
    });
  }

  function movePresentationPaletteColor(index: number, direction: -1 | 1) {
    setPresentation((current) => {
      const currentColors = current.palette?.colors;

      if (!currentColors || index < 0 || index >= currentColors.length) {
        return current;
      }

      const colors = movePaletteColor(currentColors, index, direction);

      if (colors === currentColors) {
        return current;
      }

      return {
        ...current,
        palette: { colors: [...colors] },
      };
    });
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
    const newElement = createElement(type, presentation.slides);

    setPresentation((current) => ({
      ...current,

      slides: current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        const destination = resolveAddElementDestination(
          slide.elements,
          selectedElement?.id ?? null,
          newElement,
          selectedElement?.contentSlotId ?? null,
        );

        switch (destination.kind) {
          case "slide-root":
            return {
              ...slide,
              elements: [...slide.elements, newElement],
            };

          case "append-container":
            return {
              ...slide,
              elements: appendElementToContainer(
                slide.elements,
                destination.containerId,
                newElement,
              ),
            };

          case "append-topic-content":
            return {
              ...slide,
              elements: appendElementToContentSlot(
                slide.elements,
                destination.contentSlotId,
                newElement,
              ),
            };

          case "insert-after":
            return {
              ...slide,
              elements: insertElementAfterId(
                slide.elements,
                destination.targetId,
                newElement,
              ),
            };
        }
      }),
    }));

    setSelectedElement({
      id: newElement.id,

      type: newElement.type,
    });
  }

  // ==========================================================
  // END: ADD ELEMENT
  // ==========================================================

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
    const created = createDefaultTopicItem(presentation.slides);
    const selectedSlide = presentation.slides[selectedSlideIndex];

    if (!selectedSlide) {
      return null;
    }

    // Dry-run somente para validar o alvo e preservar o contrato
    // string | null. O resultado NÃO é reaproveitado na escrita.
    if (
      appendTopicItemToTopics(
        selectedSlide.elements,
        topicsId,
        created.item,
      ) === selectedSlide.elements
    ) {
      return null;
    }

    setPresentation((current) => {
      let changed = false;

      const slides = current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        const elements = appendTopicItemToTopics(
          slide.elements,
          topicsId,
          created.item,
        );

        if (elements === slide.elements) {
          return slide;
        }

        changed = true;

        return {
          ...slide,
          elements,
        };
      });

      return changed
        ? {
            ...current,
            slides,
          }
        : current;
    });

    return created.item.id;
  }

  function addChildTopic(topicsId: string, topicItemId: string): string | null {
    const created = createDefaultTopicItem(presentation.slides);
    const selectedSlide = presentation.slides[selectedSlideIndex];

    if (!selectedSlide) {
      return null;
    }

    // Valida o par proprietário + TopicItem.
    // O array produzido aqui NÃO é usado na escrita React.
    if (
      appendChildTopicItemToTopics(
        selectedSlide.elements,
        topicsId,
        topicItemId,
        created.item,
      ) === selectedSlide.elements
    ) {
      return null;
    }

    setPresentation((current) => {
      let changed = false;

      const slides = current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        const elements = appendChildTopicItemToTopics(
          slide.elements,
          topicsId,
          topicItemId,
          created.item,
        );

        if (elements === slide.elements) {
          return slide;
        }

        changed = true;

        return {
          ...slide,
          elements,
        };
      });

      return changed
        ? {
            ...current,
            slides,
          }
        : current;
    });

    return created.item.id;
  }

  // ==========================================================
  // END: ADD TOP LEVEL TOPIC
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

    const duplicatedElement = duplicateElement(
      selectedDocumentElement,
      presentation.slides,
    );

    setPresentation((current) => ({
      ...current,

      slides: current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        return {
          ...slide,

          elements: insertElementAfterId(
            slide.elements,
            selectedDocumentElement.id,
            duplicatedElement,
          ),
        };
      }),
    }));

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

  function deleteSelectedElement() {
    if (!selectedDocumentElement) {
      return;
    }

    const description =
      selectedDocumentElement.type === "container"
        ? t("elementCrud.deleteContainerConfirm", {
            id: selectedDocumentElement.id,
          })
        : t("elementCrud.deleteElementConfirm", {
            id: selectedDocumentElement.id,
            type: t(ELEMENT_TYPE_MESSAGE_KEYS[selectedDocumentElement.type]),
          });

    const confirmed = window.confirm(description);

    if (!confirmed) {
      return;
    }

    setPresentation((current) => ({
      ...current,

      slides: current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        return {
          ...slide,

          elements: removeElementById(
            slide.elements,
            selectedDocumentElement.id,
          ),
        };
      }),
    }));

    setSelectedElement(null);
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

    const newSlide = createSlideFromPreset(preset, presentation.slides);

    setPresentation((current) => ({
      ...current,

      slides: [
        ...current.slides.slice(0, insertionIndex),

        newSlide,

        ...current.slides.slice(insertionIndex),
      ],
    }));

    setSelectedSlideIndex(insertionIndex);

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
  // ==========================================================
  // BEGIN: DUPLICATE SLIDE
  //
  // A cópia também é inserida imediatamente depois do atual.
  //
  // slide-operations.ts renova recursivamente todos os IDs.
  // ==========================================================

  function duplicateSelectedSlide() {
    if (!selectedSlide) {
      return;
    }

    const insertionIndex = selectedSlideIndex + 1;

    const duplicatedSlide = duplicateSlideWithUniqueIds(
      selectedSlide,
      presentation.slides,
    );

    setPresentation((current) => ({
      ...current,

      slides: [
        ...current.slides.slice(0, insertionIndex),

        duplicatedSlide,

        ...current.slides.slice(insertionIndex),
      ],
    }));

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
    if (!selectedSlide || presentation.slides.length <= 1) {
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

    setPresentation((current) => ({
      ...current,

      slides: current.slides.filter(
        (_slide, index) => index !== selectedSlideIndex,
      ),
    }));

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
    const targetIndex = selectedSlideIndex + offset;

    if (targetIndex < 0 || targetIndex >= presentation.slides.length) {
      return;
    }

    setPresentation((current) => ({
      ...current,

      slides: moveSlide(current.slides, selectedSlideIndex, targetIndex),
    }));

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

    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === selectedSlideIndex
          ? {
              ...slide,
              elements: moveElementToSiblingIndexById(
                slide.elements,
                selectedElement.id,
                targetIndex,
              ),
            }
          : slide,
      ),
    }));
  }

  function moveElementInTree(options: Parameters<typeof moveElement>[1]) {
    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) => {
        if (index !== selectedSlideIndex) {
          return slide;
        }

        const result = moveElement(slide.elements, options);

        return result.moved ? { ...slide, elements: result.elements } : slide;
      }),
    }));
  }

  // ==========================================================
  // END: MOVE SELECTED ELEMENT
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

      <header className={styles.topbar}>
        {/* ========================================================
      BEGIN: BRAND
      ======================================================== */}

        <div>
          <strong>
            <span>PowerShow</span>
          </strong>

          <span className={styles.topbarSection}>{t("topbar.editor")}</span>
        </div>

        {/* ========================================================
      END: BRAND
      ======================================================== */}

        {/* ========================================================
      BEGIN: PRESENTATION TITLE
      ======================================================== */}

        <div className={styles.presentationTitle}>
          <span>{presentation.title}</span>
        </div>

        {/* ========================================================
      END: PRESENTATION TITLE
      ======================================================== */}

        {/* ========================================================
      BEGIN: TOPBAR CONTROLS
      ======================================================== */}

        <div className={styles.topbarControls}>
          {/* ======================================================
        BEGIN: STUDIO LANGUAGE SELECTOR
        ====================================================== */}

          <LocaleSelector />

          {/* ======================================================
        END: STUDIO LANGUAGE SELECTOR (separated divider)
        ====================================================== */}

          <div className={styles.topbarDivider} aria-hidden="true" />

          {/* ======================================================
        BEGIN: SAVE STATUS
        ====================================================== */}

          <span className={styles.status}>
            {onSave === undefined
              ? t("topbar.localDraft")
              : saveStatus === "saving"
                ? t("topbar.saving")
                : saveStatus === "error"
                  ? t("topbar.saveFailed")
                  : saveStatus === "dirty"
                    ? t("topbar.unsavedChanges")
                    : t("topbar.saved")}
          </span>

          {/* ======================================================
        END: SAVE STATUS
        ====================================================== */}

          {/* ======================================================
        BEGIN: SAVE BUTTON
        ====================================================== */}

          {onSave && (
            <button
              type="button"
              className={styles.saveButton}
              disabled={!saveEnabled}
              onClick={handleSave}
            >
              {t("topbar.save")}
            </button>
          )}

          {/* ======================================================
        END: SAVE BUTTON
        ====================================================== */}

          {/* ======================================================
        BEGIN: PUBLISH BUTTON
        ====================================================== */}

          {onPublish && (
            <button
              type="button"
              className={
                publishLabelStatus === "success"
                  ? `${styles.publishButton} ${styles.publishButtonSuccess}`
                  : styles.publishButton
              }
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
            </button>
          )}

          {/* ======================================================
        END: PUBLISH BUTTON
        ====================================================== */}
        </div>

        {/* ========================================================
      END: TOPBAR CONTROLS
      ======================================================== */}
      </header>

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
                setIsSlideLayoutPickerOpen((current) => !current);
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

          {isSlideLayoutPickerOpen && (
            <SlideLayoutPicker
              value={newSlidePreset}
              onChange={setNewSlidePreset}
              onCreate={() => {
                addSlide(newSlidePreset);
              }}
              onCancel={() => {
                setIsSlideLayoutPickerOpen(false);
              }}
            />
          )}

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
                  onClick={() => {
                    selectSlide(index);
                  }}
                >
                  <span className={styles.slideNumber}>{index + 1}</span>

                  <span>{slide.title || t("slides.untitled")}</span>
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
              disabled={selectedSlideIndex === 0}
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
              disabled={selectedSlideIndex === presentation.slides.length - 1}
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
              disabled={presentation.slides.length <= 1}
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
            <span>
              {t("slides.current", { number: selectedSlideIndex + 1 })}
            </span>

            <span>
              {selectedDocumentElement
                ? `${t(ELEMENT_TYPE_MESSAGE_KEYS[selectedDocumentElement.type])} · ${selectedDocumentElement.id}`
                : t("canvas.noElementSelected")}
            </span>

            <span className={styles.canvasToolbarRight}>
              <button
                type="button"
                className={
                  isNotesOpen
                    ? `${styles.notesToggle} ${styles.notesToggleActive}`
                    : styles.notesToggle
                }
                aria-pressed={isNotesOpen}
                onClick={() => {
                  setIsNotesOpen((current) => !current);
                }}
              >
                {t("notes.toggle")}
              </button>

              <span>{presentation.aspectRatio}</span>
            </span>
          </div>

          <div className={styles.canvasViewport}>
            {renderedFontResources && (
              <style data-powershow-font-resources>
                {renderedFontResources}
              </style>
            )}

            <div
              ref={slideCanvasRef}
              className={styles.slideCanvas}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerCancel}
              onLostPointerCapture={handleCanvasPointerCancel}
              onClick={handleCanvasLinkClick}
              dangerouslySetInnerHTML={{
                __html: renderedSlide,
              }}
            />
            {canvasResizeOverlay && (
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
              displayedCanvasFocalPoint &&
              focalEditingImageId === selectedDocumentElement?.id && (
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

        {isNotesOpen ? (
          <SlideNotesWorkspace
            note={editorNotes.note}
            status={editorNotes.status}
            isSaving={editorNotes.isSaving}
            hasSaveError={editorNotes.hasSaveError}
            onChange={editorNotes.onChange}
          />
        ) : (
          <aside className={styles.inspector}>
            <div className={styles.panelHeader}>
              <button
                className={
                  rightPanelView === "inspector"
                    ? styles.rightPanelTabActive
                    : styles.rightPanelTab
                }
                type="button"
                aria-pressed={rightPanelView === "inspector"}
                onClick={() => setRightPanelView("inspector")}
              >
                {t("inspector.title")}
              </button>
              <button
                className={
                  rightPanelView === "elements"
                    ? styles.rightPanelTabActive
                    : styles.rightPanelTab
                }
                type="button"
                aria-pressed={rightPanelView === "elements"}
                onClick={() => setRightPanelView("elements")}
              >
                {t("tree.elements")}
              </button>
            </div>

            <div className={styles.inspectorContent}>
              {rightPanelView === "elements" ? (
                <ElementTreePanel
                  key={selectedSlide.id}
                  slide={selectedSlide}
                  selectedElementId={selectedElement?.id ?? null}
                  selectedContentSlotId={selectedElement?.contentSlotId ?? null}
                  onSelectElement={(selection) => {
                    setSelectedElement(selection);
                  }}
                  onMoveElement={moveElementInTree}
                />
              ) : (
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
                    onAdd={addElement}
                    onDuplicate={duplicateSelectedElement}
                    onDelete={deleteSelectedElement}
                  />

                  {/* ==========================================================
    END: ELEMENT CRUD CONTROLS
    ========================================================== */}

                  {/* =================================================
                 END: ELEMENT CRUD CONTROLS
                 ================================================= */}
                  {selectedDocumentElement ? (
                    <RecentColorsProvider
                      colors={[]}
                      onAddColor={(color) => {
                        // Recent colors are managed locally in ColorControl
                      }}
                      onClearColors={() => {
                        // Clear handled in ColorControl
                      }}
                      onMoveColor={(index, direction) => {
                        // Move handled in ColorControl
                      }}
                    >
                      <PresentationColorPaletteProvider
                        colors={presentation.palette?.colors ?? []}
                        onAddColor={addPresentationPaletteColor}
                        onRemoveColor={removePresentationPaletteColor}
                        onMoveColor={movePresentationPaletteColor}
                      >
                        <ElementInspector
                          element={selectedDocumentElement}
                          onUpdate={updateSelectedElement}
                          preserveImageProportion={preserveImageProportion}
                          onPreserveImageProportionChange={
                            setPreserveImageProportion
                          }
                          focalEditingImageId={focalEditingImageId}
                          onFocalEditingImageIdChange={setFocalEditingImageId}
                          fontResourceControls={{
                            fontResources: presentation.resources?.fonts ?? [],
                            onAddFontFace: addFontFace,
                            onRemoveFontFace: removeFontFace,
                            isFontFamilyInUse: (family) =>
                              presentationUsesFontFamily(presentation, family),
                          }}
                          parent={selectedElementParent}
                          layerControls={
                            selectedElementPosition
                              ? {
                                  index: selectedElementPosition.index,
                                  count: selectedElementPosition.count,
                                  onMoveTo: moveSelectedElementTo,
                                }
                              : null
                          }
                          topicsAuthoringControls={{
                            onAddTopLevelTopic: addTopLevelTopic,
                            onAddChildTopic: addChildTopic,
                          }}
                        />
                      </PresentationColorPaletteProvider>
                    </RecentColorsProvider>
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
                          onChange={(event) => {
                            const title = event.target.value;

                            updateSelectedSlide((slide) => ({
                              ...slide,

                              title,
                            }));
                          }}
                        />
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

                        <strong>{selectedSlide.elements.length}</strong>
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
              )}
            </div>
          </aside>
        )}

        {/* ===================================================
            END: INSPECTOR
            =================================================== */}
      </div>

      {/* =====================================================
          END: WORKSPACE
          ===================================================== */}
    </main>
  );
}

// ============================================================
// END: EDITOR WORKSPACE
// ============================================================
