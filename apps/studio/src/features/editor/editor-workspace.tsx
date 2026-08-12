"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import { renderFontResources, renderSlide } from "@powershow/renderer";

import {
  FontFaceResourceSchema,
  FontResourceSchema,
  getFontResourceFaces,
} from "@powershow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";

import type { StudioLocale } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { ElementInspector } from "./element-inspector";
import { ElementTreePanel } from "./element-tree-panel";
import { resolveCanvasPointerSelection } from "./canvas-pointer-selection-helpers";
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
  createElement,
  duplicateElement,
  findElementSiblingPosition,
  insertElementAfterId,
  moveElement,
  moveElementToSiblingIndexById,
  removeElementById,
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
}

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

export function EditorWorkspace() {
  const { locale, setLocale, t } = useStudioI18n();

  // ==========================================================
  // BEGIN: DOCUMENTO EDITÁVEL
  // ==========================================================

  const [presentation, setPresentation] = useState<Presentation>(() =>
    structuredClone(editorDemoPresentation),
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

  const [rightPanelView, setRightPanelView] = useState<"inspector" | "elements">(
    "inspector",
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
    if (!selectedSlide || !selectedElementPosition?.parentId) {
      return null;
    }

    const parent = findElementById(
      selectedSlide.elements,
      selectedElementPosition.parentId,
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
      const documentElement = id ? findElementById(selectedSlide?.elements ?? [], id) : null;

      if (documentElement && isCanvasDraggable(documentElement.style)) {
        candidate.classList.add("powershow-editor-draggable");
      }
    });

    if (!selectedElement) {
      return;
    }

    const target = Array.from(candidates).find(
      (element) => element.dataset.powershowId === selectedElement.id,
    );

    target?.classList.add("powershow-editor-selected");
  }, [locale, renderedSlide, selectedElement, selectedSlide]);

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
  }

  function getCanvasLayoutParent(
    canvas: HTMLDivElement,
    elementId: string,
  ): HTMLElement | null {
    if (!selectedSlide) {
      return null;
    }

    const position = findElementSiblingPosition(selectedSlide.elements, elementId);

    if (!position) {
      return null;
    }

    if (position.parentId === null) {
      return canvas.querySelector<HTMLElement>(".powershow-slide");
    }

    return Array.from(canvas.querySelectorAll<HTMLElement>("[data-powershow-id]")).find(
      (candidate) => candidate.dataset.powershowId === position.parentId,
    ) ?? null;
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element) || !selectedSlide) {
      return;
    }

    const elementTarget = target.closest<HTMLElement>("[data-powershow-id]");
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

    setSelectedElement({ id: selection.id, type: selection.type });

    if (!isCanvasDraggable(selection.documentElement.style) || !elementTarget) {
      return;
    }

    const layoutParent = getCanvasLayoutParent(event.currentTarget, selection.id);

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
    };
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = canvasDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drag.deltaX = (event.clientX - drag.startClientX) / drag.scaleX;
    drag.deltaY = (event.clientY - drag.startClientY) / drag.scaleY;
    drag.target.style.setProperty("translate", `${drag.deltaX}px ${drag.deltaY}px`);
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
              elements: updateElementById(slide.elements, drag.elementId, (element) => {
                const style = updatePlacementForCanvasDrag(
                  element.style,
                  drag.deltaX,
                  drag.deltaY,
                  drag.parentWidthPx,
                  drag.parentHeightPx,
                );

                return style === element.style ? element : { ...element, style };
              }),
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
            index === fontResourceIndex
              ? updatedResource.data
              : registeredFont,
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

        if (!selectedDocumentElement) {
          return {
            ...slide,

            elements: [...slide.elements, newElement],
          };
        }

        if (selectedDocumentElement.type === "container") {
          return {
            ...slide,

            elements: appendElementToContainer(
              slide.elements,
              selectedDocumentElement.id,
              newElement,
            ),
          };
        }

        return {
          ...slide,

          elements: insertElementAfterId(
            slide.elements,
            selectedDocumentElement.id,
            newElement,
          ),
        };
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

          <label className={styles.localeControl} title={t("locale.language")}>
            <span className={styles.localeIcon} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />

                <path d="M3 12h18" />

                <path d="M12 3a15 15 0 0 1 0 18" />

                <path d="M12 3a15 15 0 0 0 0 18" />
              </svg>
            </span>

            <select
              value={locale}
              aria-label={t("locale.language")}
              onChange={(event) => {
                setLocale(event.target.value as StudioLocale);
              }}
            >
              <option value="en">US</option>

              <option value="pt-BR">PT</option>
            </select>
          </label>

          {/* ======================================================
        END: STUDIO LANGUAGE SELECTOR
        ====================================================== */}

          {/* ======================================================
        BEGIN: LOCAL DRAFT STATUS
        ====================================================== */}

          <span className={styles.status}>{t("topbar.localDraft")}</span>

          {/* ======================================================
        END: LOCAL DRAFT STATUS
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

          <form
            autoComplete="off"
            className={styles.slideActions}>
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

            <span>{presentation.aspectRatio}</span>
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
               dangerouslySetInnerHTML={{
                __html: renderedSlide,
              }}
            />
          </div>
        </section>

        {/* ===================================================
            END: CANVAS
            =================================================== */}

        {/* ===================================================
            BEGIN: INSPECTOR
            =================================================== */}

        <aside className={styles.inspector}>
          <div className={styles.panelHeader}>
            <button
              className={rightPanelView === "inspector" ? styles.rightPanelTabActive : styles.rightPanelTab}
              type="button"
              aria-pressed={rightPanelView === "inspector"}
              onClick={() => setRightPanelView("inspector")}
            >
              {t("inspector.title")}
            </button>
            <button
              className={rightPanelView === "elements" ? styles.rightPanelTabActive : styles.rightPanelTab}
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
                onSelectElement={(element) => {
                  setSelectedElement({ id: element.id, type: element.type });
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
