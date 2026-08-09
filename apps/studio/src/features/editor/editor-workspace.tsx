"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MouseEvent as ReactMouseEvent } from "react";

import { renderSlide } from "@powershow/renderer";

import { ElementInspector } from "./element-inspector";

import { editorDemoPresentation } from "./editor-demo-presentation";

import { findElementById, updateElementById } from "./element-tree";

// ============================================================
// BEGIN: SLIDE OPERATIONS
// ============================================================

import {
  createBlankSlide,
  duplicateSlideWithUniqueIds,
  moveSlide,
} from "./slide-operations";

// ============================================================
// END: SLIDE OPERATIONS
// ============================================================

import styles from "./editor-workspace.module.css";

// ============================================================
// BEGIN: TIPOS DO DOCUMENTO
// ============================================================

import type {
  PowerShowElement,
  Presentation,
  Slide,
} from "@powershow/document-schema";

// ============================================================
// END: TIPOS DO DOCUMENTO
// ============================================================

// ============================================================
// BEGIN: TIPOS DO EDITOR
// ============================================================

interface SelectedElementInfo {
  id: string;
  type: string;
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

  // ==========================================================
  // END: SELEÇÃO
  // ==========================================================

  // ==========================================================
  // BEGIN: REFERÊNCIA DO CANVAS
  //
  // Usada apenas para aplicar o outline visual da seleção.
  // ==========================================================

  const slideCanvasRef = useRef<HTMLDivElement>(null);

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

    if (!selectedElement) {
      return;
    }

    const candidates = canvas.querySelectorAll<HTMLElement>(
      "[data-powershow-id]",
    );

    const target = Array.from(candidates).find(
      (element) => element.dataset.powershowId === selectedElement.id,
    );

    target?.classList.add("powershow-editor-selected");
  }, [renderedSlide, selectedElement]);

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

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const element = target.closest<HTMLElement>("[data-powershow-id]");

    if (!element) {
      setSelectedElement(null);

      return;
    }

    const id = element.dataset.powershowId;

    const type = element.dataset.powershowType;

    if (!id || !type) {
      return;
    }

    setSelectedElement({
      id,
      type,
    });
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
  // BEGIN: CREATE SLIDE
  //
  // Novo slide é inserido imediatamente depois do atual.
  // ==========================================================

  function addSlide() {
    const insertionIndex = Math.min(
      selectedSlideIndex + 1,
      presentation.slides.length,
    );

    const newSlide = createBlankSlide(presentation.slides);

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
  }

  // ==========================================================
  // END: CREATE SLIDE
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
      `Delete slide "${selectedSlide.title || "Untitled slide"}"?`,
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

  function moveSelectedSlide(
    offset: -1 | 1,
  ) {
    const targetIndex =
      selectedSlideIndex +
      offset;


    if (
      targetIndex < 0 ||
      targetIndex >=
        presentation.slides.length
    ) {
      return;
    }


    setPresentation(
      (current) => ({
        ...current,

        slides:
          moveSlide(
            current.slides,
            selectedSlideIndex,
            targetIndex,
          ),
      }),
    );


    setSelectedSlideIndex(
      targetIndex,
    );
  }

  // ==========================================================
  // END: MOVE SELECTED SLIDE
  // ==========================================================

  // ==========================================================
  // BEGIN: EMPTY STATE
  // ==========================================================

  if (!selectedSlide) {
    return (
      <main className={styles.emptyState}>Presentation has no slides.</main>
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

      <header className={styles.topbar}>
        <div>
          <strong>PowerShow</strong>

          <span className={styles.topbarSection}>Editor</span>
        </div>

        <div className={styles.presentationTitle}>{presentation.title}</div>

        <div className={styles.status}>Local draft</div>
      </header>

      {/* =====================================================
          END: TOP BAR
          ===================================================== */}

      {/* =====================================================
          BEGIN: WORKSPACE
          ===================================================== */}

      <div className={styles.workspace}>
        {/* ===================================================
            BEGIN: SLIDE SIDEBAR
            =================================================== */}

        <aside className={styles.slideSidebar}>
          {/* =================================================
              BEGIN: SLIDE HEADER
              ================================================= */}

          <div className={`${styles.panelHeader} ${styles.slidePanelHeader}`}>
            <span>Slides</span>

            <button
              type="button"
              className={styles.slideHeaderButton}
              onClick={addSlide}
              title="Add slide"
            >
              + New
            </button>
          </div>

          {/* =================================================
              END: SLIDE HEADER
              ================================================= */}

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

                  <span>{slide.title || "Untitled slide"}</span>
                </button>
              );
            })}
          </div>
          {/* =================================================
              BEGIN: SLIDE ACTIONS
              ================================================= */}

          {/* =================================================
              BEGIN: SLIDE ACTIONS
              ================================================= */}

          <div
            className={
              styles.slideActions
            }
          >
            {/* ===============================================
                MOVE UP
                =============================================== */}

            <button
              type="button"

              className={
                styles.slideActionButton
              }

              disabled={
                selectedSlideIndex ===
                0
              }

              onClick={
                () => {
                  moveSelectedSlide(
                    -1,
                  );
                }
              }

              title="Move slide up"
            >
              ↑ Up
            </button>


            {/* ===============================================
                MOVE DOWN
                =============================================== */}

            <button
              type="button"

              className={
                styles.slideActionButton
              }

              disabled={
                selectedSlideIndex ===
                presentation.slides.length -
                  1
              }

              onClick={
                () => {
                  moveSelectedSlide(
                    1,
                  );
                }
              }

              title="Move slide down"
            >
              ↓ Down
            </button>


            {/* ===============================================
                DUPLICATE
                =============================================== */}

            <button
              type="button"

              className={
                styles.slideActionButton
              }

              onClick={
                duplicateSelectedSlide
              }
            >
              Duplicate
            </button>


            {/* ===============================================
                DELETE
                =============================================== */}

            <button
              type="button"

              className={`${styles.slideActionButton} ${styles.slideActionDanger}`}

              disabled={
                presentation.slides.length <=
                1
              }

              onClick={
                deleteSelectedSlide
              }
            >
              Delete
            </button>
          </div>

          {/* =================================================
              END: SLIDE ACTIONS
              ================================================= */}

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
            <span>Slide {selectedSlideIndex + 1}</span>

            <span>
              {selectedDocumentElement
                ? `${selectedDocumentElement.type} · ${selectedDocumentElement.id}`
                : "No element selected"}
            </span>

            <span>{presentation.aspectRatio}</span>
          </div>

          <div className={styles.canvasViewport}>
            <div
              ref={slideCanvasRef}
              className={styles.slideCanvas}
              onClick={handleCanvasClick}
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
          <div className={styles.panelHeader}>Inspector</div>

          <div className={styles.inspectorContent}>
            {selectedDocumentElement ? (
              <ElementInspector
                element={selectedDocumentElement}
                onUpdate={updateSelectedElement}
              />
            ) : (
              <>
                {/* =============================================
                    BEGIN: SLIDE INSPECTOR
                    ============================================= */}

                {/* ===========================================
                    BEGIN: SLIDE TITLE
                    =========================================== */}

                <label className={styles.field}>
                  <span>Title</span>

                  <input
                    type="text"
                    value={selectedSlide.title}
                    placeholder="Untitled slide"
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
                  <span className={styles.inspectorLabel}>ID</span>

                  <code>{selectedSlide.id}</code>
                </div>

                <div className={styles.inspectorGroup}>
                  <span className={styles.inspectorLabel}>Root elements</span>

                  <strong>{selectedSlide.elements.length}</strong>
                </div>

                <div className={styles.nextStep}>
                  Click an element directly on the canvas to inspect it.
                </div>

                {/* =============================================
                    END: SLIDE INSPECTOR
                    ============================================= */}
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
