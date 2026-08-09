"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MouseEvent as ReactMouseEvent,
} from "react";

import type {
  PowerShowElement,
  Presentation,
} from "@powershow/document-schema";

import {
  renderSlide,
} from "@powershow/renderer";

import {
  ElementInspector,
} from "./element-inspector";

import {
  editorDemoPresentation,
} from "./editor-demo-presentation";

import {
  findElementById,
  updateElementById,
} from "./element-tree";

import styles from
  "./editor-workspace.module.css";


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

  const [
    presentation,
    setPresentation,
  ] = useState<Presentation>(
    () =>
      structuredClone(
        editorDemoPresentation,
      ),
  );

  // ==========================================================
  // END: DOCUMENTO EDITÁVEL
  // ==========================================================


  // ==========================================================
  // BEGIN: SELEÇÃO
  // ==========================================================

  const [
    selectedSlideIndex,
    setSelectedSlideIndex,
  ] = useState(0);


  const [
    selectedElement,
    setSelectedElement,
  ] = useState<SelectedElementInfo | null>(
    null,
  );

  // ==========================================================
  // END: SELEÇÃO
  // ==========================================================


  // ==========================================================
  // BEGIN: REFERÊNCIA DO CANVAS
  //
  // Usada apenas para aplicar o outline visual da seleção.
  // ==========================================================

  const slideCanvasRef =
    useRef<HTMLDivElement>(null);

  // ==========================================================
  // END: REFERÊNCIA DO CANVAS
  // ==========================================================


  // ==========================================================
  // BEGIN: SLIDE ATUAL
  // ==========================================================

  const selectedSlide =
    presentation.slides[
      selectedSlideIndex
    ];

  // ==========================================================
  // END: SLIDE ATUAL
  // ==========================================================


  // ==========================================================
  // BEGIN: ELEMENTO REAL SELECIONADO
  //
  // selectedElement guarda apenas dados de seleção da UI.
  // Aqui encontramos o objeto real dentro do documento.
  // ==========================================================

  const selectedDocumentElement =
    useMemo<PowerShowElement | null>(
      () => {
        if (
          !selectedSlide ||
          !selectedElement
        ) {
          return null;
        }


        return findElementById(
          selectedSlide.elements,
          selectedElement.id,
        );
      },
      [
        selectedSlide,
        selectedElement,
      ],
    );

  // ==========================================================
  // END: ELEMENTO REAL SELECIONADO
  // ==========================================================


  // ==========================================================
  // BEGIN: RENDERIZAÇÃO DO SLIDE
  //
  // O Editor usa o mesmo renderer do Player.
  // ==========================================================

  const renderedSlide =
    useMemo(
      () => {
        if (!selectedSlide) {
          return "";
        }


        return renderSlide(
          selectedSlide,
        );
      },
      [
        selectedSlide,
      ],
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

  useEffect(
    () => {
      const canvas =
        slideCanvasRef.current;


      if (!canvas) {
        return;
      }


      const previousSelections =
        canvas.querySelectorAll(
          ".powershow-editor-selected",
        );


      previousSelections.forEach(
        (element) => {
          element.classList.remove(
            "powershow-editor-selected",
          );
        },
      );


      if (!selectedElement) {
        return;
      }


      const candidates =
        canvas.querySelectorAll<HTMLElement>(
          "[data-powershow-id]",
        );


      const target =
        Array.from(
          candidates,
        ).find(
          (element) =>
            element.dataset
              .powershowId ===
            selectedElement.id,
        );


      target?.classList.add(
        "powershow-editor-selected",
      );
    },
    [
      renderedSlide,
      selectedElement,
    ],
  );

  // ==========================================================
  // END: OUTLINE DO ELEMENTO SELECIONADO
  // ==========================================================


  // ==========================================================
  // BEGIN: TROCA DE SLIDE
  //
  // A seleção de elemento é limpa ao trocar de slide.
  // ==========================================================

  function selectSlide(
    index: number,
  ) {
    setSelectedSlideIndex(
      index,
    );

    setSelectedElement(
      null,
    );
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

  function handleCanvasClick(
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    const target =
      event.target;


    if (
      !(target instanceof Element)
    ) {
      return;
    }


    const element =
      target.closest<HTMLElement>(
        "[data-powershow-id]",
      );


    if (!element) {
      setSelectedElement(
        null,
      );

      return;
    }


    const id =
      element.dataset.powershowId;

    const type =
      element.dataset.powershowType;


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
    update: (
      element: PowerShowElement,
    ) => PowerShowElement,
  ) {
    if (!selectedElement) {
      return;
    }


    setPresentation(
      (current) => ({
        ...current,

        slides:
          current.slides.map(
            (
              slide,
              index,
            ) => {
              if (
                index !==
                selectedSlideIndex
              ) {
                return slide;
              }


              return {
                ...slide,

                elements:
                  updateElementById(
                    slide.elements,
                    selectedElement.id,
                    update,
                  ),
              };
            },
          ),
      }),
    );
  }

  // ==========================================================
  // END: ATUALIZAÇÃO DO ELEMENTO SELECIONADO
  // ==========================================================


  // ==========================================================
  // BEGIN: EMPTY STATE
  // ==========================================================

  if (!selectedSlide) {
    return (
      <main
        className={
          styles.emptyState
        }
      >
        Presentation has no slides.
      </main>
    );
  }

  // ==========================================================
  // END: EMPTY STATE
  // ==========================================================


  return (
    <main
      className={
        styles.editor
      }
    >
      {/* =====================================================
          BEGIN: TOP BAR
          ===================================================== */}

      <header
        className={
          styles.topbar
        }
      >
        <div>
          <strong>
            PowerShow
          </strong>

          <span
            className={
              styles.topbarSection
            }
          >
            Editor
          </span>
        </div>


        <div
          className={
            styles.presentationTitle
          }
        >
          {presentation.title}
        </div>


        <div
          className={
            styles.status
          }
        >
          Local draft
        </div>
      </header>

      {/* =====================================================
          END: TOP BAR
          ===================================================== */}


      {/* =====================================================
          BEGIN: WORKSPACE
          ===================================================== */}

      <div
        className={
          styles.workspace
        }
      >
        {/* ===================================================
            BEGIN: SLIDE SIDEBAR
            =================================================== */}

        <aside
          className={
            styles.slideSidebar
          }
        >
          <div
            className={
              styles.panelHeader
            }
          >
            Slides
          </div>


          <div
            className={
              styles.slideList
            }
          >
            {presentation.slides.map(
              (
                slide,
                index,
              ) => {
                const selected =
                  index ===
                  selectedSlideIndex;


                return (
                  <button
                    key={slide.id}

                    type="button"

                    className={
                      selected
                        ? styles.slideItemSelected
                        : styles.slideItem
                    }

                    onClick={
                      () => {
                        selectSlide(
                          index,
                        );
                      }
                    }
                  >
                    <span
                      className={
                        styles.slideNumber
                      }
                    >
                      {index + 1}
                    </span>


                    <span>
                      {slide.title ||
                        "Untitled slide"}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </aside>

        {/* ===================================================
            END: SLIDE SIDEBAR
            =================================================== */}


        {/* ===================================================
            BEGIN: CANVAS
            =================================================== */}

        <section
          className={
            styles.canvasArea
          }
        >
          <div
            className={
              styles.canvasToolbar
            }
          >
            <span>
              Slide{" "}
              {selectedSlideIndex + 1}
            </span>


            <span>
              {selectedDocumentElement
                ? `${selectedDocumentElement.type} · ${selectedDocumentElement.id}`
                : "No element selected"}
            </span>


            <span>
              {presentation.aspectRatio}
            </span>
          </div>


          <div
            className={
              styles.canvasViewport
            }
          >
            <div
              ref={
                slideCanvasRef
              }

              className={
                styles.slideCanvas
              }

              onClick={
                handleCanvasClick
              }

              dangerouslySetInnerHTML={{
                __html:
                  renderedSlide,
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

        <aside
          className={
            styles.inspector
          }
        >
          <div
            className={
              styles.panelHeader
            }
          >
            Inspector
          </div>


          <div
            className={
              styles.inspectorContent
            }
          >
            {selectedDocumentElement ? (
              <ElementInspector
                element={
                  selectedDocumentElement
                }

                onUpdate={
                  updateSelectedElement
                }
              />
            ) : (
              <>
                {/* =============================================
                    BEGIN: SLIDE INSPECTOR
                    ============================================= */}

                <div
                  className={
                    styles.inspectorGroup
                  }
                >
                  <span
                    className={
                      styles.inspectorLabel
                    }
                  >
                    Slide
                  </span>

                  <strong>
                    {selectedSlide.title ||
                      "Untitled slide"}
                  </strong>
                </div>


                <div
                  className={
                    styles.inspectorGroup
                  }
                >
                  <span
                    className={
                      styles.inspectorLabel
                    }
                  >
                    ID
                  </span>

                  <code>
                    {selectedSlide.id}
                  </code>
                </div>


                <div
                  className={
                    styles.inspectorGroup
                  }
                >
                  <span
                    className={
                      styles.inspectorLabel
                    }
                  >
                    Root elements
                  </span>

                  <strong>
                    {
                      selectedSlide
                        .elements
                        .length
                    }
                  </strong>
                </div>


                <div
                  className={
                    styles.nextStep
                  }
                >
                  Click an element directly
                  on the canvas to inspect it.
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