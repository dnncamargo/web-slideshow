import type {
  PresentationElement,
  Slide,
  TopicItem,
} from "@web-slideshow/document-schema";
import {
  buildPresetStructure,
  createUniqueId,
  type SlideLayoutPreset,
} from "./preset-structure";

export type { SlideLayoutPreset } from "./preset-structure";


// ============================================================
// BEGIN: CLONE RECURSIVO DE ELEMENTO
//
// Ao duplicar um slide não copiamos apenas o ID do slide.
//
// Todos os elementos internos também recebem novos IDs,
// inclusive filhos de containers aninhados.
// ============================================================

function cloneElementWithUniqueIds(
  element: PresentationElement,
  usedIds: Set<string>,
): PresentationElement {
  const clone =
    structuredClone(
      element,
    );


  const id =
    createUniqueId(
      `${element.id}-copy`,
      usedIds,
    );


  usedIds.add(
    id,
  );


  if (
    clone.type ===
    "container"
  ) {
    return {
      ...clone,

      id,

      children:
        clone.children.map(
          (child) =>
            cloneElementWithUniqueIds(
              child,
              usedIds,
            ),
        ),
    };
  }



  if (
    clone.type ===
    "topics"
  ) {
    return {
      ...clone,

      id,

      items:
        clone.items.map(
          (item) =>
            cloneTopicItemRenewingBlocks(
              item,
              usedIds,
            ),
        ),
    };
  }


  if (
    clone.type ===
      "table" &&
    clone.mode ===
      "structured"
  ) {
    return {
      ...clone,

      id,

      columns:
        clone.columns.map(
          (column) => ({
            ...column,

            header: {
              ...column.header,

              children:
                cloneContentSlotElementsRenewingBlocksOnly(
                  column.header.children,
                  usedIds,
                ),
            },
          }),
        ),

      rows:
        clone.rows.map(
          (row) => ({
            ...row,

            cells:
              row.cells.map(
                (cell) => ({
                  ...cell,

                  children:
                    cloneContentSlotElementsRenewingBlocksOnly(
                      cell.children,
                      usedIds,
                    ),
                }),
              ),
          }),
        ),
    };
  }


  return {
    ...clone,

    id,
  };
}


/**
 * Renews ids of a cloned TopicsElement reached through the NORMAL
 * historical slide clone path.
 *
 * The Topics PresentationElement id follows the normal -copy convention,
 * and the TopicItem/ContentSlot structural ids are preserved. The
 * PresentationElements inside each ContentSlot keep their historical identity
 * rules while remaining independently cloned.
 */
function cloneTopicItemRenewingBlocks(
  item: TopicItem,
  usedIds: Set<string>,
): TopicItem {
  return {
    ...item,

    content: {
      ...item.content,

      children:
        cloneContentSlotElementsRenewingBlocksOnly(
          item.content.children,
          usedIds,
        ),
    },

    children:
      item.children.map(
        (child) =>
          cloneTopicItemRenewingBlocks(
            child,
            usedIds,
          ),
      ),
  };
}


/**
 * Blocks-only traversal for PresentationElements inside a ContentSlot
 * (TopicItem ContentSlot, Structured Table header/cell ContentSlot).
 *
 * Blocks roots are renewed, while every other PresentationElement keeps its own
 * id exactly and is only recursed into where nested content may live. This
 * preserves the historical duplicate-slide semantics for unrelated
 * ContentSlot elements while extending reachability to nested Blocks.
 *
 * Returns an independent clone in every case so the duplicated slide
 * never shares references with the source.
 */
function cloneContentSlotElementRenewingBlocksOnly(
  element: PresentationElement,
  usedIds: Set<string>,
): PresentationElement {
  if (
    element.type ===
    "blocks"
  ) {
    return cloneElementWithUniqueIds(
      element,
      usedIds,
    );
  }

  if (
    element.type ===
    "container"
  ) {
    return {
      ...structuredClone(
        element,
      ),

      children:
        element.children.map(
          (child) =>
            cloneContentSlotElementRenewingBlocksOnly(
              child,
              usedIds,
            ),
        ),
    };
  }

  if (
    element.type ===
    "topics"
  ) {
    return {
      ...structuredClone(
        element,
      ),

      items:
        element.items.map(
          (item) =>
            cloneTopicItemRenewingBlocks(
              item,
              usedIds,
            ),
        ),
    };
  }

  if (
    element.type ===
      "table" &&
    element.mode ===
      "structured"
  ) {
    return {
      ...structuredClone(
        element,
      ),

      columns:
        element.columns.map(
          (column) => ({
            ...column,

            header: {
              ...column.header,

              children:
                cloneContentSlotElementsRenewingBlocksOnly(
                  column.header.children,
                  usedIds,
                ),
            },
          }),
        ),

      rows:
        element.rows.map(
          (row) => ({
            ...row,

            cells:
              row.cells.map(
                (cell) => ({
                  ...cell,

                  children:
                    cloneContentSlotElementsRenewingBlocksOnly(
                      cell.children,
                      usedIds,
                    ),
                }),
              ),
          }),
        ),
    };
  }

  return structuredClone(
    element,
  );
}


function cloneContentSlotElementsRenewingBlocksOnly(
  elements: readonly PresentationElement[],
  usedIds: Set<string>,
): PresentationElement[] {
  return elements.map(
    (element) =>
      cloneContentSlotElementRenewingBlocksOnly(
        element,
        usedIds,
      ),
  );
}


// ============================================================
// END: CLONE RECURSIVO DE ELEMENTO
// ============================================================

// ============================================================
// BEGIN: SLIDE LAYOUT PRESETS
//
// O preset é somente uma ferramenta de autoria.
//
// Depois que o slide é criado, o documento contém apenas:
// - containers;
// - textos;
// - dimensões;
// - espaçamentos.
//
// Não armazenamos "preset: two-columns" no documento.
// ============================================================

// ============================================================
// BEGIN: CREATE SLIDE FROM PRESET
// ============================================================

export function createSlideFromPreset(
  preset: SlideLayoutPreset,
  usedIds: Set<string>,
): Slide {
  const slideId =
    createUniqueId(
      "slide",
      usedIds,
    );


  const root = buildPresetStructure(preset, slideId, usedIds);

  return {
    id: slideId,
    title: "Untitled slide",
    summary: "",
    speakerNotes: "",
    background: { color: "#0b1020" },
    elements: root === null ? [] : [root],
  };
}

// ============================================================
// END: CREATE SLIDE FROM PRESET
// ============================================================


// ============================================================
// END: SLIDE LAYOUT PRESETS
// ============================================================

// ============================================================
// BEGIN: CREATE BLANK SLIDE
//
// Mantemos esta função por compatibilidade com código existente.
// ============================================================

export function createBlankSlide(
  usedIds: Set<string>,
): Slide {
  return createSlideFromPreset(
    "blank",
    usedIds,
  );
}

// ============================================================
// END: CREATE BLANK SLIDE
// ============================================================

// ============================================================
// BEGIN: DUPLICATE SLIDE
//
// structuredClone garante independência de:
//
// - background;
// - metadata;
// - arrays;
// - objetos internos.
//
// Depois substituímos todos os IDs que precisam ser únicos.
// ============================================================

export function duplicateSlideWithUniqueIds(
  source: Slide,
  usedIds: Set<string>,
): Slide {
  const clone =
    structuredClone(
      source,
    );


  const id =
    createUniqueId(
      `${source.id}-copy`,
      usedIds,
    );


  return {
    ...clone,

    id,

    title:
      source.title.trim()
        ? `${source.title} copy`
        : "Untitled slide copy",

    elements:
      source.elements.map(
        (element) =>
          cloneElementWithUniqueIds(
            element,
            usedIds,
          ),
      ),
  };
}

// ============================================================
// END: DUPLICATE SLIDE
// ============================================================

// ============================================================
// BEGIN: MOVE SLIDE
//
// Move um slide de uma posição para outra.
//
// A função é pura:
// - não altera o array recebido;
// - preserva os objetos dos slides;
// - retorna uma nova ordem.
//
// Índices inválidos simplesmente mantêm a ordem atual.
// ============================================================

export function moveSlide(
  slides: readonly Slide[],
  fromIndex: number,
  toIndex: number,
): Slide[] {
  if (
    fromIndex < 0 ||
    fromIndex >= slides.length ||
    toIndex < 0 ||
    toIndex >= slides.length ||
    fromIndex === toIndex
  ) {
    return [
      ...slides,
    ];
  }


  const nextSlides = [
    ...slides,
  ];


  const slide =
    nextSlides[
      fromIndex
    ];


  if (!slide) {
    return nextSlides;
  }


  nextSlides.splice(
    fromIndex,
    1,
  );


  nextSlides.splice(
    toIndex,
    0,
    slide,
  );


  return nextSlides;
}

// ============================================================
// END: MOVE SLIDE
// ============================================================
