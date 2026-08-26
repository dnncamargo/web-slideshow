"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { PointerEvent as ReactPointerEvent } from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

import {
  hydrateImageCrops,
  renderFontResources,
  renderSlide,
} from "@powershow/renderer";
import {
  Button,
  HoverScrollText,
  Separator,
  Status,
  Topbar,
  TopbarActions,
  TopbarLocale,
  TopbarTitle,
} from "@powershow/ui";

import {
  FontFaceResourceSchema,
  FontResourceSchema,
  getFontResourceFaces,
  addPresentationPaletteColor as addPaletteEntry,
  removePresentationPaletteColor as removePaletteEntry,
  renamePresentationPaletteColor as renamePaletteEntry,
  updatePresentationPaletteColorValue,
  type Color,
} from "@powershow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";
import type { CustomLibraryRepository } from "@/features/custom-library/custom-library-repository";
import type { CustomLibraryElementRecipe } from "@/features/custom-library/custom-library-recipe";
import type { CustomLibraryApplyOutcome } from "@/features/custom-library/custom-library-apply-picker";
import { placeCustomLibraryElementRecipe } from "@/features/custom-library/custom-library-placement";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { LocaleSelector } from "@/features/i18n/locale-selector";
import { ProductSurfaceBrand } from "@/features/app/product-surface-brand";

import { ElementInspector } from "./element-inspector";
import { ElementTreePanel } from "./element-tree-panel";
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
import {
  resolveCanvasEmbedPointerTarget,
  resolveCanvasPointerHit,
  resolveCanvasPointerSelection,
} from "./canvas-pointer-selection-helpers";
import { isAuthoredPowerShowLink } from "./canvas-link-interception";
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

import {
  areFontFacesEquivalent,
  createFontResourceId,
  normalizeFontFamily,
  presentationUsesFontFamily,
} from "./font-resource-helpers";
import { PresentationColorPaletteProvider } from "./inspector/sections/presentation-color-palette";
import { PresentationPaletteManager } from "./inspector/sections/presentation-palette-manager";
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
  addColumnToStructuredTable,
  addRootBlockToPresentation,
  addRowToStructuredTable,
  addScopeChildToPresentation,
  addSocketPartToPresentation,
  addTextPartToPresentation,
  createDefaultTopicItem,
  createElement,
  createSocketValueInPresentation,
  duplicateElement,
  findElementSiblingPosition,
  insertElementAfterId,
  moveElement,
  moveElementToSiblingIndexById,
  removeColumnFromStructuredTable,
  removeElementById,
  removeRowFromStructuredTable,
  setStructuredTableShowHeader,
  appendTopicItemToTopics,
  appendChildTopicItemToTopics,
  resolveAddElementDestination,
} from "./element-operations";

import type { TableAuthoringControls } from "./inspector/inspector-types";

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
import { updatePresentationTitle } from "./presentation-title";

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
  containerResizeGeometry?: ContainerCanvasResizeGeometry;
  canonicalTextResizeGeometry?: CanonicalTextCanvasGeometry;
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

interface CanvasCropOverlay extends CropCanvasBounds {
  elementId: string;
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
  imageId: string;
  operation: CropCanvasOperation;
  startClientX: number;
  startClientY: number;
  initialCrop: NonNullable<Extract<PowerShowElement, { type: "image" }>["crop"]>;
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
  customLibraryRepository,
}: {
  initialPresentation?: Presentation;
  onSave?: (presentation: Presentation) => Promise<void>;
  onPublish?: () => Promise<void>;
  notesRepository?: PresentationNotesRepository;
  customLibraryRepository?: CustomLibraryRepository;
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
  const [recentColors, setRecentColors] = useState<readonly Color[]>([]);

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
  const [cropEditingImageId, setCropEditingImageId] = useState<string | null>(
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
    NonNullable<Extract<PowerShowElement, { type: "image" }>["crop"]> | null
  >(null);
  const [cropSourceMetrics, setCropSourceMetrics] = useState<{
    key: string;
    imageId: string;
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const [canvasCropAppearance, setCanvasCropAppearance] =
    useState<CanvasCropAppearance | null>(null);
  const [cropMeasureVersion, setCropMeasureVersion] = useState(0);

  function setCropEditingMode(id: string | null) {
    if (id === null) {
      canvasCropDragRef.current = null;
      setCanvasCropPreview(null);
    }
    setCropEditingImageId(id);
  }

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

  useEffect(() => {
    const canvas = slideCanvasRef.current;
    if (canvas) {
      hydrateImageCrops(canvas);
    }
  }, [renderedSlide]);

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

      if (documentElement) {
        const draggable =
          documentElement.type === "container"
            ? isContainerCanvasDraggable(documentElement)
            : documentElement.type === "text"
              ? documentElement.layout?.position === "absolute"
              : documentElement.type === "image" || documentElement.type === "gallery" || documentElement.type === "embed" || documentElement.type === "scripted" || documentElement.type === "code" || documentElement.type === "terminal" || documentElement.type === "table" || documentElement.type === "blocks"
                ? documentElement.layout?.position === "absolute"
              : documentElement.type === "divider" || documentElement.type === "topics" || documentElement.type === "chart" || documentElement.type === "interactive"
                  ? documentElement.layout?.position === "absolute"
                  : false;

        if (draggable) {
          candidate.classList.add("powershow-editor-draggable");
        }
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
    if (
      !cropEditingImageId ||
      selectedDocumentElement?.type !== "image" ||
      selectedDocumentElement.id !== cropEditingImageId
    ) {
      setCanvasCropOverlay(null);
      setCanvasCropPreview(null);
      setCropSourceMetrics(null);
      setCanvasCropAppearance(null);
      if (cropEditingImageId) setCropEditingMode(null);
      return;
    }

    const canvas = slideCanvasRef.current;
    const target = canvas
      ? Array.from(canvas.querySelectorAll<HTMLElement>("[data-powershow-id]"))
          .find((candidate) => candidate.dataset.powershowId === cropEditingImageId)
      : undefined;
    const sourceKey = `${cropEditingImageId}:${selectedDocumentElement.src}`;
    const preview = cropSourceMetrics?.key === sourceKey && target
      ? resolveSourcePreviewBounds(
          getCanvasBounds(target),
          cropSourceMetrics.width,
          cropSourceMetrics.height,
        )
      : null;

    if (target) {
      const computed = getComputedStyle(target);
      const bounds = getCanvasBounds(target);
      setCanvasCropAppearance({
        ...bounds,
        border: computed.border || target.style.border || "",
        borderRadius: computed.borderRadius || target.style.borderRadius || "0px",
        boxShadow: computed.boxShadow || target.style.boxShadow || "none",
      });
    } else {
      setCanvasCropAppearance(null);
    }

    if (!preview) {
      setCanvasCropOverlay(null);
      return;
    }

    const crop = canvasCropPreview ?? getEffectiveImageCrop(selectedDocumentElement.crop);
    setCanvasCropOverlay({
      ...preview,
      elementId: cropEditingImageId,
      source: selectedDocumentElement.src,
      crop: resolveCropCanvasRect(preview, crop),
    });
  }, [cropEditingImageId, cropSourceMetrics, canvasCropPreview, renderedSlide, selectedDocumentElement, cropMeasureVersion]);

  useEffect(() => {
    if (!cropEditingImageId) return;
    const handleResize = () => {
      setCropMeasureVersion((current) => current + 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [cropEditingImageId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (canvasCropDragRef.current) {
          canvasCropDragRef.current = null;
          setCanvasCropPreview(null);
        }
        setCanvasCropOverlay(null);
        setCropEditingMode(null);
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
      const documentElement = findElementById(
        selectedSlide.elements,
        elementId,
      );

      if (documentElement?.type === "container") {
        return canvas.querySelector<HTMLElement>(".powershow-slide-content");
      }

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
    if (cropEditingImageId) {
      return;
    }
    const target = event.target;

    if (!(target instanceof Element) || !selectedSlide) {
      return;
    }

    const iframeElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[data-powershow-type="embed"][data-powershow-id],' +
          ' [data-powershow-type="scripted"][data-powershow-id]',
      ),
    );
    const embedTarget = resolveCanvasEmbedPointerTarget(
      { clientX: event.clientX, clientY: event.clientY },
      iframeElements.map((iframeElement) => {
        const bounds = iframeElement.getBoundingClientRect();

        return {
          id: iframeElement.dataset.powershowId ?? "",
          type:
            iframeElement.dataset.powershowType === "scripted"
              ? ("scripted" as const)
              : ("embed" as const),
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        };
      }),
    );
    const ordinaryTarget = target.closest<HTMLElement>("[data-powershow-id]");
    const { elementTarget, target: hitTarget } = resolveCanvasPointerHit({
      embeds: iframeElements,
      embedTarget,
      ordinaryTarget,
    });
    const contentSlotTarget = target.closest<HTMLElement>(
      "[data-powershow-content-slot-id]",
    );
    const selection = resolveCanvasPointerSelection(
      hitTarget,
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

    const draggable =
      selection.documentElement.type === "container"
        ? isContainerCanvasDraggable(selection.documentElement)
        : selection.documentElement.type === "text"
          ? selection.documentElement.layout?.position === "absolute"
        : selection.documentElement.type === "image" || selection.documentElement.type === "gallery" || selection.documentElement.type === "embed" || selection.documentElement.type === "scripted" || selection.documentElement.type === "code" || selection.documentElement.type === "terminal" || selection.documentElement.type === "table" || selection.documentElement.type === "blocks"
            ? selection.documentElement.layout?.position === "absolute"
          : selection.documentElement.type === "divider" || selection.documentElement.type === "topics" || selection.documentElement.type === "chart" || selection.documentElement.type === "interactive"
            ? selection.documentElement.layout?.position === "absolute"
            : false;

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
    } else if (selection.documentElement.type === "text" || selection.documentElement.type === "image" || selection.documentElement.type === "gallery" || selection.documentElement.type === "embed" || selection.documentElement.type === "scripted" || selection.documentElement.type === "code" || selection.documentElement.type === "terminal" || selection.documentElement.type === "table" || selection.documentElement.type === "blocks" || selection.documentElement.type === "divider" || selection.documentElement.type === "topics" || selection.documentElement.type === "chart" || selection.documentElement.type === "interactive") {
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
      elementId: selection.id,
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
                  if (element.type === "container") {
                    if (!drag.containerGeometry) {
                      return element;
                    }

                    return updateContainerForCanvasDrag(
                      element,
                      drag.deltaX,
                      drag.deltaY,
                      drag.containerGeometry,
                    );
                  }

                  if (element.type === "text") {
                    return drag.canonicalTextGeometry
                      ? updateCanonicalTextForCanvasDrag(element, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
                      : element;
                  }

                  if (element.type === "image") {
                    return drag.canonicalTextGeometry
                      ? updateCanonicalImageForCanvasDrag(element, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
                      : element;
                  }

                  if (element.type === "gallery" || element.type === "embed" || element.type === "scripted") {
                    return drag.canonicalTextGeometry
                      ? updateCanonicalSurfaceForCanvasDrag(element, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
                      : element;
                  }

                  if (element.type === "code" || element.type === "terminal" || element.type === "table" || element.type === "blocks") {
                    return drag.canonicalTextGeometry
                      ? updateCanonicalSurfaceForCanvasDrag(element, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry)
                      : element;
                  }
                  if (element.type === "divider" || element.type === "topics" || element.type === "chart" || element.type === "interactive") {
                    return updateCanonicalElementForCanvasDrag(element, drag.deltaX, drag.deltaY, drag.canonicalTextGeometry ?? {
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

                  return element;
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

  function handleCropPointerDown(
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
    operation: "move" | CropCanvasHandle,
  ) {
    const overlay = canvasCropOverlay;
    const image = selectedDocumentElement;
    if (!overlay || !image || image.type !== "image" || !cropEditingImageId) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasCropDragRef.current = {
      pointerId: event.pointerId,
      imageId: image.id,
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

  function commitCanvasCrop(crop: NonNullable<CanvasCropDragState["initialCrop"]>, imageId: string) {
    const normalized = normalizeCropCanvasValue(crop);
    const authored = presentation.slides[selectedSlideIndex]
      ? findElementById(presentation.slides[selectedSlideIndex].elements, imageId)
      : null;
    if (authored?.type !== "image" || areImageCropsEqual(authored.crop, normalized)) return;
    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) => index === selectedSlideIndex
        ? { ...slide, elements: updateElementById(slide.elements, imageId, (element) => element.type === "image" ? { ...element, crop: normalized } : element) }
        : slide),
    }));
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
    commitCanvasCrop(crop, drag.imageId);
  }

  function handleCropPointerCancel(event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    if (canvasCropDragRef.current?.pointerId !== event.pointerId) return;
    canvasCropDragRef.current = null;
    setCanvasCropPreview(null);
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
    if (cropEditingImageId || !selectedDocumentElement || !canvasResizeOverlay || !selectedSlide) {
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
    } else if (selectedDocumentElement.type === "image" || selectedDocumentElement.type === "gallery" || selectedDocumentElement.type === "embed" || selectedDocumentElement.type === "scripted" || selectedDocumentElement.type === "code" || selectedDocumentElement.type === "terminal" || selectedDocumentElement.type === "table" || selectedDocumentElement.type === "blocks") {
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
      elementId: selectedDocumentElement.id,
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
                  if (element.type === "container") {
                    if (!resize.containerResizeGeometry) {
                      return element;
                    }

                    return updateContainerForCanvasResize(
                      element,
                      resize.direction,
                      resize.deltaX,
                      resize.deltaY,
                      resize.containerResizeGeometry,
                    );
                  }
                  if (element.type === "text") {
                    return element;
                  }
                  if (element.type === "image") {
                    const locked = preserveImageProportion;
                    const proportional = locked
                      ? resolveProportionalResize(
                          resize.direction,
                          resize.deltaX,
                          resize.deltaY,
                          resize.initialWidthPx,
                          resize.initialHeightPx,
                        )
                      : undefined;
                    return resize.canonicalTextResizeGeometry
                      ? updateImageForCanvasResize(
                          element,
                          resize.direction,
                          resize.deltaX,
                          resize.deltaY,
                          resize.canonicalTextResizeGeometry,
                          proportional,
                        )
                      : element;
                  }
                  if (element.type === "gallery" || element.type === "embed" || element.type === "scripted") {
                    return resize.canonicalTextResizeGeometry
                      ? updateSurfaceForCanvasResize(element, resize.direction, resize.deltaX, resize.deltaY, resize.canonicalTextResizeGeometry)
                      : element;
                  }
                  if (element.type === "code" || element.type === "terminal" || element.type === "table" || element.type === "blocks") {
                    return resize.canonicalTextResizeGeometry
                      ? updateSurfaceForCanvasResize(element, resize.direction, resize.deltaX, resize.deltaY, resize.canonicalTextResizeGeometry)
                      : element;
                  }
                  if (element.type === "divider" || element.type === "topics" || element.type === "chart" || element.type === "interactive") return element;
                  return element;
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

  function addNamedPresentationPaletteColor(name: string, color: Color) {
    setPresentation((current) => {
      const result = addPaletteEntry(current, name, color);
      return result.ok ? result.presentation : current;
    });
  }

  function removePresentationPaletteColor(colorId: string) {
    setPresentation((current) => {
      const result = removePaletteEntry(current, colorId);
      return result.ok ? result.presentation : current;
    });
  }

  function renamePresentationPaletteColor(colorId: string, name: string) {
    setPresentation((current) => {
      const result = renamePaletteEntry(current, colorId, name);
      return result.ok ? result.presentation : current;
    });
  }

  function updatePresentationPaletteColor(colorId: string, color: Color) {
    setPresentation((current) => {
      const result = updatePresentationPaletteColorValue(current, colorId, color);
      return result.ok ? result.presentation : current;
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

          case "append-content-slot":
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

  function applyCustomLibraryRecipe(
    recipe: CustomLibraryElementRecipe,
  ): CustomLibraryApplyOutcome {
    if (!selectedSlide) {
      return { ok: false, reason: "invalid-recipe-application" };
    }

    const selectedElementId = selectedElement?.contentSlotId != null
      ? null
      : selectedElement?.id ?? null;
    const result = placeCustomLibraryElementRecipe(
      recipe,
      selectedSlide,
      presentation.slides,
      selectedElementId,
    );

    if (!result.ok) {
      return result;
    }

    setPresentation((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === selectedSlideIndex ? result.slide : slide,
      ),
    }));

    const appliedElement = findElementById(
      result.slide.elements,
      result.appliedElementId,
    );
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
  // BEGIN: BLOCKS AUTHORING CONTROLS
  //
  // Each creation allocates presentation-wide authoring ids from the
  // full slide inventory, validates the target through the pure
  // operations, and writes a canonical update. The returned id is the
  // freshly created BlockItem/BlockPart id; null means the target is
  // stale/invalid or the creation was refused.
  // ==========================================================

  function addRootBlock(blocksId: string): string | null {
    const outcome = addRootBlockToPresentation(presentation.slides, blocksId);

    if (!outcome) {
      return null;
    }

    setPresentation((current) => ({
      ...current,
      slides: outcome.slides,
    }));

    return outcome.createdId;
  }

  function addScopeChild(
    blocksId: string,
    scopeBlockId: string,
  ): string | null {
    const outcome = addScopeChildToPresentation(
      presentation.slides,
      blocksId,
      scopeBlockId,
    );

    if (!outcome) {
      return null;
    }

    setPresentation((current) => ({
      ...current,
      slides: outcome.slides,
    }));

    return outcome.createdId;
  }

  function addBlocksTextPart(
    blocksId: string,
    blockItemId: string,
  ): string | null {
    const outcome = addTextPartToPresentation(
      presentation.slides,
      blocksId,
      blockItemId,
    );

    if (!outcome) {
      return null;
    }

    setPresentation((current) => ({
      ...current,
      slides: outcome.slides,
    }));

    return outcome.createdId;
  }

  function addBlocksSocketPart(
    blocksId: string,
    blockItemId: string,
  ): string | null {
    const outcome = addSocketPartToPresentation(
      presentation.slides,
      blocksId,
      blockItemId,
    );

    if (!outcome) {
      return null;
    }

    setPresentation((current) => ({
      ...current,
      slides: outcome.slides,
    }));

    return outcome.createdId;
  }

  function createBlocksSocketValue(
    blocksId: string,
    ownerBlockId: string,
    socketPartId: string,
  ): string | null {
    const outcome = createSocketValueInPresentation(
      presentation.slides,
      blocksId,
      ownerBlockId,
      socketPartId,
    );

    if (!outcome) {
      return null;
    }

    setPresentation((current) => ({
      ...current,
      slides: outcome.slides,
    }));

    return outcome.createdId;
  }

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
  // BEGIN: STRUCTURED TABLE AUTHORING CONTROLS
  //
  // Structural Table mutations need globally-unique IDs, so they
  // run against the full presentation slides rather than the
  // single selected element updater.
  // ==========================================================

  const tableAuthoringControls: TableAuthoringControls = {
    onAddColumn: (tableId) => {
      setPresentation((current) => ({
        ...current,
        slides: addColumnToStructuredTable(current.slides, tableId),
      }));
    },

    onRemoveColumn: (tableId, index) => {
      setPresentation((current) => ({
        ...current,
        slides: removeColumnFromStructuredTable(current.slides, tableId, index),
      }));
    },

    onAddRow: (tableId) => {
      setPresentation((current) => ({
        ...current,
        slides: addRowToStructuredTable(current.slides, tableId),
      }));
    },

    onRemoveRow: (tableId, index) => {
      setPresentation((current) => ({
        ...current,
        slides: removeRowFromStructuredTable(current.slides, tableId, index),
      }));
    },

    onShowHeaderChange: (tableId, showHeader) => {
      setPresentation((current) => ({
        ...current,
        slides: setStructuredTableShowHeader(
          current.slides,
          tableId,
          showHeader,
        ),
      }));
    },
  };

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

      <Topbar>
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
            onChange={(event) => {
              const title = event.target.value;
              setPresentation((current) =>
                updatePresentationTitle(current, title),
              );
            }}
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
            {cropEditingImageId && selectedDocumentElement?.type === "image" && (
              <img
                key={`${cropEditingImageId}:${selectedDocumentElement.src}`}
                className={styles.canvasCropSourceLoader}
                src={selectedDocumentElement.src}
                alt=""
                draggable={false}
                data-crop-source-key={`${cropEditingImageId}:${selectedDocumentElement.src}`}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (
                    cropEditingImageId !== selectedDocumentElement.id ||
                    selectedDocumentElement.src !== image.getAttribute("src")
                  ) return;
                  setCropSourceMetrics({
                    key: `${selectedDocumentElement.id}:${selectedDocumentElement.src}`,
                    imageId: selectedDocumentElement.id,
                    src: selectedDocumentElement.src,
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  });
                }}
                onError={(event) => {
                  if (
                    cropEditingImageId === selectedDocumentElement.id &&
                    selectedDocumentElement.src === event.currentTarget.getAttribute("src")
                  ) {
                    setCropSourceMetrics(null);
                  }
                }}
              />
            )}
            {cropEditingImageId && canvasCropAppearance && (
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
            {cropEditingImageId && selectedDocumentElement?.type === "image" && canvasCropOverlay && (
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
                  src={selectedDocumentElement.src}
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
            {canvasResizeOverlay && !cropEditingImageId && (
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
              !cropEditingImageId &&
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
            hasCurrentSaveError={editorNotes.hasCurrentSaveError}
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
                  customLibraryRepository={customLibraryRepository}
                  onApplyCustomLibraryRecipe={applyCustomLibraryRecipe}
                  palette={presentation.palette}
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
                      colors={recentColors}
                      onAddColor={(color) => {
                        setRecentColors((current) => addRecentColor(current, color));
                      }}
                      onClearColors={() => {
                        setRecentColors(clearRecentColors());
                      }}
                      onMoveColor={(index, direction) => {
                        setRecentColors((current) => moveRecentColor(current, index, direction));
                      }}
                    >
                      <PresentationColorPaletteProvider
                        colors={presentation.palette?.colors ?? []}
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
                          cropEditingImageId={cropEditingImageId}
                          onCropEditingImageIdChange={(id) => {
                            setCropEditingMode(id);
                            if (id) setFocalEditingImageId(null);
                          }}
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
                          blocksAuthoringControls={{
                            onAddRootBlock: addRootBlock,
                            onAddScopeChild: addScopeChild,
                            onAddTextPart: addBlocksTextPart,
                            onAddSocketPart: addBlocksSocketPart,
                            onCreateSocketValue: createBlocksSocketValue,
                          }}
                          tableAuthoringControls={tableAuthoringControls}
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

                      <PresentationPaletteManager
                        colors={presentation.palette?.colors ?? []}
                        onAdd={addNamedPresentationPaletteColor}
                        onRename={renamePresentationPaletteColor}
                        onUpdate={updatePresentationPaletteColor}
                        onRemove={removePresentationPaletteColor}
                      />

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
